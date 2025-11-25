import { Emitter } from "@e-board/utils";
import { IHistoryService, Operation, OperationType, BatchOperation } from "./type";
import { IServiceInitParams, IBoard } from "../../types";
import { IModelService, IModel, ModelChangeType, ModelChangeEvent } from "../modelService/type";
import type { EBoard } from "../../board";

class HistoryService implements IHistoryService {
    private undoStack: Operation[] = [];
    private redoStack: Operation[] = [];
    private maxHistorySize: number = 100;
    private board!: EBoard;
    private modelService!: IModelService;
    private _historyChange = new Emitter<void>();
    private batchOperations: Operation[] | null = null;
    private isBatching: boolean = false;
    private isApplyingHistory: boolean = false;
    private modelOperationDisposable: { dispose: () => void } | null = null;

    public onHistoryChange = this._historyChange.event;

    init(params: IServiceInitParams): void {
        this.board = params.board as EBoard;
        this.modelService = this.board.getService('modelService')
        // 监听数据发生变化的操作是什么
        this.modelOperationDisposable = this.modelService.onModelOperation(this.handleModelOperation.bind(this));
    }

    dispose(): void {
        this.clear();
        this._historyChange.dispose();
        if (this.modelOperationDisposable) {
            this.modelOperationDisposable.dispose();
        }
    }

    private handleModelOperation(event: ModelChangeEvent): void {
        if (this.isApplyingHistory) return;

        switch (event.type) {
            // 创建数据
            case ModelChangeType.CREATE:
                this.handleCreate(event);
                break;
            // 数据更新
            case ModelChangeType.UPDATE:
                this.handleUpdate(event);
                break;
            // 删除数据
            case ModelChangeType.DELETE:
                this.handleDelete(event);
                break;
            // 清空数据
            case ModelChangeType.CLEAR:
                this.handleClear(event);
                break;
        }
    }

    private handleCreate(event: ModelChangeEvent): void {
        if (!event.model) return;
        const currentModel = this.modelService.getModelById(event.modelId);
        if (currentModel) {
            const operation: Operation = {
                type: OperationType.CREATE,
                modelId: event.modelId,
                model: this.cloneModel(currentModel)
            };
            this.pushOperation(operation);
        }

    }

    private handleUpdate(event: ModelChangeEvent): void {
        if (!event.updates || !event.previousState) return;
        // 普通的 update 操作
        const operation: Operation = {
            type: OperationType.UPDATE,
            modelId: event.modelId,
            changes: this.clonePartialModel(event.updates),
            previousState: this.clonePartialModel(event.previousState)
        };

        this.pushOperation(operation);
    }

    private handleDelete(event: ModelChangeEvent): void {
        if (!event.model) return;

        // 如果有待合并的 create，说明是创建后立即删除，不记录历史
        const operation: Operation = {
            type: OperationType.DELETE,
            modelId: event.modelId,
            deletedModel: this.cloneModel(event.model)
        };

        this.pushOperation(operation);
    }

    private handleClear(event: ModelChangeEvent): void {
        if (!event.deletedModels || event.deletedModels.size === 0) return;

        this.startBatch();
        event.deletedModels.forEach((model, id) => {
            const operation: Operation = {
                type: OperationType.DELETE,
                modelId: id,
                deletedModel: this.cloneModel(model)
            };
            this.pushOperation(operation);
        });
        this.endBatch();
    }

    startBatch(): void {
        this.isBatching = true;
        this.batchOperations = [];
    }

    endBatch(): void {
        if (!this.isBatching || !this.batchOperations) return;

        if (this.batchOperations.length > 0) {
            const batchOp: BatchOperation = {
                type: OperationType.BATCH,
                operations: this.batchOperations
            };
            this.addToUndoStack(batchOp);
        }

        this.isBatching = false;
        this.batchOperations = null;
    }

    undo(): boolean {
        if (!this.canUndo()) return false;

        const operation = this.undoStack.pop()!;
        this.isApplyingHistory = true;

        try {
            this.revertOperation(operation);
            this.redoStack.push(operation);
            this.trimRedoStack();
            this._historyChange.fire();
            return true;
        } catch (error) {
            console.error("Undo failed:", error);
            this.undoStack.push(operation);
            return false;
        } finally {
            this.isApplyingHistory = false;
        }
    }

    redo(): boolean {
        if (!this.canRedo()) return false;

        const operation = this.redoStack.pop()!;
        this.isApplyingHistory = true;

        try {
            this.applyOperation(operation);
            this.undoStack.push(operation);
            this.trimUndoStack();
            this._historyChange.fire();
            return true;
        } catch (error) {
            console.error("Redo failed:", error);
            this.redoStack.push(operation);
            return false;
        } finally {
            this.isApplyingHistory = false;
        }
    }

    canUndo(): boolean {
        return this.undoStack.length > 0;
    }

    canRedo(): boolean {
        return this.redoStack.length > 0;
    }

    clear(): void {
        this.undoStack = [];
        this.redoStack = [];
        this._historyChange.fire();
    }

    getHistorySize(): number {
        return this.undoStack.length;
    }

    setMaxHistorySize(size: number): void {
        this.maxHistorySize = Math.max(1, size);
        this.trimUndoStack();
        this.trimRedoStack();
    }

    private pushOperation(operation: Operation): void {
        if (this.isBatching && this.batchOperations) {
            this.batchOperations.push(operation);
        } else {
            this.addToUndoStack(operation);
        }
    }

    private addToUndoStack(operation: Operation): void {
        this.undoStack.push(operation);
        this.trimUndoStack();
        this.redoStack = [];
        this._historyChange.fire();
    }

    private applyOperation(operation: Operation): void {
        switch (operation.type) {
            case OperationType.CREATE:
                this.modelService.createModel(operation.model.type, {
                    ...operation.model,
                    id: operation.modelId
                });
                break;
            case OperationType.UPDATE:
                this.modelService.updateModel(operation.modelId, operation.changes);
                break;
            case OperationType.DELETE:
                this.modelService.deleteModel(operation.modelId);
                break;
            case OperationType.BATCH:
                operation.operations.forEach(op => this.applyOperation(op));
                break;
        }
    }

    private revertOperation(operation: Operation): void {
        switch (operation.type) {
            case OperationType.CREATE:
                this.modelService.deleteModel(operation.modelId);
                break;
            case OperationType.UPDATE:
                this.modelService.updateModel(operation.modelId, operation.previousState);
                break;
            case OperationType.DELETE:
                this.modelService.createModel(operation.deletedModel.type, {
                    ...operation.deletedModel,
                    id: operation.modelId
                });
                break;
            case OperationType.BATCH:
                for (let i = operation.operations.length - 1; i >= 0; i--) {
                    this.revertOperation(operation.operations[i]);
                }
                break;
        }
    }

    private trimUndoStack(): void {
        if (this.undoStack.length > this.maxHistorySize) {
            this.undoStack = this.undoStack.slice(-this.maxHistorySize);
        }
    }

    private trimRedoStack(): void {
        if (this.redoStack.length > this.maxHistorySize) {
            this.redoStack = this.redoStack.slice(-this.maxHistorySize);
        }
    }

    private cloneModel<T>(model: T): T {
        return this.deepClone(model);
    }

    private clonePartialModel<T>(partial: T): T {
        return this.deepClone(partial);
    }

    private deepClone<T>(value: T): T {
        // 处理 null 和 undefined
        if (value === null || value === undefined) {
            return value;
        }

        // 处理基本类型
        if (typeof value !== 'object') {
            return value;
        }

        // 处理数组
        if (Array.isArray(value)) {
            return value.map(item => this.deepClone(item)) as any;
        }

        // 处理普通对象
        const cloned: any = {};
        for (const key in value) {
            if (value.hasOwnProperty(key)) {
                cloned[key] = this.deepClone(value[key]);
            }
        }

        return cloned as T;
    }
}

export default HistoryService;
