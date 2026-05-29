import { IBoard, IPluginInitParams } from "../../types";
import { eBoardContainer } from "../../common/IocContainer";
import { IModel, IModelService } from "../../services/modelService/type";
import { IPlugin } from "../type";
import { IModeService, IRenderService } from "../../services";
import { ITransformService } from "../../services/transformService/type";
import { Emitter } from "@e-board/board-utils";

type ResizeHandle =
  | "nw" | "n" | "ne"
  | "w" | "e"
  | "sw" | "s" | "se";

const HANDLE_SIZE = 8;
const MIN_ELEMENT_SIZE = 10;

const HANDLE_CURSORS: Record<ResizeHandle, string> = {
  nw: "nwse-resize", n: "ns-resize", ne: "nesw-resize",
  w: "ew-resize", e: "ew-resize",
  sw: "nesw-resize", s: "ns-resize", se: "nwse-resize",
};

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
  private readonly _onSelectedElements = new Emitter<IModel>();
  private emitSelectedElement = this._onSelectedElements.fire.bind(this._onSelectedElements);
  private readonly _onElementsMoving = new Emitter<IModel[]>()
  private emitElementsMoving = this._onElementsMoving.fire.bind(this._onElementsMoving)

  private activeHandle: ResizeHandle | null = null;
  private resizeStartAABB: { x: number; y: number; width: number; height: number } | null = null;
  private savedCursor: string = "";
  private handleElements = new Map<ResizeHandle, HTMLDivElement>();
  /**
   * 是否选中元素 如果已经渲染的元素再次被选中则不会被触发
   */
  public onElementMoving = this._onElementsMoving.event;
  public onSelectedElements = this._onSelectedElements.event;

  public pluginName = "SelectionPlugin";

  public exports = {
    getSelectedModelsId: this.getSelectedModelsId.bind(this),
    getSelectedModels: this.getSelectedModels.bind(this),
    onSelectedElements: this.onSelectedElements.bind(this),
    onElementsMoving: this.onElementMoving.bind(this)
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
    // todo 通过roam来监听
    canvas.addEventListener("wheel", e => {
      this.renderSelectionOverlay();
    });

    const { dispose } = this.renderService.onRenderEnd(this.renderSelectionOverlay);
    this.disposeList.push(dispose);

    modeService.registerMode(CURRENT_MODE, {
      beforeSwitchMode: ({ currentMode }) => {
        if (currentMode === CURRENT_MODE) {
          this.disposeList.forEach(dispose => dispose());
        }
      },
      afterSwitchMode: ({ currentMode }) => {
        if (currentMode === CURRENT_MODE) {
          this.initSelect();
        }
      }
    });
  }

  private resetAllState() {
    const canvas = this.board.getInteractionCanvas();
    const ctx = this.board.getInteractionCtx();
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // this.selectModels.clear();
    this.initialModelPositions.clear();
    this.currentSelectRange = null;
  }

  private initSelect() {
    const container = this.board.getContainer();
    const canvas = this.board.getInteractionCanvas();
    const ctx = this.board.getInteractionCtx();

    if (!canvas || !container) return;
    if (!ctx) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;

      // 先检测是否点击了缩放控制点
      const handle = this.hitTestHandles({ x: e.clientX, y: e.clientY });
      if (handle && this.AABbBox && this.selectModels.size > 0) {
        this.activeHandle = handle;
        this.resizeStartAABB = { ...this.AABbBox };
        this.pointerDownPoint = { x: e.clientX, y: e.clientY };
        this.savedCursor = container.style.cursor;
        container.style.cursor = HANDLE_CURSORS[handle];

        this.initialModelPositions.clear();
        this.initialModelSizes.clear();
        this.selectModels.forEach(id => {
          const model = this.modelService.getModelById(id);
          if (model?.points) {
            this.initialModelPositions.set(id, [...model.points]);
          }
          if ((model as any)?.width !== undefined) {
            this.initialModelSizes.set(id, { width: (model as any).width, height: (model as any).height });
          }
        });

        container.addEventListener("pointermove", handlePointerMove);
        container.addEventListener("pointerup", handlePointerUp);
        return;
      }

      // 判断点是否在AABB盒子内
      if (this.AABbBox) {
        // AABB盒子的坐标已经是经过transform的屏幕坐标，可以直接与clientX/Y比较
        if (
          e.clientX >= this.AABbBox.x &&
          e.clientX <= this.AABbBox.x + this.AABbBox.width &&
          e.clientY >= this.AABbBox.y &&
          e.clientY <= this.AABbBox.y + this.AABbBox.height
        ) {
          // console.log(this.selectModels, 'this.selectModels')
          // 在AABB盒子内，开始拖拽已选模型
          this.pointerDownPoint = { x: e.clientX, y: e.clientY };

          if (this.selectModels.size > 0) {
            // 保存所有选中模型的初始位置
            this.initialModelPositions.clear();
            this.selectModels.forEach(id => {
              const model = this.modelService.getModelById(id);
              if (model?.points) {
                this.initialModelPositions.set(id, [...model.points]);
              }
            });
            container.addEventListener("pointermove", handlePointerMove);
            container.addEventListener("pointerup", handlePointerUp);
            return;
          }
        }
      }
      this.resetAllState();
      this.selectModels.clear()

      this.pointerDownPoint = { x: e.clientX, y: e.clientY };
      const models = this.modelService.getAllModels().reverse();
      let count = 0
      for (const model of models) {
        if (!model) return;
        count++
        const ctrlElement = model.ctrlElement
        if (!ctrlElement) continue;
        const isIntersecting = ctrlElement.isHit({
          point: this.pointerDownPoint,
          model: model,
        })
        const bounding = ctrlElement.getBoundingBox()
        if (!bounding) continue;

        if (isIntersecting) {
          this.addSelectedModels(model.id);
          this.renderSelectionOverlay();
          break
        }
        // 判断是否最后一个
        if (count === models.length) {
          this.selectModels.clear();
        }
      }

      if (this.selectModels.size > 0) {
        // 保存所有选中模型的初始位置
        this.initialModelPositions.clear();
        this.selectModels.forEach(id => {
          const model = this.modelService.getModelById(id);
          if (model?.points) {
            this.initialModelPositions.set(id, [...model.points]);
          }
        });
      }

      container.addEventListener("pointermove", handlePointerMove);
      container.addEventListener("pointerup", handlePointerUp);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!this.pointerDownPoint) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // 使用 requestAnimationFrame 节流
      if (this.rafId !== null) {
        cancelAnimationFrame(this.rafId);
      }

      // 移动过程中要添加帧截流 不然会非常卡顿 每次移动的时候都要遍历一遍selectModels
      this.rafId = requestAnimationFrame(() => {
        if (!this.pointerDownPoint) return;

        // 缩放模式
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

          this.applyResizeToModels({ x: newX, y: newY, width: newW, height: newH });
          this.renderSelectionOverlay();
          return;
        }

        if (this.selectModels.size > 0) {
          const deltaX = e.clientX - this.pointerDownPoint.x;
          const deltaY = e.clientY - this.pointerDownPoint.y;
          const x = deltaX / (this.transformService.getView().zoom || 1);
          const y = deltaY / (this.transformService.getView().zoom || 1);
          // 基于初始位置和总偏移量更新模型位置
          this.selectModels.forEach(id => {
            const initialPoints = this.initialModelPositions.get(id);
            if (!initialPoints) return;

            const tempModel = this.modelService.getModelById(id);
            if (!tempModel) return;

            this.modelService.updateModel(id, {
              points: initialPoints.map(p => ({ x: p.x + x, y: p.y + y }))
            });
            tempModel.ctrlElement?.onElementMove?.(e);
          });
          const models = Array.from(this.selectModels).map(id => this.modelService.getModelById(id)!).filter(Boolean)
          this.emitElementsMoving(models);
          return;
        }

        const width = e.clientX - this.pointerDownPoint.x;
        const height = e.clientY - this.pointerDownPoint.y;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.strokeStyle = "rgba(14, 87, 75, 1)";
        // 虚线
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 2;
        ctx.strokeRect(this.pointerDownPoint.x, this.pointerDownPoint.y, width, height);
        this.currentSelectRange = {
          x: this.pointerDownPoint.x,
          y: this.pointerDownPoint.y,
          width: width || 1,
          height: height || 1
        };
        ctx.restore();
      });
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!this.pointerDownPoint) return;

      if (this.rafId !== null) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }

      // 结束缩放
      if (this.activeHandle) {
        container.style.cursor = this.savedCursor;
        this.activeHandle = null;
        this.resizeStartAABB = null;
        this.initialModelSizes.clear();
        container.removeEventListener("pointermove", handlePointerMove);
        container.removeEventListener("pointerup", handlePointerUp);
        this.pointerDownPoint = null;
        requestAnimationFrame(this.renderSelectionOverlay);
        return;
      }

      if (this.selectModels.size > 0) {
        container.removeEventListener("pointermove", handlePointerMove);
        container.removeEventListener("pointerup", handlePointerUp);
        // pointer up 后清除框选矩形，只保留元素外框
        this.currentSelectRange = null;
        requestAnimationFrame(this.renderSelectionOverlay);

        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.pointerDownPoint = null;
      container.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("pointerup", handlePointerUp);

      // 计算所有的包围盒
      const models = this.modelService.getAllModels();
      models.forEach(model => {
        const bounding = model.ctrlElement?.getBoundingBox();


        if (!this.currentSelectRange) return;
        const selectRect = {
          x: Math.min(
            this.currentSelectRange.x,
            this.currentSelectRange.x + this.currentSelectRange.width
          ),
          y: Math.min(
            this.currentSelectRange.y,
            this.currentSelectRange.y + this.currentSelectRange.height
          ),
          width: Math.abs(this.currentSelectRange.width),
          height: Math.abs(this.currentSelectRange.height)
        };
        const isIntersecting =
          bounding.minX < selectRect.x + selectRect.width &&
          bounding.maxX > selectRect.x &&
          bounding.minY < selectRect.y + selectRect.height &&
          bounding.maxY > selectRect.y;
        // 判断是否相交
        if (isIntersecting) {
          // console.log("选中了", model.id);
          this.addSelectedModels(model.id);
        }
      });

      // 计算完成后再清除框选矩形
      this.currentSelectRange = null;
      this.renderSelectionOverlay();
    };

    container.addEventListener("pointerdown", handlePointerDown);

    const handleHoverCursor = (e: PointerEvent) => {
      if (this.activeHandle) return;
      const handle = this.hitTestHandles({ x: e.clientX, y: e.clientY });
      container.style.cursor = handle ? HANDLE_CURSORS[handle] : "";
    };
    container.addEventListener("pointermove", handleHoverCursor);

    this.disposeList.push(() => {
      container.removeEventListener("pointerdown", handlePointerDown);
      container.removeEventListener("pointermove", handleHoverCursor);
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

  private normalizeBoundingBox(box: any) {
    if (box.minX !== undefined && box.maxX !== undefined) {
      return box;
    }

    return {
      ...box,
      minX: box.x,
      minY: box.y,
      maxX: box.x + box.width,
      maxY: box.y + box.height
    };
  }

  private renderSelectionOverlay = () => {
    const canvas = this.board.getInteractionCanvas();
    const ctx = this.board.getInteractionCtx();
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 在进行框选时保持选框绘制
    if (this.currentSelectRange) {
      const { x, y, width, height } = this.currentSelectRange;
      ctx.save();
      ctx.strokeStyle = "rgba(14, 87, 75, 1)";
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, height);
      ctx.restore();
    }

    if (this.selectModels.size === 0) {
      this.AABbBox = null;
      this.removeHandles();
      return;
    }

    const boxes: any[] = [];
    this.selectModels.forEach(id => {
      const model = this.modelService.getModelById(id);
      const bounding = model?.ctrlElement?.getBoundingBox?.();
      if (!bounding) return;

      boxes.push(bounding);
      ctx.save();
      ctx.strokeStyle = "white";
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 2;
      ctx.strokeRect(bounding.x, bounding.y, bounding.width, bounding.height);
      ctx.restore();
    });

    this.updateAABbBox(boxes, ctx);

    if (this.AABbBox) {
      this.drawHandles(ctx, this.AABbBox);
    }
  };

  private getHandlePositions(box: { x: number; y: number; width: number; height: number }): Record<ResizeHandle, { x: number; y: number }> {
    const { x, y, width, height } = box;
    const mx = x + width / 2;
    const my = y + height / 2;
    return {
      nw: { x, y },
      n: { x: mx, y },
      ne: { x: x + width, y },
      w: { x, y: my },
      e: { x: x + width, y: my },
      sw: { x, y: y + height },
      s: { x: mx, y: y + height },
      se: { x: x + width, y: y + height },
    };
  }

  private hitTestHandles(point: { x: number; y: number }): ResizeHandle | null {
    if (!this.AABbBox) return null;
    const handles = this.getHandlePositions(this.AABbBox);
    const half = HANDLE_SIZE / 2 + 2;
    for (const [key, pos] of Object.entries(handles)) {
      if (Math.abs(point.x - pos.x) <= half && Math.abs(point.y - pos.y) <= half) {
        return key as ResizeHandle;
      }
    }
    return null;
  }

  private drawHandles(_ctx: CanvasRenderingContext2D, box: { x: number; y: number; width: number; height: number }) {
    const handles = this.getHandlePositions(box);
    const half = HANDLE_SIZE / 2;
    const container = this.board.getContainer();
    if (!container) return;

    for (const [key, pos] of Object.entries(handles) as [ResizeHandle, { x: number; y: number }][]) {
      let el = this.handleElements.get(key);
      if (!el) {
        el = document.createElement("div");
        el.style.position = "absolute";
        el.style.width = `${HANDLE_SIZE}px`;
        el.style.height = `${HANDLE_SIZE}px`;
        el.style.background = "white";
        el.style.border = "1.5px solid rgba(14, 87, 75, 1)";
        el.style.boxSizing = "border-box";
        el.style.pointerEvents = "none";
        el.style.zIndex = "999";
        container.appendChild(el);
        this.handleElements.set(key, el);
      }
      el.style.left = `${pos.x - half}px`;
      el.style.top = `${pos.y - half}px`;
      el.style.display = "block";
    }
  }

  private removeHandles() {
    this.handleElements.forEach(el => el.remove());
    this.handleElements.clear();
  }

  private applyResizeToModels(newAABB: { x: number; y: number; width: number; height: number }) {
    if (!this.resizeStartAABB) return;
    const orig = this.resizeStartAABB;

    const scaleX = orig.width !== 0 ? newAABB.width / orig.width : 1;
    const scaleY = orig.height !== 0 ? newAABB.height / orig.height : 1;

    this.selectModels.forEach(id => {
      const initialPoints = this.initialModelPositions.get(id);
      if (!initialPoints) return;

      const model = this.modelService.getModelById(id);
      if (!model) return;

      const initialSize = this.initialModelSizes.get(id);
      const hasSize = initialSize && initialSize.width !== undefined && initialSize.height !== undefined;

      if (hasSize) {
        const anchor = initialPoints[0];
        const screenAnchor = this.transformService.transformPoint(anchor);
        const newScreenX = newAABB.x + (screenAnchor.x - orig.x) * scaleX;
        const newScreenY = newAABB.y + (screenAnchor.y - orig.y) * scaleY;
        const newWorldAnchor = this.transformService.transformPoint({ x: newScreenX, y: newScreenY }, true);

        const newWidth = Math.max(MIN_ELEMENT_SIZE, initialSize.width! * scaleX);
        const newHeight = Math.max(MIN_ELEMENT_SIZE, initialSize.height! * scaleY);

        this.modelService.updateModel(id, {
          points: [newWorldAnchor],
          width: newWidth,
          height: newHeight,
        } as any);
      } else {
        const newPoints = initialPoints.map(p => {
          const sp = this.transformService.transformPoint(p);
          const newSx = newAABB.x + (sp.x - orig.x) * scaleX;
          const newSy = newAABB.y + (sp.y - orig.y) * scaleY;
          return this.transformService.transformPoint({ x: newSx, y: newSy }, true);
        });
        this.modelService.updateModel(id, { points: newPoints });
      }
    });
  }

  private updateAABbBox(boxes?: any[], ctx?: CanvasRenderingContext2D) {
    const normalizedBoxes = (boxes ?? Array.from(this.selectModels)
      .map(id => {
        const model = this.modelService.getModelById(id);
        if (!model) return null;
        const bounding = model.ctrlElement?.getBoundingBox();
        return bounding;
      })
      .filter(Boolean))
      .map(box => this.normalizeBoundingBox(box));

    if (normalizedBoxes.length === 0) {
      this.AABbBox = null;
      return;
    }

    let minX = Math.min(...normalizedBoxes.map(box => box!.minX));
    let minY = Math.min(...normalizedBoxes.map(box => box!.minY));
    let maxX = Math.max(...normalizedBoxes.map(box => box!.maxX));
    let maxY = Math.max(...normalizedBoxes.map(box => box!.maxY));
    this.AABbBox = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };

    if (!ctx) return;

    ctx.save();
    ctx.strokeStyle = "pink";
    ctx.setLineDash([10, 5]);
    ctx.lineWidth = 2;
    ctx.strokeRect(this.AABbBox.x, this.AABbBox.y, this.AABbBox.width, this.AABbBox.height);
    ctx.restore();
  }

  public dispose() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.removeHandles();
    this.disposeList.forEach(dispose => dispose());
    this.disposeList = [];
  }

}

export default SelectionPlugin;
