/**
 * 初始化 Canvas 上下文的绘制属性
 * @param context Canvas 2D 上下文
 * @param transformService 变换服务，用于获取缩放比例
 */
export function initContextAttrs(context: CanvasRenderingContext2D, options?: { zoom: number }) {
  const zoom = options?.zoom || 1;

  // 设置绘制样式
  context.lineCap = "round"; // 设置线条端点样式
  context.lineJoin = "round"; // 设置线条连接处样式
  context.strokeStyle = "white"; // 设置线条颜色
  // 根据缩放比例调整线条宽度，保持视觉一致性
  context.lineWidth = 4 * zoom;
  context.globalCompositeOperation = "source-over";
  context.globalAlpha = 1.0;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
}
