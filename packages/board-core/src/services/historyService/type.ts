import { IService } from "../type";
import { IModel } from "../modelService/type";

// 操作类型枚举
export enum OperationType {
    CREATE = "create",
    UPDATE = "update",
    DELETE = "delete",
    BATCH = "batch"
}

// 创建操作
export interface CreateOperation {
    type: OperationType.CREATE;
    modelId: string;
    model: IModel;
}

// 更新操作（只存储变化的字段）
export interface UpdateOperation {
    type: OperationType.UPDATE;
    modelId: string;
    changes: Partial<Omit<IModel, "id">>;
    previousState: Partial<Omit<IModel, "id">>;
}

// 删除操作
export interface DeleteOperation {
    type: OperationType.DELETE;
    modelId: string;
    deletedModel: IModel;
}

// 批量操作
export interface BatchOperation {
    type: OperationType.BATCH;
    operations: Operation[];
}

// 联合类型
export type Operation = CreateOperation | UpdateOperation | DeleteOperation | BatchOperation;

export interface IHistoryService extends IService {
    /**
     * 开始批量操作
     */
    startBatch(): void;

    /**
     * 结束批量操作
     */
    endBatch(): void;

    /**
     * 撤销操作
     */
    undo(): boolean;

    /**
     * 重做操作
     */
    redo(): boolean;

    /**
     * 是否可以撤销
     */
    canUndo(): boolean;

    /**
     * 是否可以重做
     */
    canRedo(): boolean;

    /**
     * 清空历史记录
     */
    clear(): void;

    /**
     * 获取历史记录栈大小
     */
    getHistorySize(): number;

    /**
     * 设置最大历史记录数
     */
    setMaxHistorySize(size: number): void;

    /**
     * 历史状态变化事件
     */
    onHistoryChange: (listener: () => void) => { dispose: () => void };
}

export const IHistoryService = Symbol("IHistoryService");
