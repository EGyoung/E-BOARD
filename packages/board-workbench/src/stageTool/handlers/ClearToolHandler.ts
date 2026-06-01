import { IModelService } from '@e-board/board-core';
import { IToolHandler, ToolBoard } from '../types';

export class ClearToolHandler implements IToolHandler {
    activate(board: ToolBoard): void {
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
