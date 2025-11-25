import { IHistoryService } from '@e-board/core';
import { IToolHandler } from '../types';

export class UndoToolHandler implements IToolHandler {
    activate(board: any): void {
        try {
            const historyService = board.getService('historyService')

            if (historyService && historyService.undo) {
                const success = historyService.undo();
                if (!success) {
                    console.log('No more actions to undo');
                }
            } else {
                console.warn('HistoryService not available');
            }
        } catch (error) {
            console.warn('Failed to undo:', error);
        }
    }
}