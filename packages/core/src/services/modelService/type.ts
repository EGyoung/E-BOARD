import { IService } from "../type";

export enum ModelChangeType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  CLEAR = "clear"
}

export interface ModelChangeEvent {
  type: ModelChangeType;
  modelId: string;
  model?: IModel;
  updates?: Partial<Omit<IModel, "id">>;
  previousState?: Partial<Omit<IModel, "id">>;
  deletedModels?: Map<string, IModel>;
}

export interface IModelService extends IService {
  createModel(type: string, options?: Partial<IModel>): IModel;
  getAllModels(): IModel[];
  getModelById(id: string): IModel | undefined;
  updateModel(id: string, updates: Partial<Omit<IModel, "id">>): IModel | undefined;
  deleteModel(id: string): boolean;
  clearModels(): void;
  onModelChange: (listener: () => void) => { dispose: () => void };
  onModelOperation: (listener: (event: ModelChangeEvent) => void) => { dispose: () => void };
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
