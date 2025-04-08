export interface IBoard {
  // Canvas 相关方法
  getCanvas(): HTMLCanvasElement | null;
  getCtx(): CanvasRenderingContext2D | null;
  getContainer(): HTMLDivElement | null;

  // 画板模式管理
  setBoardMode(mode: typeof EBoardMode | string): void;
  getBoardMode(): typeof EBoardMode | string;

  // 插件管理
  registerPlugin(plugin: new ({ board }: IPluginInitParams) => IPlugin): void;
  getPlugin(name: string): IPlugin | undefined;
  removePlugin(name: string): void;
  isCorePlugin(name: string): boolean;

  // 生命周期方法
  init(): void;
  dispose(): void;
}

export interface IPlugin {
  pluginName: string;
  init({ board }: IPluginInitParams): void;
  dispose(): void;
}

export interface IPluginInitParams {
  board: IBoard;
}

export interface IServiceInitParams {
  board: IBoard;
}

export const EBoardMode = {
  PEN: "PEN",
  ERASER: "ERASER",
  SELECT: "SELECT",
  ROAM: "ROAM"
} as const;

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
