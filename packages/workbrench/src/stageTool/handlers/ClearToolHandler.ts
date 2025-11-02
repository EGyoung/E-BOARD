import { IModelService } from '@e-board/core';
import { IToolHandler } from '../types';

export class ClearToolHandler implements IToolHandler {
    activate(board: any): void {
        try {


            const modelService = board.getService(IModelService);

            if (modelService && modelService.clear) {
                modelService.clear();
            }

        } catch (error) {
            console.warn('Failed to clear canvas:', error);
        }
    }

    deactivate(board: any): void {
        // No deactivation needed for clear action
    }
}
