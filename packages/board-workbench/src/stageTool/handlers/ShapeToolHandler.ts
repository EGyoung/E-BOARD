import { IToolHandler, ShapeType, ToolBoard } from '../types';

export class ShapeToolHandler implements IToolHandler {


    activate(board: ToolBoard): void {
        try {


            const modeService = board.getService('modeService');

            if (modeService) {
                modeService.switchMode('drawShape');
            }

        } catch (error) {
            console.warn('Failed to switch to shape mode:', error);
        }
    }

    deactivate(board: ToolBoard): void {
        // Optional cleanup
    }
}
