export type IVectorClock = Record<string, number>;

export type OpType = string;

export interface OpEnvelope {
	opId: string;
	clientId: string;
	sessionId: string;
	vc: IVectorClock;
	type: OpType;
	payload: any;
	seq: number;
}

export interface OperationBatchPayload {
	batchId: string;
	clientId: string;
	sessionId: string;
	ops: OpEnvelope[];
}

export interface AckPayload {
	batchId: string;
	opIds?: string[];
}

export interface SyncRequestPayload {
	clientId: string;
	sessionId: string;
	clock: IVectorClock;
}

export interface SyncPayload {
	operations: OpEnvelope[];
}

export interface SnapshotPayload {
	snapshotId: string;
	clientId: string;
	sessionId: string;
	clock: IVectorClock;
	models?: any[];
	modelsChunk?: any[];
	chunkIndex?: number;
	chunkCount?: number;
}

export interface CollaborationOptions {
	wsUrl?: string;
	sessionId?: string;
	clientId?: string;
	maxBatchOps?: number;
	flushIntervalMs?: number;
	maxMessageBytes?: number;
	maxOpBytes?: number;
	maxInflightBatches?: number;
	retryBaseMs?: number;
	maxRetries?: number;
	holdbackLimit?: number;
}