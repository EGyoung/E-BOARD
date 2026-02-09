/**
 * 初始化 Canvas 上下文的绘制属性
 * @param context Canvas 2D 上下文
 * @param transformService 变换服务，用于获取缩放比例
 */
export function initContextAttrs(
  context: CanvasRenderingContext2D,
  options?: { zoom: number },
  config?: Partial<CanvasRenderingContext2D>
) {
  const zoom = options?.zoom || 1;
  const currentConfig = config || {};

  const lineCap = currentConfig.lineCap ?? "round";
  if (context.lineCap !== lineCap) context.lineCap = lineCap;

  const lineJoin = currentConfig.lineJoin ?? "round";
  if (context.lineJoin !== lineJoin) context.lineJoin = lineJoin;

  const strokeStyle = currentConfig.strokeStyle ?? "white";
  if (context.strokeStyle !== strokeStyle) context.strokeStyle = strokeStyle;

  const globalCompositeOperation =
    currentConfig.globalCompositeOperation ?? "source-over";
  if (context.globalCompositeOperation !== globalCompositeOperation) {
    context.globalCompositeOperation = globalCompositeOperation;
  }

  const globalAlpha = currentConfig.globalAlpha ?? 1.0;
  if (context.globalAlpha !== globalAlpha) context.globalAlpha = globalAlpha;

  const imageSmoothingEnabled = currentConfig.imageSmoothingEnabled ?? true;
  if (context.imageSmoothingEnabled !== imageSmoothingEnabled) {
    context.imageSmoothingEnabled = imageSmoothingEnabled;
  }

  const imageSmoothingQuality = currentConfig.imageSmoothingQuality ?? "high";
  if (context.imageSmoothingQuality !== imageSmoothingQuality) {
    context.imageSmoothingQuality = imageSmoothingQuality;
  }

  if (currentConfig.lineWidth !== undefined) {
    const lineWidth = currentConfig.lineWidth * zoom;
    if (context.lineWidth !== lineWidth) context.lineWidth = lineWidth;
  }
}



