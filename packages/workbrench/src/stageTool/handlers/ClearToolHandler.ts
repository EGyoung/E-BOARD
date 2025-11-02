import { IToolHandler } from '../types';

export class ClearToolHandler implements IToolHandler {
    activate(board: any): void {
        try {
            const IModelService = Symbol.for('IModelService');
            const IRenderService = Symbol.for('IRenderService');

            const modelService = board.getService(IModelService);
            const renderService = board.getService(IRenderService);

            if (modelService && modelService.clear) {
                modelService.clear();
            }

            if (renderService && renderService.render) {
                renderService.render();
            }
        } catch (error) {
            console.warn('Failed to clear canvas:', error);
        }
    }

    deactivate(board: any): void {
        // No deactivation needed for clear action
    }
}
