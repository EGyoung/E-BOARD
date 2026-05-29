# 元素缩放功能实现文档

## 概述

元素缩放功能允许用户选中画布上的元素后，通过拖拽控制点来自由缩放元素的大小。实现位于 `packages/board-core/src/plugins/selection/index.ts` 的 `SelectionPlugin` 中。

## 交互流程

```
选中元素 → 显示 AABB 包围框 + 8个控制点 → 拖拽控制点 → 实时缩放元素 → 松手完成
```

1. 用户点击/框选元素后，在所有选中元素的 AABB（轴对齐包围盒）上显示 8 个控制点
2. 鼠标悬停控制点时显示对应方向的 resize 光标
3. 按下并拖拽控制点，实时计算新的包围盒尺寸并应用到所有选中元素
4. 松手后结束缩放

## 控制点布局

```
 nw ---- n ---- ne
 |              |
 w              e
 |              |
 sw ---- s ---- se
```

8 个控制点分布在 AABB 的 4 个角和 4 条边的中点。

## 核心实现

### 1. 控制点渲染（DOM 方式）

控制点使用 DOM 元素实现（而非 canvas 绘制），原因是 canvas 方式在拖拽移动时需要每帧清除重绘，容易产生残影。

```typescript
private drawHandles(_ctx, box) {
  // 为每个方向创建一个 absolute 定位的 div
  // 设置 left/top 定位到 AABB 对应位置
  // pointerEvents: none —— 不拦截事件，由 hitTestHandles 判断命中
}
```

关键属性：
- `position: absolute` 相对于画板容器定位
- `pointer-events: none` 不参与事件捕获，点击判定由 `hitTestHandles` 处理
- `z-index: 999` 确保在画布上层

### 2. 控制点命中检测

```typescript
private hitTestHandles(point: { x: number; y: number }): ResizeHandle | null
```

在 `pointerdown` 时调用，判断鼠标是否落在某个控制点的热区内（HANDLE_SIZE/2 + 2px 容差）。

### 3. 缩放计算核心 —— `applyResizeToModels`

缩放的核心思路是：**根据拖拽前后的 AABB 变化，计算缩放比例，然后将比例应用到每个元素上。**

```
scaleX = newAABB.width / origAABB.width
scaleY = newAABB.height / origAABB.height
```

#### 对角固定原则

拖拽某个方向的控制点时，对面保持不动：
- 拖 `e`（右边）→ 左边不动，只改 width
- 拖 `nw`（左上角）→ 右下角不动，改 x/y/width/height

实现方式：根据 `activeHandle` 包含的方向字母（n/s/e/w）决定修改哪些属性：

```typescript
if (handle.includes("e")) { newW = orig.width + deltaX; }
if (handle.includes("w")) { newX = orig.x + deltaX; newW = orig.width - deltaX; }
if (handle.includes("s")) { newH = orig.height + deltaY; }
if (handle.includes("n")) { newY = orig.y + deltaY; newH = orig.height - deltaY; }
```

### 4. 两类元素的缩放策略

#### 有 width/height 的元素（rect、picture、text）

这类元素由一个锚点 `points[0]` + `width`/`height` 描述其几何形状。

缩放时：
1. 将锚点从世界坐标转到屏幕坐标
2. 计算锚点在新 AABB 中的相对位置（按比例映射）
3. 将新屏幕坐标转回世界坐标作为新锚点
4. 按 scaleX/scaleY 缩放 width/height

```typescript
const screenAnchor = transformService.transformPoint(anchor);
const newScreenX = newAABB.x + (screenAnchor.x - orig.x) * scaleX;
const newScreenY = newAABB.y + (screenAnchor.y - orig.y) * scaleY;
const newWorldAnchor = transformService.transformPoint({ x: newScreenX, y: newScreenY }, true);
const newWidth = initialSize.width * scaleX;
const newHeight = initialSize.height * scaleY;
```

#### 只有 points 的元素（line、arrow、手绘线条）

这类元素由多个点描述路径，没有 width/height。

缩放时：对每个点执行相同的坐标映射：
1. 世界坐标 → 屏幕坐标
2. 在屏幕坐标下按比例映射到新 AABB
3. 屏幕坐标 → 世界坐标

```typescript
const sp = transformService.transformPoint(p);          // 世界→屏幕
const newSx = newAABB.x + (sp.x - orig.x) * scaleX;   // 比例映射
const newSy = newAABB.y + (sp.y - orig.y) * scaleY;
return transformService.transformPoint({ x: newSx, y: newSy }, true); // 屏幕→世界
```

### 5. 坐标系转换

所有缩放计算在**屏幕坐标系**下进行：
- AABB 包围框是屏幕坐标（已经过 transformService 的 zoom + pan 变换）
- 鼠标事件的 clientX/Y 是屏幕坐标
- 计算完成后通过 `transformPoint(p, true)` 转回世界坐标存入 model

这样做的好处是：缩放计算不需要关心当前的画布 zoom/pan 状态。

### 6. 最小尺寸限制

```typescript
const MIN_ELEMENT_SIZE = 10; // 世界坐标下的最小尺寸
```

防止元素被缩放到不可见或负值。

## 光标样式

| 控制点 | 光标 |
|--------|------|
| nw, se | nwse-resize |
| ne, sw | nesw-resize |
| n, s   | ns-resize |
| e, w   | ew-resize |

通过 `pointermove` 监听实现悬停时切换光标，拖拽过程中锁定光标方向。

## 状态管理

缩放开始时保存的初始状态：
- `resizeStartAABB` — 开始拖拽时的 AABB 位置和尺寸
- `initialModelPositions` — 每个选中 model 的初始 points
- `initialModelSizes` — 每个选中 model 的初始 width/height（如果有）

拖拽过程中基于初始状态 + 鼠标偏移量计算，避免累积误差。

## 生命周期

- 选中元素 → 创建 DOM 控制点
- 取消选中 / 切换模式 → `removeHandles()` 移除 DOM
- 插件销毁 → `dispose()` 中清理所有 DOM 和事件监听
