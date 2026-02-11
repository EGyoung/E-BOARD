import type { EBoard, ModelService } from "@e-board/board-core";

class BoardCollaboration {
    private modelService: ModelService
    private disposeList: (() => void)[] = [];
    constructor(private board: EBoard) {
        this.modelService = board.getService('modelService')
        this.init()
    }

    private init = () => {
        const { dispose } = this.modelService.onModelOperation(
            (operation) => {
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