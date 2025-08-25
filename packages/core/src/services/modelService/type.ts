import { IService } from "../type";

export interface IModelService extends IService {
  createModel(type: string, options?: Partial<IModel>): IModel;
  getAllModels(): IModel[];
  getModelById(id: string): IModel | undefined;
  updateModel(id: string, updates: Partial<Omit<IModel, "id">>): IModel | undefined;
  deleteModel(id: string): boolean;
}

interface ModelOptions {
  strokeStyle?: string;
  lineWidth?: number;
  lineCap?: CanvasLineCap;
  lineJoin?: CanvasLineJoin;
  fillStyle?: string;
  globalAlpha?: number;
  [key: string]: any;
}

export interface IModel {
  id: string;
  type: "line" | string;
  points?: { x: number; y: number }[];
  options?: ModelOptions;
}

export const IModelService = Symbol("IModelService");
