import { IToolHandler, ToolBoard } from '../types';

export class ArrowToolHandler implements IToolHandler {
    activate(board: ToolBoard): void {
        try {
            const modeService = board.getService('modeService');

            if (modeService) {
                modeService.switchMode('drawArrow');
            }
        } catch (error) {
            console.warn('Failed to switch to arrow mode:', error);
        }
    }

    deactivate(board: ToolBoard): void {
        // Optional cleanup
    }
}
