import { IModel } from "../../services/modelService/type";

type Range = { x: number; y: number; width: number; height: number };

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
