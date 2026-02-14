// types.ts

export enum MsgType {
    COMMAND = 'command', // 指令 用户一些不用保存的操作，如 绘制过程中的路径数据，可以通过 COMMAND 类型发送，减少对消息存储和历史回放的压力
    OPERATION = 'operation',
    HEARTBEAT = 'heartbeat',
    ACK = 'ack', // 消息确认回执
    SYNC_REQUEST = 'sync-request',
    SYNC = 'sync',
    SNAPSHOT = 'snapshot',
    ERROR = 'error',
}

export enum MsgStatus {
    SENDING = 'sending',
    SUCCESS = 'success',
    FAILED = 'failed',
}

export interface IMessage {
    id: string;        // 消息唯一ID (UUID)
    type: MsgType;
    data: string;
    senderId: string;
    timestamp: number;
    status?: MsgStatus; // 前端专用状态，用于UI展示loading/重试
}

// 事件回调类型
export type MessageHandler = (msg: IMessage) => void;
export type StatusChangeHandler = (status: 'connected' | 'disconnected' | 'reconnecting') => void;