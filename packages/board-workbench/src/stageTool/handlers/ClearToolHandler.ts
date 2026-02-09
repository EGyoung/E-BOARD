import { IModelService } from '@e-board/core';
import { IToolHandler } from '../types';

export class ClearToolHandler implements IToolHandler {
    activate(board: any): void {
        try {
            const modelService = board.getService('modelService') as unknown as IModelService;
            if (modelService && modelService.clearModels) {
                modelService.clearModels();
            }

        } catch (error) {
            console.warn('Failed to clear canvas:', error);
        }
    }

}
