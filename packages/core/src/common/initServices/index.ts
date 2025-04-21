import {
  IModelService,
  IPointerEventService,
  ISelectionService,
  ModelService,
  ModeService,
  PointerEventService,
  SelectionService,
  RenderService,
  IModeService
} from "../../services";
import PluginService from "../../services/pluginService";
import { IPluginService } from "../../services/pluginService/type";
import { IRenderService } from "../../services/renderService/type";
import { eBoardContainer } from "../IocContainer";

const commonServicesMap = [
  {
    name: IModelService,
    service: ModelService
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
