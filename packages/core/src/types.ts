export interface IBoard {
  // 获取画布元素
  getCanvas(): HTMLCanvasElement | null;
  
  // 获取容器元素
  getContainer(): HTMLDivElement | null;
  
  // 初始化方法
  init(): void;
  
  // 销毁方法
  dispose(): void;
}

export interface IServiceInitParams {
  board: IBoard;
}
export interface IService {
  init({ board }: IServiceInitParams): void;
  dispose(): void;
}

export interface IPlugin {
  init(): void;
  dispose(): void;
} 