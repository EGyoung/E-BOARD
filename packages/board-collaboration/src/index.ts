import { type EBoard, type ElementService, type ModelChangeEvent, type ModelService } from "@e-board/board-core";
import { WebSocketProvider, MsgType } from '@e-board/board-websocket';
import { operationManager } from "./operation/transform";
import { CommandFactory } from "./command";
import { CommandProcessor } from "./command/processor";
import { initCommandProcessor } from './command/processor/index';
import { HybridLogicalClock } from "./utils/clock";

const WS_URL = 'ws://localhost:3010/collaboration'; // TODO: 这个配置应该放到app初始化时作为配置传入

class BoardCollaboration {
    private modelService: ModelService
    private elementService: ElementService
    private websocketProvider: WebSocketProvider | null = null;
    private commandFactory: CommandFactory
    private commandProcessor: CommandProcessor
    private disposeList: (() => void)[] = [];
    private currentUserid = `user-${Math.floor(Math.random() * 1000)}`;

    // Conflict Resolution & Offline Support
    public clock: HybridLogicalClock;
    private pendingQueue: any[] = [];
    private offlineBuffer: any[] = [];
    private retryTimer: any = null;

    constructor(private board: EBoard) {
        this.modelService = board.getService('modelService')
        this.elementService = this.board.getService('elementService')
        this.commandFactory = new CommandFactory({ board })
        this.commandProcessor = initCommandProcessor(this.board)
        this.clock = new HybridLogicalClock(this.currentUserid);
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
            this.sendOrBuffer({
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

            this.websocketProvider?.onStatusChange((status) => {
                if (status === 'connected') {
                    // Flush buffer
                    while (this.offlineBuffer.length > 0) {
                        const msg = this.offlineBuffer.shift();
                        this.websocketProvider?.send(msg);
                    }

                    this.websocketProvider?.send({
                        type: 'sync-request' as any,
                        id: `sync-${Date.now()}`,
                        senderId: this.currentUserid
                    });
                }
            });

            this.websocketProvider?.onMessage((data) => {
                if (data.senderId === this.currentUserid) return; // 忽略自己发送的消息

                if (data.type === 'sync' as any) {
                    const history = (data as any).data.operations;
                    if (Array.isArray(history)) {
                        console.log('Replaying history:', history.length, 'ops');
                        history.forEach(opData => {
                            // Ensure history playback doesn't re-apply own ops blindly if we have state, 
                            // but usually LWW handles this. 
                            // Standard practice: Apply all history as if remote. 
                            if (opData.senderId !== this.currentUserid) {
                                // Add timestamp/nodeId if missing (for legacy ops)
                                opData.nodeId = opData.nodeId || opData.senderId;
                                this.processRemoteOperation(opData);
                            }
                        });
                    }
                    return;
                }

                if (data.type === MsgType.OPERATION) {
                    const operationData = JSON.parse(data.data);
                    operationData.nodeId = operationData.nodeId || data.senderId;
                    this.processRemoteOperation(operationData);
                } else if (data.type === MsgType.COMMAND) {
                    const commandData = JSON.parse(data.data)
                    this.commandProcessor.execute(commandData.commandType, commandData.params);
                }
            })
        } catch (err) {
            console.error('WebSocket 连接失败:', err);
        }
    }

    private sendOrBuffer(msg: any) {
        if (this.websocketProvider?.send(msg)) {
            // sent successfully
        } else {
            this.offlineBuffer.push(msg);
        }
    }

    private processRemoteOperation(operationData: any) {
        if (operationData.timestamp) {
            this.clock.receive(operationData.timestamp);
        }

        const opType = operationData.operation;

        // Buffer updates/deletes if model is missing
        if (['update', 'delete'].includes(opType)) {
            const modelId = operationData.modelId;
            const model = this.modelService.getModelById(modelId);

            if (!model) {
                // If update arrives before create
                this.pendingQueue.push({
                    timestamp: Date.now(),
                    data: operationData
                });
                this.scheduleRetry();
                return;
            }
        }

        this.applyOperation(operationData);

        // If we created something, maybe pending updates can apply now
        if (opType === 'create') {
            this.scheduleRetry();
        }
    }

    private applyOperation(operationData: any) {
        const handler = operationManager.getHandler(operationData.operation);
        if (handler) {
            handler.handleRemote({
                data: operationData,
                board: this.board,
                modelService: this.modelService,
                elementService: this.elementService
            });
        }
    }

    private scheduleRetry() {
        if (this.retryTimer) return;
        this.retryTimer = setTimeout(() => {
            this.retryTimer = null;
            this.processPendingQueue();
        }, 500);
    }

    private processPendingQueue() {
        if (this.pendingQueue.length === 0) return;

        const queue = [...this.pendingQueue];
        this.pendingQueue = [];
        const nextPass: any[] = [];

        queue.forEach(item => {
            const { data } = item;
            const model = this.modelService.getModelById(data.modelId);

            if (model || data.operation === 'create') {
                this.applyOperation(data);
            } else {
                if (Date.now() - item.timestamp < 30000) {
                    nextPass.push(item);
                }
            }
        });

        this.pendingQueue = nextPass;
        if (this.pendingQueue.length > 0) {
            this.scheduleRetry();
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

                    // Attach LWW Metadata
                    const finalPayload = {
                        ...payload,
                        timestamp: this.clock.send(),
                        nodeId: this.currentUserid
                    };

                    const body: any = {
                        type: MsgType.OPERATION,
                        id: `msg-${Date.now()}`,
                        senderId: this.currentUserid,
                        data: JSON.stringify(finalPayload)
                    }
                    this.sendOrBuffer(body);
                }
            }
        )
        this.disposeList.push(dispose);
    }

    public dispose = () => {
        this.disposeList.forEach(dispose => dispose());
        this.disposeList = [];
        this.commandFactory.dispose();
        if (this.retryTimer) clearTimeout(this.retryTimer);
    }
}

export { BoardCollaboration }