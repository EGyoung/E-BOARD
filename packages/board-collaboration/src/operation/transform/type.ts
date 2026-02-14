import type { EBoard, ModelChangeEvent, ModelService, ElementService } from "@e-board/board-core";

export interface IOperationHandler {
    type: string;
    handleLocal(params: {
        operation: ModelChangeEvent;
        board: EBoard;
        modelService: ModelService;
        elementService: ElementService;
    }): any;
    handleRemote(params: {
        data: any;
        board: EBoard;
        modelService: ModelService;
        elementService: ElementService;
    }): void;
}
