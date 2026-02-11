import type { EBoard, ModelChangeEvent, ModelService } from "@e-board/board-core";

class BoardCollaboration {
    private modelService: ModelService
    private disposeList: (() => void)[] = [];
    constructor(private board: EBoard) {
        this.modelService = board.getService('modelService')
        this.init()
    }

    private init = () => {
        const { dispose } = this.modelService.onModelOperation(
            (operation: ModelChangeEvent) => {
                console.log('Received operation:', operation);
            }
        )
        this.disposeList.push(dispose);
    }

    public dispose = () => {
        this.disposeList.forEach(dispose => dispose());
        this.disposeList = [];
    }

}

export { BoardCollaboration }