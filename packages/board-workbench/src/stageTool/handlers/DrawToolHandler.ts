import { IToolHandler } from '../types';

export class DrawToolHandler implements IToolHandler {
    activate(board: any): void {
        try {
            console.log(board, 'board')
            const modeService = board.getService('modeService');
            if (modeService) {
                modeService.switchMode('draw');
            }
        } catch (error) {
            console.warn('Failed to switch to draw mode:', error);
        }
    }

    deactivate(board: any): void {
        // Optional cleanup
    }
}
