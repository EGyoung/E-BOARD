import {
    type EBoard,
    type ElementService,
    type ModelChangeEvent,
    type ModelService,
    OperationSource,
    type ISaveInfoService
} from "@e-board/board-core";
import { WebSocketProvider, MsgType } from '@e-board/board-websocket';
import { operationManager } from "./operation/transform";
import { CommandFactory } from "./command";
import { CommandProcessor } from "./command/processor";
import { initCommandProcessor } from './command/processor/index';
import { VectorClockAction } from "./operation/vectorClock";
import type {
    AckPayload,
    CollaborationOptions,
    IVectorClock,
    OpEnvelope,
    OperationBatchPayload,
    SnapshotPayload,
    SyncPayload,
    SyncRequestPayload
} from "./types";
import {
    DEFAULT_FLUSH_INTERVAL_MS,
    DEFAULT_MAX_BATCH_OPS,
    DEFAULT_MAX_INFLIGHT_BATCHES,
    DEFAULT_MAX_MESSAGE_BYTES,
    DEFAULT_MAX_OP_BYTES,
    DEFAULT_MAX_RETRIES,
    DEFAULT_RETRY_BASE_MS,
    DEFAULT_HOLDBACK_LIMIT
} from "./collaboration/constants";
import { SendQueue } from "./collaboration/sendQueue";
import { HoldbackQueue } from "./collaboration/holdbackQueue";
import { uuid } from "@e-board/board-utils";

const DEFAULT_WS_URL = 'ws://localhost:3010/collaboration';

class BoardCollaboration {
    private modelService: ModelService;
    private elementService: ElementService;
    private saveInfoService: ISaveInfoService;
    private websocketProvider: WebSocketProvider | null = null;
    private commandFactory: CommandFactory;
    private commandProcessor: CommandProcessor;
    private disposeList: (() => void)[] = [];
    private clientId: string;
    private sessionId: string;
    private clock: IVectorClock = {};
    private seq = 0;
    private appliedOps = new Set<string>();
    private holdbackQueue: HoldbackQueue;
    private sendQueue: SendQueue;
    private options: Required<CollaborationOptions>;
    private snapshotChunks: Map<string, {
        chunks: Map<number, any[]>;
        total: number;
        clock: IVectorClock;
        appliedIndex: number;
    }> = new Map();

    constructor(private board: EBoard, options: CollaborationOptions = {}) {
        this.modelService = board.getService('modelService');
        this.elementService = this.board.getService('elementService');
        this.saveInfoService = this.board.getService('saveInfoService');
        this.commandFactory = new CommandFactory({ board });
        this.commandProcessor = initCommandProcessor(this.board);
        this.clientId = options.clientId ?? uuid();
        this.sessionId = options.sessionId ?? 'default-session';
        this.options = {
            wsUrl: options.wsUrl ?? DEFAULT_WS_URL,
            sessionId: this.sessionId,
            clientId: this.clientId,
            maxBatchOps: options.maxBatchOps ?? DEFAULT_MAX_BATCH_OPS,
            flushIntervalMs: options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS,
            maxMessageBytes: options.maxMessageBytes ?? DEFAULT_MAX_MESSAGE_BYTES,
            maxOpBytes: options.maxOpBytes ?? DEFAULT_MAX_OP_BYTES,
            maxInflightBatches: options.maxInflightBatches ?? DEFAULT_MAX_INFLIGHT_BATCHES,
            retryBaseMs: options.retryBaseMs ?? DEFAULT_RETRY_BASE_MS,
            maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
            holdbackLimit: options.holdbackLimit ?? DEFAULT_HOLDBACK_LIMIT
        };
        this.holdbackQueue = new HoldbackQueue(this.options.holdbackLimit);
        this.sendQueue = new SendQueue(
            this.sendBatch,
            this.handleOversizeOp,
            this.handleDeadLetter,
            {
                maxBatchOps: this.options.maxBatchOps,
                flushIntervalMs: this.options.flushIntervalMs,
                maxMessageBytes: this.options.maxMessageBytes,
                maxOpBytes: this.options.maxOpBytes,
                maxInflightBatches: this.options.maxInflightBatches,
                retryBaseMs: this.options.retryBaseMs,
                maxRetries: this.options.maxRetries
            }
        );
        this.init();
    }

    private init = () => {
        this.websocketProvider = new WebSocketProvider();
        this.initRemoteConnection();
        this.initLocalSubscription();
        this.initCollaborationCommand();
        this.sendQueue.startRetries();
    }

    private initCollaborationCommand = () => {
        const { dispose } = this.commandFactory.registerCommandExecute((arg) => {
            this.websocketProvider?.send({
                type: MsgType.COMMAND,
                id: `msg-${uuid()}`,
                senderId: this.clientId,
                data: JSON.stringify(arg),
                timestamp: Date.now()
            });
        });
        this.disposeList.push(dispose);
    }

    private initRemoteConnection = () => {
        try {
            this.websocketProvider?.connect(this.options.wsUrl);
            this.websocketProvider?.onMessage((data) => {
                if (data.senderId === this.clientId) return;
                if (data.type === MsgType.OPERATION) {
                    const payload = JSON.parse(data.data) as OperationBatchPayload | OpEnvelope;
                    if ((payload as OperationBatchPayload).ops) {
                        this.handleRemoteBatch(payload as OperationBatchPayload);
                    } else {
                        this.handleRemoteOp(payload as OpEnvelope);
                    }
                } else if (data.type === MsgType.COMMAND) {
                    const commandData = JSON.parse(data.data);
                    this.commandProcessor.execute(commandData.commandType, commandData.params);
                } else if (data.type === MsgType.ACK) {
                    const ack = (typeof data.data === 'string'
                        ? JSON.parse(data.data)
                        : data.data) as AckPayload;
                    this.sendQueue.handleAck(ack.batchId);
                } else if (data.type === MsgType.SYNC) {
                    const sync = (typeof data.data === 'string'
                        ? JSON.parse(data.data)
                        : data.data) as SyncPayload;
                    this.handleSync(sync);
                } else if (data.type === MsgType.SNAPSHOT) {
                    const snapshot = (typeof data.data === 'string'
                        ? JSON.parse(data.data)
                        : data.data) as SnapshotPayload;
                    this.handleSnapshot(snapshot);
                } else if (data.type === MsgType.ERROR) {
                    console.warn('Collaboration error:', data.data);
                }
            });
        } catch (err) {
            console.error('WebSocket 连接失败:', err);
        }
    }

    private initLocalSubscription = () => {
        const { dispose } = this.modelService.onModelOperation(
            (operation: ModelChangeEvent) => {
                if (operation.operationSource === 'remote') return;
                const handler = operationManager.getHandler(operation.type);
                if (!handler) return;

                this.clock = VectorClockAction.increment(this.clock, this.clientId);

                const payload = handler.handleLocal({
                    operation,
                    board: this.board,
                    modelService: this.modelService,
                    elementService: this.elementService
                });

                const op: OpEnvelope = {
                    opId: uuid(),
                    clientId: this.clientId,
                    sessionId: this.sessionId,
                    vc: this.clock,
                    type: payload.operation,
                    payload,
                    seq: ++this.seq
                };

                this.sendQueue.enqueue(op);
            }
        );
        this.disposeList.push(dispose);
    }

    private sendBatch = (batch: OperationBatchPayload) => {
        if (!this.websocketProvider) return false;
        const message: OperationBatchPayload = {
            ...batch,
            batchId: batch.batchId || `batch-${uuid()}`,
            clientId: this.clientId,
            sessionId: this.sessionId
        };
        const sent = this.websocketProvider.send({
            type: MsgType.OPERATION,
            id: message.batchId,
            senderId: this.clientId,
            timestamp: Date.now(),
            data: JSON.stringify(message)
        });
        return Boolean(sent);
    }

    private handleRemoteBatch(batch: OperationBatchPayload) {
        batch.ops.forEach(op => this.handleRemoteOp(op));
        this.sendAck(batch.batchId);
    }

    private handleRemoteOp(op: OpEnvelope) {
        if (this.appliedOps.has(op.opId)) return;

        if (VectorClockAction.isCausallyReady(op.vc, this.clock, op.clientId)) {
            this.applyRemoteOp(op);
            this.releaseHoldback();
        } else {
            const added = this.holdbackQueue.add(op);
            if (!added) {
                this.requestSync();
            }
        }
    }

    private applyRemoteOp(op: OpEnvelope) {
        const handler = operationManager.getHandler(op.type);
        if (!handler) return;

        this.appliedOps.add(op.opId);
        handler.handleRemote({
            data: op.payload,
            board: this.board,
            modelService: this.modelService,
            elementService: this.elementService
        });
        this.clock = VectorClockAction.merge(this.clock, op.vc);
    }

    private releaseHoldback() {
        let ready = this.holdbackQueue.extractReady(this.clock);
        while (ready.length > 0) {
            ready.forEach(op => this.applyRemoteOp(op));
            ready = this.holdbackQueue.extractReady(this.clock);
        }
    }

    private sendAck(batchId: string) {
        this.websocketProvider?.send({
            type: MsgType.ACK,
            id: `msg-${uuid()}`,
            senderId: this.clientId,
            timestamp: Date.now(),
            data: JSON.stringify({ batchId })
        });
    }

    private requestSync() {
        const payload: SyncRequestPayload = {
            clientId: this.clientId,
            sessionId: this.sessionId,
            clock: this.clock
        };
        this.websocketProvider?.send({
            type: MsgType.SYNC_REQUEST,
            id: `msg-${uuid()}`,
            senderId: this.clientId,
            timestamp: Date.now(),
            data: JSON.stringify(payload)
        });
    }

    private handleSync(sync: SyncPayload) {
        sync.operations.forEach(op => this.handleRemoteOp(op));
    }

    private async handleOversizeOp(op: OpEnvelope) {
        const snapshot = await this.buildSnapshot();
        this.sendSnapshot(snapshot);
    }

    private async buildSnapshot(): Promise<SnapshotPayload> {
        const models = await this.saveInfoService.exportSaveInfo();
        return {
            snapshotId: `snapshot-${uuid()}`,
            clientId: this.clientId,
            sessionId: this.sessionId,
            clock: this.clock,
            models
        };
    }

    private sendSnapshot(snapshot: SnapshotPayload) {
        const serialized = JSON.stringify(snapshot);
        if (serialized.length <= this.options.maxMessageBytes) {
            this.websocketProvider?.send({
                type: MsgType.SNAPSHOT,
                id: `msg-${uuid()}`,
                senderId: this.clientId,
                timestamp: Date.now(),
                data: serialized
            });
            return;
        }

        const models = snapshot.models || [];
        const chunks: any[][] = [];
        let current: any[] = [];
        for (const model of models) {
            const candidate = [...current, model];
            const chunkPayload = {
                ...snapshot,
                models: undefined,
                modelsChunk: candidate,
                chunkIndex: chunks.length,
                chunkCount: 0
            };
            if (JSON.stringify(chunkPayload).length > this.options.maxMessageBytes) {
                if (current.length > 0) {
                    chunks.push(current);
                    current = [model];
                } else {
                    chunks.push([model]);
                    current = [];
                }
            } else {
                current = candidate;
            }
        }
        if (current.length > 0) chunks.push(current);

        chunks.forEach((chunk, index) => {
            const chunkPayload = {
                ...snapshot,
                models: undefined,
                modelsChunk: chunk,
                chunkIndex: index,
                chunkCount: chunks.length
            };
            this.websocketProvider?.send({
                type: MsgType.SNAPSHOT,
                id: `msg-${uuid()}`,
                senderId: this.clientId,
                timestamp: Date.now(),
                data: JSON.stringify(chunkPayload)
            });
        });
    }

    private handleSnapshot(snapshot: SnapshotPayload) {
        if (snapshot.modelsChunk && typeof snapshot.chunkIndex === 'number' && typeof snapshot.chunkCount === 'number') {
            const existing = this.snapshotChunks.get(snapshot.snapshotId);
            const entry = existing ?? {
                chunks: new Map<number, any[]>(),
                total: snapshot.chunkCount,
                clock: snapshot.clock,
                appliedIndex: 0
            };
            entry.chunks.set(snapshot.chunkIndex, snapshot.modelsChunk || []);
            entry.total = snapshot.chunkCount;
            entry.clock = snapshot.clock;
            this.snapshotChunks.set(snapshot.snapshotId, entry);

            while (entry.chunks.has(entry.appliedIndex)) {
                if (entry.appliedIndex === 0) {
                    this.modelService.clearModels();
                }
                const chunk = entry.chunks.get(entry.appliedIndex) || [];
                this.saveInfoService.importSaveInfoList(chunk, OperationSource.REMOTE);
                entry.chunks.delete(entry.appliedIndex);
                entry.appliedIndex += 1;
            }

            if (entry.appliedIndex >= entry.total) {
                this.clock = VectorClockAction.merge(this.clock, entry.clock);
                this.snapshotChunks.delete(snapshot.snapshotId);
            }
            return;
        }
        if (!snapshot.models) return;
        this.modelService.clearModels();
        this.saveInfoService.importSaveInfoList(snapshot.models, OperationSource.REMOTE);
        this.clock = VectorClockAction.merge(this.clock, snapshot.clock);
    }

    private handleDeadLetter = (batch: OperationBatchPayload) => {
        console.warn('Batch send failed after retries', batch.batchId);
    }

    public dispose = () => {
        this.disposeList.forEach(dispose => dispose());
        this.disposeList = [];
        this.commandFactory.dispose();
        this.sendQueue.dispose();
    }
}

export { BoardCollaboration };
