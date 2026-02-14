import type { IVectorClock, OpEnvelope } from "../types";
import { VectorClockAction } from "../operation/vectorClock";
import { DEFAULT_HOLDBACK_LIMIT } from "./constants";

export class HoldbackQueue {
    private queue: OpEnvelope[] = [];

    constructor(private holdbackLimit: number = DEFAULT_HOLDBACK_LIMIT) {}

    public size() {
        return this.queue.length;
    }

    public add(op: OpEnvelope) {
        if (this.queue.length >= this.holdbackLimit) {
            return false;
        }
        this.queue.push(op);
        return true;
    }

    public extractReady(localClock: IVectorClock) {
        const ready: OpEnvelope[] = [];
        const remaining: OpEnvelope[] = [];
        for (const op of this.queue) {
            if (VectorClockAction.isCausallyReady(op.vc, localClock, op.clientId)) {
                ready.push(op);
            } else {
                remaining.push(op);
            }
        }
        this.queue = remaining;
        return ready;
    }
}
