import {
  IModelService,
  IPointerEventService,
  ISelectionService,
  ModelService,
  PointerEventService,
  SelectionService
} from "../../services";
import { eBoardContainer } from "../IocContainer";

const commonServicesMap = [
  {
    name: IModelService,
    service: ModelService
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
