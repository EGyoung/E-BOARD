import { eBoardContainer } from "../../common/IocContainer";
import { IBoard, IServiceInitParams } from "../../types";
import { IModelService, ModelChangeType, BoundingBox } from '../modelService/type';
import { ITransformService } from "../transformService/type";
import { initContextAttrs } from "@e-board/utils";

import { IRenderService } from "./type";

interface IDrawModelHandler {
  (model: any, ctx?: CanvasRenderingContext2D): void;
}

type Range = {
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
}

class RenderService implements IRenderService {
  private board!: IBoard;
  private modelService = eBoardContainer.get<IModelService>(IModelService);
  private modelHandler = new Map<string, IDrawModelHandler>();
  private disposeList: (() => void)[] = [];
  private redrawRequested = false;
  private dirtyPadding = 2;
  private currentRanges: Range | null = null;

  init = ({ board }: IServiceInitParams) => {
    this.board = board;
    this.initModelChange();

  };

  private initModelChange() {
    const { dispose } = this.modelService.onModelOperation(this.handleModelOperationChange);
    this.disposeList.push(dispose);
  }

  private expendDirtyRange(box: Range) {
    return {
      minX: box.minX - this.dirtyPadding,
      minY: box.minY - this.dirtyPadding,
      maxX: box.maxX + this.dirtyPadding,
      maxY: box.maxY + this.dirtyPadding,
    }
  }

  private accumulateRange(nextRange: Range) {
    if (!nextRange) return;
    if (!this.currentRanges) {
      this.currentRanges = { ...nextRange };
      return;
    }

    this.currentRanges = {
      minX: Math.min(this.currentRanges.minX, nextRange.minX),
      minY: Math.min(this.currentRanges.minY, nextRange.minY),
      maxX: Math.max(this.currentRanges.maxX, nextRange.maxX),
      maxY: Math.max(this.currentRanges.maxY, nextRange.maxY),
    };
  }

  private getExpandedBoundingBox(state?: any) {
    const box: BoundingBox | undefined = state?.ctrlElement?.getBoundingBox?.(state);
    return box ? this.expendDirtyRange(box as Range) : null;
  }

  private handleModelOperationChange: Parameters<typeof this.modelService.onModelOperation>[0] = (event) => {
    // 只有Create Update Delete 走脏矩形渲染
    if (event.type === ModelChangeType.CREATE || event.type === ModelChangeType.DELETE) {
      const boundingBox = this.getExpandedBoundingBox(event.model);
      if (!boundingBox) return;
      this.accumulateRange(boundingBox);
    } else if (event.type === ModelChangeType.UPDATE) {
      // 获取更新后的完整模型
      const currentModel = this.modelService.getModelById(event.modelId);
      if (!currentModel) return;

      // 构建更新前的完整模型状态（合并 previousState）
      const previousModel = { ...currentModel, ...event.previousState };

      const prevBoundingBox = this.getExpandedBoundingBox(previousModel);
      const currentBoundingBox = this.getExpandedBoundingBox(currentModel);

      if (!prevBoundingBox || !currentBoundingBox) return;

      const updateBoundBox: Range = {
        minX: Math.min(prevBoundingBox.minX, currentBoundingBox.minX),
        minY: Math.min(prevBoundingBox.minY, currentBoundingBox.minY),
        maxX: Math.max(prevBoundingBox.maxX, currentBoundingBox.maxX),
        maxY: Math.max(prevBoundingBox.maxY, currentBoundingBox.maxY),
      };

      this.accumulateRange(updateBoundBox);
    }

    this.reRender()
  }


  public registerDrawModelHandler(key: string, handler: IDrawModelHandler) {
    this.modelHandler.set(key, handler);
  }

  public unregisterDrawModelHandler(key: string) {
    this.modelHandler.delete(key);
  }

  public dispose(): void {
    this.modelHandler = new Map();
    this.disposeList.forEach(dispose => dispose());
  }

  public reRender = () => {
    if (!this.redrawRequested) {
      this.redrawRequested = true;
      requestAnimationFrame(() => {
        this._render();
        this.redrawRequested = false;
      });
    }
  };

  private _render = () => {
    const context = this.board.getCtx();
    const interactionCtx = this.board.getInteractionCtx();
    const models = this.modelService.getAllModels();
    if (!context) return;
    const canvas = this.board.getCanvas();
    if (!canvas) return;
    const transformService = eBoardContainer.get<ITransformService>(ITransformService);

    // console.log(this.currentRanges, 'currentRanges');
    if (!this.currentRanges) {
      // 清空主画布
      context.clearRect(0, 0, canvas.width, canvas.height);
      // 同时清空交互画布，避免重叠
      if (interactionCtx) {
        interactionCtx.clearRect(0, 0, interactionCtx.canvas.width, interactionCtx.canvas.height);
      }
    } else {

      const transformMinPoint = ({ x: this.currentRanges.minX, y: this.currentRanges.minY });
      const transformMaxPoint = ({ x: this.currentRanges.maxX, y: this.currentRanges.maxY });
      const width = transformMaxPoint.x - transformMinPoint.x;
      const height = transformMaxPoint.y - transformMinPoint.y;

      const clearX = Math.floor(transformMinPoint.x - this.dirtyPadding);
      const clearY = Math.floor(transformMinPoint.y - this.dirtyPadding);
      const clearW = Math.ceil(width + this.dirtyPadding * 2);
      const clearH = Math.ceil(height + this.dirtyPadding * 2);
      context.clearRect(clearX, clearY, clearW, clearH);

      // // 同时清空交互画布，避免重叠
      if (interactionCtx) {
        interactionCtx.clearRect(clearX, clearY, clearW, clearH);
      }
      context.save();
      context.beginPath();
      context.rect(clearX, clearY, clearW, clearH);
      context.clip();

    }


    // 设置绘制属性（包括根据缩放调整的线条宽度）
    // 绘制笔记
    models.forEach(model => {
      if (this.currentRanges) {
        const modelBox = model.ctrlElement.getBoundingBox(model);
        if (!isIntersect(this.currentRanges, this.expendDirtyRange(modelBox))) {
          return;
        }
      }
      const handler = this.modelHandler.get(model.type);
      if (handler) {
        context.beginPath();
        initContextAttrs(
          context,
          { zoom: transformService.getView().zoom },
          model.options
        );
        handler(model, context as any);
        context.stroke();
      }
    });

    context.restore();
    this.currentRanges = null;
  };
}

// 判断两个区域是否相交
const isIntersect = (rangeA: Range, rangeB: Range): boolean => {
  return !(
    rangeA.maxX <= rangeB.minX ||
    rangeA.minX >= rangeB.maxX ||
    rangeA.maxY <= rangeB.minY ||
    rangeA.minY >= rangeB.maxY
  );
}

export default RenderService;
