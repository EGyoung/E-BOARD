import { IConfigService, IModeService } from '@e-board/core';
import { IToolHandler, ShapeType } from '../types';

export class ShapeToolHandler implements IToolHandler {
    private shapeType: ShapeType;

    constructor(shapeType: ShapeType) {
        this.shapeType = shapeType;
    }

    activate(board: any): void {
        try {


            const modeService = board.getService(IModeService);
            const configService = board.getService(IConfigService);

            if (modeService) {
                modeService.switchMode('drawShape');
            }

            if (configService && configService.setCtxConfig) {
                configService.setCtxConfig({ shapeType: this.shapeType });
            }
        } catch (error) {
            console.warn('Failed to switch to shape mode:', error);
        }
    }

    deactivate(board: any): void {
        // Optional cleanup
    }
}
