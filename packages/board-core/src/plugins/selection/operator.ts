import { IModelService } from "../../services/modelService/type";
import { ITransformService } from "../../services/transformService/type";
import { MIN_ELEMENT_SIZE, ScreenRect } from "./overlay";

// ---------------------------------------------------------------------------
// Params
// ---------------------------------------------------------------------------

export interface ResizeParams {
  newAABB: ScreenRect;
  resizeStartAABB: ScreenRect;
  selectModels: Set<string>;
  initialModelPositions: Map<string, { x: number; y: number }[]>;
  initialModelSizes: Map<string, { width?: number; height?: number }>;
}

export interface DragParams {
  deltaX: number;
  deltaY: number;
  selectModels: Set<string>;
  initialModelPositions: Map<string, { x: number; y: number }[]>;
  event?: PointerEvent;
}

// ---------------------------------------------------------------------------
// SelectionOperator
// ---------------------------------------------------------------------------

/**
 * 选中元素的变换操作（缩放 & 拖拽）。
 * 通过构造函数注入依赖，方法不直接持有 service 引用。
 */
export class SelectionOperator {
  constructor(
    private modelService: IModelService,
    private transformService: ITransformService,
  ) {}

  /** 缩放选中的模型 */
  resize(params: ResizeParams): void {
    const { newAABB, resizeStartAABB: orig, selectModels, initialModelPositions, initialModelSizes } = params;
    const scaleX = orig.width !== 0 ? newAABB.width / orig.width : 1;
    const scaleY = orig.height !== 0 ? newAABB.height / orig.height : 1;

    selectModels.forEach(id => {
      const initialPoints = initialModelPositions.get(id);
      if (!initialPoints) return;

      const model = this.modelService.getModelById(id);
      if (!model) return;

      const initialSize = initialModelSizes.get(id);
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

  /** 拖拽选中的模型 */
  drag(params: DragParams): void {
    const { deltaX, deltaY, selectModels, initialModelPositions, event } = params;
    const zoom = this.transformService.getView().zoom || 1;
    const x = deltaX / zoom;
    const y = deltaY / zoom;

    selectModels.forEach(id => {
      const initialPoints = initialModelPositions.get(id);
      if (!initialPoints) return;

      const model = this.modelService.getModelById(id);
      if (!model) return;

      this.modelService.updateModel(id, {
        points: initialPoints.map(p => ({ x: p.x + x, y: p.y + y })),
      });
      if (event) {
        model.ctrlElement?.onElementMove?.(event);
      }
    });
  }
}