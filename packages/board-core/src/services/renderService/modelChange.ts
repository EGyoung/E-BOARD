import { normalizeBoundingBox } from './range';
import { Range } from './type';
import { IModel, IModelService, ModelChangeEvent, ModelChangeType } from '../modelService/type';
import { TileManager } from './tileManager';

interface ApplyModelChangeParams {
    event: ModelChangeEvent;
    modelService: IModelService;
    tileManager: TileManager;
    ensureTileIndex: () => void;
    accumulateRange: (range: Range) => void;
    resetDirtyRange: () => void;
    getExpandedBoundingBox: (model?: IModel<Record<string, any>>) => Range | null;
}

const addModelToTileIndex = (tileManager: TileManager, model?: IModel<Record<string, any>>) => {
    const box = model?.ctrlElement?.getBoundingBox?.();
    if (box) {
        tileManager.addModelId(model?.id, normalizeBoundingBox(box));
    }
};

const removeModelFromTileIndex = (tileManager: TileManager, model?: IModel<Record<string, any>>) => {
    const box = model?.ctrlElement?.getBoundingBox?.(model);
    if (box) {
        tileManager.removeModelId(model?.id, normalizeBoundingBox(box));
    }
};

const updateModelInTileIndex = (
    tileManager: TileManager,
    currentModel: IModel<Record<string, any>>,
    previousModel: IModel<Record<string, any>>,
) => {
    const prevBox = previousModel.ctrlElement?.getBoundingBox?.(previousModel);
    const currentBox = currentModel.ctrlElement?.getBoundingBox?.(currentModel);
    if (prevBox && currentBox) {
        tileManager.updateModelId(
            currentModel.id,
            normalizeBoundingBox(prevBox),
            normalizeBoundingBox(currentBox)
        );
    }
};

const handleCreateModel = (
    event: ModelChangeEvent,
    accumulateRange: (range: Range) => void,
    getExpandedBoundingBox: (model?: IModel<Record<string, any>>) => Range | null,
    tileManager: TileManager,
) => {
    const boundingBox = getExpandedBoundingBox(event.model);
    if (!boundingBox) return;
    accumulateRange(boundingBox);
    addModelToTileIndex(tileManager, event.model);
};

const handleDeleteModel = (
    event: ModelChangeEvent,
    accumulateRange: (range: Range) => void,
    getExpandedBoundingBox: (model?: IModel<Record<string, any>>) => Range | null,
    tileManager: TileManager,
) => {
    const boundingBox = getExpandedBoundingBox(event.model);
    if (!boundingBox) return;
    accumulateRange(boundingBox);
    removeModelFromTileIndex(tileManager, event.model);
};

const handleUpdateModel = (
    event: ModelChangeEvent,
    modelService: IModelService,
    accumulateRange: (range: Range) => void,
    getExpandedBoundingBox: (model?: IModel<Record<string, any>>) => Range | null,
    tileManager: TileManager,
) => {
    const currentModel = modelService.getModelById(event.modelId);
    if (!currentModel) return;

    const previousModel = { ...currentModel, ...event.previousState };
    const prevBoundingBox = getExpandedBoundingBox(previousModel);
    const currentBoundingBox = getExpandedBoundingBox(currentModel);
    if (!prevBoundingBox || !currentBoundingBox) return;

    accumulateRange({
        minX: Math.min(prevBoundingBox.minX, currentBoundingBox.minX),
        minY: Math.min(prevBoundingBox.minY, currentBoundingBox.minY),
        maxX: Math.max(prevBoundingBox.maxX, currentBoundingBox.maxX),
        maxY: Math.max(prevBoundingBox.maxY, currentBoundingBox.maxY),
    });

    updateModelInTileIndex(tileManager, currentModel, previousModel);
};

export const applyModelChange = ({
    event,
    modelService,
    tileManager,
    ensureTileIndex,
    accumulateRange,
    resetDirtyRange,
    getExpandedBoundingBox,
}: ApplyModelChangeParams) => {
    if (event.type === ModelChangeType.CLEAR) {
        resetDirtyRange();
        tileManager.clear();
        return;
    }

    ensureTileIndex();

    if (event.type === ModelChangeType.CREATE) {
        handleCreateModel(event, accumulateRange, getExpandedBoundingBox, tileManager);
        return;
    }

    if (event.type === ModelChangeType.DELETE) {
        handleDeleteModel(event, accumulateRange, getExpandedBoundingBox, tileManager);
        return;
    }

    if (event.type === ModelChangeType.UPDATE) {
        handleUpdateModel(event, modelService, accumulateRange, getExpandedBoundingBox, tileManager);
    }
};