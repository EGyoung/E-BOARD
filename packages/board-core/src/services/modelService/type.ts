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
  updates?: Partial<IModelData>;
  previousState?: Partial<IModelData>;
  deletedModels?: Map<string, IModel>;
  operationSource?: OperationSource;
}

export interface IModelService<ExtensionOptions extends Record<string, any> =
  Record<string, any>
> extends IService {
  createModel(type: string, options?: Partial<IModel<ExtensionOptions>>): IModel<ExtensionOptions>;
  getAllModels(): IModel<ExtensionOptions>[];
  getModelById(id: string): IModel<ExtensionOptions> | undefined;
  updateModel(id: string, updates: Partial<IModelData<ExtensionOptions>>): IModel<ExtensionOptions> | undefined;
  deleteModel(id: string): boolean;
  clearModels(): void;
  onModelOperation: (listener: (event: ModelChangeEvent) => void) => { dispose: () => void };
}

export interface ModelOptions {
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

// ---------------------------------------------------------------------------
// 模型数据层 — 纯数据字段，可被 setState / merge 修改
// ---------------------------------------------------------------------------
export type IModelData<T extends Record<string, any> = Record<string, any>> = {
  type: string;
  points?: IPoint[];
  options?: ModelOptions;
} & T

// ---------------------------------------------------------------------------
// 控制层 — 运行时行为，不属于模型数据
// ---------------------------------------------------------------------------
export interface ICtrlElement<T extends Record<string, any> = Record<string, any>> {
  getBoundingBox: (model?: IModel<T>) => BoundingBox;
  isHit: (params: any) => boolean;
  onElementMove?: (e: any) => void;
  canResize?: () => boolean;
  setState: (updates: Partial<IModelData<T>>) => void;
  merge: (updates: Partial<IModelData<T>>) => void;
}

// ---------------------------------------------------------------------------
// 完整模型 = 标识 + 数据 + 控制层
// ---------------------------------------------------------------------------
export type IModel<T extends Record<string, any> = Record<string, any>> = IModelData<T> & {
  id: string;
  ctrlElement: ICtrlElement<T>;
}



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

export const IModelService = Symbol("IModelService");
