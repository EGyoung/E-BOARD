import { IVectorClock } from "../../types"

class VectorClockAction {
    public static increment(clock: IVectorClock, userId: string) {
        return {
            ...clock,
            [userId]: (clock[userId] ?? 0) + 1
        }
    }

    public static merge(local: IVectorClock, remote: IVectorClock) {
        const localKeys = Object.keys(local);
        const remoteKeys = Object.keys(remote);
        if (localKeys.length !== remoteKeys.length) {
            throw new Error('can not be merged')
        }
        const merged: IVectorClock = {};
        for (const userId in remote) {
            merged[userId] = Math.max(local[userId] || 0, remote[userId] || 0);
        }
        return merged;
    }

    // 判断是否发成冲突
    public static isConflict(local: IVectorClock, remote: IVectorClock) {
        let localBigger = false;
        let remoteBigger = false;
        for (const userId in remote) {
            const localValue = local[userId] || 0;
            const remoteValue = remote[userId] || 0;
            if (localValue < remoteValue) {
                remoteBigger = true;
            } else if (localValue > remoteValue) {
                localBigger = true;
            }
            // 出现了一大一小就说明发生了冲突
            /**
             * 例子: 初始化的时候两个用户 A 和 B 的 vector clock 都是 { A: 0, B: 0 }
             * 1. 用户 A 本地操作一次，变成 { A: 1, B: 0 }，此时 localBigger = true, remoteBigger = false
             * 2. 用户 B 本地操作一次，变成 { A: 0, B: 1 }，此时 localBigger = false, remoteBigger = true
             * 3. 用户 A 收到用户 B 的操作，比较 { A: 1, B: 0 } 和 { A: 0, B: 1 }，此时 localBigger = true, remoteBigger = true，说明发生了冲突
             */
            if (localBigger && remoteBigger) {
                return true; // 发生冲突
            }
        }
        return false; // 没有冲突
    }


}



export { VectorClockAction }