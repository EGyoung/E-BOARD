import { Emitter, uuid } from "@e-board/board-utils";
import { IModelService, IModel, ModelChangeType, ModelChangeEvent, OperationSource } from "./type";
import { IServiceInitParams } from "../../types";
import { eBoardContainer } from "../../common/IocContainer";
import { IElementService } from "../elementService/type";

type Model = IModel;



export class ModelService implements IModelService {
  private models: Map<string, Model>;
  private _modelOperation = new Emitter<ModelChangeEvent>();
  public onModelOperation = this._modelOperation.event;
  private elementService = eBoardContainer.get<IElementService>(IElementService);
  constructor() {
    this.models = new Map<string, Model>();
  }

  init(p: IServiceInitParams): void {
    console.log("ModelService init", p);
  }

  dispose(): void {
    console.log("ModelService dispose");
    this._modelOperation.dispose();
  }

  /**
   * 创建新模型
   * @param name 模型名称
   * @param description 模型描述（可选）
   * @returns 创建的模型
   */
  createModel(type: string, options?: Partial<IModel>, operationSource: OperationSource = OperationSource.LOCAL): Model {
    const model = {
      id: options?.id || uuid(),
      type,
      ...(options ?? {})
    } as Model;
    const element = this.elementService.getElement(type);
    if (element) {
      model.ctrlElement = new element.ctrlElement({ model });
    }
    this.models.set(model.id, model);

    // 发出操作事件
    this._modelOperation.fire({
      type: ModelChangeType.CREATE,
      modelId: model.id,
      model,
      operationSource,
    });

    return model;
  }

  /**
   * 获取所有模型
   * @returns 所有模型的数组
   */
  getAllModels(): Model[] {
    return Array.from(this.models.values());
  }

  /**
   * 根据ID获取模型
   * @param id 模型ID
   * @returns 模型对象，如果不存在则返回undefined
   */
  getModelById(id: string): Model | undefined {
    return this.models.get(id);
  }

  /**
   * 更新模型
   * @param id 模型ID
   * @param updates 需要更新的字段
   * @returns 更新后的模型，如果模型不存在则返回undefined
   */
  updateModel(id: string, updates: Partial<Omit<Model, "id">>, operationSource: OperationSource = OperationSource.LOCAL): Model | undefined {
    const model = this.models.get(id);
    if (!model) {
      return undefined;
    }

    // 保存之前的状态（只保存变化的字段）
    const previousState: Partial<Omit<Model, "id">> = {};
    for (const key in updates) {
      if (key !== "id") {
        previousState[key as keyof Omit<Model, "id">] = model[key as keyof Model] as any;
      }
    }

    const updatedModel = {
      ...model,
      ...updates
    };
    this.models.set(id, updatedModel);

    // 发出操作事件
    this._modelOperation.fire({
      type: ModelChangeType.UPDATE,
      modelId: id,
      updates,
      previousState,
      operationSource
    });

    return updatedModel;
  }

  /**
   * 删除模型
   * @param id 模型ID
   * @returns 是否删除成功
   */
  deleteModel(id: string, operationSource: OperationSource = OperationSource.LOCAL): boolean {
    const model = this.models.get(id);
    if (!model) {
      return false;
    }

    const result = this.models.delete(id);

    // 发出操作事件
    if (result) {
      this._modelOperation.fire({
        type: ModelChangeType.DELETE,
        modelId: id,
        model,
        operationSource
      });
    }

    return result;
  }

  /**
   * 清除所有模型
   */
  clearModels(): void {
    const deletedModels = new Map(this.models);

    this.models.clear();

    // 发出清空事件
    if (deletedModels.size > 0) {
      this._modelOperation.fire({
        type: ModelChangeType.CLEAR,
        modelId: "",
        deletedModels
      });
    }

  }
}

export default ModelService;
