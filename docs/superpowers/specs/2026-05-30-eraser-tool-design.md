# 橡皮擦工具设计

## 背景

当前项目的 README 中仍将橡皮擦列为待完成能力，包含“基础擦除整条线段”和“局部擦除功能”。

## 目标

- 在底部工具栏新增橡皮擦按钮。
- 橡皮擦按钮使用自绘 SVG 图标，视觉上比文本或简单符号更精致。
- 新增橡皮擦模式，拖动橡皮擦时对已有手写 line 元素进行局部擦除。
- 参考 HTML 原型的实时擦除思路：命中检测、临时片段计算、鼠标抬起后提交删除和重建。
- 将擦除实现落盘成独立文档，说明算法、数据流、限制和后续扩展。

## 非目标

- 不实现图片、文本、矩形等非 line 元素的擦除。
- 不在本次实现中提供“整条擦除 / 局部擦除”用户切换开关。
- 不改变现有 line 元素的持久化结构。
- 不重构整个绘制插件或工具栏架构。

## 推荐方案

采用“局部擦除为默认行为，内部保留策略扩展边界”的方案。

对用户来说，橡皮擦表现为真实局部擦除：擦到线条中间时，线条会被切开，只保留未被橡皮擦覆盖的部分。对代码来说，擦除能力应尽量封装为独立插件和几何工具函数，避免把擦除算法散落到工具栏、渲染服务或 line renderer 中。

## 现有代码接入点

### 底部工具栏

底部工具栏由 `packages/board-workbench/src/stageTool` 维护：

- `StageTool.tsx` 管理工具栏展开、收起和 active tool 状态。
- `registry/registerDefaultTools.ts` 注册默认工具。
- `components/ToolButton.tsx` 根据 tool id 渲染图标。
- `handlers/*ToolHandler.ts` 负责工具激活后的业务动作。

实现时新增 `eraser` 工具注册项，并新增对应 handler。橡皮擦是持续模式工具，不是一次性 action tool。

### 模式服务

`packages/board-core/src/services/modeService` 维护当前画布模式。现有绘制工具通过 handler 调用 `modeService.switchMode('draw')`。橡皮擦应新增独立模式，例如 `eraser`，避免复用 `draw` 后在 draw plugin 内部分支过多。

### 手写线条数据

手写笔迹最终是 line model：

- `points` 保存世界坐标点序列。
- `options` 保存颜色、线宽等渲染配置。
- line renderer 根据 points 绘制平滑线条。

局部擦除不改变 line 的数据结构，而是删除被擦到的原 line，再用未擦除的 fragment points 创建多个新 line。

## 交互设计

1. 用户点击底部工具栏的橡皮擦按钮。
2. 工具栏 active 状态切换到橡皮擦。
3. 画布进入 eraser 模式。
4. 鼠标或触控按下后开始一次擦除事务。
5. 拖动时记录橡皮擦路径，并实时计算受影响 line 的剩余片段。
6. 画布渲染临时擦除预览，让被擦掉的部分即时消失。
7. 鼠标或触控抬起后提交事务：删除原 line，创建剩余 line fragment。
8. 若没有命中任何 line，则不产生模型变更。

## SVG 图标设计

橡皮擦图标使用内联 SVG：

- 主体为倾斜圆角矩形，体现橡皮擦外形。
- 橡皮前端用浅粉或浅橙填充，尾部用蓝紫或灰色区分。
- 使用描边和小高光增强质感。
- 图标应遵循现有 `ToolButton` 的尺寸和颜色体系，在 active 和 hover 状态下仍清晰可辨。

SVG 放在 `ToolButton.tsx` 的 icon mapping 中，或提取为局部组件。若现有图标都在 `ToolButton.tsx` 内联，优先保持一致。

## 擦除算法

算法参考 HTML 原型中的 `handleEraserMove`、`calculateStrokeFragments` 和 `commitRealtimeErase`。

### 一次擦除事务状态

一次拖动期间维护：

- `eraserPath`：橡皮擦经过的点序列。
- `affectedLines`：已命中的原 line model 集合。
- `tempFragments`：每个命中 line 当前计算出的剩余点段。

### 命中检测

每次移动时只使用最新的橡皮擦线段做增量命中检测：

1. 构造最新 eraser segment：上一个橡皮擦点到当前点。
2. 根据 eraser radius 和 line width 生成 segment bbox。
3. 使用 line bbox 做粗筛，减少逐线段距离计算。
4. 对候选 line 的相邻点段计算 segment-to-segment 最短距离。
5. 当距离小于 `eraserRadius + lineWidth / 2` 时，认为 line 被本次擦除事务影响。

### 片段切分

对每条受影响 line，用完整 eraser path 重新计算剩余 fragments：

1. 克隆 line points，并为每个点附加临时 `erase` 标记。
2. 遍历 line segment 与 eraser segment。
3. 当相交距离小于综合半径，在线段内部插入 split point。
4. 标记落入擦除范围的点。
5. 连续未擦除点组成一个 fragment。
6. 长度大于 1 的 fragment 才会保留为新 line。

### 提交变更

鼠标抬起后：

1. 收集所有 `affectedLines`。
2. 删除这些原 line。
3. 根据 `tempFragments` 创建新的 line models。
4. 新 line 继承原 line 的 `options`，points 使用 fragment points。
5. 清理事务状态并触发重绘。

## 渲染与坐标

现有 draw plugin 在交互 canvas 上使用屏幕坐标预览，在创建 model 时保存世界坐标。橡皮擦应沿用这一原则：

- 事件输入先转换为世界坐标，用于模型命中和 fragment 计算。
- 擦除范围 cursor 或 overlay 可在交互层用屏幕坐标绘制。
- 最终创建的新 line 使用世界坐标 points。

如果为了实时预览需要临时隐藏原 line、绘制 fragment，应避免修改真实 model，直到擦除事务提交。

## 撤销与重做

擦除提交应尽量走现有模型变更和命令机制，而不是直接修改内部数组。

一次擦除事务应在撤销栈中表现为一个动作：撤销后恢复被擦除的原 line，并移除新增 fragments；重做后再次删除原 line 并恢复 fragments。

若现有命令系统暂时不支持“删除多个元素并创建多个元素”的组合命令，本次实现应至少把相关代码集中在 eraser plugin 内，并在文档中记录限制，避免后续难以补齐。

## 错误处理与边界情况

- 没有命中 line 时，不创建空事务。
- fragment 点数小于 2 时丢弃，避免创建不可见 line。
- 快速拖动导致 eraser path 点间距较大时，使用 segment-to-segment 距离，避免只按点判断造成漏擦。
- line bbox 缺失时即时计算 bbox。
- 当前只处理 line 类型；其他元素应被跳过。
- 擦除过程中如果鼠标离开画布，应按 mouseup 提交当前事务。

## 测试策略

- 单元测试几何工具函数：点距线段、线段距线段、bbox 相交、fragment 切分。
- 手动验证工具栏：橡皮擦按钮显示、active 状态、与选择/画笔切换正常。
- 手动验证擦除：
  - 擦线条中间，得到左右两个 fragment。
  - 擦线条端点，只保留未擦除部分。
  - 擦过多条线，所有命中线都被局部切分。
  - 未擦到线条时不改变画布。
  - 撤销/重做行为符合预期或明确记录限制。

## 实现文档

除本设计规格外，实施完成后新增 `docs/eraser-implementation.md`。该文档面向后续维护者，记录实际落地代码路径、核心算法、与 HTML 原型的对应关系、当前限制和未来扩展点。
