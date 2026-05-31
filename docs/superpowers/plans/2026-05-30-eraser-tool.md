# Eraser Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a bottom-toolbar SVG eraser tool that locally erases hand-drawn line elements by splitting touched strokes into remaining fragments, and document the implementation.

**Architecture:** The work adds an `eraser` mode and a focused `EraserPlugin` in `board-core`. The plugin owns pointer handling and transaction state, while pure geometry helpers perform bbox filtering, segment-distance hit testing, and line-fragment splitting based on the reference HTML prototype. `board-workbench` only adds the toolbar mode, handler, registration, and polished SVG icon.

**Tech Stack:** TypeScript, React, Canvas 2D, existing EBoard plugin/service architecture, existing model/history/render services, Markdown docs.

---

## File Structure

### Create

- `packages/board-core/src/plugins/eraser/type.ts`
  - Defines local `Point`, `BBox`, `LineLikeModel`, `EraseTransactionState`, and geometry option types used by the eraser plugin.
- `packages/board-core/src/plugins/eraser/geometry.ts`
  - Pure helpers copied/adapted from `packages/ai_studio_code (6).html`: distance, bbox, segment distance, fragment splitting, affected-line detection.
- `packages/board-core/src/plugins/eraser/index.ts`
  - Registers `eraser` mode, listens to pointer events while active, previews erasing on the interaction canvas, commits model delete/create operations in a history batch.
- `packages/board-workbench/src/stageTool/handlers/EraserToolHandler.ts`
  - Switches the board mode to `eraser`.
- `docs/eraser-implementation.md`
  - Maintainer-facing implementation document requested by the user.

### Modify

- `packages/board-core/src/plugins/index.ts`
  - Export `EraserPlugin`.
- `app/src/App.tsx`
  - Register `EraserPlugin` with the app's board plugin list.
- `packages/board-workbench/src/stageTool/types.ts`
  - Add `ToolMode.ERASER = 'eraser'`.
- `packages/board-workbench/src/stageTool/handlers/index.ts`
  - Export `EraserToolHandler`.
- `packages/board-workbench/src/stageTool/registry/registerDefaultTools.ts`
  - Register the eraser tool near draw/select tools.
- `packages/board-workbench/src/stageTool/components/ToolButton.tsx`
  - Add the new SVG eraser icon.
- `README.md`
  - Mark eraser items as complete once implemented.

### Validation Commands

- `pnpm --filter @e-board/board-core build`
- `pnpm --filter @e-board/board-workbench build`
- `pnpm --filter app build` if the app package exposes a build script; otherwise use `pnpm build` as the integration build.
- Manual browser validation through `pnpm dev` and `http://localhost:3001`.

---

## Task 1: Add pure eraser geometry helpers

**Files:**
- Create: `packages/board-core/src/plugins/eraser/type.ts`
- Create: `packages/board-core/src/plugins/eraser/geometry.ts`
- Validate: `pnpm --filter @e-board/board-core build`

- [ ] **Step 1: Create eraser types**

Create `packages/board-core/src/plugins/eraser/type.ts` with this content:

```ts
import { IModel } from '../../services/modelService/type';

export interface Point {
  x: number;
  y: number;
}

export interface EraserPoint extends Point {
  erase?: boolean;
}

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface SegmentDistanceResult {
  distance: number;
  t: number;
}

export type LineModel = IModel<Record<string, any>> & {
  type: 'line';
  points: Point[];
};

export interface EraseTransactionState {
  eraserPath: Point[];
  affectedLines: Map<string, LineModel>;
  tempFragments: Map<string, Point[][]>;
}
```

- [ ] **Step 2: Create geometry implementation**

Create `packages/board-core/src/plugins/eraser/geometry.ts` with this content:

```ts
import { BBox, EraserPoint, Point, SegmentDistanceResult } from './type';

const EPSILON = 1e-7;
const SPLIT_EPSILON = 1e-3;

export const distance = (p1: Point, p2: Point) => {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
};

export const calculateBBox = (points: Point[], padding = 0): BBox | null => {
  if (!points.length) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  points.forEach(point => {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  });

  return {
    minX: minX - padding,
    minY: minY - padding,
    maxX: maxX + padding,
    maxY: maxY + padding,
  };
};

export const isBBoxIntersect = (b1: BBox | null, b2: BBox | null) => {
  if (!b1 || !b2) return false;

  return !(
    b2.minX > b1.maxX ||
    b2.maxX < b1.minX ||
    b2.minY > b1.maxY ||
    b2.maxY < b1.minY
  );
};

export const pointLineSegmentDistance = (point: Point, start: Point, end: Point) => {
  const l2 = (end.x - start.x) ** 2 + (end.y - start.y) ** 2;

  if (l2 === 0) return distance(point, start);

  let t = ((point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y)) / l2;
  t = Math.max(0, Math.min(1, t));

  return distance(point, {
    x: start.x + t * (end.x - start.x),
    y: start.y + t * (end.y - start.y),
  });
};

export const minDistanceBetweenSegments = (
  p1: Point,
  p2: Point,
  q1: Point,
  q2: Point,
): SegmentDistanceResult => {
  const u = { x: p2.x - p1.x, y: p2.y - p1.y };
  const v = { x: q2.x - q1.x, y: q2.y - q1.y };
  const w = { x: p1.x - q1.x, y: p1.y - q1.y };

  const a = u.x * u.x + u.y * u.y;
  const b = u.x * v.x + u.y * v.y;
  const c = v.x * v.x + v.y * v.y;
  const d = u.x * w.x + u.y * w.y;
  const e = v.x * w.x + v.y * w.y;
  const D = a * c - b * b;

  let sc: number;
  let sN: number;
  let sD = D;
  let tN: number;
  let tD = D;

  if (D < EPSILON) {
    sN = 0;
    sD = 1;
    tN = e;
    tD = c;
  } else {
    sN = b * e - c * d;
    tN = a * e - b * d;

    if (sN < 0) {
      sN = 0;
      tN = e;
      tD = c;
    } else if (sN > sD) {
      sN = sD;
      tN = e + b;
      tD = c;
    }
  }

  if (tN < 0) {
    tN = 0;
    if (-d < 0) {
      sN = 0;
    } else if (-d > a) {
      sN = sD;
    } else {
      sN = -d;
      sD = a;
    }
  } else if (tN > tD) {
    tN = tD;
    if (-d + b < 0) {
      sN = 0;
    } else if (-d + b > a) {
      sN = sD;
    } else {
      sN = -d + b;
      sD = a;
    }
  }

  sc = Math.abs(sN) < EPSILON ? 0 : sN / sD;
  const tc = Math.abs(tN) < EPSILON ? 0 : tN / tD;
  const dP = {
    x: w.x + sc * u.x - tc * v.x,
    y: w.y + sc * u.y - tc * v.y,
  };

  return {
    distance: Math.sqrt(dP.x * dP.x + dP.y * dP.y),
    t: sc,
  };
};

export const calculateStrokeFragments = (
  strokePoints: Point[],
  eraserPath: Point[],
  eraserRadius: number,
  strokeLineWidth = 1,
): Point[][] => {
  if (strokePoints.length < 2) return [];
  if (eraserPath.length < 1) return [strokePoints.map(point => ({ ...point }))];

  const currentPoints: EraserPoint[] = strokePoints.map(point => ({ ...point, erase: false }));
  const combinedRadius = eraserRadius + strokeLineWidth / 2;

  for (let i = currentPoints.length - 2; i >= 0; i--) {
    for (let j = 0; j < eraserPath.length - 1; j++) {
      const { distance: segmentDistance, t } = minDistanceBetweenSegments(
        currentPoints[i],
        currentPoints[i + 1],
        eraserPath[j],
        eraserPath[j + 1],
      );

      if (segmentDistance < combinedRadius && t > SPLIT_EPSILON && t < 1 - SPLIT_EPSILON) {
        const start = currentPoints[i];
        const end = currentPoints[i + 1];
        const splitPoint: EraserPoint = {
          x: start.x + t * (end.x - start.x),
          y: start.y + t * (end.y - start.y),
          erase: true,
        };
        currentPoints.splice(i + 1, 0, splitPoint);
      }
    }
  }

  currentPoints.forEach(point => {
    for (let i = 0; i < eraserPath.length - 1; i++) {
      if (pointLineSegmentDistance(point, eraserPath[i], eraserPath[i + 1]) < eraserRadius) {
        point.erase = true;
        break;
      }
    }

    if (eraserPath.length === 1 && distance(point, eraserPath[0]) < eraserRadius) {
      point.erase = true;
    }
  });

  const fragments: Point[][] = [];
  let currentFragment: Point[] = [];

  currentPoints.forEach(point => {
    if (point.erase) {
      if (currentFragment.length > 1) fragments.push(currentFragment);
      currentFragment = [];
      return;
    }

    currentFragment.push({ x: point.x, y: point.y });
  });

  if (currentFragment.length > 1) fragments.push(currentFragment);

  return fragments;
};

export const isStrokeHitByEraserSegment = (
  strokePoints: Point[],
  strokeLineWidth: number,
  eraserSegmentStart: Point,
  eraserSegmentEnd: Point,
  eraserRadius: number,
) => {
  if (strokePoints.length < 2) return false;

  const strokeBBox = calculateBBox(strokePoints, strokeLineWidth / 2);
  const eraserBBox = calculateBBox([eraserSegmentStart, eraserSegmentEnd], eraserRadius + strokeLineWidth / 2);

  if (!isBBoxIntersect(strokeBBox, eraserBBox)) return false;

  for (let i = 0; i < strokePoints.length - 1; i++) {
    const { distance: segmentDistance } = minDistanceBetweenSegments(
      strokePoints[i],
      strokePoints[i + 1],
      eraserSegmentStart,
      eraserSegmentEnd,
    );

    if (segmentDistance < eraserRadius + strokeLineWidth / 2) {
      return true;
    }
  }

  return false;
};
```

- [ ] **Step 3: Run the board-core build and capture failures**

Run:

```bash
pnpm --filter @e-board/board-core build
```

Expected result: either PASS, or a TypeScript/father error that points to the new eraser files. Fix only errors introduced in this task before continuing.

- [ ] **Step 4: Checkpoint commit if explicitly authorized**

Only run this commit step if the user explicitly authorized commits in this session:

```bash
git add packages/board-core/src/plugins/eraser/type.ts packages/board-core/src/plugins/eraser/geometry.ts
git commit -m "feat: add eraser geometry helpers"
```

---

## Task 2: Add EraserPlugin and export it from board-core

**Files:**
- Create: `packages/board-core/src/plugins/eraser/index.ts`
- Modify: `packages/board-core/src/plugins/index.ts`
- Validate: `pnpm --filter @e-board/board-core build`

- [ ] **Step 1: Create EraserPlugin**

Create `packages/board-core/src/plugins/eraser/index.ts` with this content:

```ts
import { eBoardContainer } from '../../common/IocContainer';
import { IBoard, IPluginInitParams } from '../../types';
import { IEventService, IHistoryService, IModel, IModelService, IModeService, ITransformService } from '../../services';
import { IPlugin } from '../type';
import {
  calculateStrokeFragments,
  isStrokeHitByEraserSegment,
} from './geometry';
import { EraseTransactionState, LineModel, Point } from './type';

const CURRENT_MODE = 'eraser';
const DEFAULT_ERASER_SIZE = 24;

class EraserPlugin implements IPlugin {
  private board!: IBoard;
  private disposeList: (() => void)[] = [];
  private isErasing = false;
  private erasingState: EraseTransactionState | null = null;
  private eraserSize = DEFAULT_ERASER_SIZE;
  private modelService = eBoardContainer.get<IModelService>(IModelService);
  private transformService = eBoardContainer.get<ITransformService>(ITransformService);
  private historyService = eBoardContainer.get<IHistoryService>(IHistoryService);

  public pluginName = 'EraserPlugin';
  public dependencies = [];
  public exports = {
    setEraserSize: (size: number) => this.setEraserSize(size),
    getEraserSize: () => this.eraserSize,
  };

  public init({ board }: IPluginInitParams) {
    this.board = board;
    this.initEraserMode();
  }

  private initEraserMode() {
    const modeService = eBoardContainer.get<IModeService>(IModeService);
    modeService.registerMode(CURRENT_MODE, {
      beforeSwitchMode: ({ currentMode }) => {
        if (currentMode === CURRENT_MODE) {
          this.disposePointerEvents();
          this.resetTransaction();
          this.clearInteractionCanvas();
          this.setCanvasCursor('default');
        }
      },
      afterSwitchMode: ({ currentMode }) => {
        if (currentMode === CURRENT_MODE) {
          this.initPointerEvents();
          this.setCanvasCursor('none');
        }
      },
    });
  }

  private setEraserSize(size: number) {
    this.eraserSize = Math.max(4, size);
  }

  private getCanvasPoint(clientX: number, clientY: number): Point {
    const canvas = this.board.getCanvas();
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  private toWorldPoint(point: Point): Point {
    return this.transformService.transformPoint(point, true);
  }

  private toScreenPoint(point: Point): Point {
    return this.transformService.transformPoint(point);
  }

  private getEraserRadius() {
    const zoom = this.transformService.getView().zoom || 1;
    return this.eraserSize / 2 / zoom;
  }

  private isLineModel(model: IModel<Record<string, any>>): model is LineModel {
    return model.type === 'line' && Array.isArray(model.points) && model.points.length > 1;
  }

  private getLineWidth(model: LineModel) {
    return Number(model.options?.lineWidth || 1);
  }

  private initPointerEvents = () => {
    const eventService = eBoardContainer.get<IEventService>(IEventService);

    const { dispose: disposePointerDown } = eventService.onPointerDown(event => {
      this.isErasing = true;
      const worldPoint = this.toWorldPoint(this.getCanvasPoint(event.clientX, event.clientY));
      this.erasingState = {
        eraserPath: [worldPoint],
        affectedLines: new Map(),
        tempFragments: new Map(),
      };
      this.handleEraserMove(worldPoint);
      this.drawPreview(this.getCanvasPoint(event.clientX, event.clientY));
    });

    const { dispose: disposePointerMove } = eventService.onPointerMove(event => {
      const screenPoint = this.getCanvasPoint(event.clientX, event.clientY);
      if (!this.isErasing) {
        this.drawCursor(screenPoint);
        return;
      }

      const worldPoint = this.toWorldPoint(screenPoint);
      this.erasingState?.eraserPath.push(worldPoint);
      this.handleEraserMove(worldPoint);
      this.drawPreview(screenPoint);
    });

    const { dispose: disposePointerUp } = eventService.onPointerUp(event => {
      if (!this.isErasing) return;
      const screenPoint = this.getCanvasPoint(event.clientX, event.clientY);
      const worldPoint = this.toWorldPoint(screenPoint);
      this.erasingState?.eraserPath.push(worldPoint);
      this.handleEraserMove(worldPoint);
      this.commitErase();
      this.isErasing = false;
      this.resetTransaction();
      this.clearInteractionCanvas();
      this.drawCursor(screenPoint);
    });

    this.disposeList.push(disposePointerDown, disposePointerMove, disposePointerUp);
  };

  private disposePointerEvents() {
    this.disposeList.forEach(dispose => dispose());
    this.disposeList = [];
  }

  private handleEraserMove(pos: Point) {
    if (!this.erasingState) return;

    const eraserPath = this.erasingState.eraserPath;
    const previousPoint = eraserPath.length > 1 ? eraserPath[eraserPath.length - 2] : pos;
    const eraserRadius = this.getEraserRadius();

    this.modelService.getAllModels().forEach(model => {
      if (!this.isLineModel(model) || this.erasingState?.affectedLines.has(model.id)) return;

      if (isStrokeHitByEraserSegment(
        model.points,
        this.getLineWidth(model),
        previousPoint,
        pos,
        eraserRadius,
      )) {
        this.erasingState?.affectedLines.set(model.id, model);
        this.erasingState?.tempFragments.set(model.id, [model.points]);
      }
    });

    this.erasingState.affectedLines.forEach(line => {
      const fragments = calculateStrokeFragments(
        line.points,
        eraserPath,
        eraserRadius,
        this.getLineWidth(line),
      );
      this.erasingState?.tempFragments.set(line.id, fragments);
    });
  }

  private commitErase() {
    if (!this.erasingState || this.erasingState.affectedLines.size === 0) return;

    this.historyService.startBatch();

    try {
      this.erasingState.affectedLines.forEach((line, lineId) => {
        this.modelService.deleteModel(lineId);
        const fragments = this.erasingState?.tempFragments.get(lineId) || [];

        fragments.forEach(points => {
          if (points.length < 2) return;
          this.modelService.createModel('line', {
            points: points.map(point => ({ ...point })),
            options: { ...(line.options || {}) },
          });
        });
      });
    } finally {
      this.historyService.endBatch();
    }
  }

  private drawPreview(cursorScreenPoint: Point) {
    const interactionCtx = this.board.getInteractionCtx();
    const interactionCanvas = this.board.getInteractionCanvas();
    if (!interactionCtx || !interactionCanvas) return;

    interactionCtx.clearRect(0, 0, interactionCanvas.width, interactionCanvas.height);

    this.erasingState?.tempFragments.forEach((fragments, lineId) => {
      const line = this.erasingState?.affectedLines.get(lineId);
      if (!line) return;

      fragments.forEach(points => this.drawLineFragment(interactionCtx, line, points));
    });

    this.drawCursor(cursorScreenPoint, false);
  }

  private drawLineFragment(ctx: CanvasRenderingContext2D, line: LineModel, points: Point[]) {
    if (points.length < 2) return;

    const zoom = this.transformService.getView().zoom || 1;
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = String(line.options?.strokeStyle || '#1d1d1f');
    ctx.lineWidth = this.getLineWidth(line) * zoom;
    ctx.lineCap = line.options?.lineCap || 'round';
    ctx.lineJoin = line.options?.lineJoin || 'round';

    points.forEach((point, index) => {
      const screenPoint = this.toScreenPoint(point);
      if (index === 0) {
        ctx.moveTo(screenPoint.x, screenPoint.y);
      } else if (index < 2) {
        ctx.lineTo(screenPoint.x, screenPoint.y);
      } else {
        const previousScreenPoint = this.toScreenPoint(points[index - 1]);
        const midPointX = (previousScreenPoint.x + screenPoint.x) / 2;
        const midPointY = (previousScreenPoint.y + screenPoint.y) / 2;
        ctx.quadraticCurveTo(previousScreenPoint.x, previousScreenPoint.y, midPointX, midPointY);
      }
    });

    ctx.stroke();
    ctx.restore();
  }

  private drawCursor(point: Point, shouldClear = true) {
    const interactionCtx = this.board.getInteractionCtx();
    const interactionCanvas = this.board.getInteractionCanvas();
    if (!interactionCtx || !interactionCanvas) return;

    if (shouldClear) {
      interactionCtx.clearRect(0, 0, interactionCanvas.width, interactionCanvas.height);
    }

    const radius = this.eraserSize / 2;
    interactionCtx.save();
    interactionCtx.beginPath();
    interactionCtx.arc(point.x, point.y, radius, 0, 2 * Math.PI);
    interactionCtx.fillStyle = 'rgba(255, 255, 255, 0.62)';
    interactionCtx.strokeStyle = 'rgba(29, 29, 31, 0.72)';
    interactionCtx.lineWidth = 1;
    interactionCtx.fill();
    interactionCtx.stroke();
    interactionCtx.restore();
  }

  private clearInteractionCanvas() {
    const interactionCtx = this.board.getInteractionCtx();
    const interactionCanvas = this.board.getInteractionCanvas();
    if (!interactionCtx || !interactionCanvas) return;
    interactionCtx.clearRect(0, 0, interactionCanvas.width, interactionCanvas.height);
  }

  private setCanvasCursor(cursor: string) {
    const interactionCanvas = this.board.getInteractionCanvas();
    if (!interactionCanvas) return;
    interactionCanvas.style.cursor = cursor;
  }

  private resetTransaction() {
    this.isErasing = false;
    this.erasingState = null;
  }

  public dispose() {
    this.disposePointerEvents();
    this.resetTransaction();
    this.clearInteractionCanvas();
    this.setCanvasCursor('default');
  }
}

export default EraserPlugin;
```

- [ ] **Step 2: Export EraserPlugin**

Modify `packages/board-core/src/plugins/index.ts` to exactly include the eraser import/export:

```ts
import { default as DrawPlugin } from './draw';
import { default as RoamPlugin } from './roam';
import { default as SelectionPlugin } from './selection';
import { default as DrawShapePlugin } from './drawShape';
import { default as ClearPlugin } from './clear';
import { default as PicturePlugin } from './picture';
import { default as HotkeyPlugin } from './hotkey';
import { default as EraserPlugin } from './eraser';

export { DrawPlugin, RoamPlugin, SelectionPlugin, DrawShapePlugin, ClearPlugin, PicturePlugin, HotkeyPlugin, EraserPlugin };
```

- [ ] **Step 3: Run the board-core build**

Run:

```bash
pnpm --filter @e-board/board-core build
```

Expected result: PASS. If it fails because `IHistoryService` cannot be imported from `../../services`, verify that `packages/board-core/src/services/index.ts` already exports `historyService/type`; it should.

- [ ] **Step 4: Checkpoint commit if explicitly authorized**

Only run this commit step if the user explicitly authorized commits in this session:

```bash
git add packages/board-core/src/plugins/eraser/index.ts packages/board-core/src/plugins/index.ts
git commit -m "feat: add eraser plugin"
```

---

## Task 3: Wire the eraser tool into the bottom toolbar

**Files:**
- Create: `packages/board-workbench/src/stageTool/handlers/EraserToolHandler.ts`
- Modify: `packages/board-workbench/src/stageTool/types.ts`
- Modify: `packages/board-workbench/src/stageTool/handlers/index.ts`
- Modify: `packages/board-workbench/src/stageTool/registry/registerDefaultTools.ts`
- Modify: `packages/board-workbench/src/stageTool/components/ToolButton.tsx`
- Validate: `pnpm --filter @e-board/board-workbench build`

- [ ] **Step 1: Add the eraser tool mode**

Modify `packages/board-workbench/src/stageTool/types.ts` so `ToolMode` is:

```ts
export enum ToolMode {
    DRAW = 'draw',
    ERASER = 'eraser',
    SELECT = 'selection',
    SHAPE = 'drawShape',
    LASER_POINTER = 'laserPointer',
    MIND_MAP = 'mindMap',
    TABLE = 'table',
}
```

Leave the rest of the file unchanged.

- [ ] **Step 2: Add EraserToolHandler**

Create `packages/board-workbench/src/stageTool/handlers/EraserToolHandler.ts` with this content:

```ts
import { IToolHandler } from '../types';

export class EraserToolHandler implements IToolHandler {
    activate(board: any): void {
        try {
            const modeService = board.getService('modeService');
            if (modeService) {
                modeService.switchMode('eraser');
            }
        } catch (error) {
            console.warn('Failed to switch to eraser mode:', error);
        }
    }

    deactivate(board: any): void {
        // Optional cleanup is handled by EraserPlugin mode switch hooks.
    }
}
```

- [ ] **Step 3: Export EraserToolHandler**

Modify `packages/board-workbench/src/stageTool/handlers/index.ts` so it includes this export at the end:

```ts
export { EraserToolHandler } from './EraserToolHandler';
```

- [ ] **Step 4: Register eraser in default tools**

Modify `packages/board-workbench/src/stageTool/registry/registerDefaultTools.ts`:

1. Add `EraserToolHandler` to the handler import list.
2. Register eraser immediately after the draw tool.

The import block should include:

```ts
    DrawToolHandler,
    EraserToolHandler,
    SelectToolHandler,
```

The registration block after draw should be:

```ts
    // Register eraser tool
    toolRegistry.register(
        {
            id: 'eraser',
            name: '橡皮擦',
            mode: ToolMode.ERASER,
        },
        new EraserToolHandler()
    );
```

- [ ] **Step 5: Include eraser in the first toolbar group**

Modify `packages/board-workbench/src/stageTool/StageTool.tsx`:

Add this derived list after `drawTools`:

```ts
    const eraserTools = allTools.filter(t => t.mode === ToolMode.ERASER);
```

Change the first group condition and tools array to include eraser:

```tsx
                    {(drawTools.length > 0 || eraserTools.length > 0 || selectTools.length > 0) && (
                        <ToolGroup
                            title=""
                            tools={[...drawTools, ...eraserTools, ...selectTools]}
                            activeTool={activeTool}
                            onToolClick={handleToolClick}
                        />
                    )}
```

- [ ] **Step 6: Add the polished SVG icon**

Modify `packages/board-workbench/src/stageTool/components/ToolButton.tsx` by adding this `eraser` entry after the `draw` icon entry:

```tsx
    'eraser': (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
                d="M8.1 18.6L3.9 14.4C3.12 13.62 3.12 12.35 3.9 11.57L11.24 4.23C12.02 3.45 13.29 3.45 14.07 4.23L20.1 10.26C20.88 11.04 20.88 12.31 20.1 13.09L14.59 18.6H8.1Z"
                fill="url(#eraserBodyGradient)"
                stroke="currentColor"
                strokeWidth="1.45"
                strokeLinejoin="round"
            />
            <path
                d="M14.23 6.02L18.31 10.1C18.7 10.49 18.7 11.12 18.31 11.51L15.73 14.09L10.23 8.59L12.81 6.02C13.2 5.63 13.84 5.63 14.23 6.02Z"
                fill="#F7B7C8"
                fillOpacity="0.92"
            />
            <path
                d="M8.62 18.48L5.14 15L10.23 9.91L15.32 15L11.84 18.48H8.62Z"
                fill="#EEF4FF"
                fillOpacity="0.96"
            />
            <path
                d="M9.92 9.64L15.49 15.21"
                stroke="currentColor"
                strokeWidth="1.15"
                strokeLinecap="round"
                opacity="0.52"
            />
            <path
                d="M7.2 13.65L10.55 17"
                stroke="white"
                strokeWidth="1.2"
                strokeLinecap="round"
                opacity="0.86"
            />
            <path
                d="M7.2 20H20.5"
                stroke="currentColor"
                strokeWidth="1.45"
                strokeLinecap="round"
                opacity="0.72"
            />
            <defs>
                <linearGradient id="eraserBodyGradient" x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#FFF5F8" />
                    <stop offset="0.48" stopColor="#EEF4FF" />
                    <stop offset="1" stopColor="#DCE8FF" />
                </linearGradient>
            </defs>
        </svg>
    ),
```

- [ ] **Step 7: Run the board-workbench build**

Run:

```bash
pnpm --filter @e-board/board-workbench build
```

Expected result: PASS.

- [ ] **Step 8: Checkpoint commit if explicitly authorized**

Only run this commit step if the user explicitly authorized commits in this session:

```bash
git add packages/board-workbench/src/stageTool/types.ts packages/board-workbench/src/stageTool/StageTool.tsx packages/board-workbench/src/stageTool/handlers/EraserToolHandler.ts packages/board-workbench/src/stageTool/handlers/index.ts packages/board-workbench/src/stageTool/registry/registerDefaultTools.ts packages/board-workbench/src/stageTool/components/ToolButton.tsx
git commit -m "feat: add eraser toolbar tool"
```

---

## Task 4: Register EraserPlugin in the app

**Files:**
- Modify: `app/src/App.tsx`
- Validate: app/integration build

- [ ] **Step 1: Import EraserPlugin**

Modify the import at the top of `app/src/App.tsx` from:

```ts
import { DrawShapePlugin, EBoard, IConfigService, IModelService, ITransformService } from "@e-board/board-core";
```

to:

```ts
import { DrawShapePlugin, EBoard, EraserPlugin, IConfigService, IModelService, ITransformService } from "@e-board/board-core";
```

- [ ] **Step 2: Register EraserPlugin in the plugin list**

Modify the `plugins` array in `app/src/App.tsx` from:

```ts
const plugins = [HotkeyPlugin, RoamPlugin, SelectionPlugin, DrawShapePlugin, ClearPlugin, PicturePlugin, BoardAIAssistantPlugin];
```

to:

```ts
const plugins = [HotkeyPlugin, RoamPlugin, SelectionPlugin, DrawShapePlugin, ClearPlugin, PicturePlugin, EraserPlugin, BoardAIAssistantPlugin];
```

- [ ] **Step 3: Run integration build**

First try:

```bash
pnpm --filter app build
```

If the app package has no `build` script, run:

```bash
pnpm build
```

Expected result: PASS. If a build fails because unrelated packages fail, record the failing package and still run the package-level builds from Tasks 2 and 3.

- [ ] **Step 4: Checkpoint commit if explicitly authorized**

Only run this commit step if the user explicitly authorized commits in this session:

```bash
git add app/src/App.tsx
git commit -m "feat: enable eraser plugin"
```

---

## Task 5: Update README and write implementation documentation

**Files:**
- Modify: `README.md`
- Create: `docs/eraser-implementation.md`
- Validate: manual doc review

- [ ] **Step 1: Update README checklist**

Modify the eraser section in `README.md` from:

```md
  - [ ] 橡皮擦功能
    - [ ] 基础擦除整条线段
    - [ ] 局部擦除功能
```

to:

```md
  - [x] 橡皮擦功能
    - [ ] 基础擦除整条线段
    - [x] 局部擦除功能
```

The whole-line erase sub-item remains unchecked because this implementation intentionally defaults to local fragment erase and does not add a whole-line erase mode.

- [ ] **Step 2: Create implementation doc**

Create `docs/eraser-implementation.md` with this content:

```md
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
- App 注册：`app/src/App.tsx`

## 数据流

1. 用户点击底部工具栏的“橡皮擦”。
2. `EraserToolHandler` 调用 `modeService.switchMode('eraser')`。
3. `EraserPlugin` 在 `eraser` 模式激活后监听 pointer 事件。
4. pointer down 时创建一次擦除事务，记录第一颗世界坐标点。
5. pointer move 时持续记录 eraser path，并对 line model 做命中检测和 fragment 计算。
6. pointer up 时提交事务：删除被命中的原 line，创建剩余 line fragments。
7. 删除和创建操作被包在 `historyService.startBatch()` / `historyService.endBatch()` 中，因此一次擦除在撤销栈中表现为一个批量动作。

## 算法说明

### 命中检测

`isStrokeHitByEraserSegment` 使用两阶段检测：

1. 对 line points 和最新 eraser segment 分别计算 bbox，并加入 line width / eraser radius padding。
2. bbox 相交后，再逐段计算 line segment 与 eraser segment 的最短距离。

当最短距离小于 `eraserRadius + lineWidth / 2` 时，认为 line 被命中。

### 片段切分

`calculateStrokeFragments` 使用完整 eraser path 重新计算当前受影响 line 的剩余片段：

1. 克隆 line points，并给每个点加临时 `erase` 标记。
2. 遍历 line segment 和 eraser segment，命中时插入 split point。
3. 标记落入擦除范围内的点。
4. 连续未擦除点组成 fragment。
5. 只保留点数大于 1 的 fragment。

### 坐标体系

- pointer 事件先转成 canvas 屏幕坐标。
- 参与模型计算前，通过 `transformService.transformPoint(point, true)` 转成世界坐标。
- interaction canvas 上的光标和实时预览使用屏幕坐标。
- 新建 line fragment 时保存世界坐标 points。

## 当前限制

- 只擦除 `type === 'line'` 且 points 数量大于 1 的手写线条。
- 不擦除图片、文本、矩形等元素。
- 暂未提供 UI 控件调整橡皮擦大小；插件导出 `setEraserSize(size)` 作为后续接入点。
- 暂未提供“整条擦除”策略切换。

## 后续扩展

- 在工具栏或浮动设置面板中接入橡皮擦尺寸调节。
- 增加整条擦除策略，并在插件内部通过策略函数切换。
- 为 `geometry.ts` 增加正式测试框架覆盖。
- 支持更多元素类型的擦除或删除。
```

- [ ] **Step 3: Review docs for consistency**

Open these files and verify the statements match the implementation:

```bash
git diff -- README.md docs/eraser-implementation.md docs/superpowers/specs/2026-05-30-eraser-tool-design.md
```

Expected result: docs mention only implemented behavior, not unsupported whole-line erase.

- [ ] **Step 4: Checkpoint commit if explicitly authorized**

Only run this commit step if the user explicitly authorized commits in this session:

```bash
git add README.md docs/eraser-implementation.md docs/superpowers/specs/2026-05-30-eraser-tool-design.md
git commit -m "docs: document eraser implementation"
```

---

## Task 6: Manual verification

**Files:**
- No code changes expected.
- Validate: browser behavior.

- [ ] **Step 1: Start the dev server**

Run:

```bash
pnpm dev
```

Expected result: dev servers start successfully. Open `http://localhost:3001`.

- [ ] **Step 2: Verify toolbar behavior**

Manual checks:

1. Bottom/visible stage toolbar contains a new eraser icon between draw and select.
2. The icon is a polished SVG eraser, not text or a placeholder dot.
3. Clicking the eraser sets the button active.
4. Clicking draw switches back to draw mode.
5. Clicking select switches to selection mode.

- [ ] **Step 3: Verify local erase behavior**

Manual checks:

1. Draw one horizontal line.
2. Select eraser.
3. Drag across the middle of the line.
4. Expected: the middle disappears and two line fragments remain.
5. Draw two lines that cross.
6. Drag the eraser through the crossing area.
7. Expected: both touched lines are locally split; untouched portions remain.
8. Drag the eraser in blank space.
9. Expected: no model change and no visible artifact remains on the interaction canvas.

- [ ] **Step 4: Verify undo/redo behavior**

Manual checks:

1. Draw one line.
2. Erase the middle.
3. Click undo.
4. Expected: the original continuous line returns.
5. Click redo.
6. Expected: the local erase returns.

If undo/redo does not behave as expected, inspect `historyService` batching and confirm `startBatch()` is called before the delete/create loop and `endBatch()` runs in `finally`.

- [ ] **Step 5: Run final builds**

Run:

```bash
pnpm --filter @e-board/board-core build
pnpm --filter @e-board/board-workbench build
pnpm build
```

Expected result: package-level builds pass. If root `pnpm build` fails in an unrelated package, report the package and error exactly; do not claim full verification passed.

- [ ] **Step 6: Final checkpoint commit if explicitly authorized**

Only run this commit step if the user explicitly authorized commits in this session:

```bash
git status --short
git add packages/board-core/src/plugins/eraser/type.ts packages/board-core/src/plugins/eraser/geometry.ts packages/board-core/src/plugins/eraser/index.ts packages/board-core/src/plugins/index.ts packages/board-workbench/src/stageTool/types.ts packages/board-workbench/src/stageTool/StageTool.tsx packages/board-workbench/src/stageTool/handlers/EraserToolHandler.ts packages/board-workbench/src/stageTool/handlers/index.ts packages/board-workbench/src/stageTool/registry/registerDefaultTools.ts packages/board-workbench/src/stageTool/components/ToolButton.tsx app/src/App.tsx README.md docs/eraser-implementation.md docs/superpowers/specs/2026-05-30-eraser-tool-design.md docs/superpowers/plans/2026-05-30-eraser-tool.md
git commit -m "feat: add local eraser tool"
```

---

## Self-Review

### Spec coverage

- Bottom toolbar eraser button: Task 3.
- Polished SVG eraser icon: Task 3 Step 6.
- Independent eraser mode/plugin: Task 2 and Task 4.
- Local fragment erase based on the HTML prototype: Task 1 and Task 2.
- Reuse line model structure without changing persistence: Task 2 commit creates new `line` models with copied `options` and fragment `points`.
- History batching: Task 2 `commitErase`, Task 6 undo/redo verification.
- Implementation documentation: Task 5.
- README checklist update: Task 5.

### Placeholder scan

No `TBD`, `TODO`, “similar to”, or vague “handle edge cases” instructions remain. Code blocks include concrete content for every new file and exact snippets for each modified file.

### Type consistency

The plan consistently uses `Point`, `LineModel`, `EraseTransactionState`, `ToolMode.ERASER`, `EraserToolHandler`, and `EraserPlugin`. The plugin imports services from `../../services`, matching the existing `DrawPlugin` pattern and service barrel exports.
