import { eBoardContainer } from "../../common/IocContainer";
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

class RenderService implements IRenderService {
  private board!: IBoard;
  private modelService = eBoardContainer.get<IModelService>(IModelService);
  private elementService = eBoardContainer.get<IElementService>(IElementService);
  private readonly _renderStart = new Emitter<void>();
  private readonly _renderEnd = new Emitter<void>();
  public onRenderStart = this._renderStart.event;
  public onRenderEnd = this._renderEnd.event;
  private disposeList: (() => void)[] = [];
  private pendingAnimationFrameId: number | null = null;
  private pendingDirtyRange: Range | null = null;
  private tileManager!: TileManager;
  private renderHandlerRegistry!: RenderHandlerRegistry;
  private offscreenCache!: OffscreenRenderCache;
  private transformServiceInstance: ITransformService | null = null;
  private lastRenderMode: RenderMode = 'direct';
  private static readonly DIRTY_PADDING = 2;

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
    this.ensureTileIndex()
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

  private ensureTileIndex() {
    if (!this.tileManager.tailsSize()) {
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
    }
  }

  private handleModelOperationChange: Parameters<typeof this.modelService.onModelOperation>[0] = (event) => {
    this.offscreenCache.markDirty();
    applyModelChange({
      event,
      modelService: this.modelService,
      tileManager: this.tileManager,
      ensureTileIndex: () => this.ensureTileIndex(),
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

    this.pendingDirtyRange = null;
    this.lastRenderMode = 'direct';
    this.transformServiceInstance = null;

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

  private get transformService() {
    if (!this.transformServiceInstance) {
      this.transformServiceInstance = eBoardContainer.get<ITransformService>(ITransformService);
    }
    return this.transformServiceInstance;
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
    this.tileManager.clear();
    this.ensureTileIndex();
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
    this.offscreenCache.ensureUpdated(frame.models);

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
