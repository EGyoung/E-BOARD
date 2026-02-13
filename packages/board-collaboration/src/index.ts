import { OperationSource, type EBoard, type ElementService, type ModelChangeEvent, type ModelService } from "@e-board/board-core";
import { WebSocketProvider, MsgType } from '@e-board/board-websocket';
const WS_URL = 'ws://localhost:3010/collaboration'; // TODO: 这个配置应该放到app初始化时作为配置传入

class BoardCollaboration {
    private modelService: ModelService
    private elementService: ElementService
    private websocketProvider: WebSocketProvider | null = null;
    private disposeList: (() => void)[] = [];
    private currentUserid = `user-${Math.floor(Math.random() * 1000)}`;
    constructor(private board: EBoard) {

        this.modelService = board.getService('modelService')
        this.elementService = this.board.getService('elementService')

        this.init()
    }

    private init = () => {
        this.websocketProvider = new WebSocketProvider();
        try {
            this.websocketProvider.connect(WS_URL);
            this.websocketProvider.onMessage((data) => {
                console
                if (data.type === MsgType.OPERATION) {
                    if (data.senderId === this.currentUserid) return; // 忽略自己发送的消息
                    const operation = JSON.parse(data.data)
                    // 外存模型转内存模型
                    if (operation.operation === 'create') {
                        const element = this.elementService.getElement(operation.model.type);
                        if (!element) throw new Error(`Unregistered element type: ${operation.model.type}`);
                        const saveInfoService = this.board.getService('saveInfoService')
                        saveInfoService.importSaveInfo(operation.model, OperationSource.REMOTE)
                    } else if (operation.operation === 'update') {
                        const element = this.elementService.getElement(operation.updates.type);
                        if (!element) throw new Error(`Unregistered element type: ${operation.updates.type}`);
                        const model = element.saveInfoProvider.importSaveInfo(operation.data.updates)
                        this.modelService.updateModel(model.id, model, OperationSource.REMOTE)
                    } else if (operation.operation === 'delete') {

                        operation.data.deletedModels.forEach((m: any) => {
                            const element = this.elementService.getElement(m.type);
                            if (!element) throw new Error(`Unregistered element type: ${m.type}`);
                            const model = element.saveInfoProvider.importSaveInfo(m)
                            this.modelService.deleteModel(model.id, OperationSource.REMOTE)
                        })
                    } else {
                        throw new Error(`Unsupported operation type: ${operation.operation}`);
                    }
                }

            })
        } catch (err) {
            console.error('WebSocket 连接失败:', err);
        }


        const { dispose } = this.modelService.onModelOperation(
            (operation: ModelChangeEvent) => {
                const type = operation.model?.type
                if (!type) throw new Error('Operation missing type');
                const element = this.elementService.getElement(type);
                if (!element) throw new Error(`Unregistered element type: ${type}`);
                const body: any = {
                    type: MsgType.OPERATION,
                    id: `msg-${Date.now()}`,
                    senderId: this.currentUserid,
                    timestamp: Date.now()
                }
                if (operation.operationSource === 'remote') return; // 忽略远程操作，防止循环广播

                // 内存模型转外存模型
                if (operation.type === 'create') {

                    body.data = JSON.stringify({ operation: 'create', model: element.saveInfoProvider.parse(operation.model) })
                } else if (operation.type === 'update') {
                    body.data = JSON.stringify({
                        operation: 'update',
                        updates: element.saveInfoProvider.parse(operation.model),
                        previousState: element.saveInfoProvider.parse(operation.previousState)
                    })
                } else if (operation.type === 'delete') {
                    body.data = JSON.stringify({
                        operation: 'delete',
                        deletedModels: Array.from(operation.deletedModels?.values() || []).map(m => element.saveInfoProvider.parse(m))
                    })
                } else {
                    throw new Error(`Unsupported operation type: ${operation.type}`);
                }
                this.websocketProvider?.send(body)
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