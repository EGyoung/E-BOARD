# Dirty Region Rendering Design

为 E-BOARD 引入「脏区域渲染（Dirty Region Rendering）」的设计说明。

## 背景

目前 `RenderService` 的渲染流程是：

- 任何 `ModelService` 的变更（创建 / 更新 / 删除 / 清空）都会触发一次重绘；
- 在 `reRender` 中：
  - `clearRect` 清空整个主画布；
  - 遍历 `modelService.getAllModels()`，根据 `model.type` 找到对应 handler，重新绘制所有模型。

问题：

- 模型数量一多（大量涂鸦、元素）时，每次小的变更都要全量重绘；
- 在高缩放 / 低性能设备上，会导致明显掉帧。

目标：

- 每次只重绘「变化附近」的局部区域（dirty region），而不是整个画布；
- 保持现有插件体系（`DrawPlugin`、`DrawShapePlugin`、`PicturePlugin` 等）的使用体验；
- 尽量少改公共接口，做到向后兼容。

---

## 总体设计

整体方案分为三层：

1. **模型层（`ModelService`）**

   - 为每一次模型操作（`CREATE`/`UPDATE`/`DELETE`/`CLEAR`）计算对应的「脏区域」；
   - 将 `dirtyRegion` 附加在 `ModelChangeEvent` 上，通过 `onModelOperation` 广播出去；
   - 对于不适合局部重绘的操作（例如 `CLEAR`），不携带脏区，让渲染层退回全量重绘。

2. **渲染层（`RenderService`）**

   - 持有一个脏区队列 `dirtyRegions: IRect[]`；
   - 订阅 `ModelService.onModelOperation`，根据 `event.dirtyRegion` 决定：
     - 有脏区：合并 / 累加到队列，走增量渲染 `reRenderDirty()`；
     - 无脏区：退回现有的全量渲染 `reRender()`；
   - 在增量渲染时：
     - 对每个脏区只 `clearRect` 对应的区域；
     - 遍历所有模型，利用各自的包围盒（`ctrlElement.getBoundingBox(model)`），只绘制与脏区相交的模型。

3. **插件层（`ctrlElement`）**
   - 各模型类型通过 `ctrlElement.getBoundingBox(model)` 提供自己在画布上的包围盒；
   - `ModelService` 与 `RenderService` 不关心具体几何形状（线条、矩形、图片等），只依赖这个包围盒；
   - 已有插件（如 `DrawPlugin`）中已经实现了 `getBoundingBox`，可以直接复用。

---

## 坐标系与数据结构约定

### IRect

在 core 层定义一个统一的矩形类型：

```ts
export interface IRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
```

这是脏区和模型包围盒在内部传递时的标准结构。

### 坐标系

约定：

- 所有用于计算脏区和包围盒的坐标，都是**画布像素坐标**；
- 插件内部如果在模型数据中存的是逻辑坐标（例如未缩放的坐标），应由插件在 `getBoundingBox` 里自行通过 `TransformService` 转换成画布坐标；
- 当前 `DrawPlugin` 的 `getBoundingBox` 已经是通过 `transformService.transformPoint` 做了转换，符合要求。

### Padding（扩展半径）

为了避免描边、阴影等超出几何包围盒造成视觉残留，可以定义一个简单工具函数来扩展矩形：

```ts
export function expandRect(rect: IRect, padding: number): IRect {
  return {
    minX: rect.minX - padding,
    minY: rect.minY - padding,
    maxX: rect.maxX + padding,
    maxY: rect.maxY + padding
  };
}
```

`ModelService` 在最终生成 `dirtyRegion` 时可以统一加上一个小的 padding（例如 2～4 像素）。

---

## ModelService 设计

### 扩展 ModelChangeEvent

在 `packages/core/src/services/modelService/type.ts` 中，为事件增加脏区字段（可选）：

```ts
export interface ModelChangeEvent {
  type: ModelChangeType;
  modelId: string;
  model?: IModel;
  updates?: Partial<Omit<IModel, "id">>;
  previousState?: Partial<Omit<IModel, "id">>;
  deletedModels?: Map<string, IModel>;
  dirtyRegion?: IRect; // 新增
}
```

### 统一计算脏区的辅助方法

在 `ModelService` 内部增加两个私有方法：

1. `computeModelBBox(model: IModel): IRect | undefined`

   - 封装从 `ctrlElement.getBoundingBox(model)` 转为 `IRect` 的过程；
   - 若模型没有 ctrlElement 或没有 getBoundingBox，则返回 `undefined`，此时上层可以退回全量渲染。

2. `emitOperationWithDirty(event: Omit<ModelChangeEvent, "dirtyRegion">)`
   - 根据 `event.type` 和模型信息决定如何计算脏区；
   - 计算出 `dirtyRegion` 后，调用 `expandRect` 扩一点 padding，再统一 `fire` 事件。

示意性逻辑（不要求一字不差地实现）：

- `CREATE`：`dirtyRegion = 当前模型的 bbox`
- `UPDATE`：理想情况是「更新前后的 bbox 并集」，简单版本可以只使用更新后的 bbox
- `DELETE`：`dirtyRegion = 被删除模型的 bbox`
- `CLEAR`：不生成 `dirtyRegion`，交给渲染层做人畜无害的全量重绘（`event.dirtyRegion === undefined`）

统一之后，`createModel/updateModel/deleteModel/clearModels` 只需要构造对应的 `ModelChangeEvent`（不带 `dirtyRegion`），然后交给 `emitOperationWithDirty` 去算并发出去。

### 保持 onModelChange 的兼容性

目前 `RenderService` 使用的是 `onModelChange` 做「有变就重绘」的订阅。

引入 `dirtyRegion` 后：

- 推荐做法是：`RenderService` 改为订阅 `onModelOperation`（可以同时保留 `onModelChange` 的兼容逻辑）；
- 其他依赖 `onModelChange` 的模块可以不改，只是仍然会以「有变就知道」的形式收到通知，不关心脏区。

---

## RenderService 设计

### 新增脏区状态

在 `RenderService` 中维护一个简单的 `dirtyRegions` 列表：

```ts
class RenderService implements IRenderService {
  // ...
  private dirtyRegions: IRect[] = [];
}
```

同时可以在 `IRenderService` 接口中增加一个可选的：

```ts
clearDirtyRegions(): void;
```

用于在视图变换等场景下清空脏区。

### 订阅 ModelService.onModelOperation

将 `initModelChange` 改为基于 `onModelOperation`：

- 如果事件带 `dirtyRegion`：加入队列，触发 `reRenderDirty`；
- 否则：回到原来的 `reRender` 全量重绘。

例如伪代码：

```ts
private initModelChange() {
  const { dispose } = this.modelService.onModelOperation(event => {
    if (event.dirtyRegion) {
      this.enqueueDirtyRegion(event.dirtyRegion);
      this.reRenderDirty();
    } else {
      this.reRender();
    }
  });
  this.disposeList.push(dispose);
}
```

### 合并与使用脏区

初期可以非常简单：

- `enqueueDirtyRegion` 只是 `push` 到数组；
- `getMergedDirtyRegions` 暂时直接返回 `dirtyRegions`，未来有性能压力时再做合并优化（如把重叠区域合并成一个更大的矩形）。

渲染逻辑 `_renderDirty`：

1. 拿到当前已合并的脏区列表；
2. 对每个脏区：
   - `clearRect` 清理主画布对应区域；
   - 遍历全部模型，通过各自 `ctrlElement.getBoundingBox` 得到包围盒；
   - 判断包围盒与当前脏区是否相交（矩形相交判断）；
   - 若相交，则以与 `_render` 一致的方式调用 handler 绘制该模型。

矩形相交判断可用标准逻辑：

```ts
private isIntersecting(a: IRect, b: IRect): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}
```

绘制时复用原来 `_render` 中的流程：

- 使用 `initContextAttrs` 统一设置 `lineWidth`、`strokeStyle` 等；
- context 的 zoom 从 `TransformService.getView().zoom` 获取；
- 每个模型调用 handler 前 `context.beginPath()`，调用后 `context.stroke()`。

最终，在 `_renderDirty` 结束时清空 `dirtyRegions`。

### 与全量渲染 `_render` 的关系

现有 `_render` 除了清全画布 + 全量绘制之外，不需要大改：

- `_render` 仍然是「一次全量刷新」的标准逻辑；
- `reRender` 仍然是通过 `requestAnimationFrame` 节流 `_render` 的公开接口；
- 增加的 `reRenderDirty` 走的是 `_renderDirty` 分支；
- 当操作类型不提供脏区（如 `CLEAR` 或未来的大范围 batch 操作），仍然调用 `reRender`，保证完整刷新。

---

## TransformService 与大操作的处理

### 视图变换：缩放 / 平移

`TransformService.setView` 中在更新 `x/y/zoom` 后，目前会直接调用 `renderService.reRender()`。

可选增强：

- 在调用 `reRender` 前先调用 `renderService.clearDirtyRegions()`；
- 理由：视图变换会让所有模型的屏幕位置发生改变，之前的 `dirtyRegions` 已经没有意义，直接抛弃即可。

### 清空 / 撤销 / 重做 / 批量操作

关于「一次性大量改变模型」的操作：

- 简单版本：不尝试做局部优化，直接通过 `CLEAR` / 批量更新触发全量 `reRender`；
- 若未来对撤销/重做有更细粒度优化需求，可以在 `ModelService` 里增加类似 `startBatch/endBatch` 的机制，在一个 batch 里合并大量 dirtyRegion，然后统一发一个事件。

在脏区机制的初版里，不强求对所有大操作都做得特别智能，先保证语义正确和结构清晰。

---

## 插件层设计与约定

### 已有插件

`DrawPlugin` 中的 `createCtrlElement` 已经提供了：

- `getBoundingBox(model)`：通过所有 `points`（已转换成画布坐标）计算 `minX/minY/maxX/maxY`；
- `isHint`：用于命中测试。

这类 `getBoundingBox` 完全可以直接被 `ModelService` 和 `RenderService` 复用。

### 新增 / 其他插件的约定

以后开发新插件时，推荐：

1. 必须在 `ctrlElement` 上提供 `getBoundingBox(model)`；
2. 返回值包含 `{ x, y, width, height }` 或直接 `{ minX, minY, maxX, maxY }`，如果返回前一种，由 `ModelService` 统一转换；
3. 坐标需为画布坐标，即已经把缩放、平移因素考虑进去（可以通过 `TransformService` 完成）。

### 抽取可复用工具

为了减少重复代码，可以在 `utils` 或 `core/common` 中提供一些通用 bbox 工具，例如：

- `calcPolylineBBox(points, padding)`：给一组点计算包围盒并加上 padding；
- `calcRectBBox({ x, y, width, height }, padding)`：给矩形增加 padding。

插件只需要调用这些工具而不必重复写 bbox 计算逻辑。

---

## 性能与后续优化方向

当前设计是一个**简单、易实现的脏区渲染版本**，在此基础上还有几条可选优化路线：

1. **脏区合并优化**

   - 目前 `getMergedDirtyRegions` 可以简单返回 `dirtyRegions`；
   - 当每帧脏区数量较多时，可以尝试用简单的合并算法（如扫描线合并、网格合并），减少实际需要重绘的矩形数量。

2. **OffscreenCanvas 缓存 + Patch 渲染**

   - 现在增量逻辑只操作主画布；
   - 可进一步把「真实的绘制」放在 `offscreenCanvas` 上，主画布只做 `drawImage` 把对应 dirty 区域画上来；
   - 好处：主画布可以叠加其他 UI 图层（如选区、工具条）时更易控。

3. **空间索引（Spatial Index）**

   - 当前是「每个脏区 × 所有模型」的 O(N\*M) 检查；
   - 模型非常多时，可考虑用网格、四叉树或简单 R-Tree 管理模型的包围盒，快速找到与特定 rect 相交的候选模型。

4. **事件批处理**
   - 在绘制过程中（例如自由绘制一条线）会不断产生 `UPDATE`；
   - 可以借鉴 `HistoryService.startBatch/endBatch` 的思路，对一连串操作只在末尾发一个合并后的 `dirtyRegion` 事件，进一步减少渲染次数。

---

## 小结

本设计在不强制大规模重构的前提下，引入了一个清晰、可扩展的脏区域渲染机制：

- 通过在 `ModelChangeEvent` 中携带 `dirtyRegion`，将「哪里的内容变了」从模型层传递到渲染层；
- `RenderService` 使用 `dirtyRegions` 控制局部清理与重绘，保持与现有绘制流程极高的一致性；
- 插件层仅需保证提供可靠的 `ctrlElement.getBoundingBox`，就能自然受益于这一机制；
- 同时预留了 offscreen 缓存、空间索引、批量脏区合并等后续升级点。

---

## 进一步的设计与性能优化方向

下面是基于当前方案可以继续演进的一些改进点，方便后续按需实现：

### 1. 区分逻辑脏区与渲染脏区

- 逻辑脏区（world/model space）：只描述模型在世界坐标系下的变化范围。
- 渲染脏区（screen/canvas space）：在渲染阶段通过 `TransformService` 把逻辑脏区投影到画布坐标，再加 padding。

好处：`ModelService` 不依赖 `TransformService`，只关心模型本身；`RenderService` 则根据当前视图把逻辑脏区转换成可直接 `clearRect` 的区域，视图变化时也更容易重算。

### 2. 支持多模型/全局级别的脏区

目前 `dirtyRegion` 的语义偏向「单模型」。可以抽象成更通用的结构，例如：

```ts
type DirtyRegionSource =
  | { type: "model"; modelId: string; rect: IRect }
  | { type: "multi-model"; modelIds: string[]; rect: IRect }
  | { type: "full"; reason: "clear" | "zoom-change" | "batch" };
```

这样在批量移动、成组变换、撤销/重做等场景下，可以用一个大的并集 bbox 表达「一次大改动」，而不是退回到彻底的全量重绘。

### 3. 规范 UPDATE 的前后 bbox 合并

文档中已提到 UPDATE 理想情况是「变更前后 bbox 的并集」，可以明确为标准行为：

- 在 `updateModel` 前读取旧模型并计算 `oldBBox`；
- 更新后计算 `newBBox`；
- 通过 `unionRects(oldBBox, newBBox)` 得到最终脏区。

这有助于避免实现时只考虑新状态，导致某些「移出原位置」的像素没有被清理干净。

### 4. 按帧合并脏区（Frame-level 合帧）

当前已经使用 `requestAnimationFrame` 节流重绘，可以进一步明确策略：

- `enqueueDirtyRegion`：只负责把本次事件产生的脏区加入队列；
- `reRenderDirty`：只在「当前没有挂起的 RAF」时注册一个新的帧回调；
- RAF 回调中：统一读取本帧内收集到的所有 `dirtyRegions`，做必要合并后再渲染一次。

这样在自由绘制时，高频的模型事件会自然被合并为「每帧一次局部重绘」，而不是以事件频率渲染。

### 5. 按类型/图层分桶模型

在渲染时，目前是对所有模型做 bbox 相交判断。可以在 `RenderService` 内对模型进行简单分桶：

- 静态图层（例如背景网格、参考线）：单独渲染到一个背景 offscreen，通常不参与脏区机制；
- 动态图层（涂鸦、选中框、形状）：参与 dirty region 检测与增量渲染；
- 甚至可以按 `model.type` 或逻辑图层拆成多个数组，减少不必要的相交判断。

这可以在后期模型数量很大时显著降低「脏区 × 模型」的总检查开销。

### 6. 交互期模型与最终模型的区分

以自由绘制为例，一条线的中间点数可能很多：

- 交互过程：高度推荐只在 interaction canvas 上实时画预览，不频繁对 ModelService 做 UPDATE；
- 交互结束（鼠标抬起）：一次性将整条线写入 ModelService，触发一次带脏区的 CREATE 事件。

在设计上可以在文档中约定：

> 交互类插件优先采用「交互层实时绘制 + 结束时一次性落盘为模型」的模式，从源头上减少 ModelService 与 RenderService 的压力。

### 7. 脏区 padding 的自适应策略

当前 padding 是一个固定像素值。可以结合 `model.options` 或 `ctrlElement` 提供的信息，做更智能的扩展：

- 根据 `lineWidth`、`shadowBlur` 等动态增加 padding；
- 允许 `getBoundingBox` 返回时附带一个建议 padding 字段；
- 对不同类型的模型（如图片 vs 粗线条）使用不同的默认 padding。

这样可以在不过度浪费重绘面积的前提下，保证视觉上不会有描边/阴影残留。

### 8. 利用 HistoryService 精细化撤销/重做脏区

当前设计中，撤销/重做等大操作可以简单退回到全量重绘。未来可以与 `HistoryService` 对接：

- 从历史记录中拿到「本次操作影响到的模型集合」；
- 对这些模型的旧状态和新状态分别计算 bbox 并集；
- 用这个合并结果作为一次较精确的大脏区，而不是整个画布。

这样在复杂文档上多次撤销/重做时，也能保持良好的帧率表现。

### 9. 抽取通用几何工具与调试可视化

- 将 `expandRect`、`isIntersecting`、`unionRects` 等几何函数抽到统一的 util 模块，方便插件和服务共享；
- 在开发模式下提供一个「显示脏区」的调试开关：
  - 在 `_renderDirty` 结束后，用半透明矩形或描边把本帧的脏区画在一个调试层上；
  - 方便快速验证 `dirtyRegion` 是否计算正确，有无遗漏或过大。

这些不会影响核心逻辑，但对排查问题和后续优化非常有帮助。
