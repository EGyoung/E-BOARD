import { IBoard, IServiceInitParams } from "../types";

export interface IService {
  init(p: IServiceInitParams): void;
  dispose(): void;
}
