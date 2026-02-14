import { type EBoard, type ElementService, type ModelChangeEvent, type ModelService } from "@e-board/board-core";
import { WebSocketProvider, MsgType } from '@e-board/board-websocket';
import { operationManager } from "./operation/transform";
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
        this.initRemoteConnection();
        this.initLocalSubscription();
    }

    private initRemoteConnection = () => {
        try {
            this.websocketProvider?.connect(WS_URL);
            this.websocketProvider?.onMessage((data) => {
                if (data.type === MsgType.OPERATION) {
                    if (data.senderId === this.currentUserid) return; // 忽略自己发送的消息
                    const operationData = JSON.parse(data.data)
                    const handler = operationManager.getHandler(operationData.operation);
                    if (handler) {
                        handler.handleRemote({
                            data: operationData,
                            board: this.board,
                            modelService: this.modelService,
                            elementService: this.elementService
                        });
                    } else {
                        throw new Error(`Unsupported operation type: ${operationData.operation}`);
                    }
                }
            })
        } catch (err) {
            console.error('WebSocket 连接失败:', err);
        }
    }

    private initLocalSubscription = () => {
        const { dispose } = this.modelService.onModelOperation(
            (operation: ModelChangeEvent) => {
                if (operation.operationSource === 'remote') return; // 忽略远程操作，防止循环广播

                const handler = operationManager.getHandler(operation.type);
                if (handler) {
                    const payload = handler.handleLocal({
                        operation,
                        board: this.board,
                        modelService: this.modelService,
                        elementService: this.elementService
                    });
                    const body: any = {
                        type: MsgType.OPERATION,
                        id: `msg-${Date.now()}`,
                        senderId: this.currentUserid,
                        timestamp: Date.now(),
                        data: JSON.stringify(payload)
                    }
                    this.websocketProvider?.send(body)
                }
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