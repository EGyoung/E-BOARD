import { merge } from "../merge";

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
  merge(context, currentConfig);
  if (currentConfig.lineWidth !== undefined)
    context.lineWidth = Math.max(1, currentConfig.lineWidth * zoom);
}
