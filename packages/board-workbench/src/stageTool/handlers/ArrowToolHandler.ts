import { IToolHandler } from '../types';

export class ArrowToolHandler implements IToolHandler {
    activate(board: any): void {
        try {
            const modeService = board.getService('modeService');

            if (modeService) {
                modeService.switchMode('drawArrow');
            }
        } catch (error) {
            console.warn('Failed to switch to arrow mode:', error);
        }
    }

    deactivate(board: any): void {
        // Optional cleanup
    }
}
