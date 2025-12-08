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

  private handleModelOperationChange: Parameters<typeof this.modelService.onModelOperation>[0] = (event) => {
    if (event.type === ModelChangeType.CREATE) {
      const _boundingBox = event.model?.ctrlElement?.getBoundingBox(event.model);
      if (!_boundingBox) return;
      const boundingBox = this.expendDirtyRange(_boundingBox);

      if (!this.currentRanges) {
        this.currentRanges = {
          minX: boundingBox.minX,
          minY: boundingBox.minY,
          maxX: boundingBox.maxX,
          maxY: boundingBox.maxY,
        }
      } else {
        // 当前画布的脏区域
        this.currentRanges = {
          minX: Math.min(this.currentRanges.minX, boundingBox.minX),
          minY: Math.min(this.currentRanges.minY, boundingBox.minY),
          maxX: Math.max(this.currentRanges.maxX, boundingBox.maxX),
          maxY: Math.max(this.currentRanges.maxY, boundingBox.maxY),
        }
      }
    } else if (event.type === ModelChangeType.UPDATE) {
      const _prevBoundingBox = event.previousState?.ctrlElement.getBoundingBox(event.previousState);
      const _currentBoundBox = event.updates?.ctrlElement.getBoundingBox(event.updates);
      if (!_prevBoundingBox || !_currentBoundBox) return

      const prevBoundingBox = this.expendDirtyRange(_prevBoundingBox);
      const currentBoundBox = this.expendDirtyRange(_currentBoundBox);


      const updateBoundBox = {
        minX: Math.min(prevBoundingBox.minX, currentBoundBox.minX),
        minY: Math.min(prevBoundingBox.minY, currentBoundBox.minY),
        maxX: Math.max(prevBoundingBox.maxX, currentBoundBox.maxX),
        maxY: Math.max(prevBoundingBox.maxY, currentBoundBox.maxY),
      }

      if (!this.currentRanges) {
        this.currentRanges = updateBoundBox
      } else {
        // 当前画布的脏区域
        this.currentRanges = {
          minX: Math.min(this.currentRanges.minX, updateBoundBox.minX),
          minY: Math.min(this.currentRanges.minY, updateBoundBox.minY),
          maxX: Math.max(this.currentRanges.maxX, updateBoundBox.maxX),
          maxY: Math.max(this.currentRanges.maxY, updateBoundBox.maxY),
        }
      }

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

    console.log(this.currentRanges, 'currentRanges');
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

export default RenderService;
