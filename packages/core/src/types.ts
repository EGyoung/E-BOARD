import { IPlugin } from "./plugins/type";

export interface IBoard {
  config: Partial<IBoardInitParams>;
  // Canvas 相关方法
  getCanvas(): HTMLCanvasElement | null;
  getCtx(): CanvasRenderingContext2D | null;
  getContainer(): HTMLDivElement | null;

  getInteractionCanvas(): HTMLCanvasElement | null;
  getInteractionCtx(): CanvasRenderingContext2D | null;

  // 生命周期方法
  // init(): void;
  dispose(): void;
}

export interface IPluginInitParams {
  board: IBoard;
}

export interface IServiceInitParams {
  board: IBoard;
}
// 定义核心插件类型
export const CorePlugins = {
  DRAW: "DrawPlugin"
} as const;

export type CorePluginType = (typeof CorePlugins)[keyof typeof CorePlugins];

// 扩展 IBoardInitParams 接口
export interface IBoardInitParams {
  container: HTMLDivElement;
  id: string;
  plugins?: Array<new ({ board }: IPluginInitParams) => IPlugin>;
  disableDefaultPlugins?: boolean; // 是否禁用默认插件
}

export interface IService {
  init({ board }: IServiceInitParams): void;
  dispose(): void;
}
