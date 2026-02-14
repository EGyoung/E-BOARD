import { OperationSource } from "@e-board/board-core";
import { IOperationHandler } from "./type";

export class CreateHandler implements IOperationHandler {
    type = 'create';

    handleLocal({ operation, elementService }: any) {
        const type = operation.model?.type;
        if (!type) throw new Error('Operation missing type');

        const element = elementService.getElement(type);
        if (!element) throw new Error(`Unregistered element type: ${type}`);

        return {
            operation: this.type,
            model: element.saveInfoProvider.parse(operation.model)
        };
    }

    handleRemote({ data, board, elementService }: any) {
        const element = elementService.getElement(data.model.type);
        if (!element) throw new Error(`Unregistered element type: ${data.model.type}`);

        const saveInfoService = board.getService('saveInfoService');
        saveInfoService.importSaveInfo(data.model, OperationSource.REMOTE);
    }
}
