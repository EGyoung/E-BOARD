import { IModel } from "../../services/modelService/type";

type Range = { x: number; y: number; width: number; height: number };

export function drawMarquee(ctx: CanvasRenderingContext2D, range: Range) {
  ctx.save();
  ctx.strokeStyle = "rgba(14, 87, 75, 1)";
  ctx.setLineDash([5, 5]);
  ctx.lineWidth = 2;
  ctx.strokeRect(range.x, range.y, range.width, range.height);
  ctx.restore();
}

export function computeSelectedByMarquee(range: Range, models: IModel[]): string[] {
  const selectRect = {
    x: Math.min(range.x, range.x + range.width),
    y: Math.min(range.y, range.y + range.height),
    width: Math.abs(range.width),
    height: Math.abs(range.height),
  };

  const selected: string[] = [];
  for (const model of models) {
    const bounding = model.ctrlElement?.getBoundingBox();
    if (!bounding) continue;

    const isIntersecting =
      bounding.minX < selectRect.x + selectRect.width &&
      bounding.maxX > selectRect.x &&
      bounding.minY < selectRect.y + selectRect.height &&
      bounding.maxY > selectRect.y;

    if (isIntersecting) {
      selected.push(model.id);
    }
  }
  return selected;
}
