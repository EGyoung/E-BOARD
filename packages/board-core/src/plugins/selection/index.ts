import { IBoard, IPluginInitParams } from "../../types";
import { eBoardContainer } from "../../common/IocContainer";
import { IModel, IModelService } from "../../services/modelService/type";
import { IPlugin } from "../type";
import { IModeService, IRenderService } from "../../services";
import { ITransformService } from "../../services/transformService/type";
import { Emitter } from "@e-board/board-utils";

import { ResizeHandle, MIN_ELEMENT_SIZE, hitTestHandles } from "./handles";
import { applyResizeToModels } from "./resize";
import { applyDragToModels } from "./drag";
import { drawMarquee, computeSelectedByMarquee } from "./marquee";
import { SelectionDOMOverlay } from "./overlay";

type Box = { x: number; y: number; width: number; height: number };

const CURRENT_MODE = "selection";

class SelectionPlugin implements IPlugin {
  private board!: IBoard;
  private disposeList: (() => void)[] = [];
  private overlay = new SelectionDOMOverlay();
  private AABbBox: Box | null = null;
  private pointerDownPoint: { x: number; y: number } | null = null;
  private isDragging = false;
  private selectModels = new Set<string>();
  private initialModelPositions = new Map<string, { x: number; y: number }[]>();
  private initialModelSizes = new Map<string, { width?: number; height?: number }>();
  private currentSelectRange: { x: number; y: number; width: number; height: number } | null = null;
  private rafId: number | null = null;

  private modelService = eBoardContainer.get<IModelService>(IModelService);
  private transformService = eBoardContainer.get<ITransformService>(ITransformService);
  private renderService = eBoardContainer.get<IRenderService>(IRenderService);

  private activeHandle: ResizeHandle | null = null;
  private resizeStartAABB: Box | null = null;

  private readonly _onSelectedElements = new Emitter<IModel[]>();
  private readonly _onElementsMoving = new Emitter<IModel[]>();
  private readonly _onDraggingChange = new Emitter<boolean>();

  public onElementMoving = this._onElementsMoving.event;
  public onSelectedElements = this._onSelectedElements.event;
  public onDraggingChange = this._onDraggingChange.event;
  public pluginName = "SelectionPlugin";

  public exports = {
    getSelectedModelsId: this.getSelectedModelsId.bind(this),
    getSelectedModels: this.getSelectedModels.bind(this),
    onSelectedElements: this.onSelectedElements.bind(this),
    onElementsMoving: this.onElementMoving.bind(this),
    onDraggingChange: this.onDraggingChange.bind(this),
  };

  // ===================================================================
  // 生命周期
  // ===================================================================

  public init({ board }: IPluginInitParams) {
    this.board = board;
    const modeService = eBoardContainer.get<IModeService>(IModeService);

    // 视图变换时刷新 DOM overlay
    const { dispose: renderDispose } = this.renderService.onRenderEnd(() => this.renderOverlay());
    this.disposeList.push(renderDispose);

    // model 变更时刷新（添加子节点、折叠等）
    const { dispose: modelDispose } = this.modelService.onModelOperation((event: any) => {
      if (this.selectModels.has(event.modelId)) {
        requestAnimationFrame(() => this.renderOverlay());
      }
    });
    this.disposeList.push(modelDispose);

    modeService.registerMode(CURRENT_MODE, {
      beforeSwitchMode: ({ currentMode }) => {
        if (currentMode === CURRENT_MODE) {
          this.disposeList.forEach(d => d());
          this.selectModels.clear();
          this.resetAllState();
          this._onSelectedElements.fire([]);
        }
      },
      afterSwitchMode: ({ currentMode }) => {
        if (currentMode === CURRENT_MODE) {
          this.initSelect();
        }
      },
    });
  }

  public dispose() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.overlay.remove();
    this.disposeList.forEach(d => d());
    this.disposeList = [];
  }

  // ===================================================================
  // DOM Overlay
  // ===================================================================

  private renderOverlay = () => {
    if (this.isDragging) return;

    // Canvas — 仅用于 marquee（拖选瞬时框）
    const canvas = this.board.getInteractionCanvas();
    const ctx = this.board.getInteractionCtx();
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (this.currentSelectRange) {
        drawMarquee(ctx, this.currentSelectRange);
      }
    }

    // DOM — 选中框 + 手柄
    const container = this.board.getContainer();
    if (container) {
      this.AABbBox = this.overlay.update(container, this.selectModels, this.modelService);
    }
  };

  // ===================================================================
  // 交互：PointerDown / Move / Up
  // ===================================================================

  private initSelect() {
    const container = this.board.getContainer();
    const canvas = this.board.getInteractionCanvas();
    const ctx = this.board.getInteractionCtx();
    if (!canvas || !container || !ctx) return;

    // -- PointerDown ----------------------------------------------
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;

      // 1) 手柄 → resize
      const handle = hitTestHandles({ x: e.clientX, y: e.clientY }, this.AABbBox);
      if (handle && this.AABbBox && this.selectModels.size > 0) {
        this.startResize(handle, e);
        bindMoveUp();
        return;
      }

      // 2) AABB 内 → drag
      if (this.AABbBox && this.isInsideAABB(e)) {
        if (this.selectModels.size > 0) {
          this.startDrag(e, false);
          bindMoveUp();
          return;
        }
      }

      // 3) 空白 → 取消选中 / 点击选中
      this.resetAllState();
      this.selectModels.clear();
      this._onSelectedElements.fire([]);
      this.pointerDownPoint = { x: e.clientX, y: e.clientY };

      const models = this.modelService.getAllModels().reverse();
      for (const model of models) {
        if (!model.ctrlElement?.isHit?.({ point: this.pointerDownPoint, model })) continue;
        if (!model.ctrlElement?.getBoundingBox?.()) continue;
        this.addSelectedModels(model.id);
        this.renderOverlay();
        break;
      }

      if (this.selectModels.size > 0) {
        this.startDrag(e, false);
      }

      bindMoveUp();
    };

    // -- PointerMove ----------------------------------------------
    const onPointerMove = (e: PointerEvent) => {
      if (!this.pointerDownPoint) return;
      if (this.rafId !== null) cancelAnimationFrame(this.rafId);

      this.rafId = requestAnimationFrame(() => {
        if (!this.pointerDownPoint) return;

        // Resize
        if (this.activeHandle && this.resizeStartAABB) {
          this.handleResize(e);
          return;
        }

        // Drag
        if (this.selectModels.size > 0) {
          this.handleDrag(e);
          return;
        }

        // Marquee（拖选）
        this.handleMarquee(e, ctx);
      });
    };

    // -- PointerUp ------------------------------------------------
    const onPointerUp = () => {
      if (!this.pointerDownPoint) return;
      if (this.rafId !== null) { cancelAnimationFrame(this.rafId); this.rafId = null; }

      if (this.activeHandle) {
        this.endResize();
      } else if (this.selectModels.size > 0) {
        this.endDrag();
      } else {
        this.endMarquee(ctx);
      }

      unbindMoveUp();
    };

    const bindMoveUp = () => {
      container.addEventListener("pointermove", onPointerMove);
      container.addEventListener("pointerup", onPointerUp);
    };
    const unbindMoveUp = () => {
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerup", onPointerUp);
    };

    container.addEventListener("pointerdown", onPointerDown);
    this.disposeList.push(() => container.removeEventListener("pointerdown", onPointerDown));
  }

  // -- 交互操作 ---------------------------------------------------

  private isInsideAABB(e: PointerEvent): boolean {
    if (!this.AABbBox) return false;
    return e.clientX >= this.AABbBox.x &&
      e.clientX <= this.AABbBox.x + this.AABbBox.width &&
      e.clientY >= this.AABbBox.y &&
      e.clientY <= this.AABbBox.y + this.AABbBox.height;
  }

  private startResize(handle: ResizeHandle, e: PointerEvent) {
    this.activeHandle = handle;
    this.resizeStartAABB = { ...this.AABbBox! };
    this.pointerDownPoint = { x: e.clientX, y: e.clientY };
    this.saveInitialState(true);
  }

  private startDrag(e: PointerEvent, includeSizes: boolean) {
    this.pointerDownPoint = { x: e.clientX, y: e.clientY };
    this.saveInitialState(includeSizes);
    this.isDragging = true;
    this.overlay.remove();
    this._onDraggingChange.fire(true);
  }

  private handleResize(e: PointerEvent) {
    const dx = e.clientX - this.pointerDownPoint!.x;
    const dy = e.clientY - this.pointerDownPoint!.y;
    const orig = this.resizeStartAABB!;
    let nx = orig.x, ny = orig.y, nw = orig.width, nh = orig.height;

    if (this.activeHandle!.includes("e")) nw = orig.width + dx;
    if (this.activeHandle!.includes("w")) { nx = orig.x + dx; nw = orig.width - dx; }
    if (this.activeHandle!.includes("s")) nh = orig.height + dy;
    if (this.activeHandle!.includes("n")) { ny = orig.y + dy; nh = orig.height - dy; }

    if (nw < MIN_ELEMENT_SIZE) { nw = MIN_ELEMENT_SIZE; if (this.activeHandle!.includes("w")) nx = orig.x + orig.width - MIN_ELEMENT_SIZE; }
    if (nh < MIN_ELEMENT_SIZE) { nh = MIN_ELEMENT_SIZE; if (this.activeHandle!.includes("n")) ny = orig.y + orig.height - MIN_ELEMENT_SIZE; }

    applyResizeToModels(
      { x: nx, y: ny, width: nw, height: nh },
      this.resizeStartAABB!, this.selectModels,
      this.initialModelPositions, this.initialModelSizes,
      this.modelService, this.transformService,
    );
    this._onElementsMoving.fire(this.getCurrentModels());
    this.renderOverlay();
  }

  private handleDrag(e: PointerEvent) {
    applyDragToModels(
      e.clientX - this.pointerDownPoint!.x,
      e.clientY - this.pointerDownPoint!.y,
      this.selectModels,
      this.initialModelPositions, this.modelService,
      this.transformService, e,
    );
    this._onElementsMoving.fire(this.getCurrentModels());
  }

  private handleMarquee(e: PointerEvent, ctx: CanvasRenderingContext2D) {
    const w = e.clientX - this.pointerDownPoint!.x;
    const h = e.clientY - this.pointerDownPoint!.y;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    this.currentSelectRange = { x: this.pointerDownPoint!.x, y: this.pointerDownPoint!.y, width: w || 1, height: h || 1 };
    drawMarquee(ctx, this.currentSelectRange);
  }

  private endResize() {
    this.activeHandle = null;
    this.resizeStartAABB = null;
    this.initialModelSizes.clear();
    this.pointerDownPoint = null;
    requestAnimationFrame(this.renderOverlay);
  }

  private endDrag() {
    this.isDragging = false;
    this._onDraggingChange.fire(false);
    this.currentSelectRange = null;
    this.pointerDownPoint = null;
    requestAnimationFrame(this.renderOverlay);
  }

  private endMarquee(ctx: CanvasRenderingContext2D) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    this.pointerDownPoint = null;

    if (this.currentSelectRange) {
      computeSelectedByMarquee(this.currentSelectRange, this.modelService.getAllModels())
        .forEach(id => this.addSelectedModels(id));
    }
    this.currentSelectRange = null;
    this.renderOverlay();
  }

  // ===================================================================
  // 工具
  // ===================================================================

  private resetAllState() {
    const canvas = this.board.getInteractionCanvas();
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    this.overlay.remove();
    this.initialModelPositions.clear();
    this.currentSelectRange = null;
  }

  private saveInitialState(includeSizes: boolean) {
    this.initialModelPositions.clear();
    if (includeSizes) this.initialModelSizes.clear();
    this.selectModels.forEach(id => {
      const model = this.modelService.getModelById(id);
      if (model?.points) {
        this.initialModelPositions.set(id, [...model.points]);
      }
      if (includeSizes && (model as any)?.width !== undefined) {
        this.initialModelSizes.set(id, { width: (model as any).width, height: (model as any).height });
      }
    });
  }

  private getCurrentModels(): IModel[] {
    return Array.from(this.selectModels)
      .map(id => this.modelService.getModelById(id))
      .filter(Boolean) as IModel[];
  }

  private addSelectedModels(id: string) {
    if (!this.selectModels.has(id)) {
      this.selectModels.add(id);
      this._onSelectedElements.fire(this.getCurrentModels());
    }
  }

  public getSelectedModelsId(): string[] {
    return Array.from(this.selectModels);
  }

  public getSelectedModels(): IModel[] {
    return this.getCurrentModels();
  }
}

export default SelectionPlugin;