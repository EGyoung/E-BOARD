# 橡皮擦实现说明

## 背景

橡皮擦功能参考 `packages/ai_studio_code (6).html` 中的白板原型实现。原型的关键思路是：橡皮擦移动时记录擦除路径，用擦除路径和已有笔迹线段做碰撞检测，被命中的笔迹不整条删除，而是切分成多个未被擦到的片段。

当前项目落地为 `EraserPlugin`，底部工具栏通过 `EraserToolHandler` 切换到 `eraser` 模式。

## 代码入口

- 工具栏模式：`packages/board-workbench/src/stageTool/types.ts`
- 工具栏注册：`packages/board-workbench/src/stageTool/registry/registerDefaultTools.ts`
- 工具栏按钮图标：`packages/board-workbench/src/stageTool/components/ToolButton.tsx`
- 工具栏 handler：`packages/board-workbench/src/stageTool/handlers/EraserToolHandler.ts`
- 核心插件：`packages/board-core/src/plugins/eraser/index.ts`
- 几何算法：`packages/board-core/src/plugins/eraser/geometry.ts`
- 类型定义：`packages/board-core/src/plugins/eraser/type.ts`
- 插件导出：`packages/board-core/src/plugins/index.ts`
- App 注册：`app/src/App.tsx`

## 工具栏接入

底部工具栏是 registry 驱动的：

1. `ToolMode` 增加 `ERASER = 'eraser'`。
2. `EraserToolHandler` 调用 `modeService.switchMode('eraser')`。
3. `registerDefaultTools` 在画笔和选择之间注册 `eraser`。
4. `StageTool` 将 eraser tools 放进第一组工具，顺序为：画笔、橡皮擦、选择。
5. `ToolButton` 为 `eraser` 增加内联 SVG 图标。

橡皮擦是持续模式工具，不是一次性 action tool。因此必须设置 `mode: ToolMode.ERASER`，否则点击后不会保持 active 状态。

## 数据流

1. 用户点击底部工具栏的“橡皮擦”。
2. `EraserToolHandler` 调用 `modeService.switchMode('eraser')`。
3. `EraserPlugin` 在 `eraser` 模式激活后监听 pointer 事件，并将 interaction canvas cursor 设为 `none`。
4. pointer down 时创建一次擦除事务，记录第一颗世界坐标点。
5. pointer move 时持续记录 eraser path，并对 line model 做命中检测和 fragment 计算。
6. 命中 line 后，原 line 会被临时从 modelService 删除，但删除操作使用 `OperationSource.REMOTE`，避免进入历史栈。
7. 剩余 fragments 不作为临时 model 写入 modelService，而是直接画在 interaction canvas 上。
8. pointer up 时恢复临时隐藏的原 line，再用 `historyService.startBatch()` / `historyService.endBatch()` 提交真实删除和 fragment 创建。
9. 因此一次擦除在撤销栈中表现为一个批量动作。

## 实时预览策略

最终采用的实时预览策略是：

- **底层 render canvas**：通过临时删除命中的原 line，让底层不再显示被擦的完整原线。
- **上层 interaction canvas**：直接绘制当前剩余 fragments 和橡皮擦圆形光标。
- **提交时**：清理预览状态，恢复原 line，然后在一个 history batch 中执行真实删除和真实 fragment 创建。

这样做的原因：

- 如果只在 interaction canvas 画 fragment，底层原线还在，拖动时看不到擦除效果。
- 如果把 fragment 作为临时 model 写进 modelService，会被 renderService 的异步渲染、脏区索引和删除顺序影响，容易出现残影或概率性多余线段。
- 直接在 interaction canvas 画 fragment，不进入真实模型层，状态边界更清晰。

## 算法说明

### 命中检测

`isStrokeHitByEraserSegment` 使用两阶段检测：

1. 对 line points 和最新 eraser segment 分别计算 bbox，并加入 line width / eraser radius padding。
2. bbox 相交后，再逐段计算 line segment 与 eraser segment 的最短距离。

当最短距离小于 `eraserRadius + lineWidth / 2` 时，认为 line 被命中。

### 片段切分

`calculateStrokeFragments` 使用完整 eraser path 重新计算当前受影响 line 的剩余片段：

1. 将每个 line segment 转成参数区间 `[0, 1]`。
2. 根据橡皮擦点、橡皮擦线段和综合半径计算该 segment 上被擦掉的区间。
3. 对平行或重叠的 eraser segment，额外把 eraser segment 两端投影到 stroke segment 上，生成完整覆盖区间，避免只擦掉最近点附近。
4. 合并重叠擦除区间。
5. 反推出保留区间，并在区间边界插入新点。
6. 连续保留区间组成 fragment。
7. 只保留点数大于 1 的 fragment。

### 快速书写线条的采样

快速书写时，原始 `line.points` 会比较稀疏，但 line renderer 会用二次曲线平滑渲染。若直接按稀疏点做擦除，擦除边缘会不贴合视觉线条。

当前处理方式：

- 擦除前对命中的 line 做加密采样。
- 采样不使用简单直线插点，而是尽量复用 line renderer 的路径逻辑：
  - 2 个点：按直线采样。
  - 3 个及以上点：按现有 renderer 的 quadratic curve 逻辑采样。
- 加密采样后的点用于命中检测、fragment 切分、实时预览和最终提交。

这样可以减少两类问题：

- 快速画线时橡皮擦边缘和视觉线条不贴合。
- 线条第一次被命中时，未擦除部分突然从“平滑曲线”变成“直线折线”。

## 坐标体系

- pointer 事件先转成 canvas 屏幕坐标。
- 参与模型计算前，通过 `transformService.transformPoint(point, true)` 转成世界坐标。
- interaction canvas 上的光标和实时预览使用屏幕坐标。
- 新建 line fragment 时保存世界坐标 points。
- `getEraserRadius()` 会根据当前 zoom 把屏幕上的橡皮擦半径换算成世界坐标半径。

## 踩过的坑

### 1. 只在 interaction canvas 画 fragment，看起来不会实时擦除

第一版实时预览只把剩余 fragments 画到 interaction canvas。问题是原始 line 仍然在 render canvas 上，所以用户拖动时仍然看到完整原线，只有 pointer up 后真实删除原 line 才能看到效果。

结论：实时擦除必须让底层原线在视觉上消失。当前方案是拖动时临时隐藏命中的原 line。

### 2. 临时 fragment model 会导致概率性多余线段

第二版为了让底层同步变化，把 fragment 也作为临时 model 写入 modelService。虽然使用了 `OperationSource.REMOTE` 避免进入 history，但它仍然进入了 renderService、tile index 和异步渲染流程。

表现：

- 擦除过程中概率性出现额外线段。
- 预览 fragment 和真实提交之间可能有短暂残影。
- 快速移动时，临时 model 删除/创建和 render frame 顺序不稳定。

结论：预览数据不要进入真实 modelService。当前方案是只把原 line 临时隐藏，fragments 直接画在 interaction canvas。

### 3. renderService 会清空 interaction canvas，导致橡皮光标消失

renderService 的重绘流程会清空 interaction canvas。拖动过程中如果触发 render，刚画好的橡皮光标会被清掉，看起来像“按住移动时橡皮消失，抬手后才出现”。

解决方式：监听 `renderService.onRenderEnd`，每次渲染结束后重新绘制 overlay，包括 fragments 和橡皮光标。

### 4. 两点线段从中间擦除时容易整段消失

如果只在最近点插入一个 erased split point，两点线段被橡皮从中间穿过时，会得到一个被擦掉的中间点，两侧都只有单点 fragment，最后因为 fragment 点数小于 2 被丢弃，整条线就没了。

解决方式：改成区间切分。擦除命中的是 segment 上的一段区间，而不是单个点；保留区间边界会插入新点，因此两侧 fragment 都能保留为两点线段。

### 5. 单点 eraser path 无法擦到线段内部

pointer down 后如果还没移动，eraser path 只有一个点。只遍历 eraser segment 时没有任何 segment 可算，会导致按住不动时擦不到线段内部。

解决方式：`calculateStrokeFragments` 对单点 eraser path 单独处理，将 eraser point 投影到 stroke segment 上，生成擦除区间。

### 6. 零长度 eraser segment 会影响距离计算

pointer move 可能产生重复点，形成零长度 eraser segment。普通 segment-to-segment 距离算法在这种情况下可能返回错误的 stroke 参数 `t`，导致漏擦。

解决方式：`minDistanceBetweenSegments` 对零长度 segment 加分支：

- 两条 segment 都是点：返回点距。
- stroke segment 是点：计算该点到 eraser segment 的距离。
- eraser segment 是点：把该点投影到 stroke segment，返回投影位置和距离。

### 7. 平行或重叠线段只擦掉最近点附近

如果 eraser segment 和 stroke segment 平行或重叠，只根据最短距离点生成一个小区间，会出现“橡皮沿线擦过，但只擦掉中间一小段”的问题。

解决方式：对平行情况额外计算 eraser segment 两端在 stroke segment 上的投影区间，再按橡皮半径扩展该区间。

### 8. 快速书写后未擦除部分突然变化

快速书写线条点少，原线用 quadratic curve 渲染。如果擦除时把原线直线加密，再用现有 renderer 画 fragment，就会从“原始曲线”跳成“加密折线再曲线化”，视觉上未擦除部分会突然变化。

解决方式：加密采样尽量沿 line renderer 的 quadratic curve 逻辑进行，而不是简单直线插值。

### 9. 按住橡皮越久帧率越低

早期实现每次 `pointermove` 都用完整 `eraserPath` 重新切分所有已命中的线条。`eraserPath` 会随着按住时间持续增长，因此单帧计算量会越来越大，表现为越擦越卡。

解决方式：改成增量擦除。每次移动只使用最新一段橡皮路径 `[previousPoint, currentPoint]` 继续切当前剩余 fragments，并把 `eraserPath` 控制在最近两个点。这样单帧切分成本与按住时长解耦。

## 当前限制

- 只擦除 `type === 'line'` 且 points 数量大于 1 的手写线条。
- 不擦除图片、文本、矩形等元素。
- 暂未提供 UI 控件调整橡皮擦大小；插件导出 `setEraserSize(size)` 作为后续接入点。
- 暂未提供“整条擦除”策略切换。
- fragment 提交后会保存为加密采样后的 points，因此数据点数量会比原始快速书写线条更多。

## 后续优化方向

- 在工具栏或浮动设置面板中接入橡皮擦尺寸调节。
- 增加整条擦除策略，并在插件内部通过策略函数切换。
- 为 `geometry.ts` 增加正式测试框架覆盖，包括：
  - 两点线段中间擦除。
  - 单点 eraser path。
  - 零长度 eraser segment。
  - 平行/重叠擦除。
  - 快速书写稀疏点擦除。
- 支持更多元素类型的擦除或删除。
- 如果后续希望完全保留原始曲线形状，可考虑保存原始 stroke 曲线参数或使用更接近 renderer 的路径布尔运算，而不是提交加密采样 points。
