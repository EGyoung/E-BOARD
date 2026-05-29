import { eBoardContainer } from "../../common/IocContainer";
import { IBoard, IServiceInitParams } from "../../types";
import { IModelService, ModelChangeType, BoundingBox, IModel } from '../modelService/type';
import { ITransformService } from "../transformService/type";


import { IRenderService, Range, View } from "./type";
import { TileManager } from "./tileManager";
import { Emitter, initContextAttrs } from '@e-board/board-utils';
import { IElementService } from "../elementService/type";


class RenderService implements IRenderService {
  private board!: IBoard;
  private modelService = eBoardContainer.get<IModelService>(IModelService);
  private elementService = eBoardContainer.get<IElementService>(IElementService);
  private readonly _renderStart = new Emitter<void>();
  private readonly _renderEnd = new Emitter<void>();
  public onRenderStart = this._renderStart.event;
  public onRenderEnd = this._renderEnd.event;
  private disposeList: (() => void)[] = [];
  private redrawRequested = false;
  private currentRanges: Range | null = null; // 累积的脏矩形范围
  private tileManager!: TileManager;
  private renderHandlerCache = new Map<string, any>();
  public static readonly DIRTY_PADDING = 2;

  public static readonly TILE_ROWS = 32;
  public static readonly TILE_COLS = 32;
  public static readonly TILE_BUFFER = 10; // minX,minY,maxX,maxY 各扩展10px, 确保边界上的model也能被包含进来

  // OffscreenCanvas 缓存：元素预渲染到离屏画布，漫游时只做 drawImage
  private offscreenCanvas: OffscreenCanvas | null = null;
  private offscreenCtx: OffscreenCanvasRenderingContext2D | null = null;
  private offscreenDirty = true;
  // 离屏画布覆盖的世界坐标范围
  private offscreenWorldBounds: Range = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  // 上次渲染是否通过 offscreen drawImage 完成 
  // 比如： 如果上次是通过漫游/缩放的这里就是true
  private lastRenderWasOffscreen = false;

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
    this.offscreenDirty = true;
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


  public dispose(): void {
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

    const view = this.transformService.getView();
    const isViewChange = this.isViewChanged(view);
    if (isViewChange) {
      this.lastStatus = {
        x: view.x,
        y: view.y,
        zoom: view.zoom
      };
    }

    // 脏矩形渲染（元素变化时的局部更新）
    if (this.currentRanges) {
      // 为了处理抬手后的那下全量绘制图形才做的这个this.lastRenderWasOffscreen变量
      if (this.lastRenderWasOffscreen) {
        // 从 offscreen 模式切换到编辑模式，先全量直接渲染重置画布
        this.lastRenderWasOffscreen = false;
        this.currentRanges = null;
        context.clearRect(0, 0, canvas.width, canvas.height);
        if (interactionCtx) {
          interactionCtx.clearRect(0, 0, interactionCtx.canvas.width, interactionCtx.canvas.height);
        }
        this._renderDirect(context, models, this.transformService.getView());
        this.tileManager.clear();
        this.rebuildTileIndex();
        this._renderEnd.fire();
        return;
      }
      this._renderDirtyRect(context, interactionCtx, models);
      return;
    }

    // 清空主画布和交互画布
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (interactionCtx) {
      interactionCtx.clearRect(0, 0, interactionCtx.canvas.width, interactionCtx.canvas.height);
    }

    if (!models.length) {
      this._renderEnd.fire();
      return;
    }

    // 确保离屏画布是最新的
    if (this.offscreenDirty || !this.offscreenCanvas) {
      this._rebuildOffscreen(models);
    }

    if (!this.offscreenCanvas) {
      // 超出 OffscreenCanvas 尺寸限制，回退到直接绘制
      this._renderDirect(context, models, view);
      this._renderEnd.fire();
      return;
    }

    // 漫游/缩放时只做一次 drawImage
    const dpr = window.devicePixelRatio || 1;
    const zoom = view.zoom;
    const { minX: worldMinX, minY: worldMinY } = this.offscreenWorldBounds;

    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    // 将离屏画布绘制到主画布：世界坐标 → 屏幕坐标
    const sx = 0;
    const sy = 0;
    const sw = this.offscreenCanvas.width;
    const sh = this.offscreenCanvas.height;
    // 离屏画布左上角（worldMinX, worldMinY）对应的屏幕位置
    const dx = (worldMinX - view.x) * zoom * dpr;
    const dy = (worldMinY - view.y) * zoom * dpr;
    const dw = sw * zoom * dpr;
    const dh = sh * zoom * dpr;
    context.drawImage(this.offscreenCanvas, sx, sy, sw, sh, dx, dy, dw, dh);
    context.restore();
    this.lastRenderWasOffscreen = true;

    this._renderEnd.fire();
  };

  // 将所有元素绘制到离屏画布（世界坐标，1:1 像素）
  private _rebuildOffscreen(models: IModel<Record<string, any>>[]) {
    // 计算所有元素的世界坐标包围盒
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const model of models) {
      if (!model.points?.length) continue;
      if (model.width !== undefined && model.height !== undefined) {
        const p = model.points[0];
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x + model.width > maxX) maxX = p.x + model.width;
        if (p.y + model.height > maxY) maxY = p.y + model.height;
      } else {
        for (const p of model.points) {
          if (p.x < minX) minX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.x > maxX) maxX = p.x;
          if (p.y > maxY) maxY = p.y;
        }
      }
    }

    if (!isFinite(minX)) {
      this.offscreenCanvas = null;
      this.offscreenCtx = null;
      this.offscreenDirty = false;
      return;
    }

    const padding = 20;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const w = Math.ceil(maxX - minX);
    const h = Math.ceil(maxY - minY);

    // 限制最大尺寸防止显存爆炸
    const MAX_SIZE = 8192;
    if (w > MAX_SIZE || h > MAX_SIZE) {
      // 超出限制，回退到直接绘制
      this.offscreenCanvas = null;
      this.offscreenCtx = null;
      this.offscreenDirty = false;
      return;
    }

    this.offscreenWorldBounds = { minX, minY, maxX, maxY };

    if (!this.offscreenCanvas || this.offscreenCanvas.width !== w || this.offscreenCanvas.height !== h) {
      this.offscreenCanvas = new OffscreenCanvas(w, h);
      this.offscreenCtx = this.offscreenCanvas.getContext('2d')!;
    }

    // 下面的逻辑就是将元素绘制到OffscreenCanvas上
    const ctx = this.offscreenCtx!;
    ctx.clearRect(0, 0, w, h);
    // 偏移到世界坐标原点
    ctx.save();
    ctx.translate(-minX, -minY);

    for (const model of models) {
      const comp = this.elementService.getElement(model.type);
      if (!comp) continue;
      let renderHandler = this.renderHandlerCache.get(model.type);
      if (!renderHandler) {
        renderHandler = new comp.render(this.board);
        this.renderHandlerCache.set(model.type, renderHandler);
      }
      if (renderHandler) {
        ctx.beginPath();
        initContextAttrs(ctx as any, { zoom: 1 }, model.options);
        renderHandler.render(model, ctx as any, true);
        ctx.stroke();
      }
    }
    ctx.restore();
    this.offscreenDirty = false;
  }

  // 脏矩形渲染：元素变化时的局部更新（保持原有逻辑）
  private _renderDirtyRect(
    context: CanvasRenderingContext2D,
    interactionCtx: CanvasRenderingContext2D | null,
    models: IModel<Record<string, any>>[]
  ) {
    const { minX, minY, maxX, maxY } = this.currentRanges!;
    const clearX = Math.floor(minX);
    const clearY = Math.floor(minY);
    const clearW = Math.ceil(maxX - minX);
    const clearH = Math.ceil(maxY - minY);

    context.clearRect(clearX, clearY, clearW, clearH);
    if (interactionCtx) {
      interactionCtx.clearRect(clearX, clearY, clearW, clearH);
    }
    context.save();
    context.beginPath();
    context.rect(clearX, clearY, clearW, clearH);
    context.clip();

    const extendedRange: Range = {
      minX: clearX - RenderService.TILE_BUFFER,
      minY: clearY - RenderService.TILE_BUFFER,
      maxX: clearX + clearW + RenderService.TILE_BUFFER,
      maxY: clearY + clearH + RenderService.TILE_BUFFER
    };
    const modelIdSet = this.tileManager.getModelIdsInRange(extendedRange);
    const renderModels = models.filter(model => modelIdSet.has(model.id));
    const zoom = this.transformService.getView().zoom;

    for (const model of renderModels) {
      const modelBox = model.ctrlElement.getBoundingBox();
      if (!modelBox) continue;
      if (!isIntersect(this.currentRanges!, modelBox)) continue;
      const comp = this.elementService.getElement(model.type);
      if (!comp) continue;
      let renderHandler = this.renderHandlerCache.get(model.type);
      if (!renderHandler) {
        renderHandler = new comp.render(this.board);
        this.renderHandlerCache.set(model.type, renderHandler);
      }
      if (renderHandler) {
        context.beginPath();
        initContextAttrs(context, { zoom }, model.options);
        renderHandler.render(model, context as any, false);
        context.stroke();
      }
    }
    context.restore();
    this.currentRanges = null;
    this._renderEnd.fire();
  }

  // 回退路径：OffscreenCanvas 不可用时直接绘制（原有逻辑）
  private _renderDirect(
    context: CanvasRenderingContext2D,
    models: IModel<Record<string, any>>[],
    view: View
  ) {
    const dpr = window.devicePixelRatio || 1;
    const zoom = view.zoom;
    context.save();
    context.setTransform(
      dpr * zoom, 0,
      0, dpr * zoom,
      -view.x * dpr * zoom,
      -view.y * dpr * zoom
    );
    for (const model of models) {
      const comp = this.elementService.getElement(model.type);
      if (!comp) continue;
      let renderHandler = this.renderHandlerCache.get(model.type);
      if (!renderHandler) {
        renderHandler = new comp.render(this.board);
        this.renderHandlerCache.set(model.type, renderHandler);
      }
      if (renderHandler) {
        context.beginPath();
        initContextAttrs(context, { zoom: 1 }, model.options);
        renderHandler.render(model, context as any, true);
        context.stroke();
      }
    }
    context.restore();
  }

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
