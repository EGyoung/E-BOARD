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
            this.rebuild(models, scale, view);
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

    private rebuild(models: IModel<Record<string, any>>[], scale: number, view: View) {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        const zoom = view.zoom;

        for (const model of models) {
            const box = model.ctrlElement?.getBoundingBox?.();
            if (!box || (box.width === 0 && box.height === 0)) continue;

            // getBoundingBox 返回屏幕坐标，转换回世界坐标
            // screenX = (worldX - view.x) * zoom → worldX = screenX / zoom + view.x
            const worldMinX = box.minX / zoom + view.x;
            const worldMinY = box.minY / zoom + view.y;
            const worldMaxX = box.maxX / zoom + view.x;
            const worldMaxY = box.maxY / zoom + view.y;

            if (worldMinX < minX) minX = worldMinX;
            if (worldMinY < minY) minY = worldMinY;
            if (worldMaxX > maxX) maxX = worldMaxX;
            if (worldMaxY > maxY) maxY = worldMaxY;
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