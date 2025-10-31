import { IService } from "../type";

export interface IModelService extends IService {
  createModel(type: string, options?: Partial<IModel>): IModel;
  getAllModels(): IModel[];
  getModelById(id: string): IModel | undefined;
  updateModel(id: string, updates: Partial<Omit<IModel, "id">>): IModel | undefined;
  deleteModel(id: string): boolean;
  clearModels(): void;
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

export type IModel<T extends Record<string, any> = Record<string, any>> = {
  id: string;
  type: "line" | string;
  points?: { x: number; y: number }[];
  options?: ModelOptions;
} & T;

export const IModelService = Symbol("IModelService");
