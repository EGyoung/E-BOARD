import { uuid } from "@e-board/utils";
import { IModelService, IModel } from "./type";
import { IServiceInitParams } from "../../types";

type Model = IModel;

export class ModelService implements IModelService {
  private models: Map<string, Model>;

  constructor() {
    this.models = new Map<string, Model>();
  }

  init(p: IServiceInitParams): void {
    console.log("ModelService init", p);
  }

  dispose(): void {
    console.log("ModelService dispose");
  }

  /**
   * 创建新模型
   * @param name 模型名称
   * @param description 模型描述（可选）
   * @returns 创建的模型
   */
  createModel(type: string, options?: Partial<IModel>): Model {
    const model: Model = {
      id: uuid(),
      type,
      ...(options ?? {})
    };
    this.models.set(model.id, model);
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
  updateModel(id: string, updates: Partial<Omit<Model, "id">>): Model | undefined {
    const model = this.models.get(id);
    if (!model) {
      return undefined;
    }

    const updatedModel = {
      ...model,
      ...updates
    };
    this.models.set(id, updatedModel);
    return updatedModel;
  }

  /**
   * 删除模型
   * @param id 模型ID
   * @returns 是否删除成功
   */
  deleteModel(id: string): boolean {
    return this.models.delete(id);
  }

  /**
   * 清除所有模型
   */
  clearModels(): void {
    this.models.clear();
  }
}

export default ModelService;
