import { IService } from "../type";

export interface ITransformService extends IService {
  /**
   * 获取当前视图信息
   */
  getView(): { x: number; y: number; zoom: number };

  /**
   * 设置视图信息
   */
  setView(view: { x?: number; y?: number; zoom?: number }): void;

  transformPoint(point: { x: number; y: number }, inverse?: boolean): { x: number; y: number };
}

export const ITransformService = Symbol("ITransformService");
