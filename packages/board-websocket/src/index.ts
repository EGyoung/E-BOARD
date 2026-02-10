import { IMessage, MsgType, MessageHandler, StatusChangeHandler } from './types';

export class WebSocketProvider {
    private ws: WebSocket | null = null;
    private url: string = '';
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private heartbeatTimer: any = null;
    private listeners: MessageHandler[] = [];
    private statusListeners: StatusChangeHandler[] = [];
    private isIntentionalClose = false; // 是否是用户主动断开


    // 初始化连接
    public connect(url: string) {
        this.url = url;
        this.isIntentionalClose = false;

        if (this.ws) {
            this.ws.close();
        }

        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            console.log('IM Connected');
            this.reconnectAttempts = 0; // 重置重连次数
            this.notifyStatus('connected');
            this.startHeartbeat();
        };

        this.ws.onmessage = (event) => {
            try {
                const msg: IMessage = JSON.parse(event.data);
                // 如果是心跳回包，忽略或重置超时计时器
                if (msg.type === MsgType.HEARTBEAT) return;

                // 分发消息给订阅者
                this.listeners.forEach(fn => fn(msg));
            } catch (e) {
                console.error('Message parse error', e);
            }
        };

        this.ws.onclose = () => {
            console.log('IM Disconnected');
            this.stopHeartbeat();
            this.notifyStatus('disconnected');

            // 非主动断开且未超过最大重试次数，触发重连
            if (!this.isIntentionalClose) {
                this.handleReconnect();
            }
        };

        this.ws.onerror = (err) => {
            console.error('IM Error', err);
            // error 通常会紧接着 close，所以逻辑主要在 close 中处理
        };
    }

    // 发送消息
    public send(msg: Partial<IMessage>) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
            return true;
        } else {
            console.warn('WebSocket not connected. Message queued or dropped.');
            return false;
        }
    }

    // 断开连接
    public disconnect() {
        this.isIntentionalClose = true;
        this.stopHeartbeat();
        this.ws?.close();
    }

    // 添加消息监听
    public onMessage(callback: MessageHandler) {
        this.listeners.push(callback);
        return () => { // 返回取消订阅函数
            this.listeners = this.listeners.filter(fn => fn !== callback);
        };
    }

    // 取消消息监听
    public offMessage(callback: MessageHandler) {
        this.listeners = this.listeners.filter(fn => fn !== callback);
    }

    // 添加状态监听
    public onStatusChange(callback: StatusChangeHandler) {
        this.statusListeners.push(callback);
    }

    // 取消状态监听
    public offStatusChange(callback: StatusChangeHandler) {
        this.statusListeners = this.statusListeners.filter(fn => fn !== callback);
    }
    // ----------- 内部机制 -----------

    private notifyStatus(status: 'connected' | 'disconnected' | 'reconnecting') {
        this.statusListeners.forEach(fn => fn(status));
    }

    // 重连机制：指数退避
    private handleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('Max reconnect attempts reached');
            return;
        }

        this.notifyStatus('reconnecting');
        this.reconnectAttempts++;
        const delay = Math.min(1000 * (2 ** this.reconnectAttempts), 30000); // 1s, 2s, 4s... max 30s

        console.log(`Attempting reconnect in ${delay}ms...`);
        setTimeout(() => {
            this.connect(this.url);
        }, delay);
    }

    // 心跳机制
    private startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatTimer = setInterval(() => {
            // 发送心跳包
            this.send({
                type: MsgType.HEARTBEAT,
                content: 'ping',
                id: 'heartbeat',
                senderId: 'system',
                timestamp: Date.now()
            });
        }, 30000); // 30秒一次
    }

    private stopHeartbeat() {
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    }
}