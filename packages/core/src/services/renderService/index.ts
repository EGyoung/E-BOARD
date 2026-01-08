import { eBoardContainer } from "../../common/IocContainer";
import { IBoard, IServiceInitParams } from "../../types";
import { IModelService, ModelChangeType, BoundingBox, IModel } from '../modelService/type';
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

class TileManager {
  private tailRows: number;
  private tailCols: number;
  private canvasSize: {
    width: number;
    height: number;
  } = { width: 0, height: 0 };
  private dpr = window.devicePixelRatio || 1;

  private tailMap: Map<string, Set<string>> = new Map();

  constructor(rows: number, cols: number, canvasSize: { width: number; height: number }) {
    this.tailRows = rows;
    this.tailCols = cols;
    this.canvasSize = canvasSize;
  }

  // 计算出一个瓦片的大小
  public getTileSize() {
    const cssWidth = this.canvasSize.width / this.dpr;
    const cssHeight = this.canvasSize.height / this.dpr;
    return {
      width: cssWidth / this.tailCols,
      height: cssHeight / this.tailRows
    }
  }

  // 根据元素的范围来获取 这个范围内覆盖到的瓦片key, 最左上角 （0，0） 最右下角（31，31）
  private getKeysByBoundingBox(boundingBox: Range): string[] {
    const tileSize = this.getTileSize();
    const startTileX = Math.max(0, Math.floor(boundingBox.minX / tileSize.width));
    const startTileY = Math.max(0, Math.floor(boundingBox.minY / tileSize.height));
    const endTileX = Math.min(this.tailCols - 1, Math.floor(boundingBox.maxX / tileSize.width));
    const endTileY = Math.min(this.tailRows - 1, Math.floor(boundingBox.maxY / tileSize.height));
    const keys: string[] = [];
    for (let x = startTileX; x <= endTileX; x++) {
      for (let y = startTileY; y <= endTileY; y++) {
        keys.push(`${x},${y}`);
      }
    }
    return keys;
  }

  public addModel(model: IModel<Record<string, any>> | undefined, boundingBox: Range) {
    if (!model) return;
    const keys = this.getKeysByBoundingBox(boundingBox);
    keys.forEach((key) => {
      if (!this.tailMap.has(key)) {
        this.tailMap.set(key, new Set());
      }
      this.tailMap.get(key)?.add(model.id);
    })
  }

  public removeModel(model: IModel<Record<string, any>> | undefined, boundingBox: Range) {
    if (!model) return;
    const keys = this.getKeysByBoundingBox(boundingBox);
    keys.forEach((key) => {
      this.tailMap.get(key)?.delete(model.id);
      // 判断是否已经为空
      if (this.tailMap.get(key)?.size === 0) {
        // 如果为空，则从 map 中删除该键
        this.tailMap.delete(key);
      }
    })
  }

  public updateModel(model: IModel<Record<string, any>> | undefined, oldBoundingBox: Range, newBoundingBox: Range) {
    this.removeModel(model, oldBoundingBox);
    this.addModel(model, newBoundingBox);
  }

  public getModelIdsInRange(boundingBox: Range) {
    const keys = this.getKeysByBoundingBox(boundingBox);
    const resultSet: Set<string> = new Set();
    keys.forEach((key) => {
      const ids = this.tailMap.get(key);
      if (ids) {
        ids.forEach((id) => {
          resultSet.add(id)
        });
      }
    });
    return resultSet;
  }

  public clear() {
    this.tailMap.clear();
  }
}

class RenderService implements IRenderService {
  private board!: IBoard;
  private modelService = eBoardContainer.get<IModelService>(IModelService);
  private modelHandler = new Map<string, IDrawModelHandler>();
  private disposeList: (() => void)[] = [];
  private redrawRequested = false;
  private currentRanges: Range | null = null;
  private tileManager!: TileManager;
  public static readonly DIRTY_PADDING = 2;

  public static readonly TILE_ROWS = 32;
  public static readonly TILE_COLS = 32;
  public static readonly TILE_BUFFER = 200; // minX,minY,maxX,maxY 各扩展200px, 确保边界上的model也能被包含进来

  private getCanvasSize = () => {
    const canvas = this.board.getCanvas();
    if (!canvas) return { width: 0, height: 0 };
    return {
      width: canvas.width,
      height: canvas.height
    }
  }

  private rebuildTileIndex() {
    const models = this.modelService.getAllModels();
    this.tileManager.clear();

    models.forEach(model => {
      const box = model.ctrlElement?.getBoundingBox?.(model);
      if (box) {
        this.tileManager.addModel(model, this.normalizeBoundingBox(box));
      }
    });

  }

  init = ({ board }: IServiceInitParams) => {
    this.board = board;
    this.initModelChange();
    this.tileManager = new TileManager(RenderService.TILE_ROWS, RenderService.TILE_COLS, this.getCanvasSize())
    // window.tileManager = this.tileManager;
    // 先重建瓦片索引
    this.rebuildTileIndex()

    // 在重建索引后初始化视图状态，避免首次渲染时误判为视图变化
    const transformService = eBoardContainer.get<ITransformService>(ITransformService);
    this.lastStatus = transformService.getView();
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

  private getExpandedBoundingBox(state?: any) {
    const box: BoundingBox | undefined = state?.ctrlElement?.getBoundingBox?.(state);
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

  private handleModelOperationChange: Parameters<typeof this.modelService.onModelOperation>[0] = (event) => {
    // 只有Create Update Delete 走脏矩形渲染
    if (event.type === ModelChangeType.CREATE) {
      const boundingBox = this.getExpandedBoundingBox(event.model);
      if (!boundingBox) return;
      this.accumulateRange(boundingBox);
      const box = event.model?.ctrlElement?.getBoundingBox?.(event.model);
      if (box) {
        this.tileManager.addModel(event.model, this.normalizeBoundingBox(box));
      }
    } else if (event.type === ModelChangeType.DELETE) {
      const boundingBox = this.getExpandedBoundingBox(event.model);
      if (!boundingBox) return;
      this.accumulateRange(boundingBox);
      const box = event.model?.ctrlElement?.getBoundingBox?.(event.model);
      if (box) {
        this.tileManager.removeModel(event.model, this.normalizeBoundingBox(box));
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
        this.tileManager.updateModel(
          currentModel,
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



  private lastStatus: any

  private _render = () => {

    const context = this.board.getCtx();
    const interactionCtx = this.board.getInteractionCtx();
    const models = this.modelService.getAllModels();
    if (!context) return;
    const canvas = this.board.getCanvas();
    if (!canvas) return;
    const transformService = eBoardContainer.get<ITransformService>(ITransformService);

    let renderModels: IModel<Record<string, any>>[] = models;
    const view = transformService.getView();

    // 检查视图是否发生变化（漫游、缩放）
    const viewChanged = this.lastStatus && (
      this.lastStatus.x !== view.x ||
      this.lastStatus.y !== view.y ||
      this.lastStatus.zoom !== view.zoom
    );

    // 如果视图变化，重建瓦片索引
    if (viewChanged) {
      this.tileManager.clear();
      models.forEach((model) => {
        const box = model.ctrlElement?.getBoundingBox?.(model);
        if (box) {
          this.tileManager.addModel(
            model,
            this.normalizeBoundingBox(box as Range)
          );
        }
      });
      this.lastStatus = {
        x: view.x,
        y: view.y,
        zoom: view.zoom
      };
      // 注意：不要清空 currentRanges，让脏矩形渲染继续工作
      // 只有在需要强制全屏渲染时才清空
    }


    if (!this.currentRanges) {
      // 清空主画布
      context.clearRect(0, 0, canvas.width, canvas.height);
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


    // 设置绘制属性（包括根据缩放调整的线条宽度）
    // 绘制笔记
    const zoom = transformService.getView().zoom

    for (const model of renderModels) {
      if (this.currentRanges) {
        const modelBox = model.ctrlElement.getBoundingBox(model);
        if (!modelBox) continue;
        if (!isIntersect(this.currentRanges, modelBox)) {
          continue;
        }
      }
      const handler = this.modelHandler.get(model.type);
      if (handler) {
        context.beginPath();
        initContextAttrs(context, { zoom }, model.options);
        handler(model, context as any);
        context.stroke();
      }

    }


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
