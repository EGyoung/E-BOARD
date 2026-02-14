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
        // 修正之前代码里 data.data.deletedModels 的问题，统一使用 data.deletedModels
        const deletedModels = data.deletedModels || [];
        deletedModels.forEach((m: any) => {
            const element = elementService.getElement(m.type);
            if (!element) throw new Error(`Unregistered element type: ${m.type}`);
            const model = element.saveInfoProvider.importSaveInfo(m);
            modelService.deleteModel(model.id, OperationSource.REMOTE);
        });
    }
}
