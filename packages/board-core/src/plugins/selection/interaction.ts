import { IModelService } from "../../services/modelService/type";
import { ResizeHandle, MIN_ELEMENT_SIZE, hitTestHandles, ScreenRect } from "./overlay";
import { SelectionOperator } from "./operator";
import { SelectionDOMOverlay, computeSelectedByMarquee } from "./overlay";

/**
 * 交互层持有的状态（与 Plugin 共享引用）。
 * Plugin 拥有这些对象，Interaction 读写它们。
 */
export interface InteractionState {
  selectModels: Set<string>;
  AABbBox: ScreenRect | null;
  initialModelPositions: Map<string, { x: number; y: number }[]>;
  initialModelSizes: Map<string, { width?: number; height?: number }>;
  currentSelectRange: { x: number; y: number; width: number; height: number } | null;
  isDragging: boolean;
  rafId: number | null;
}

export interface InteractionCallbacks {
  renderOverlay(): void;
  addSelectedModels(id: string): void;
  resetAllState(): void;
  onElementsMoving(models: any[]): void;
  onDraggingChange(dragging: boolean): void;
  onSelectedElements(models: any[]): void;
}

export interface InteractionConfig {
  state: InteractionState;
  operator: SelectionOperator;
  overlay: SelectionDOMOverlay;
  modelService: IModelService;
  callbacks: InteractionCallbacks;
  getContainer: () => HTMLElement | null;
}

/**
 * SelectionPlugin 的交互层。
 * 管理 PointerDown/Move/Up 事件处理，分为三种模式：Resize / Drag / Marquee。
 */
export class SelectionInteraction {
  private pointerDownPoint: { x: number; y: number } | null = null;
  private activeHandle: ResizeHandle | null = null;
  private resizeStartAABB: ScreenRect | null = null;

  private disposeList: (() => void)[] = [];

  private state: InteractionState;
  private operator: SelectionOperator;
  private overlay: SelectionDOMOverlay;
  private modelService: IModelService;
  private cb: InteractionCallbacks;
  private getContainer: () => HTMLElement | null;

  constructor(config: InteractionConfig) {
    this.state = config.state;
    this.operator = config.operator;
    this.overlay = config.overlay;
    this.modelService = config.modelService;
    this.cb = config.callbacks;
    this.getContainer = config.getContainer;
  }

  /** 绑定事件到 container，切换模式时调用 */
  attach(container: HTMLElement): void {
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;

      // 1) 手柄 → resize（仅当所有选中元素都允许缩放时）
      const handle = hitTestHandles({ x: e.clientX, y: e.clientY }, this.state.AABbBox);
      if (handle && this.state.AABbBox && this.state.selectModels.size > 0 && this.canResizeSelected()) {
        this.startResize(handle, e);
        bindMoveUp();
        return;
      }

      // 2) AABB 内 → drag
      if (this.isInsideAABB(e)) {
        if (this.state.selectModels.size > 0) {
          this.startDrag(e);
          bindMoveUp();
          return;
        }
      }

      // 3) 空白 → 取消选中 / 点击选中
      this.cb.resetAllState();
      this.state.selectModels.clear();
      this.cb.onSelectedElements([]);
      this.pointerDownPoint = { x: e.clientX, y: e.clientY };

      const models = this.modelService.getAllModels().reverse();
      for (const model of models) {
        if (!model.ctrlElement?.isHit?.({ point: this.pointerDownPoint, model })) continue;
        if (!model.ctrlElement?.getBoundingBox?.()) continue;
        this.cb.addSelectedModels(model.id);
        this.cb.renderOverlay();
        break;
      }

      if (this.state.selectModels.size > 0) {
        this.startDrag(e);
      }

      bindMoveUp();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!this.pointerDownPoint) return;
      if (this.state.rafId !== null) cancelAnimationFrame(this.state.rafId);

      this.state.rafId = requestAnimationFrame(() => {
        if (!this.pointerDownPoint) return;

        if (this.activeHandle && this.resizeStartAABB) {
          this.handleResize(e);
          return;
        }

        if (this.state.selectModels.size > 0) {
          this.handleDrag(e);
          return;
        }

        this.handleMarquee(e);
      });
    };

    const onPointerUp = () => {
      if (!this.pointerDownPoint) return;
      if (this.state.rafId !== null) { cancelAnimationFrame(this.state.rafId); this.state.rafId = null; }

      if (this.activeHandle) this.endResize();
      else if (this.state.selectModels.size > 0) this.endDrag();
      else this.endMarquee();

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

  detach(): void {
    this.disposeList.forEach(d => d());
    this.disposeList = [];
  }

  // -- Resize ---------------------------------------------------

  private startResize(handle: ResizeHandle, e: PointerEvent) {
    this.activeHandle = handle;
    this.resizeStartAABB = { ...this.state.AABbBox! };
    this.pointerDownPoint = { x: e.clientX, y: e.clientY };
    this.saveInitialState(true);
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

    this.operator.resize({
      newAABB: { x: nx, y: ny, width: nw, height: nh },
      resizeStartAABB: this.resizeStartAABB!,
      selectModels: this.state.selectModels,
      initialModelPositions: this.state.initialModelPositions,
      initialModelSizes: this.state.initialModelSizes,
    });
    this.cb.onElementsMoving(this.getCurrentModels());
    this.cb.renderOverlay();
  }

  private endResize() {
    this.activeHandle = null;
    this.resizeStartAABB = null;
    this.state.initialModelSizes.clear();
    this.pointerDownPoint = null;
    requestAnimationFrame(this.cb.renderOverlay);
  }

  // -- Drag -----------------------------------------------------

  private startDrag(e: PointerEvent) {
    this.pointerDownPoint = { x: e.clientX, y: e.clientY };
    this.saveInitialState(false);
    this.state.isDragging = true;
    this.overlay.remove();
    this.cb.onDraggingChange(true);
  }

  private handleDrag(e: PointerEvent) {
    this.operator.drag({
      deltaX: e.clientX - this.pointerDownPoint!.x,
      deltaY: e.clientY - this.pointerDownPoint!.y,
      selectModels: this.state.selectModels,
      initialModelPositions: this.state.initialModelPositions,
      event: e,
    });
    this.cb.onElementsMoving(this.getCurrentModels());
  }

  private endDrag() {
    this.state.isDragging = false;
    this.cb.onDraggingChange(false);
    this.state.currentSelectRange = null;
    this.pointerDownPoint = null;
    requestAnimationFrame(this.cb.renderOverlay);
  }

  // -- Marquee --------------------------------------------------

  private handleMarquee(e: PointerEvent) {
    const container = this.getContainer();
    if (!container) return;
    const w = e.clientX - this.pointerDownPoint!.x;
    const h = e.clientY - this.pointerDownPoint!.y;
    this.state.currentSelectRange = {
      x: Math.min(this.pointerDownPoint!.x, e.clientX),
      y: Math.min(this.pointerDownPoint!.y, e.clientY),
      width: Math.abs(w) || 1,
      height: Math.abs(h) || 1,
    };
    this.overlay.showMarquee(container, this.state.currentSelectRange);
  }

  private endMarquee() {
    this.overlay.hideMarquee();
    this.pointerDownPoint = null;

    if (this.state.currentSelectRange) {
      computeSelectedByMarquee(this.state.currentSelectRange, this.modelService.getAllModels())
        .forEach(id => this.cb.addSelectedModels(id));
    }
    this.state.currentSelectRange = null;
    this.cb.renderOverlay();
  }

  // -- 工具 -----------------------------------------------------

  /** 检查所有选中元素是否都允许缩放 */
  private canResizeSelected(): boolean {
    for (const id of this.state.selectModels) {
      const model = this.modelService.getModelById(id);
      if (model?.ctrlElement?.canResize && !model.ctrlElement.canResize()) return false;
    }
    return true;
  }

  private isInsideAABB(e: PointerEvent): boolean {
    const box = this.state.AABbBox;
    if (!box) return false;
    return e.clientX >= box.x && e.clientX <= box.x + box.width &&
      e.clientY >= box.y && e.clientY <= box.y + box.height;
  }

  private saveInitialState(includeSizes: boolean) {
    this.state.initialModelPositions.clear();
    if (includeSizes) this.state.initialModelSizes.clear();
    this.state.selectModels.forEach(id => {
      const model = this.modelService.getModelById(id);
      if (model?.points) {
        this.state.initialModelPositions.set(id, [...model.points]);
      }
      if (includeSizes && (model as any)?.width !== undefined) {
        this.state.initialModelSizes.set(id, { width: (model as any).width, height: (model as any).height });
      }
    });
  }

  private getCurrentModels() {
    return Array.from(this.state.selectModels)
      .map(id => this.modelService.getModelById(id))
      .filter(Boolean);
  }
}