import { IModelService } from "../../services/modelService/type";
import { HandleManager } from "./handles";
import { drawMarquee } from "./marquee";

type Box = { x: number; y: number; width: number; height: number };
type Range = { x: number; y: number; width: number; height: number };

export function normalizeBoundingBox(box: any) {
  if (box.minX !== undefined && box.maxX !== undefined) {
    return box;
  }
  return {
    ...box,
    minX: box.x,
    minY: box.y,
    maxX: box.x + box.width,
    maxY: box.y + box.height,
  };
}

export function computeAABB(
  selectModels: Set<string>,
  modelService: IModelService,
  boxes?: any[],
): Box | null {
  const normalizedBoxes = (boxes ?? Array.from(selectModels)
    .map(id => {
      const model = modelService.getModelById(id);
      if (!model) return null;
      return model.ctrlElement?.getBoundingBox();
    })
    .filter(Boolean))
    .map(box => normalizeBoundingBox(box));

  if (normalizedBoxes.length === 0) return null;

  const minX = Math.min(...normalizedBoxes.map(box => box!.minX));
  const minY = Math.min(...normalizedBoxes.map(box => box!.minY));
  const maxX = Math.max(...normalizedBoxes.map(box => box!.maxX));
  const maxY = Math.max(...normalizedBoxes.map(box => box!.maxY));

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * 将坐标取整以保证在交互层（屏幕空间）上绘制出清晰的像素对齐线条。
 * lineWidth 为偶数时取整到整数像素，避免抗锯齿导致的模糊/锯齿感。
 */
function snapToPixel(value: number): number {
  return Math.round(value);
}

export function renderSelectionOverlay(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  selectModels: Set<string>,
  modelService: IModelService,
  handleManager: HandleManager,
  container: HTMLElement,
  currentSelectRange: Range | null,
): Box | null {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (currentSelectRange) {
    drawMarquee(ctx, currentSelectRange);
  }

  if (selectModels.size === 0) {
    handleManager.removeHandles();
    return null;
  }

  const boxes: any[] = [];
  selectModels.forEach(id => {
    const model = modelService.getModelById(id);
    const bounding = model?.ctrlElement?.getBoundingBox?.();
    if (!bounding) return;

    boxes.push(bounding);
    ctx.save();
    ctx.strokeStyle = "rgba(0, 113, 227, 0.62)";
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 2;
    ctx.strokeRect(
      snapToPixel(bounding.x),
      snapToPixel(bounding.y),
      snapToPixel(bounding.width),
      snapToPixel(bounding.height),
    );
    ctx.restore();
  });

  const aabb = computeAABB(selectModels, modelService, boxes);

  if (aabb) {
    ctx.save();
    ctx.strokeStyle = "rgba(0, 113, 227, 0.88)";
    ctx.setLineDash([10, 5]);
    ctx.lineWidth = 2;
    ctx.strokeRect(
      snapToPixel(aabb.x),
      snapToPixel(aabb.y),
      snapToPixel(aabb.width),
      snapToPixel(aabb.height),
    );
    ctx.restore();

    handleManager.drawHandles(container, aabb);
  }

  return aabb;
}
