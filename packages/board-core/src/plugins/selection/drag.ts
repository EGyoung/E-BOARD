import { IModelService } from "../../services/modelService/type";
import { ITransformService } from "../../services/transformService/type";

export function applyDragToModels(
  deltaScreenX: number,
  deltaScreenY: number,
  selectModels: Set<string>,
  initialModelPositions: Map<string, { x: number; y: number }[]>,
  modelService: IModelService,
  transformService: ITransformService,
  event?: PointerEvent,
) {
  const zoom = transformService.getView().zoom || 1;
  const x = deltaScreenX / zoom;
  const y = deltaScreenY / zoom;

  selectModels.forEach(id => {
    const initialPoints = initialModelPositions.get(id);
    if (!initialPoints) return;

    const tempModel = modelService.getModelById(id);
    if (!tempModel) return;

    modelService.updateModel(id, {
      points: initialPoints.map(p => ({ x: p.x + x, y: p.y + y }))
    });
    if (event) {
      tempModel.ctrlElement?.onElementMove?.(event);
    }
  });
}
