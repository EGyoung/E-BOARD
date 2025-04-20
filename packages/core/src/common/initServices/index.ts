import {
  IModelService,
  IPointerEventService,
  ISelectionService,
  ModelService,
  PointerEventService,
  SelectionService
} from "../../services";
import PluginService from "../../services/pluginService";
import { IPluginService } from "../../services/pluginService/type";
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
  }
] as const;
export const bindCommonServices = () => {
  commonServicesMap.forEach(({ name, service }) => {
    eBoardContainer.bind(name).to(service).inSingletonScope();
  });
};

export { commonServicesMap };
