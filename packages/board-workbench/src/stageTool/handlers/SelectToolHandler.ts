import { IToolHandler, ToolBoard } from '../types';

export class SelectToolHandler implements IToolHandler {
    activate(board: ToolBoard): void {
        try {

            const modeService = board.getService('modeService');
            if (modeService) {
                modeService.switchMode('selection');
            }
        } catch (error) {
            console.warn('Failed to switch to selection mode:', error);
        }
    }

    deactivate(board: ToolBoard): void {
        // Optional cleanup
    }
}
