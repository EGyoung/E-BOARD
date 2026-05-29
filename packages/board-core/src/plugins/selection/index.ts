import { IBoard, IPluginInitParams } from "../../types";
import { eBoardContainer } from "../../common/IocContainer";
import { IModel, IModelService } from "../../services/modelService/type";
import { IPlugin } from "../type";
import { IModeService, IRenderService } from "../../services";
import { ITransformService } from "../../services/transformService/type";
import { Emitter } from "@e-board/board-utils";

import { ResizeHandle, HANDLE_CURSORS, MIN_ELEMENT_SIZE, HandleManager, hitTestHandles } from "./handles";
import { applyResizeToModels } from "./resize";
import { applyDragToModels } from "./drag";
import { drawMarquee, computeSelectedByMarquee } from "./marquee";
import { renderSelectionOverlay } from "./renderer";

const CURRENT_MODE = "selection";

class SelectionPlugin implements IPlugin {
  private board!: IBoard;
  private disposeList: (() => void)[] = [];
  private AABbBox: { x: number; y: number; width: number; height: number } | null = null;
  private pointerDownPoint: { x: number; y: number } | null = null;
  private selectModels = new Set<string>();
  private initialModelPositions = new Map<string, { x: number; y: number }[]>();
  private initialModelSizes = new Map<string, { width?: number; height?: number }>();
  private currentSelectRange: { x: number; y: number; width: number; height: number } | null = null;
  private rafId: number | null = null;
  private modelService = eBoardContainer.get<IModelService>(IModelService);
  private transformService = eBoardContainer.get<ITransformService>(ITransformService);
  private renderService = eBoardContainer.get<IRenderService>(IRenderService);
  private handleManager = new HandleManager();

  private readonly _onSelectedElements = new Emitter<IModel>();
  private emitSelectedElement = this._onSelectedElements.fire.bind(this._onSelectedElements);
  private readonly _onElementsMoving = new Emitter<IModel[]>();
  private emitElementsMoving = this._onElementsMoving.fire.bind(this._onElementsMoving);

  private activeHandle: ResizeHandle | null = null;
  private resizeStartAABB: { x: number; y: number; width: number; height: number } | null = null;
  private savedCursor: string = "";

  public onElementMoving = this._onElementsMoving.event;
  public onSelectedElements = this._onSelectedElements.event;
  public pluginName = "SelectionPlugin";

  public exports = {
    getSelectedModelsId: this.getSelectedModelsId.bind(this),
    getSelectedModels: this.getSelectedModels.bind(this),
    onSelectedElements: this.onSelectedElements.bind(this),
    onElementsMoving: this.onElementMoving.bind(this),
  };

  public getSelectedModelsId() {
    return Array.from(this.selectModels);
  }

  public getSelectedModels() {
    return this.getSelectedModelsId()
      .map(id => this.modelService.getModelById(id))
      .filter(Boolean);
  }

  public init({ board }: IPluginInitParams) {
    this.board = board;
    const modeService = eBoardContainer.get<IModeService>(IModeService);
    const canvas = this.board.getInteractionCanvas();
    if (!canvas) return;

    canvas.addEventListener("wheel", () => {
      this.doRenderOverlay();
    });

    const { dispose } = this.renderService.onRenderEnd(this.doRenderOverlay);
    this.disposeList.push(dispose);

    modeService.registerMode(CURRENT_MODE, {
      beforeSwitchMode: ({ currentMode }) => {
        if (currentMode === CURRENT_MODE) {
          this.disposeList.forEach(d => d());
        }
      },
      afterSwitchMode: ({ currentMode }) => {
        if (currentMode === CURRENT_MODE) {
          this.initSelect();
        }
      },
    });
  }

  private doRenderOverlay = () => {
    const canvas = this.board.getInteractionCanvas();
    const ctx = this.board.getInteractionCtx();
    const container = this.board.getContainer();
    if (!canvas || !ctx || !container) return;

    this.AABbBox = renderSelectionOverlay(
      canvas, ctx, this.selectModels, this.modelService,
      this.handleManager, container, this.currentSelectRange,
    );
  };

  private resetAllState() {
    const canvas = this.board.getInteractionCanvas();
    const ctx = this.board.getInteractionCtx();
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.handleManager.removeHandles();
    this.initialModelPositions.clear();
    this.currentSelectRange = null;
  }

  private initSelect() {
    const container = this.board.getContainer();
    const canvas = this.board.getInteractionCanvas();
    const ctx = this.board.getInteractionCtx();
    if (!canvas || !container || !ctx) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;

      const handle = hitTestHandles({ x: e.clientX, y: e.clientY }, this.AABbBox);
      if (handle && this.AABbBox && this.selectModels.size > 0) {
        this.activeHandle = handle;
        this.resizeStartAABB = { ...this.AABbBox };
        this.pointerDownPoint = { x: e.clientX, y: e.clientY };
        this.savedCursor = container.style.cursor;
        container.style.cursor = HANDLE_CURSORS[handle];
        this.saveInitialState(true);
        container.addEventListener("pointermove", handlePointerMove);
        container.addEventListener("pointerup", handlePointerUp);
        return;
      }

      if (this.AABbBox) {
        if (
          e.clientX >= this.AABbBox.x &&
          e.clientX <= this.AABbBox.x + this.AABbBox.width &&
          e.clientY >= this.AABbBox.y &&
          e.clientY <= this.AABbBox.y + this.AABbBox.height
        ) {
          this.pointerDownPoint = { x: e.clientX, y: e.clientY };
          if (this.selectModels.size > 0) {
            this.saveInitialState(false);
            container.addEventListener("pointermove", handlePointerMove);
            container.addEventListener("pointerup", handlePointerUp);
            return;
          }
        }
      }

      this.resetAllState();
      this.selectModels.clear();
      this.emitSelectedElement(null as any);
      this.pointerDownPoint = { x: e.clientX, y: e.clientY };

      const models = this.modelService.getAllModels().reverse();
      let count = 0;
      for (const model of models) {
        if (!model) return;
        count++;
        const ctrlElement = model.ctrlElement;
        if (!ctrlElement) continue;
        const isIntersecting = ctrlElement.isHit({ point: this.pointerDownPoint, model });
        const bounding = ctrlElement.getBoundingBox();
        if (!bounding) continue;
        if (isIntersecting) {
          this.addSelectedModels(model.id);
          this.doRenderOverlay();
          break;
        }
        if (count === models.length) {
          this.selectModels.clear();
        }
      }

      if (this.selectModels.size > 0) {
        this.saveInitialState(false);
      }

      container.addEventListener("pointermove", handlePointerMove);
      container.addEventListener("pointerup", handlePointerUp);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!this.pointerDownPoint) return;
      if (this.rafId !== null) cancelAnimationFrame(this.rafId);

      this.rafId = requestAnimationFrame(() => {
        if (!this.pointerDownPoint) return;

        if (this.activeHandle && this.resizeStartAABB) {
          const deltaX = e.clientX - this.pointerDownPoint.x;
          const deltaY = e.clientY - this.pointerDownPoint.y;
          const orig = this.resizeStartAABB;
          let newX = orig.x, newY = orig.y, newW = orig.width, newH = orig.height;

          if (this.activeHandle.includes("e")) { newW = orig.width + deltaX; }
          if (this.activeHandle.includes("w")) { newX = orig.x + deltaX; newW = orig.width - deltaX; }
          if (this.activeHandle.includes("s")) { newH = orig.height + deltaY; }
          if (this.activeHandle.includes("n")) { newY = orig.y + deltaY; newH = orig.height - deltaY; }

          if (newW < MIN_ELEMENT_SIZE) { newW = MIN_ELEMENT_SIZE; if (this.activeHandle.includes("w")) newX = orig.x + orig.width - MIN_ELEMENT_SIZE; }
          if (newH < MIN_ELEMENT_SIZE) { newH = MIN_ELEMENT_SIZE; if (this.activeHandle.includes("n")) newY = orig.y + orig.height - MIN_ELEMENT_SIZE; }

          applyResizeToModels(
            { x: newX, y: newY, width: newW, height: newH },
            this.resizeStartAABB, this.selectModels,
            this.initialModelPositions, this.initialModelSizes,
            this.modelService, this.transformService,
          );
          this.doRenderOverlay();
          return;
        }

        if (this.selectModels.size > 0) {
          const deltaX = e.clientX - this.pointerDownPoint.x;
          const deltaY = e.clientY - this.pointerDownPoint.y;
          applyDragToModels(
            deltaX, deltaY, this.selectModels,
            this.initialModelPositions, this.modelService,
            this.transformService, undefined, e,
          );
          const models = Array.from(this.selectModels)
            .map(id => this.modelService.getModelById(id)!)
            .filter(Boolean);
          this.emitElementsMoving(models);
          return;
        }

        const width = e.clientX - this.pointerDownPoint.x;
        const height = e.clientY - this.pointerDownPoint.y;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        this.currentSelectRange = {
          x: this.pointerDownPoint.x,
          y: this.pointerDownPoint.y,
          width: width || 1,
          height: height || 1,
        };
        drawMarquee(ctx, this.currentSelectRange);
      });
    };

    const handlePointerUp = (_e: PointerEvent) => {
      if (!this.pointerDownPoint) return;

      if (this.rafId !== null) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }

      if (this.activeHandle) {
        container.style.cursor = this.savedCursor;
        this.activeHandle = null;
        this.resizeStartAABB = null;
        this.initialModelSizes.clear();
        container.removeEventListener("pointermove", handlePointerMove);
        container.removeEventListener("pointerup", handlePointerUp);
        this.pointerDownPoint = null;
        requestAnimationFrame(this.doRenderOverlay);
        return;
      }

      if (this.selectModels.size > 0) {
        container.removeEventListener("pointermove", handlePointerMove);
        container.removeEventListener("pointerup", handlePointerUp);
        this.currentSelectRange = null;
        requestAnimationFrame(this.doRenderOverlay);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.pointerDownPoint = null;
      container.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("pointerup", handlePointerUp);

      if (this.currentSelectRange) {
        const models = this.modelService.getAllModels();
        const ids = computeSelectedByMarquee(this.currentSelectRange, models);
        ids.forEach(id => this.addSelectedModels(id));
      }

      this.currentSelectRange = null;
      this.doRenderOverlay();
    };

    container.addEventListener("pointerdown", handlePointerDown);

    const handleHoverCursor = (e: PointerEvent) => {
      if (this.activeHandle) return;
      const handle = hitTestHandles({ x: e.clientX, y: e.clientY }, this.AABbBox);
      container.style.cursor = handle ? HANDLE_CURSORS[handle] : "";
    };
    container.addEventListener("pointermove", handleHoverCursor);

    this.disposeList.push(() => {
      container.removeEventListener("pointerdown", handlePointerDown);
      container.removeEventListener("pointermove", handleHoverCursor);
    });
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

  public addSelectedModels(id: string) {
    if (!this.selectModels.has(id)) {
      this.selectModels.add(id);
      const model = this.modelService.getModelById(id);
      if (model) {
        this.emitSelectedElement(model);
      }
    }
  }

  public dispose() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.handleManager.removeHandles();
    this.disposeList.forEach(d => d());
    this.disposeList = [];
  }
}

export default SelectionPlugin;
