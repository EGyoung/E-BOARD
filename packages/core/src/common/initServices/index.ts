import {
  IModelService,
  IEventService,
  ISelectionService,
  ModelService,
  ModeService,
  EventService,
  SelectionService,
  RenderService,
  IModeService,
  TransformService,
  IConfigService,
  ConfigService,
  HistoryService,
  IHistoryService,
  CanvasService,
  ICanvasService,
  ElementService
} from "../../services";
import PluginService from "../../services/pluginService";
import { IPluginService } from "../../services/pluginService/type";
import { IRenderService } from "../../services/renderService/type";
import { IElementService } from "../../services/elementService/type";
import { ITransformService } from "../../services/transformService/type";
import { eBoardContainer } from "../IocContainer";
/**
 *  绑定列表需要注意相互之间的依赖关系！！！！！！
 */
const commonServicesMap = [
  {
    name: ICanvasService,
    service: CanvasService,
    attrName: "canvasService"
  },
  {
    name: IConfigService,
    service: ConfigService,
    attrName: "configService"
  },
  {
    name: IModelService,
    service: ModelService,
    attrName: "modelService"
  },
  {
    name: IHistoryService,
    service: HistoryService,
    attrName: "historyService"
  },
  {
    name: IPluginService,
    service: PluginService,
    attrName: "pluginService"
  },
  {
    name: IEventService,
    service: EventService,
    attrName: "eventService"
  },
  {
    name: ISelectionService,
    service: SelectionService,
    attrName: "selectionService"
  },

  {
    name: IRenderService,
    service: RenderService,
    attrName: "renderService"
  },
  {
    name: ITransformService,
    service: TransformService,
    attrName: "transformService"
  },
  {
    name: IElementService,
    service: ElementService,
    attrName: "elementService"
  },
  {
    name: IModeService,
    service: ModeService,
    attrName: "modeService"
  }
] as const;

type CommonServiceItem = (typeof commonServicesMap)[number];

export type CommonServiceAttrName = CommonServiceItem["attrName"];

type CommonServiceCtorMap = {
  [Item in CommonServiceItem as Item["attrName"]]: Item["service"];
};

type GetServiceConstructorTypeByAttrName<T extends CommonServiceAttrName> =
  CommonServiceCtorMap[T];

export type GetServiceTypeByAttrName<T extends CommonServiceAttrName> = InstanceType<
  GetServiceConstructorTypeByAttrName<T>
>;

// type ss = GetServiceTypeByAttrName<'canvasService' '>
export const bindCommonServices = () => {
  commonServicesMap.forEach(({ name, service }) => {
    eBoardContainer.bind(name).to(service).inSingletonScope();
  });
};

export { commonServicesMap };
