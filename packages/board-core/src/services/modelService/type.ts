import { IService } from "../type";

export enum ModelChangeType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  CLEAR = "clear"
}
export enum OperationSource {
  LOCAL = 'local',
  REMOTE = 'remote'
}
export interface ModelChangeEvent {
  type: ModelChangeType;
  modelId: string;
  model?: IModel;
  updates?: Partial<Omit<IModel, "id">>;
  previousState?: Partial<Omit<IModel, "id">>;
  deletedModels?: Map<string, IModel>;
  operationSource?: OperationSource;
}

export interface IModelService<ExtensionOptions extends Record<string, any> =
  Record<string, any>
> extends IService {
  createModel(type: string, options?: Partial<IModel<ExtensionOptions>>): IModel<ExtensionOptions>;
  getAllModels(): IModel<ExtensionOptions>[];
  getModelById(id: string): IModel<ExtensionOptions> | undefined;
  updateModel(id: string, updates: Partial<Omit<IModel<ExtensionOptions>, "id">>): IModel<ExtensionOptions> | undefined;
  deleteModel(id: string): boolean;
  clearModels(): void;
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

export type IPoint = {
  x: number;
  y: number;
}

export type IModel<T extends Record<string, any> = Record<string, any>> = {
  id: string;
  type: string;
  points?: IPoint[];
  options?: ModelOptions;
  ctrlElement: {
    getBoundingBox: (model?: IModel<any>) => BoundingBox;
    isHit: (params: any) => boolean;
    onElementMove?: (e: any) => void;
  },
} & T




export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

// export type BaseCtrlElement<Model> = 

export const IModelService = Symbol("IModelService");
