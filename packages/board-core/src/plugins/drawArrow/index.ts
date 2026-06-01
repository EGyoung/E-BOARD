import { BaseDrawLinePlugin } from "../drawLine/BaseDrawLinePlugin";

class DrawArrowPlugin extends BaseDrawLinePlugin {
  public pluginName = "DrawArrowPlugin";

  protected get modeName() { return "drawArrow"; }
  protected get modelType() { return "arrow"; }

  protected drawPreviewExtras(
    ctx: CanvasRenderingContext2D,
    start: { x: number; y: number },
    end: { x: number; y: number }
  ) {
    const zoom = this.transformService.getView().zoom || 1;
    const lineWidth = this.configService.getCtxConfig()?.lineWidth ?? 2;
    const headLength = Math.max(8, lineWidth * 4 * zoom);

    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const wingAngle = Math.PI / 7;

    const leftX = end.x - headLength * Math.cos(angle - wingAngle);
    const leftY = end.y - headLength * Math.sin(angle - wingAngle);
    const rightX = end.x - headLength * Math.cos(angle + wingAngle);
    const rightY = end.y - headLength * Math.sin(angle + wingAngle);

    ctx.moveTo(leftX, leftY);
    ctx.lineTo(end.x, end.y);
    ctx.lineTo(rightX, rightY);
  }
}

export default DrawArrowPlugin;
