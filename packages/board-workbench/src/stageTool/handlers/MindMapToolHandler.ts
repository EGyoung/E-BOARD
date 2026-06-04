import { IToolHandler, ToolBoard } from '../types';

export class MindMapToolHandler implements IToolHandler {
    activate(board: ToolBoard): void {
        try {
            const modeService = board.getService('modeService');
            if (modeService) {
                modeService.switchMode('mindMap');
            }
        } catch (error) {
            console.warn('Failed to activate mind map:', error);
        }
    }

    deactivate(_board: ToolBoard): void {
        // Optional cleanup when switching away from mind map mode
    }
}
