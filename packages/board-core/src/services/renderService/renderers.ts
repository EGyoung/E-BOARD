import { initContextAttrs } from '@e-board/board-utils';
import { IModel } from '../modelService/type';
import { ITransformService } from '../transformService/type';
import { Range, View } from './type';
import { TileManager } from './tileManager';
import { isIntersect } from './range';
import { RenderHandlerRegistry } from './renderHandlerRegistry';

interface RenderDeps {
    renderHandlerRegistry: RenderHandlerRegistry;
}

interface DirtyRectParams extends RenderDeps {
    context: CanvasRenderingContext2D;
    interactionCtx: CanvasRenderingContext2D | null;
    models: IModel<Record<string, any>>[];
    currentRange: Range;
    tileManager: TileManager;
    tileBuffer: number;
    transformService: ITransformService;
}

interface DirectRenderParams extends RenderDeps {
    context: CanvasRenderingContext2D;
    models: IModel<Record<string, any>>[];
    view: View;
}

export const renderDirtyRect = ({
    context,
    interactionCtx,
    models,
    currentRange,
    tileManager,
    tileBuffer,
    transformService,
    renderHandlerRegistry,
}: DirtyRectParams) => {
    const { minX, minY, maxX, maxY } = currentRange;
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
        minX: clearX - tileBuffer,
        minY: clearY - tileBuffer,
        maxX: clearX + clearW + tileBuffer,
        maxY: clearY + clearH + tileBuffer
    };
    const modelIdSet = tileManager.getModelIdsInRange(extendedRange);
    const renderModels = models.filter(model => modelIdSet.has(model.id));
    const zoom = transformService.getView().zoom;

    for (const model of renderModels) {
        const modelBox = model.ctrlElement.getBoundingBox();
        if (!modelBox || !isIntersect(currentRange, modelBox)) continue;

        const renderHandler = renderHandlerRegistry.get(model.type);
        if (!renderHandler) continue;

        context.beginPath();
        initContextAttrs(context, { zoom }, model.options);
        renderHandler.render(model, context as any, false);
        context.stroke();
    }

    context.restore();
};

export const renderDirect = ({
    context,
    models,
    view,
    renderHandlerRegistry,
}: DirectRenderParams) => {
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
        const renderHandler = renderHandlerRegistry.get(model.type);
        if (!renderHandler) continue;

        context.beginPath();
        initContextAttrs(context, { zoom: 1 }, model.options);
        renderHandler.render(model, context as any, true);
        context.stroke();
    }

    context.restore();
};