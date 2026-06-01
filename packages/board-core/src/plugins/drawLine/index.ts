import { BaseShapeDrawPlugin, DrawContext } from "../BaseShapeDrawPlugin";

class DrawLinePlugin extends BaseShapeDrawPlugin {
  public pluginName = "DrawLinePlugin";

  protected get modeName() { return "drawLine"; }

  protected drawPreview(dc: DrawContext) {
    dc.ctx.moveTo(dc.startCanvasPoint.x, dc.startCanvasPoint.y);
    dc.ctx.lineTo(dc.endCanvasPoint.x, dc.endCanvasPoint.y);
  }

  protected createModel(dc: DrawContext) {
    this.modelService.createModel("line", {
      points: [dc.startWorldPoint, dc.endWorldPoint],
      options: { ...this.configService.getCtxConfig() },
    });
  }
}

export default DrawLinePlugin;
