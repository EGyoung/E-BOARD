import { IToolHandler, ToolBoard } from '../types';

export class CircleToolHandler implements IToolHandler {
    activate(board: ToolBoard): void {
        try {
            const modeService = board.getService('modeService');
            if (modeService) {
                modeService.switchMode('drawCircle');
            }
        } catch (error) {
            console.warn('Failed to switch to circle mode:', error);
        }
    }

    deactivate(board: ToolBoard): void { }
}
