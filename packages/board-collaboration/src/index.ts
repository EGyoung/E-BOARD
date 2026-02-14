import { type EBoard, type ElementService, type ModelChangeEvent, type ModelService } from "@e-board/board-core";
import { WebSocketProvider, MsgType } from '@e-board/board-websocket';
import { operationManager } from "./operation/transform";
import { CommandFactory } from "./command";
import { CommandProcessor } from "./command/processor";
import { initCommandProcessor } from './command/processor/index';
const WS_URL = 'ws://localhost:3010/collaboration'; // TODO: 这个配置应该放到app初始化时作为配置传入

class BoardCollaboration {
    private modelService: ModelService
    private elementService: ElementService
    private websocketProvider: WebSocketProvider | null = null;
    private commandFactory: CommandFactory
    private commandProcessor: CommandProcessor
    private disposeList: (() => void)[] = [];
    private currentUserid = `user-${Math.floor(Math.random() * 1000)}`;
    constructor(private board: EBoard) {
        this.modelService = board.getService('modelService')
        this.elementService = this.board.getService('elementService')
        this.commandFactory = new CommandFactory({ board })
        this.commandProcessor = initCommandProcessor(this.board)
        this.init()
    }

    private init = () => {
        this.websocketProvider = new WebSocketProvider();
        this.initRemoteConnection();
        this.initLocalSubscription();
        this.initCollaborationCommand();
    }

    private initCollaborationCommand = () => {
        const { dispose } = this.commandFactory.registerCommandExecute((arg) => {
            this.websocketProvider?.send({
                type: MsgType.COMMAND,
                id: `msg-${Date.now()}`,
                senderId: this.currentUserid,
                data: JSON.stringify(arg)
            })
        })
        this.disposeList.push(dispose)
    }

    private initRemoteConnection = () => {
        try {
            this.websocketProvider?.connect(WS_URL);
            this.websocketProvider?.onMessage((data) => {
                if (data.senderId === this.currentUserid) return; // 忽略自己发送的消息
                if (data.type === MsgType.OPERATION) {
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
                } else if (data.type === MsgType.COMMAND) {
                    const commandData = JSON.parse(data.data)
                    this.commandProcessor.execute(commandData.commandType, commandData.params);
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
        this.commandFactory.dispose();
    }
}

export { BoardCollaboration }