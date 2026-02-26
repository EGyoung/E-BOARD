const LOGICAL_MULTIPLIER = 100000;
const EPOCH_OFFSET = 1700000000000; // Early 2024

export class HybridLogicalClock {
    private physical: number;
    private logical: number;
    private nodeId: string;

    constructor(nodeId: string) {
        this.nodeId = nodeId;
        this.physical = Date.now();
        this.logical = 0;
    }

    send(): number {
        const now = Date.now();

        if (this.physical < now) {
            this.physical = now;
            this.logical = 0;
        } else {
            this.logical++;
        }

        return this.pack();
    }

    receive(remoteTimestamp: number): void {
        const { physical: rPhysical, logical: rLogical } = this.unpack(remoteTimestamp);
        const now = Date.now();
        const nextPhysical = Math.max(this.physical, rPhysical, now);

        if (nextPhysical === this.physical && nextPhysical === rPhysical) {
            // 都是在同一秒内发生的事件，且物理时间相同，则逻辑时钟取较大值加一
            this.logical = Math.max(this.logical, rLogical) + 1;
        } else if (nextPhysical === this.physical) {
            // 如果最大的是本地物理时间，说明本地事件发生在远程事件之后，逻辑时钟加一
            this.logical++;
        } else if (nextPhysical === rPhysical) {
            // 如果最大的是远程物理时间，说明远程事件发生在本地事件之后，逻辑时钟取远程逻辑时钟加一
            this.logical = rLogical + 1;
        } else {
            this.logical = 0;
        }

        this.physical = nextPhysical;
    }

    now(): number {
        return this.send();
    }

    private pack(): number {
        return (this.physical - EPOCH_OFFSET) * LOGICAL_MULTIPLIER + (this.logical % LOGICAL_MULTIPLIER);
    }

    private unpack(timestamp: number) {
        return {
            physical: Math.floor(timestamp / LOGICAL_MULTIPLIER) + EPOCH_OFFSET,
            logical: timestamp % LOGICAL_MULTIPLIER
        }
    }

    getNodeId() {
        return this.nodeId;
    }
}
