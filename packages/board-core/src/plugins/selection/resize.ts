import { IModelService } from "../../services/modelService/type";
import { ITransformService } from "../../services/transformService/type";
import { MIN_ELEMENT_SIZE } from "./handles";

type Box = { x: number; y: number; width: number; height: number };

export function applyResizeToModels(
  newAABB: Box,
  resizeStartAABB: Box,
  selectModels: Set<string>,
  initialModelPositions: Map<string, { x: number; y: number }[]>,
  initialModelSizes: Map<string, { width?: number; height?: number }>,
  modelService: IModelService,
  transformService: ITransformService,
) {
  const orig = resizeStartAABB;
  const scaleX = orig.width !== 0 ? newAABB.width / orig.width : 1;
  const scaleY = orig.height !== 0 ? newAABB.height / orig.height : 1;

  selectModels.forEach(id => {
    const initialPoints = initialModelPositions.get(id);
    if (!initialPoints) return;

    const model = modelService.getModelById(id);
    if (!model) return;

    const initialSize = initialModelSizes.get(id);
    const hasSize = initialSize && initialSize.width !== undefined && initialSize.height !== undefined;

    if (hasSize) {
      const anchor = initialPoints[0];
      const screenAnchor = transformService.transformPoint(anchor);
      const newScreenX = newAABB.x + (screenAnchor.x - orig.x) * scaleX;
      const newScreenY = newAABB.y + (screenAnchor.y - orig.y) * scaleY;
      const newWorldAnchor = transformService.transformPoint({ x: newScreenX, y: newScreenY }, true);

      const newWidth = Math.max(MIN_ELEMENT_SIZE, initialSize.width! * scaleX);
      const newHeight = Math.max(MIN_ELEMENT_SIZE, initialSize.height! * scaleY);

      modelService.updateModel(id, {
        points: [newWorldAnchor],
        width: newWidth,
        height: newHeight,
      } as any);
    } else {
      const newPoints = initialPoints.map(p => {
        const sp = transformService.transformPoint(p);
        const newSx = newAABB.x + (sp.x - orig.x) * scaleX;
        const newSy = newAABB.y + (sp.y - orig.y) * scaleY;
        return transformService.transformPoint({ x: newSx, y: newSy }, true);
      });
      modelService.updateModel(id, { points: newPoints });
    }
  });
}
