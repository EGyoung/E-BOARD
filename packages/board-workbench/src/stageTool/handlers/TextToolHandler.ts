import { IToolHandler } from '../types';

export class TextToolHandler implements IToolHandler {
    activate(board: any): void {
        try {
            const modelService = board.getService('modelService');
            const transformService = board.getService('transformService');

            const view = transformService?.getView?.() || {};
            const center = view.center || { x: 0, y: 0 };

            const fontSize = 18;
            const rawWidth = 180;
            const rawHeight = 60;

            const model = modelService.createModel('text', {
                type: 'text',
                points: [{ x: center.x, y: center.y }],
                width: rawWidth,
                height: rawHeight,
                text: '文本',
                fontSize,
                options: {
                    ...(board.getService('configService')?.getCtxConfig?.() || {}),
                    fillStyle: '#000000',
                },
            });

            // Optionally log the created model id
            if (model && model.id) {
                console.log('Text model created:', model.id);
            }
        } catch (error) {
            console.warn('Failed to insert text element:', error);
        }
    }

    deactivate(board: any): void {
        // no-op
    }
}
