import { BaseShapeDrawPlugin, DrawContext } from "../BaseShapeDrawPlugin";

class DrawCirclePlugin extends BaseShapeDrawPlugin {
  public pluginName = "DrawCirclePlugin";

  protected get modeName() { return "drawCircle"; }

  protected drawPreview(dc: DrawContext) {
    const { ctx, startCanvasPoint: s, endCanvasPoint: e } = dc;
    const x = Math.min(s.x, e.x);
    const y = Math.min(s.y, e.y);
    const w = Math.abs(e.x - s.x);
    const h = Math.abs(e.y - s.y);
    const rx = w / 2;
    const ry = h / 2;
    if (rx > 0 && ry > 0) {
      ctx.ellipse(x + rx, y + ry, rx, ry, 0, 0, Math.PI * 2);
    }
  }

  protected createModel(dc: DrawContext) {
    const { startWorldPoint: s, endWorldPoint: e } = dc;
    const x = Math.min(s.x, e.x);
    const y = Math.min(s.y, e.y);
    const width = Math.abs(e.x - s.x);
    const height = Math.abs(e.y - s.y);
    this.modelService.createModel("circle", {
      points: [{ x, y }],
      width,
      height,
      options: { ...this.configService.getCtxConfig() },
    });
  }
}

export default DrawCirclePlugin;
