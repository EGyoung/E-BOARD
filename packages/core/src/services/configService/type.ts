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

export interface CtxConfig {
  // 这里可以添加配置服务的方法和属性
  lineCap?: CanvasLineCap;
  lineJoin?: CanvasLineJoin;
  strokeStyle?: string;
  lineWidth?: number;
  globalCompositeOperation?: GlobalCompositeOperation;
  globalAlpha?: number;
  imageSmoothingEnabled?: boolean;
  imageSmoothingQuality?: ImageSmoothingQuality;
}
export type IConfigService = {
  ctxConfig?: CtxConfig;
};

export const IConfigService = Symbol("IConfigService");
