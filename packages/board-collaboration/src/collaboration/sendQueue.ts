import type { OpEnvelope, OperationBatchPayload } from "../types";
import { uuid } from "@e-board/board-utils";
import {
    DEFAULT_FLUSH_INTERVAL_MS,
    DEFAULT_MAX_BATCH_OPS,
    DEFAULT_MAX_INFLIGHT_BATCHES,
    DEFAULT_MAX_MESSAGE_BYTES,
    DEFAULT_MAX_OP_BYTES,
    DEFAULT_MAX_RETRIES,
    DEFAULT_RETRY_BASE_MS
} from "./constants";

export type SendBatchFn = (batch: OperationBatchPayload) => boolean;
export type OversizeOpHandler = (op: OpEnvelope) => void;
export type DeadLetterHandler = (batch: OperationBatchPayload) => void;

interface InflightBatch {
    batch: OperationBatchPayload;
    retryCount: number;
    nextRetryAt: number;
}

interface SendQueueOptions {
    maxBatchOps?: number;
    flushIntervalMs?: number;
    maxMessageBytes?: number;
    maxOpBytes?: number;
    maxInflightBatches?: number;
    retryBaseMs?: number;
    maxRetries?: number;
}

const getByteLength = (value: string) => {
    if (typeof TextEncoder !== "undefined") {
        return new TextEncoder().encode(value).length;
    }
    return value.length;
};

export class SendQueue {
    private queue: OpEnvelope[] = [];
    private inflight: Map<string, InflightBatch> = new Map();
    private flushTimer: any = null;
    private retryTimer: any = null;
    private maxBatchOps: number;
    private flushIntervalMs: number;
    private maxMessageBytes: number;
    private maxOpBytes: number;
    private maxInflightBatches: number;
    private retryBaseMs: number;
    private maxRetries: number;

    constructor(
        private sendBatch: SendBatchFn,
        private onOversizeOp: OversizeOpHandler,
        private onDeadLetter: DeadLetterHandler,
        options: SendQueueOptions = {}
    ) {
        this.maxBatchOps = options.maxBatchOps ?? DEFAULT_MAX_BATCH_OPS;
        this.flushIntervalMs = options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
        this.maxMessageBytes = options.maxMessageBytes ?? DEFAULT_MAX_MESSAGE_BYTES;
        this.maxOpBytes = options.maxOpBytes ?? DEFAULT_MAX_OP_BYTES;
        this.maxInflightBatches = options.maxInflightBatches ?? DEFAULT_MAX_INFLIGHT_BATCHES;
        this.retryBaseMs = options.retryBaseMs ?? DEFAULT_RETRY_BASE_MS;
        this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    }

    public enqueue(op: OpEnvelope) {
        const opSize = getByteLength(JSON.stringify(op));
        if (opSize > this.maxOpBytes) {
            this.onOversizeOp(op);
            return;
        }
        this.queue.push(op);
        this.scheduleFlush();
    }

    public handleAck(batchId: string) {
        this.inflight.delete(batchId);
    }

    public flushNow() {
        if (this.queue.length === 0) return;
        if (this.inflight.size >= this.maxInflightBatches) return;

        const batch = this.buildBatch();
        if (!batch) return;

        if (!batch.batchId) {
            batch.batchId = `batch-${uuid()}`;
        }

        const sent = this.sendBatch(batch);
        if (!sent) {
            this.queue = [...batch.ops, ...this.queue];
            return;
        }
        this.inflight.set(batch.batchId, {
            batch,
            retryCount: 0,
            nextRetryAt: Date.now() + this.retryBaseMs
        });

        if (this.queue.length > 0) {
            this.scheduleFlush();
        }
    }

    public startRetries() {
        if (this.retryTimer) return;
        this.retryTimer = setInterval(() => this.retryInflight(), this.retryBaseMs);
    }

    public stopRetries() {
        if (this.retryTimer) clearInterval(this.retryTimer);
        this.retryTimer = null;
    }

    public dispose() {
        this.stopRetries();
        if (this.flushTimer) clearTimeout(this.flushTimer);
        this.flushTimer = null;
        this.queue = [];
        this.inflight.clear();
    }

    private scheduleFlush() {
        if (this.flushTimer) return;
        this.flushTimer = setTimeout(() => {
            this.flushTimer = null;
            this.flushNow();
        }, this.flushIntervalMs);
    }

    private buildBatch(): OperationBatchPayload | null {
        if (this.queue.length === 0) return null;

        const ops: OpEnvelope[] = [];
        let bytes = 0;

        while (this.queue.length > 0 && ops.length < this.maxBatchOps) {
            const candidate = this.queue[0];
            const nextOps = [...ops, candidate];
            const payload = JSON.stringify({ ops: nextOps });
            const nextBytes = getByteLength(payload);
            if (nextBytes > this.maxMessageBytes) {
                if (ops.length === 0) {
                    // Single op too large for batch payload limit
                    this.queue.shift();
                    this.onOversizeOp(candidate);
                    continue;
                }
                break;
            }
            ops.push(candidate);
            this.queue.shift();
            bytes = nextBytes;
        }

        if (ops.length === 0) return null;
        return {
            batchId: "",
            clientId: "",
            sessionId: "",
            ops
        } as OperationBatchPayload;
    }

    private retryInflight() {
        const now = Date.now();
        for (const [batchId, inflight] of this.inflight.entries()) {
            if (now < inflight.nextRetryAt) continue;
            if (inflight.retryCount >= this.maxRetries) {
                this.inflight.delete(batchId);
                this.onDeadLetter(inflight.batch);
                continue;
            }
            const sent = this.sendBatch(inflight.batch);
            inflight.retryCount += 1;
            inflight.nextRetryAt = now + this.retryBaseMs * Math.pow(2, inflight.retryCount);
            if (!sent) {
                // keep retrying
                continue;
            }
        }
    }
}
