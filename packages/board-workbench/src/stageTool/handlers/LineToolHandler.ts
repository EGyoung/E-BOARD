import { IToolHandler } from '../types';

export class LineToolHandler implements IToolHandler {
    activate(board: any): void {
        try {
            const modeService = board.getService('modeService');
            if (modeService) {
                modeService.switchMode('drawLine');
            }
        } catch (error) {
            console.warn('Failed to switch to line mode:', error);
        }
    }

    deactivate(board: any): void {}
}
