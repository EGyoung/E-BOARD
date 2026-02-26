import { OperationSource } from "@e-board/board-core";
import { IOperationHandler } from "./type";

export class DeleteHandler implements IOperationHandler {
    type = 'delete';

    handleLocal({ operation, elementService }: any) {
        return {
            operation: this.type,
            deletedModels: Array.from(operation.deletedModels?.values() || []).map((m: any) => {
                const type = m?.type;
                if (!type) throw new Error('Operation missing type');
                const element = elementService.getElement(type);
                if (!element) throw new Error(`Unregistered element type: ${type}`);
                return element.saveInfoProvider.parse(m);
            }),
            modelId: operation.modelId
        };
    }

    handleRemote({ data, modelService, elementService }: any) {
        const deletedModels = data.deletedModels || [];
        deletedModels.forEach((m: any) => {
            const element = elementService.getElement(m.type);
            if (!element) return;

            const modelId = m.id;
            const localModel = modelService.getModelById(modelId);

            // If already deleted locally, do nothing
            if (!localModel) return;

            // LWW Check: If local modification is newer than delete op, keep local
            const incomingTime = data.timestamp || 0;
            const localTime = localModel._v || 0;

            if (localTime > incomingTime) {
                // Local version is newer, ignore delete
                return;
            }
            if (localTime === incomingTime) {
                // Tie break: prefer delete if from higher node? or keep? 
                // Usually higher node wins.
                const incomingNode = data.nodeId || '';
                const localNode = localModel._by || '';
                if (localNode > incomingNode) return;
            }

            modelService.deleteModel(modelId, OperationSource.REMOTE);
        });
    }
}
