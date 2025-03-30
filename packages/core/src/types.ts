export interface IBoard {
  // 获取画布元素
  getCanvas(): HTMLCanvasElement | null;

  // 获取上下文
  getCtx(): CanvasRenderingContext2D | null;

  // 获取容器元素
  getContainer(): HTMLDivElement | null;

  // // 初始化方法
  // init(): void;

  // 销毁方法
  dispose(): void;
}

export enum EBoardMode {
  PEN = "pen",
  SELECT = "select",
  ZOOM = "zoom"
}

export interface IServiceInitParams {
  board: IBoard;
}
export interface IPluginInitParams {
  board: IBoard;
}
export interface IService {
  init({ board }: IServiceInitParams): void;
  dispose(): void;
}

export interface IPlugin {
  init({ board }: IPluginInitParams): void;
  dispose(): void;
}
