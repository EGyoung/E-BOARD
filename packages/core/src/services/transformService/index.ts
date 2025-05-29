import { eBoardContainer } from "../../common/IocContainer";
import { IBoard, IServiceInitParams } from "../../types";
import { IRenderService } from "../renderService/type";

import { ITransformService } from "./type";

class TransformService implements ITransformService {
  private board!: IBoard;
  private renderService = eBoardContainer.get<IRenderService>(IRenderService);

  private x: number = 0;

  private y: number = 0;

  private zoom: number = 1;

  init = ({ board }: IServiceInitParams) => {
    this.board = board;
    this.initAttribute();
  };

  private initAttribute = () => {
    this.x = 0;
    this.y = 0;
    this.zoom = 1;
  };

  public getView = () => {
    return {
      x: this.x,
      y: this.y,
      zoom: this.zoom
    };
  };

  /**
   * 设置视图信息（位置和缩放）
   * @param view 包含位置和缩放信息的对象
   */
  public setView = (view: { x?: number; y?: number; zoom?: number }) => {
    if (view.x !== undefined) this.x = view.x;
    if (view.y !== undefined) this.y = view.y;
    if (view.zoom !== undefined) this.zoom = view.zoom;
    if (view.x !== undefined || view.y !== undefined || view.zoom !== undefined) {
      const ctx = this.board.getCtx();
      const canvas = this.board.getCanvas();
      if (!ctx || !canvas) return;
      this.renderService.reRender();
    }
  };

  public transformPoint(point: { x: number; y: number }, inverse: boolean = false) {
    const view = this.getView();
    if (inverse) {
      return {
        x: point.x + view.x,
        y: point.y + view.y
      };
    }
    return {
      x: point.x - view.x,
      y: point.y - view.y
    };
  }

  public dispose(): void {}
}

export default TransformService;
