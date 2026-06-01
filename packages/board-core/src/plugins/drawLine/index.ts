import { BaseDrawLinePlugin } from "./BaseDrawLinePlugin";

class DrawLinePlugin extends BaseDrawLinePlugin {
  public pluginName = "DrawLinePlugin";

  protected get modeName() { return "drawLine"; }
  protected get modelType() { return "line"; }
}

export default DrawLinePlugin;
