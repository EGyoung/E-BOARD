import { initContextAttrs } from "@e-board/utils";
import { eBoardContainer } from "../../common/IocContainer";
import { IBoard, IServiceInitParams } from "../../types";
import { IConfigService } from "../configService/type";
import { IModel, IModelService, ModelChangeEvent, ModelChangeType } from "../modelService/type";
import { ITransformService } from "../transformService/type";

import { IRenderService } from "./type";

interface IDrawModelHandler {
  (model: any, ctx?: CanvasRenderingContext2D): void;
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

class RenderService implements IRenderService {
  private board!: IBoard;
  private modelService = eBoardContainer.get<IModelService>(IModelService);
  private configService = eBoardContainer.get<IConfigService>(IConfigService);
  private modelHandler = new Map<string, IDrawModelHandler>();
  private disposeList: (() => void)[] = [];
  private redrawRequested = false;
  private dirtyBounds: Bounds | null = null;
  private fullRedraw = false;
  private modelBoundsCache = new Map<string, Bounds>();
  private transformService!: ITransformService;
  private dirtyPadding = 2;
  private readonly maxDirtyAreaRatio = 0.65;
  private devicePixelRatio = 1;
  private antialiasPadding = 2;
  private spatialIndex = new Map<string, Set<string>>();
  private modelCellKeys = new Map<string, string[]>();
  private readonly spatialCellSize = 256;


  init = ({ board }: IServiceInitParams) => {
    this.board = board;
    this.initModelListeners();
    this.transformService = eBoardContainer.get<ITransformService>(ITransformService);
    if (typeof window !== "undefined" && typeof window.devicePixelRatio === "number") {
      this.devicePixelRatio = window.devicePixelRatio || 1;
    }
    this.antialiasPadding = Math.max(4, Math.ceil(this.devicePixelRatio * 3));
    this.dirtyPadding = Math.max(4, Math.ceil(this.antialiasPadding / 2));

  };

  private initModelListeners() {
    const { dispose } = this.modelService.onModelOperation(this.handleModelOperation);
    this.disposeList.push(dispose);
  }

  // private initOffscreenCanvas() {
  //   const mainCanvas = this.board.getCanvas()!;
  //   const { width, height } = mainCanvas.style;
  //   this.offscreenCanvas = document.createElement("canvas");
  //   this.offscreenCanvas.width = parseInt(width);
  //   this.offscreenCanvas.height = parseInt(height);
  //   this.offscreenCtx = this.offscreenCanvas.getContext("2d", {
  //     alpha: false
  //   });

  //   const transformService = eBoardContainer.get<ITransformService>(ITransformService);
  //   const configService = eBoardContainer.get<IConfigService>(IConfigService);
  //   initContextAttrs(
  //     this.offscreenCtx!,
  //     { zoom: transformService.getView().zoom },
  //     configService.getCtxConfig()
  //   );
  // }

  public registerDrawModelHandler(key: string, handler: IDrawModelHandler) {
    this.modelHandler.set(key, handler);
  }

  public unregisterDrawModelHandler(key: string) {
    this.modelHandler.delete(key);
  }

  public dispose(): void {
    this.modelHandler = new Map();
    // this.offscreenCtx = null;
    this.disposeList.forEach(dispose => dispose());
    // this.offscreenCanvas = document.createElement("canvas");
    this.resetDirtyState();
    this.modelBoundsCache.clear();
    this.clearSpatialIndex();
  }

  public reRender = (region?: Rect | Rect[]) => {
    if (!region) {
      this.fullRedraw = true;
      this.modelBoundsCache.clear();
      this.clearSpatialIndex();
    } else {
      const regions = Array.isArray(region) ? region : [region];
      regions.forEach(rect => {
        const bounds = this.rectToBounds(rect);
        this.mergeDirtyBounds(bounds);
      });
    }
    this.requestRenderFrame();
  };

  private requestRenderFrame() {
    if (this.redrawRequested) return;
    this.redrawRequested = true;
    requestAnimationFrame(() => {
      this._render();
      this.redrawRequested = false;
    });
  }

  private _render = () => {
    const context = this.board.getCtx();
    const interactionCtx = this.board.getInteractionCtx();
    if (!context) return;
    const canvas = this.board.getCanvas();
    if (!canvas) return;

    const targetBounds = this.fullRedraw ? this.computeCanvasBounds(canvas) : this.dirtyBounds;
    if (!targetBounds) {
      this.resetDirtyState();
      return;
    }

    const expandedBounds = this.expandBounds(targetBounds, this.antialiasPadding);
    const canvasBounds = this.clampBoundsToCanvas(expandedBounds, canvas);

    if (!canvasBounds) {
      this.resetDirtyState();
      return;
    }

    const renderRect = this.boundsToRect(canvasBounds);

    this.clearRegion(context, renderRect);

    // 同时清空交互画布，避免重叠
    if (interactionCtx) {
      this.clearRegion(interactionCtx, renderRect);
    }

    // 设置绘制属性（包括根据缩放调整的线条宽度）
    const view = this.transformService.getView();
    const allModels = this.modelService.getAllModels();
    let modelsToDraw: IModel[];
    if (this.fullRedraw) {
      modelsToDraw = allModels;
    } else {
      const candidateIds = this.querySpatialIndex(canvasBounds);
      const orderedCandidates = allModels.filter(model => candidateIds.has(model.id));
      modelsToDraw = orderedCandidates.filter(model => {
        const bounds = this.getOrComputeBounds(model);
        return bounds ? this.isIntersecting(bounds, canvasBounds) : true;
      });

      if (modelsToDraw.length === 0) {
        modelsToDraw = allModels.filter(model => {
          const bounds = this.getOrComputeBounds(model);
          return bounds ? this.isIntersecting(bounds, canvasBounds) : true;
        });
      }
    }

    // 绘制笔记
    this.applyClip(context, renderRect, () => {
      modelsToDraw.forEach(model => {
        const handler = this.modelHandler.get(model.type);
        if (handler) {
          context.beginPath();
          initContextAttrs(
            context,
            { zoom: view.zoom },
            model.options
          );
          handler(model, context as any);
          context.stroke();
          const bounds = this.computeBoundingBox(model);
          this.setModelBounds(model.id, bounds);
        }
      });
    });

    this.resetDirtyState();
  };

  private handleModelOperation = (event: ModelChangeEvent) => {
    switch (event.type) {
      case ModelChangeType.CREATE:
        if (event.model) {
          const bounds = this.computeBoundingBox(event.model);
          this.setModelBounds(event.model.id, bounds);
          this.invalidate(bounds);
        }
        break;
      case ModelChangeType.UPDATE: {
        const current = this.modelService.getModelById(event.modelId);
        if (!current) {
          this.requestRenderFrame();
          break;
        }
        const previousState = event.previousState
          ? ({ ...current, ...event.previousState } as IModel)
          : null;
        const prevBounds = previousState ? this.computeBoundingBox(previousState) : null;
        const nextBounds = this.computeBoundingBox(current);
        this.setModelBounds(current.id, nextBounds);
        this.invalidate(prevBounds);
        this.invalidate(nextBounds);
        break;
      }
      case ModelChangeType.DELETE: {
        const cached = this.modelBoundsCache.get(event.modelId);
        const bounds = cached || (event.model ? this.computeBoundingBox(event.model) : null);
        this.setModelBounds(event.modelId, null);
        this.invalidate(bounds);
        break;
      }
      case ModelChangeType.CLEAR:
        this.modelBoundsCache.clear();
        this.clearSpatialIndex();
        this.reRender();
        break;
    }
  };

  private invalidate(bounds: Bounds | null) {
    if (!bounds) {
      this.fullRedraw = true;
      this.modelBoundsCache.clear();
      this.requestRenderFrame();
      return;
    }
    this.mergeDirtyBounds(bounds);
    this.requestRenderFrame();
  }

  private mergeDirtyBounds(bounds: Bounds) {
    const expanded = this.expandBounds(bounds, this.dirtyPadding);
    this.dirtyBounds = this.dirtyBounds
      ? {
        minX: Math.min(this.dirtyBounds.minX, expanded.minX),
        minY: Math.min(this.dirtyBounds.minY, expanded.minY),
        maxX: Math.max(this.dirtyBounds.maxX, expanded.maxX),
        maxY: Math.max(this.dirtyBounds.maxY, expanded.maxY)
      }
      : expanded;

    if (!this.board) return;
    const canvas = this.board.getCanvas();
    if (!canvas) return;
    const rect = this.boundsToRect(this.dirtyBounds);
    const { width, height } = this.getCanvasSize(canvas);
    if (!width || !height) return;
    const dirtyArea = rect.width * rect.height;
    const canvasArea = width * height;
    if (canvasArea && dirtyArea / canvasArea >= this.maxDirtyAreaRatio) {
      this.fullRedraw = true;
      this.modelBoundsCache.clear();
    }
  }

  private expandBounds(bounds: Bounds, padding: number): Bounds {
    return {
      minX: bounds.minX - padding,
      minY: bounds.minY - padding,
      maxX: bounds.maxX + padding,
      maxY: bounds.maxY + padding
    };
  }

  private getOrComputeBounds(model: IModel): Bounds | null {
    const cached = this.modelBoundsCache.get(model.id);
    if (cached) return cached;
    const bounds = this.computeBoundingBox(model);
    this.setModelBounds(model.id, bounds);
    return bounds;
  }

  private computeBoundingBox(model: IModel): Bounds | null {
    if (!model) return null;


    const candidate = this.extractBoundsFromCtrlElement(model);
    if (candidate) {
      return candidate;
    }

    if (!model.points || model.points.length === 0) {
      return null;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    model.points.forEach(point => {
      const { x, y } = this.transformService.transformPoint(point);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    });

    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
      return null;
    }

    const zoom = this.transformService.getView().zoom || 1;
    const lineWidth = model.options?.lineWidth ?? this.configService.getCtxConfig().lineWidth ?? 1;
    const padding = Math.max((lineWidth * zoom) / 2, 1);

    return {
      minX: minX - padding,
      minY: minY - padding,
      maxX: maxX + padding,
      maxY: maxY + padding
    };
  }

  private extractBoundsFromCtrlElement(model: IModel): Bounds | null {
    const ctrlElement = model.ctrlElement as { getBoundingBox?: (m: IModel) => any } | undefined;
    if (!ctrlElement || typeof ctrlElement.getBoundingBox !== "function") {
      return null;
    }
    try {
      const box = ctrlElement.getBoundingBox(model);
      if (!box) return null;
      const minX = this.safeNumber(box.minX ?? box.x);
      const minY = this.safeNumber(box.minY ?? box.y);
      const maxX = this.safeNumber(box.maxX ?? (box.x ?? 0) + (box.width ?? 0));
      const maxY = this.safeNumber(box.maxY ?? (box.y ?? 0) + (box.height ?? 0));
      if (minX === null || minY === null || maxX === null || maxY === null) {
        return null;
      }
      if (maxX < minX || maxY < minY) {
        return null;
      }
      return {
        minX,
        minY,
        maxX,
        maxY
      };
    } catch (error) {
      console.warn("Failed to read bounding box from ctrlElement", error);
      return null;
    }
  }

  private safeNumber(value: unknown): number | null {
    if (typeof value !== "number") return null;
    if (!Number.isFinite(value)) return null;
    return value;
  }

  private clampBoundsToCanvas(bounds: Bounds | null, canvas: HTMLCanvasElement): Bounds | null {
    if (!bounds) return null;
    const { width, height } = this.getCanvasSize(canvas);
    const minX = Math.max(bounds.minX, 0);
    const minY = Math.max(bounds.minY, 0);
    const maxX = Math.min(bounds.maxX, width);
    const maxY = Math.min(bounds.maxY, height);
    if (maxX <= minX || maxY <= minY) {
      return null;
    }
    return { minX, minY, maxX, maxY };
  }

  private computeCanvasBounds(canvas: HTMLCanvasElement): Bounds {
    const { width, height } = this.getCanvasSize(canvas);
    return {
      minX: 0,
      minY: 0,
      maxX: width,
      maxY: height
    };
  }

  private boundsToRect(bounds: Bounds): Rect {
    const x = Math.floor(bounds.minX);
    const y = Math.floor(bounds.minY);
    const width = Math.ceil(bounds.maxX - bounds.minX);
    const height = Math.ceil(bounds.maxY - bounds.minY);
    return {
      x,
      y,
      width: Math.max(width, 1),
      height: Math.max(height, 1)
    };
  }

  private rectToBounds(rect: Rect): Bounds {
    return {
      minX: rect.x,
      minY: rect.y,
      maxX: rect.x + rect.width,
      maxY: rect.y + rect.height
    };
  }

  private isIntersecting(a: Bounds, b: Bounds): boolean {
    return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
  }

  private resetDirtyState() {
    this.dirtyBounds = null;
    this.fullRedraw = false;
  }

  private clearRegion(ctx: CanvasRenderingContext2D, rect: Rect) {
    if (!rect.width || !rect.height) {
      return;
    }
    ctx.clearRect(rect.x, rect.y, rect.width, rect.height);
  }

  private applyClip(ctx: CanvasRenderingContext2D, rect: Rect, draw: () => void) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.width, rect.height);
    ctx.clip();
    try {
      draw();
    } finally {
      ctx.restore();
    }
  }

  private setModelBounds(modelId: string, bounds: Bounds | null) {
    if (bounds) {
      this.modelBoundsCache.set(modelId, bounds);
      this.updateSpatialIndex(modelId, bounds);
    } else {
      this.modelBoundsCache.delete(modelId);
      this.updateSpatialIndex(modelId, null);
    }
  }

  private updateSpatialIndex(modelId: string, bounds: Bounds | null) {
    const previousKeys = this.modelCellKeys.get(modelId);
    if (previousKeys) {
      previousKeys.forEach(key => {
        const cell = this.spatialIndex.get(key);
        if (!cell) return;
        cell.delete(modelId);
        if (cell.size === 0) {
          this.spatialIndex.delete(key);
        }
      });
      this.modelCellKeys.delete(modelId);
    }

    if (!bounds) {
      return;
    }

    const keys = this.getCellKeys(bounds);
    keys.forEach(key => {
      const cell = this.spatialIndex.get(key);
      if (cell) {
        cell.add(modelId);
      } else {
        this.spatialIndex.set(key, new Set([modelId]));
      }
    });
    this.modelCellKeys.set(modelId, keys);
  }

  private getCellKeys(bounds: Bounds): string[] {
    const keys: string[] = [];
    const size = this.spatialCellSize;
    const epsilon = 0.001;
    const startX = Math.floor(bounds.minX / size);
    let endX = Math.floor((bounds.maxX - epsilon) / size);
    const startY = Math.floor(bounds.minY / size);
    let endY = Math.floor((bounds.maxY - epsilon) / size);

    if (endX < startX) {
      endX = startX;
    }
    if (endY < startY) {
      endY = startY;
    }

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        keys.push(`${x}:${y}`);
      }
    }
    return keys;
  }

  private querySpatialIndex(bounds: Bounds): Set<string> {
    const result = new Set<string>();
    const keys = this.getCellKeys(bounds);
    keys.forEach(key => {
      const cell = this.spatialIndex.get(key);
      if (!cell) return;
      cell.forEach(id => result.add(id));
    });
    return result;
  }

  private clearSpatialIndex() {
    this.spatialIndex.clear();
    this.modelCellKeys.clear();
  }

  private getCanvasSize(canvas: HTMLCanvasElement) {
    const dpr = this.devicePixelRatio || 1;
    const width = canvas.width ? canvas.width / dpr : canvas.clientWidth;
    const height = canvas.height ? canvas.height / dpr : canvas.clientHeight;
    return {
      width,
      height
    };
  }
}

export default RenderService;
