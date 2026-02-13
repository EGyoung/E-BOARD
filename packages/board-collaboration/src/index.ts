import type { EBoard, ModelChangeEvent, ModelService } from "@e-board/board-core";

class BoardCollaboration {
    private modelService: ModelService
    // private websocketProvider: WebSocketProvider
    private disposeList: (() => void)[] = [];
    constructor(private board: EBoard) {
        this.modelService = board.getService('modelService')
        this.init()
    }

    // TODO: 初始化websocketProvider, 监听传入的数据，更新modelService中的数据

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