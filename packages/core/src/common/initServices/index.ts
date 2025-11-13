import {
  IModelService,
  IPointerEventService,
  ISelectionService,
  ModelService,
  ModeService,
  PointerEventService,
  SelectionService,
  RenderService,
  IModeService,
  TransformService,
  ShapeService,
  IConfigService,
  ConfigService,
  HistoryService,
  IHistoryService,
  CanvasService,
  ICanvasService
} from "../../services";
import PluginService from "../../services/pluginService";
import { IPluginService } from "../../services/pluginService/type";
import { IRenderService } from "../../services/renderService/type";
import { IShapeService } from "../../services/shapeService/type";
import { ITransformService } from "../../services/transformService/type";
import { eBoardContainer } from "../IocContainer";
/**
 *  绑定列表需要注意相互之间的依赖关系！！！！！！
 */
const commonServicesMap = [
  {
    name: ICanvasService,
    service: CanvasService
  },
  {
    name: IConfigService,
    service: ConfigService
  },
  {
    name: IModelService,
    service: ModelService
  },
  {
    name: IHistoryService,
    service: HistoryService
  },
  {
    name: IPluginService,
    service: PluginService
  },
  {
    name: IPointerEventService,
    service: PointerEventService
  },
  {
    name: ISelectionService,
    service: SelectionService
  },

  {
    name: IRenderService,
    service: RenderService
  },
  {
    name: ITransformService,
    service: TransformService
  },
  {
    name: IShapeService,
    service: ShapeService
  },
  {
    name: IModeService,
    service: ModeService
  }
] as const;
export const bindCommonServices = () => {
  commonServicesMap.forEach(({ name, service }) => {
    eBoardContainer.bind(name).to(service).inSingletonScope();
  });
};

export { commonServicesMap };
