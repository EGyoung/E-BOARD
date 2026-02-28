import { IModel } from "../../../services/modelService/type";

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

    const labelText = `${(model as any)?.text ?? model.options?.label ?? model.options?.aiText ?? ""}`.trim();
    if (!labelText) {
      return;
    }

    const drawRect = isViewChanged
      ? {
        x: point.x,
        y: point.y,
        width: model.width,
        height: model.height,
        zoom: 1
      }
      : (() => {
        const transformedPoint = this.transformPoint({ x: point.x, y: point.y });
        const zoom = this.transformService.getView().zoom;
        return {
          x: transformedPoint.x,
          y: transformedPoint.y,
          width: model.width * zoom,
          height: model.height * zoom,
          zoom
        };
      })();

    const baseFontSize = model.options?.labelFontSize ?? model.options?.fontSize ?? model.options?.aiTextFontSize ?? 16;
    const fontSize = Math.max(1, baseFontSize * drawRect.zoom);
    const lineHeight = fontSize * 1.3;
    const lines = labelText.split("\n");
    const totalHeight = lines.length * lineHeight;
    const centerX = drawRect.x + drawRect.width / 2;
    const startY = drawRect.y + (drawRect.height - totalHeight) / 2;

    context.save();
    context.textAlign = "center";
    context.textBaseline = "top";
    context.font = `${fontSize}px sans-serif`;
    context.fillStyle = model.options?.labelColor ?? model.options?.aiTextColor ?? "#000000";

    lines.forEach((line, index) => {
      const lineY = startY + index * lineHeight;
      context.fillText(line, centerX, lineY);
    });

    context.restore();
  };
}

export { Render }