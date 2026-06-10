import { IModelService } from "../../services/modelService/type";

type Box = { x: number; y: number; width: number; height: number };

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
