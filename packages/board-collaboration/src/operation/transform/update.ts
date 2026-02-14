import { OperationSource } from "@e-board/board-core";
import { IOperationHandler } from "./type";

export class UpdateHandler implements IOperationHandler {
    type = 'update';

    handleLocal({ operation, modelService, elementService }: any) {
        const modelId = operation.modelId;
        const model = modelService.getModelById(modelId);
        const type = model?.type;
        if (!type) throw new Error('Operation missing type');

        const element = elementService.getElement(type);
        if (!element) throw new Error(`Unregistered element type: ${type}`);

        return {
            operation: this.type,
            updates: element.saveInfoProvider.parse(operation.updates),
            previousState: element.saveInfoProvider.parse(operation.previousState),
            modelId: operation.modelId
        };
    }

    handleRemote({ data, modelService }: any) {
        const modelId = data.modelId;
        const model = modelService.getModelById(modelId);
        if (!model) return; // 或者抛错

        modelService.updateModel(modelId, data.updates, OperationSource.REMOTE);
    }
}
