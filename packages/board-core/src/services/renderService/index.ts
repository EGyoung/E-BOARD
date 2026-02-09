import { eBoardContainer } from "../../common/IocContainer";
import { IBoard, IServiceInitParams } from "../../types";
import { IModelService, ModelChangeType, BoundingBox, IModel } from '../modelService/type';
import { ITransformService } from "../transformService/type";


import { IDrawModelHandler, IRenderService, Range, View } from "./type";
import { TileManager } from "./tileManager";
import { Emitter, initContextAttrs } from '@e-board/board-utils';


class RenderService implements IRenderService {
  private board!: IBoard;
  private modelService = eBoardContainer.get<IModelService>(IModelService);
  private modelHandler = new Map<string, IDrawModelHandler>();
  private readonly _renderStart = new Emitter<void>();
  private readonly _renderEnd = new Emitter<void>();
  public onRenderStart = this._renderStart.event;
  public onRenderEnd = this._renderEnd.event;
  private disposeList: (() => void)[] = [];
  private redrawRequested = false;
  private currentRanges: Range | null = null;
  private tileManager!: TileManager;
  public static readonly DIRTY_PADDING = 2;

  public static readonly TILE_ROWS = 32;
  public static readonly TILE_COLS = 32;
  public static readonly TILE_BUFFER = 10; // minX,minY,maxX,maxY 各扩展10px, 确保边界上的model也能被包含进来

  private getCanvasSize = () => {
    const canvas = this.board.getCanvas();
    if (!canvas) return { width: 0, height: 0 };
    return {
      width: canvas.width,
      height: canvas.height
    }
  }


  init = ({ board }: IServiceInitParams) => {
    this.board = board;
    this.initModelChange();
    this.tileManager = new TileManager(RenderService.TILE_ROWS, RenderService.TILE_COLS, this.getCanvasSize())
    // 先重建瓦片索引
    this.rebuildTileIndex()

    // 在重建索引后初始化视图状态，避免首次渲染时误判为视图变化
    this.lastStatus = this.transformService.getView();
  };

  private initModelChange() {
    const { dispose } = this.modelService.onModelOperation(this.handleModelOperationChange);
    this.disposeList.push(dispose);
  }

  private expendDirtyRange(box: Range) {
    return {
      minX: box.minX - RenderService.DIRTY_PADDING,
      minY: box.minY - RenderService.DIRTY_PADDING,
      maxX: box.maxX + RenderService.DIRTY_PADDING,
      maxY: box.maxY + RenderService.DIRTY_PADDING,
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

  private getExpandedBoundingBox(model?: any) {
    const box: BoundingBox | undefined = model?.ctrlElement?.getBoundingBox?.(model);
    return box ? this.expendDirtyRange(box as Range) : null;
  }


  // 不是所有的model数据都有minX/minY/maxX/maxY，需要做下兼容
  private normalizeBoundingBox(box: any): BoundingBox {
    // 如果已经有 minX/minY/maxX/maxY，直接返回
    if (box.minX !== undefined && box.maxX !== undefined) {
      return box;
    }

    // 否则从 x/y/width/height 计算
    const minX = box.x;
    const minY = box.y;
    const maxX = box.x + box.width;
    const maxY = box.y + box.height;

    return {
      ...box,
      minX,
      minY,
      maxX,
      maxY
    };
  }

  private rebuildTileIndex() {
    if (!this.tileManager.tailsSize()) {
      const models = this.modelService.getAllModels();
      if (models.length) {
        models.forEach((model) => {
          const box = model.ctrlElement?.getBoundingBox?.(model);
          if (box) {
            this.tileManager.addModelId(
              model.id,
              this.normalizeBoundingBox(box as Range)
            );
          }
        });
      }
    }
  }

  private handleModelOperationChange: Parameters<typeof this.modelService.onModelOperation>[0] = (event) => {
    this.rebuildTileIndex()
    // 只有Create Update Delete 走脏矩形渲染
    if (event.type === ModelChangeType.CREATE) {
      const boundingBox = this.getExpandedBoundingBox(event.model);
      if (!boundingBox) return;
      this.accumulateRange(boundingBox);
      const box = event.model?.ctrlElement?.getBoundingBox?.();
      if (box) {
        this.tileManager.addModelId(event.model?.id, this.normalizeBoundingBox(box));
      }
    } else if (event.type === ModelChangeType.DELETE) {
      const boundingBox = this.getExpandedBoundingBox(event.model);
      if (!boundingBox) return;
      this.accumulateRange(boundingBox);
      const box = event.model?.ctrlElement?.getBoundingBox?.(event.model);
      if (box) {
        this.tileManager.removeModelId(event.model?.id, this.normalizeBoundingBox(box));
      }
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
      const prevBox = previousModel.ctrlElement?.getBoundingBox?.(previousModel);
      const currentBox = currentModel.ctrlElement?.getBoundingBox?.(currentModel);
      if (prevBox && currentBox) {
        this.tileManager.updateModelId(
          currentModel.id,
          this.normalizeBoundingBox(prevBox),
          this.normalizeBoundingBox(currentBox)
        );
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
    RenderService.transformService = null;
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

  private lastStatus: View | null = null

  private isViewChanged(view: View) {
    return this.lastStatus && (
      this.lastStatus.x !== view.x ||
      this.lastStatus.y !== view.y ||
      this.lastStatus.zoom !== view.zoom
    );
  }

  public static transformService: ITransformService | null = null;

  private get transformService() {
    if (!RenderService.transformService) {
      RenderService.transformService = eBoardContainer.get<ITransformService>(ITransformService);
    }
    return RenderService.transformService;
  }


  private _render = () => {
    const context = this.board.getCtx();
    const interactionCtx = this.board.getInteractionCtx();
    const models = this.modelService.getAllModels();
    if (!context) return;
    const canvas = this.board.getCanvas();
    if (!canvas) return;
    this._renderStart.fire();

    let renderModels: IModel<Record<string, any>>[] = models;
    const view = this.transformService.getView();
    const isViewChange = this.isViewChanged(view);
    // 如果视图变化, 清除瓦片, 下次modelchange前时再重新构建
    if (isViewChange) {
      this.tileManager.clear();
      this.lastStatus = {
        x: view.x,
        y: view.y,
        zoom: view.zoom
      };
    }



    if (!this.currentRanges) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      if (isViewChange) {
        context.save();
        // 缩放和移动 还有 dpr
        const dpr = window.devicePixelRatio || 1;
        const zoom = this.transformService.getView().zoom;
        context.setTransform(
          dpr * zoom,
          0,
          0,
          dpr * zoom,
          -view.x * dpr * zoom,
          -view.y * dpr * zoom
        );
      }


      // 同时清空交互画布，避免重叠
      if (interactionCtx) {
        interactionCtx.clearRect(0, 0, interactionCtx.canvas.width, interactionCtx.canvas.height);
      }
    } else {
      // currentRanges 已经通过 expendDirtyRange 包含了 padding，直接使用即可
      const { minX, minY, maxX, maxY } = this.currentRanges;
      const clearX = Math.floor(minX);
      const clearY = Math.floor(minY);
      const clearW = Math.ceil(maxX - minX);
      const clearH = Math.ceil(maxY - minY);


      context.clearRect(clearX, clearY, clearW, clearH);

      // 同时清空交互画布，避免重叠
      if (interactionCtx) {
        interactionCtx.clearRect(clearX, clearY, clearW, clearH);
      }
      context.save();
      context.beginPath();
      context.rect(clearX, clearY, clearW, clearH);
      context.clip();
      // 基于清理区域扩展 TILE_BUFFER，不要再次扩展 DIRTY_PADDING
      const extendedRange: Range = {
        minX: clearX - RenderService.TILE_BUFFER,
        minY: clearY - RenderService.TILE_BUFFER,
        maxX: clearX + clearW + RenderService.TILE_BUFFER,
        maxY: clearY + clearH + RenderService.TILE_BUFFER
      };
      const modelIdSet = this.tileManager.getModelIdsInRange(extendedRange);
      // 这么处理是为了保证models的顺序不变, 否则在移动过程中会导致层级疯狂修改
      renderModels = models.filter(model => modelIdSet.has(model.id));
    }

    const useWorldCoords = !this.currentRanges && isViewChange;
    const zoom = useWorldCoords ? 1 : this.transformService.getView().zoom

    for (const model of renderModels) {
      if (this.currentRanges) {
        const modelBox = model.ctrlElement.getBoundingBox();
        if (!modelBox) continue;
        if (!isIntersect(this.currentRanges, modelBox)) {
          continue;
        }
      }
      const handler = this.modelHandler.get(model.type);
      if (handler) {
        context.beginPath();
        initContextAttrs(context, { zoom }, model.options);
        handler(model, context as any, !!useWorldCoords);
        context.stroke();
      }


    }



    context.restore();
    this.currentRanges = null;
    this._renderEnd.fire();
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
