import { initContextAttrs } from '@e-board/board-utils';
import { IModel } from '../modelService/type';
import { Range, View } from './type';
import { RenderHandlerRegistry } from './renderHandlerRegistry';

export class OffscreenRenderCache {
    private static readonly MAX_SIZE = 8192;
    private static readonly PADDING = 20;

    private offscreenCanvas: OffscreenCanvas | null = null;
    private offscreenCtx: OffscreenCanvasRenderingContext2D | null = null;
    private dirty = true;
    private worldBounds: Range = { minX: 0, minY: 0, maxX: 0, maxY: 0 };

    constructor(
        private readonly renderHandlerRegistry: RenderHandlerRegistry,
    ) { }

    public markDirty() {
        this.dirty = true;
    }

    public ensureUpdated(models: IModel<Record<string, any>>[]) {
        if (this.dirty || !this.offscreenCanvas) {
            this.rebuild(models);
        }
    }

    public draw(context: CanvasRenderingContext2D, view: View): boolean {
        if (!this.offscreenCanvas) {
            return false;
        }

        const dpr = window.devicePixelRatio || 1;
        const zoom = view.zoom;
        const { minX: worldMinX, minY: worldMinY } = this.worldBounds;

        context.save();
        context.setTransform(1, 0, 0, 1, 0, 0);

        const sw = this.offscreenCanvas.width;
        const sh = this.offscreenCanvas.height;
        const dx = (worldMinX - view.x) * zoom * dpr;
        const dy = (worldMinY - view.y) * zoom * dpr;
        const dw = sw * zoom * dpr;
        const dh = sh * zoom * dpr;

        context.drawImage(this.offscreenCanvas, 0, 0, sw, sh, dx, dy, dw, dh);
        context.restore();
        return true;
    }

    public dispose() {
        this.clear();
    }

    private rebuild(models: IModel<Record<string, any>>[]) {
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
            this.dirty = false;
            return;
        }

        minX -= OffscreenRenderCache.PADDING;
        minY -= OffscreenRenderCache.PADDING;
        maxX += OffscreenRenderCache.PADDING;
        maxY += OffscreenRenderCache.PADDING;

        const width = Math.ceil(maxX - minX);
        const height = Math.ceil(maxY - minY);

        if (width > OffscreenRenderCache.MAX_SIZE || height > OffscreenRenderCache.MAX_SIZE) {
            this.clear();
            this.dirty = false;
            return;
        }

        this.worldBounds = { minX, minY, maxX, maxY };

        if (!this.offscreenCanvas || this.offscreenCanvas.width !== width || this.offscreenCanvas.height !== height) {
            this.offscreenCanvas = new OffscreenCanvas(width, height);
            this.offscreenCtx = this.offscreenCanvas.getContext('2d')!;
        }

        const ctx = this.offscreenCtx!;
        ctx.clearRect(0, 0, width, height);
        ctx.save();
        ctx.translate(-minX, -minY);

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