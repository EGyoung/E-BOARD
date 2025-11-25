import { IHistoryService } from '@e-board/core';
import { IToolHandler } from '../types';

export class RedoToolHandler implements IToolHandler {
    activate(board: any): void {
        try {
            const historyService = board.getService('historyService');

            if (historyService && historyService.redo) {
                const success = historyService.redo();
                if (!success) {
                    console.log('No more actions to redo');
                }
            } else {
                console.warn('HistoryService not available');
            }
        } catch (error) {
            console.warn('Failed to redo:', error);
        }
    }
}