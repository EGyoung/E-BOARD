import { injectable, inject } from "inversify";
import { IBoard, IServiceInitParams } from "../../types";
import { IModelService, IModel } from '../modelService/type';
import { ITransformService } from "../transformService/type";


import { IRenderService, Range, View } from "./type";
import { TileManager } from "./tileManager";
import { Emitter } from '@e-board/board-utils';
import { IElementService } from "../elementService/type";
import { OffscreenRenderCache } from './offscreenCache';
import { expandDirtyRange, mergeRanges, normalizeBoundingBox } from './range';
import { applyModelChange } from './modelChange';
import { renderDirect, renderDirtyRect } from './renderers';
import { RenderHandlerRegistry } from './renderHandlerRegistry';

type RenderFrame = {
  context: CanvasRenderingContext2D;
  interactionCtx: CanvasRenderingContext2D | null;
  canvas: HTMLCanvasElement;
  models: IModel<Record<string, any>>[];
  view: View;
}

type RenderMode = 'direct' | 'dirty' | 'offscreen';

@injectable()
class RenderService implements IRenderService {
  private board!: IBoard;
  private modelService: IModelService;
  private elementService: IElementService;
  private readonly _renderStart = new Emitter<void>();
  private readonly _renderEnd = new Emitter<void>();
  public onRenderStart = this._renderStart.event;
  public onRenderEnd = this._renderEnd.event;
  private disposeList: (() => void)[] = [];
  private pendingAnimationFrameId: number | null = null;
  private pendingDirtyRange: Range | null = null;
  private tileManager!: TileManager;
  private tileIndexView: View | null = null;
  private renderHandlerRegistry!: RenderHandlerRegistry;
  private offscreenCache!: OffscreenRenderCache;
  private transformService!: ITransformService;
  private lastRenderMode: RenderMode = 'direct';
  private zoomSettleTimerId: number | null = null;
  private forceOffscreenScaleRebuild = false;

  constructor(
    @inject(IModelService) modelService: IModelService,
    @inject(IElementService) elementService: IElementService,
    @inject(ITransformService) transformService: ITransformService
  ) {
    this.modelService = modelService;
    this.elementService = elementService;
    this.transformService = transformService;
  }
  private static readonly DIRTY_PADDING = 2;
  private static readonly ZOOM_SETTLE_DELAY = 80;

  private static readonly TILE_ROWS = 32;
  private static readonly TILE_COLS = 32;
  private static readonly TILE_BUFFER = 10;

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
    this.renderHandlerRegistry = new RenderHandlerRegistry(this.board, this.elementService);
    this.offscreenCache = new OffscreenRenderCache(this.renderHandlerRegistry);
    this.initModelChange();
    this.tileManager = new TileManager(RenderService.TILE_ROWS, RenderService.TILE_COLS, this.getCanvasSize())
    this.rebuildTileIndex(this.transformService.getView())
  };

  private initModelChange() {
    const { dispose } = this.modelService.onModelOperation(this.handleModelOperationChange);
    this.disposeList.push(dispose);
  }

  private accumulateRange(nextRange: Range) {
    this.pendingDirtyRange = mergeRanges(this.pendingDirtyRange, nextRange);
  }

  private getExpandedBoundingBox(model?: any) {
    const box = model?.ctrlElement?.getBoundingBox?.(model);
    return box ? expandDirtyRange(normalizeBoundingBox(box), RenderService.DIRTY_PADDING) : null;
  }

  private copyView(view: View): View {
    return {
      x: view.x,
      y: view.y,
      zoom: view.zoom,
    };
  }

  private isSameView(current: View | null, next: View) {
    return !!current
      && current.x === next.x
      && current.y === next.y
      && current.zoom === next.zoom;
  }

  private rebuildTileIndex(view: View) {
    this.tileManager.clear();

    const models = this.modelService.getAllModels();
    if (models.length) {
      models.forEach((model) => {
        const box = model.ctrlElement?.getBoundingBox?.(model);
        if (box) {
          this.tileManager.addModelId(
            model.id,
            normalizeBoundingBox(box as Range)
          );
        }
      });
    }

    this.tileIndexView = this.copyView(view);
  }

  private ensureTileIndex(view: View) {
    if (!this.tileManager.tailsSize()) {
      this.rebuildTileIndex(view);
    }
  }

  private syncTileIndexView(view: View) {
    if (!this.isSameView(this.tileIndexView, view)) {
      this.rebuildTileIndex(view);
      return;
    }

    this.ensureTileIndex(view);
  }

  private handleModelOperationChange: Parameters<typeof this.modelService.onModelOperation>[0] = (event) => {
    const view = this.transformService.getView();

    this.offscreenCache.markDirty();
    this.syncTileIndexView(view);
    applyModelChange({
      event,
      modelService: this.modelService,
      tileManager: this.tileManager,
      ensureTileIndex: () => this.ensureTileIndex(view),
      accumulateRange: (range) => this.accumulateRange(range),
      resetDirtyRange: () => {
        this.pendingDirtyRange = null;
      },
      getExpandedBoundingBox: (model) => this.getExpandedBoundingBox(model),
    });
    this.reRender()
  }


  public dispose(): void {
    this.disposeList.forEach(dispose => dispose());
    this.disposeList = [];

    if (this.pendingAnimationFrameId !== null) {
      cancelAnimationFrame(this.pendingAnimationFrameId);
      this.pendingAnimationFrameId = null;
    }

    if (this.zoomSettleTimerId !== null) {
      window.clearTimeout(this.zoomSettleTimerId);
      this.zoomSettleTimerId = null;
    }

    this.pendingDirtyRange = null;
    this.tileIndexView = null;
    this.lastRenderMode = 'direct';
    this.forceOffscreenScaleRebuild = false;

    if (this.renderHandlerRegistry) {
      this.renderHandlerRegistry.clear();
    }

    if (this.offscreenCache) {
      this.offscreenCache.dispose();
    }
  }

  public reRender = () => {
    if (this.pendingAnimationFrameId === null) {
      this.pendingAnimationFrameId = requestAnimationFrame(() => {
        this.pendingAnimationFrameId = null;
        this._render();
      });
    }
  };

  public renderSync = () => {
    if (this.pendingAnimationFrameId !== null) {
      cancelAnimationFrame(this.pendingAnimationFrameId);
      this.pendingAnimationFrameId = null;
    }
    this._render();
  };


  private scheduleZoomSettledRender() {
    if (this.zoomSettleTimerId !== null) {
      window.clearTimeout(this.zoomSettleTimerId);
    }

    this.zoomSettleTimerId = window.setTimeout(() => {
      this.zoomSettleTimerId = null;
      this.forceOffscreenScaleRebuild = true;
      this.reRender();
    }, RenderService.ZOOM_SETTLE_DELAY);
  }

  private clearContexts(
    frame: RenderFrame
  ) {
    frame.context.clearRect(0, 0, frame.canvas.width, frame.canvas.height);
    if (frame.interactionCtx) {
      frame.interactionCtx.clearRect(0, 0, frame.interactionCtx.canvas.width, frame.interactionCtx.canvas.height);
    }
  }

  private renderAfterOffscreenEdit(frame: RenderFrame) {
    this.pendingDirtyRange = null;
    this.clearContexts(frame);
    this.renderDirectFrame(frame);
    this.rebuildTileIndex(frame.view);
  }

  private renderDirectFrame(frame: RenderFrame) {
    renderDirect({
      context: frame.context,
      models: frame.models,
      view: frame.view,
      renderHandlerRegistry: this.renderHandlerRegistry,
    });
    this.lastRenderMode = 'direct';
  }

  private renderDirtyChanges(frame: RenderFrame): boolean {
    const dirtyRange = this.pendingDirtyRange;
    if (!dirtyRange) {
      return false;
    }

    if (this.lastRenderMode === 'offscreen') {
      this.renderAfterOffscreenEdit(frame);
      return true;
    }

    renderDirtyRect({
      context: frame.context,
      interactionCtx: frame.interactionCtx,
      models: frame.models,
      currentRange: dirtyRange,
      tileManager: this.tileManager,
      tileBuffer: RenderService.TILE_BUFFER,
      transformService: this.transformService,
      renderHandlerRegistry: this.renderHandlerRegistry,
    });
    this.pendingDirtyRange = null;
    this.lastRenderMode = 'dirty';
    return true;
  }

  private renderFromOffscreenOrDirect(frame: RenderFrame) {
    const shouldDeferScaleRebuild = this.offscreenCache.canDraw()
      && !this.offscreenCache.isDirty()
      && !this.offscreenCache.isScaleSynced(frame.view)
      && !this.forceOffscreenScaleRebuild;

    this.offscreenCache.ensureUpdated(frame.models, frame.view, {
      allowScaleRebuild: !shouldDeferScaleRebuild,
    });

    if (shouldDeferScaleRebuild) {
      this.scheduleZoomSettledRender();
    }

    this.forceOffscreenScaleRebuild = false;

    if (!this.offscreenCache.draw(frame.context, frame.view)) {
      this.renderDirectFrame(frame);
      return;
    }

    this.lastRenderMode = 'offscreen';
  }


  private _render = () => {
    const context = this.board.getCtx();
    const interactionCtx = this.board.getInteractionCtx();
    const models = this.modelService.getAllModels();
    if (!context) return;
    const canvas = this.board.getCanvas();
    if (!canvas) return;
    this._renderStart.fire();

    try {
      const view = this.transformService.getView();
      const frame: RenderFrame = {
        context,
        interactionCtx,
        canvas,
        models,
        view,
      };

      if (this.renderDirtyChanges(frame)) {
        return;
      }

      this.clearContexts(frame);

      if (!models.length) {
        this.lastRenderMode = 'direct';
        return;
      }

      this.renderFromOffscreenOrDirect(frame);
    } finally {
      this._renderEnd.fire();
    }
  };

}

export default RenderService;
