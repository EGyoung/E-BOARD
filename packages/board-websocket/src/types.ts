// types.ts

export enum MsgType {
    OPERATION = 'operation',
    HEARTBEAT = 'heartbeat',
    ACK = 'ack', // 消息确认回执
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