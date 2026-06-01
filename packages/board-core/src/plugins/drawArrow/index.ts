import { BaseShapeDrawPlugin, DrawContext } from "../drawLine/BaseDrawLinePlugin";

class DrawArrowPlugin extends BaseShapeDrawPlugin {
  public pluginName = "DrawArrowPlugin";

  protected get modeName() { return "drawArrow"; }

  protected drawPreview(dc: DrawContext) {
    const { ctx, startCanvasPoint: s, endCanvasPoint: e, zoom } = dc;
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(e.x, e.y);

    const lineWidth = this.configService.getCtxConfig()?.lineWidth ?? 2;
    const headLength = Math.max(8, lineWidth * 4 * zoom);
    const angle = Math.atan2(e.y - s.y, e.x - s.x);
    const wing = Math.PI / 7;

    ctx.moveTo(e.x - headLength * Math.cos(angle - wing), e.y - headLength * Math.sin(angle - wing));
    ctx.lineTo(e.x, e.y);
    ctx.lineTo(e.x - headLength * Math.cos(angle + wing), e.y - headLength * Math.sin(angle + wing));
  }

  protected createModel(dc: DrawContext) {
    this.modelService.createModel("arrow", {
      points: [dc.startWorldPoint, dc.endWorldPoint],
      options: { ...this.configService.getCtxConfig() },
    });
  }
}

export default DrawArrowPlugin;
