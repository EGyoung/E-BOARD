import { IToolHandler } from '../types';

export class EraserToolHandler implements IToolHandler {
    activate(board: any): void {
        try {
            const modeService = board.getService('modeService');
            if (modeService) {
                modeService.switchMode('eraser');
            }
        } catch (error) {
            console.warn('Failed to switch to eraser mode:', error);
        }
    }

    deactivate(board: any): void {
        // Optional cleanup is handled by EraserPlugin mode switch hooks.
    }
}
