import { IModel } from "@e-board/board-core";

import { BaseRender } from "../../baseElement/baseRender";
import { IShapeRectangle } from "../type";

class Render extends BaseRender<IShapeRectangle> {
  private transformService = this.board.getService('transformService')
  public transformPoint(point: { x: number; y: number }, inverse = false) {
    return this.transformService.transformPoint(point, inverse);
  }
  public render = (
    model: IModel<IShapeRectangle>,
    _: any,
    isViewChanged: boolean = false
  ) => {
    const context = this.board.getCtx();
    if (!context) return;
    const [point] = model.points!;
    if (isViewChanged) {
      context.rect(
        point.x,
        point.y,
        model.width,
        model.height
      )
    } else {
      const transformedPoint = this.transformPoint({ x: point.x, y: point.y });
      const zoom = this.transformService.getView().zoom;

      // 绘制矩形
      context.rect(
        transformedPoint.x,
        transformedPoint.y,
        model.width * zoom,
        model.height * zoom
      );
    }

    if (model.options?.fillStyle) {
      context.fillStyle = model.options.fillStyle;
      context.fill();
    }
  };
}

export { Render }