# E-Board 漫游性能优化方案

## 背景

画布在大量元素（1 万个矩形）场景下漫游（平移/缩放）FPS 仅 30，目标提升至 60。

---

## 一、问题分析

### 原始渲染流程

```
wheel 事件 → transformService.setView() → renderService.reRender() → _render()
```

每次漫游触发 `_render()`，执行以下操作：

1. `tileManager.clear()` — 清除空间索引
2. `context.clearRect()` — 清空整个画布
3. `context.setTransform()` — 设置缩放平移矩阵
4. 遍历 **全部** 元素 → `new comp.render()` → 逐个绘制

### 瓶颈定位

| 瓶颈 | 影响 | 耗时占比 |
|------|------|---------|
| 每帧遍历全部 N 个元素逐个绘制 | O(N) 绘制调用，N=10000 时每帧 10000 次 Canvas API 调用 | **主要瓶颈** |
| 每帧 `new comp.render(board)` 创建渲染器 | N 次对象分配，触发 GC | 次要 |
| 每帧 `tileManager.clear()` 清除空间索引 | 下次 model 变更前需要全量重建 | 次要 |

**核心矛盾**：漫游时元素本身没有变化，只是视角在移动，但每帧都在重复绘制所有元素。

---

## 二、优化方案：OffscreenCanvas 位图缓存

### 核心思路

> 漫游时不逐个绘制元素，而是将所有元素预渲染到 OffscreenCanvas，漫游时只做一次 `drawImage` 位图搬运。

```
                  元素变化时（一次性）                   漫游时（每帧）
┌─────────────────────────────────────┐    ┌──────────────────────────────┐
│  遍历所有元素                         │    │  计算视口偏移                  │
│  ↓                                   │    │  ↓                           │
│  绘制到 OffscreenCanvas（世界坐标）    │    │  context.drawImage()         │
│  ↓                                   │    │  ↓                           │
│  offscreenDirty = false              │    │  完成（O(1)）                 │
└─────────────────────────────────────┘    └──────────────────────────────┘
```

### 性能对比

| 场景 | 优化前 | 优化后 |
|------|--------|--------|
| 漫游（1 万元素） | 每帧 10000 次绘制调用 → ~30 FPS | 每帧 1 次 drawImage → ~60 FPS |
| 移动单个元素 | 脏矩形局部重绘 → 流畅 | 不变，仍走脏矩形路径 |
| 新建/删除元素 | 脏矩形局部重绘 → 流畅 | 不变 + 标记 offscreen 需重建 |

---

## 三、实现细节

### 修改文件清单

```
packages/board-core/src/services/renderService/index.ts   ← 主要改动
packages/board-core/src/elements/baseElement/baseRender.ts
packages/board-core/src/elements/rectElement/render/index.ts
packages/board-core/src/elements/lineElement/render/index.ts
packages/board-core/src/elements/arrowElement/render/index.ts
packages/board-core/src/elements/pictureElement/render/index.ts
packages/board-core/src/elements/textElement/render/index.ts
```

### 3.1 三种渲染模式

`RenderService._render()` 现在根据场景分发到三条路径：

```
_render()
  ├── currentRanges 有值？
  │     ├── lastRenderWasOffscreen？
  │     │     └── YES → _renderDirect() 全量重绘（模式切换，一次性）
  │     └── NO → _renderDirtyRect()  脏矩形局部重绘
  │
  └── currentRanges 为空（视图变化 / 初始渲染）
        ├── offscreenDirty？→ _rebuildOffscreen() 重建离屏画布
        └── drawImage() 位图搬运到主画布
```

#### 模式 1：OffscreenCanvas 漫游渲染

**触发条件**：`currentRanges == null`（无元素变化，纯视图变化）

```typescript
// 1. 如果 offscreen 脏了，重建
if (this.offscreenDirty || !this.offscreenCanvas) {
  this._rebuildOffscreen(models);
}

// 2. 一次 drawImage 完成渲染
context.save();
context.setTransform(1, 0, 0, 1, 0, 0);  // 重置到原始像素空间
const dx = (worldMinX - view.x) * zoom * dpr;
const dy = (worldMinY - view.y) * zoom * dpr;
const dw = sw * zoom * dpr;
const dh = sh * zoom * dpr;
context.drawImage(offscreenCanvas, sx, sy, sw, sh, dx, dy, dw, dh);
context.restore();
this.lastRenderWasOffscreen = true;
```

#### 模式 2：脏矩形渲染

**触发条件**：`currentRanges != null && !lastRenderWasOffscreen`（元素增删改，画布状态一致）

保持原有逻辑不变：清除脏区域 → clip → 只重绘脏区域内的元素。

#### 模式 3：模式切换全量渲染

**触发条件**：`currentRanges != null && lastRenderWasOffscreen`

漫游结束后首次编辑元素时触发。做一次全量直接渲染将画布从"位图状态"恢复为"元素逐个绘制状态"，使后续脏矩形渲染能正常工作。

```typescript
if (this.lastRenderWasOffscreen) {
  this.lastRenderWasOffscreen = false;
  this.currentRanges = null;
  // 全量直接渲染
  this._renderDirect(context, models, view);
  // 重建瓦片索引（视图可能已变化）
  this.tileManager.clear();
  this.rebuildTileIndex();
  return;
}
```

**这是一次性成本**，只在漫游→编辑切换时发生一次。

### 3.2 OffscreenCanvas 重建（`_rebuildOffscreen`）

```
1. 遍历所有 model，计算世界坐标包围盒 (minX, minY, maxX, maxY)
2. 加 padding，计算离屏画布尺寸 w × h
3. 尺寸检查：超过 8192px 则回退到直接绘制（防止显存溢出）
4. 创建/复用 OffscreenCanvas
5. ctx.translate(-minX, -minY)：偏移到世界坐标原点
6. 遍历所有 model，以世界坐标（isViewChanged=true）绘制
7. offscreenDirty = false
```

**关键点**：

- 离屏画布使用**世界坐标**，1 世界像素 = 1 离屏像素
- `drawImage` 时通过 `zoom * dpr` 缩放到屏幕像素
- 仅在 `offscreenDirty` 时重建，漫游期间复用缓存

### 3.3 渲染器改造（使用传入的 context）

所有渲染器原来硬编码 `this.board.getCtx()` 获取上下文：

```typescript
// 改造前
public render = (model, _: any, isViewChanged = false) => {
  const context = this.board.getCtx();  // 只能画到主画布
  ...
}

// 改造后
public render = (model, ctx: any, isViewChanged = false) => {
  const context = ctx || this.board.getCtx();  // 可以画到任意 canvas
  ...
}
```

这使得渲染器可以绘制到 OffscreenCanvas。改动涉及 5 个元素渲染器 + 1 个基类。

### 3.4 Render Handler 缓存

```typescript
// 改造前：每帧每元素 new 一个渲染器
const renderHandler = new comp.render(this.board);

// 改造后：按类型缓存，只创建一次
private renderHandlerCache = new Map<string, any>();

let renderHandler = this.renderHandlerCache.get(model.type);
if (!renderHandler) {
  renderHandler = new comp.render(this.board);
  this.renderHandlerCache.set(model.type, renderHandler);
}
```

消除每帧 N 次对象分配的 GC 压力。

### 3.5 `offscreenDirty` 标记管理

```typescript
private handleModelOperationChange = (event) => {
  this.offscreenDirty = true;  // 元素变化 → 标记 offscreen 需重建
  // ... 脏矩形逻辑不变
}
```

offscreen 仅在下次进入漫游渲染路径时才会重建（懒重建），不会在编辑期间浪费性能。

---

## 四、坐标系说明

系统中存在三个坐标系，理解它们是避免渲染 bug 的关键：

```
世界坐标 (World)          屏幕坐标 (Screen)        原始像素 (Raw Pixel)
model.points 存储的值    transformPoint 转换后     canvas.width/height 空间
与视图无关              考虑 zoom + offset        考虑 zoom + offset + dpr

    世界 ──── ×zoom, -offset ────→ 屏幕 ──── ×dpr ────→ 原始像素
```

| 渲染路径 | 渲染器坐标系 | 画布 transform |
|---------|-------------|---------------|
| OffscreenCanvas | 世界坐标 (`isViewChanged=true`) | `translate(-minX, -minY)` |
| drawImage 搬运 | — | `setTransform(1,0,0,1,0,0)` + dx/dy 偏移 |
| 脏矩形 | 屏幕坐标 (`isViewChanged=false`) | DPR 缩放（canvasService 初始化） |
| 模式切换全量渲染 | 世界坐标 | `setTransform(dpr*zoom, ..., -view.x*dpr*zoom, ...)` |

---

## 五、限制与回退

| 条件 | 行为 |
|------|------|
| 世界包围盒 > 8192px | 回退到 `_renderDirect` 全量逐个绘制 |
| 元素无 `points` 数据 | 跳过该元素的包围盒计算 |
| `OffscreenCanvas` API 不可用 | 代码中直接使用，现代浏览器均支持 |

---

## 六、渲染状态机

```
                    ┌─────────────────────────┐
                    │                         │
                    ▼                         │
              ┌───────────┐   视图变化    ┌────────────┐
              │  编辑模式   │ ──────────→ │  漫游模式    │
              │ (Direct/   │             │ (Offscreen   │
              │  DirtyRect)│ ←────────── │  drawImage)  │
              └───────────┘  首次元素变化  └────────────┘
                    │         （一次性       │
                    │        全量重绘）       │
                    ▼                         │
              ┌───────────┐                   │
              │  脏矩形     │                   │
              │  局部重绘   │ ──────────────────┘
              └───────────┘    视图变化
```

**状态转换**：
- **编辑→漫游**：自然切换，offscreen 在漫游首帧懒重建
- **漫游→编辑**：检测 `lastRenderWasOffscreen`，做一次全量 `_renderDirect` 重置画布
- **编辑中**：脏矩形局部重绘（不触发 offscreen 重建）
