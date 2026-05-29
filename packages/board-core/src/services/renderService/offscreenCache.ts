import { initContextAttrs } from '@e-board/board-utils';
import { IModel } from '../modelService/type';
import { Range, View } from './type';
import { RenderHandlerRegistry } from './renderHandlerRegistry';

interface EnsureUpdatedOptions {
    allowScaleRebuild?: boolean;
}

export class OffscreenRenderCache {
    private static readonly MAX_SIZE = 8192;
    private static readonly PADDING = 20;

    private offscreenCanvas: OffscreenCanvas | null = null;
    private offscreenCtx: OffscreenCanvasRenderingContext2D | null = null;
    private dirty = true;
    private unavailable = false;
    private cachedScale = 0;
    private worldBounds: Range = { minX: 0, minY: 0, maxX: 0, maxY: 0 };

    constructor(
        private readonly renderHandlerRegistry: RenderHandlerRegistry,
    ) { }

    public markDirty() {
        this.dirty = true;
    }

    public ensureUpdated(
        models: IModel<Record<string, any>>[],
        view: View,
        options: EnsureUpdatedOptions = {},
    ) {
        const scale = this.getScale(view);
        const allowScaleRebuild = options.allowScaleRebuild ?? true;
        const needsInitialBuild = !this.offscreenCanvas && (!this.unavailable || this.cachedScale !== scale);
        const needsScaleRebuild = this.cachedScale !== scale && allowScaleRebuild;

        if (this.dirty || needsInitialBuild || needsScaleRebuild) {
            this.rebuild(models, scale);
        }
    }

    public canDraw() {
        return !!this.offscreenCanvas;
    }

    public isDirty() {
        return this.dirty;
    }

    public isScaleSynced(view: View) {
        return this.cachedScale === this.getScale(view);
    }

    public draw(context: CanvasRenderingContext2D, view: View): boolean {
        if (!this.offscreenCanvas) {
            return false;
        }

        const scale = this.getScale(view);
        const { minX: worldMinX, minY: worldMinY } = this.worldBounds;

        context.save();
        context.setTransform(1, 0, 0, 1, 0, 0);

        const sw = this.offscreenCanvas.width;
        const sh = this.offscreenCanvas.height;
        const dw = (this.worldBounds.maxX - this.worldBounds.minX) * scale;
        const dh = (this.worldBounds.maxY - this.worldBounds.minY) * scale;
        const dx = (worldMinX - view.x) * scale;
        const dy = (worldMinY - view.y) * scale;

        context.drawImage(this.offscreenCanvas, 0, 0, sw, sh, dx, dy, dw, dh);
        context.restore();
        return true;
    }

    public dispose() {
        this.clear();
    }

    private getScale(view: View) {
        return (window.devicePixelRatio || 1) * view.zoom;
    }

    private rebuild(models: IModel<Record<string, any>>[], scale: number) {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        for (const model of models) {
            if (!model.points?.length) continue;

            if (model.width !== undefined && model.height !== undefined) {
                const point = model.points[0];
                if (point.x < minX) minX = point.x;
                if (point.y < minY) minY = point.y;
                if (point.x + model.width > maxX) maxX = point.x + model.width;
                if (point.y + model.height > maxY) maxY = point.y + model.height;
            } else {
                for (const point of model.points) {
                    if (point.x < minX) minX = point.x;
                    if (point.y < minY) minY = point.y;
                    if (point.x > maxX) maxX = point.x;
                    if (point.y > maxY) maxY = point.y;
                }
            }
        }

        if (!isFinite(minX)) {
            this.clear();
            this.cachedScale = scale;
            this.unavailable = true;
            this.dirty = false;
            return;
        }

        minX -= OffscreenRenderCache.PADDING;
        minY -= OffscreenRenderCache.PADDING;
        maxX += OffscreenRenderCache.PADDING;
        maxY += OffscreenRenderCache.PADDING;

        const width = Math.ceil((maxX - minX) * scale);
        const height = Math.ceil((maxY - minY) * scale);

        if (width > OffscreenRenderCache.MAX_SIZE || height > OffscreenRenderCache.MAX_SIZE) {
            this.clear();
            this.cachedScale = scale;
            this.unavailable = true;
            this.dirty = false;
            return;
        }

        this.worldBounds = { minX, minY, maxX, maxY };
        this.cachedScale = scale;
        this.unavailable = false;

        if (!this.offscreenCanvas || this.offscreenCanvas.width !== width || this.offscreenCanvas.height !== height) {
            this.offscreenCanvas = new OffscreenCanvas(width, height);
            this.offscreenCtx = this.offscreenCanvas.getContext('2d')!;
        }

        const ctx = this.offscreenCtx!;
        ctx.clearRect(0, 0, width, height);
        ctx.save();
        ctx.setTransform(scale, 0, 0, scale, -minX * scale, -minY * scale);

        for (const model of models) {
            const renderHandler = this.renderHandlerRegistry.get(model.type);
            if (!renderHandler) continue;

            ctx.beginPath();
            initContextAttrs(ctx as any, { zoom: 1 }, model.options);
            renderHandler.render(model, ctx as any, true);
            ctx.stroke();
        }

        ctx.restore();
        this.dirty = false;
    }

    private clear() {
        this.offscreenCanvas = null;
        this.offscreenCtx = null;
    }
}