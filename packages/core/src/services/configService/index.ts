import { merge } from "@e-board/utils";

/**
 *   context.lineCap = "round"; // 设置线条端点样式
  context.lineJoin = "round"; // 设置线条连接处样式
  context.strokeStyle = "white"; // 设置线条颜色
  // 根据缩放比例调整线条宽度，保持视觉一致性，但设置最小宽度避免线条过细
  context.lineWidth = Math.max(1, 4 * zoom);
  context.globalCompositeOperation = "source-over";
  context.globalAlpha = 1.0;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
 */
const defaultCtxConfig = {
  lineCap: "round" as CanvasLineCap,
  lineJoin: "round" as CanvasLineJoin,
  strokeStyle: "white",
  lineWidth: 4,
  globalCompositeOperation: "source-over" as GlobalCompositeOperation,
  globalAlpha: 1.0,
  imageSmoothingEnabled: true
};

class ConfigService {
  private ctxConfig = defaultCtxConfig;
  getCtxConfig() {
    return defaultCtxConfig;
  }

  setCtxConfig(config: Partial<typeof defaultCtxConfig>) {
    merge(this.ctxConfig, config);
    return this;
  }
}

export default ConfigService;
