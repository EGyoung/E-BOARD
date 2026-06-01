import { BaseShapeDrawPlugin, DrawContext } from "../BaseShapeDrawPlugin";

class DrawShapePlugin extends BaseShapeDrawPlugin {
  public pluginName = "DrawShapePlugin";

  protected get modeName() { return "drawShape"; }

  protected drawPreview(dc: DrawContext) {
    const { ctx, startCanvasPoint: s, endCanvasPoint: e } = dc;
    const x = Math.min(s.x, e.x);
    const y = Math.min(s.y, e.y);
    const w = Math.abs(e.x - s.x);
    const h = Math.abs(e.y - s.y);
    ctx.rect(x, y, w, h);
  }

  protected createModel(dc: DrawContext) {
    const { startWorldPoint: s, endWorldPoint: e } = dc;
    const x = Math.min(s.x, e.x);
    const y = Math.min(s.y, e.y);
    const width = Math.abs(e.x - s.x);
    const height = Math.abs(e.y - s.y);
    this.modelService.createModel("rectangle", {
      points: [{ x, y }],
      width,
      height,
      options: { ...this.configService.getCtxConfig() },
    });
  }
}

export default DrawShapePlugin;
