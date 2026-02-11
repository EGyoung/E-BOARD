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
  ElementService,
  ISaveInfoService,
  SaveInfoService,
  IPluginService,
  IRenderService,
  PluginService,
  IElementService,
  ITransformService
} from "../../services";
import { eBoardContainer } from "../IocContainer";
/**
 *  绑定列表需要注意相互之间的依赖关系！！！！！！
 */
const commonServicesMap = [
  // ==============================核心独立服务end========================
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
    name: IEventService,
    service: EventService,
    attrName: "eventService"
  },
  {
    name: IModelService,
    service: ModelService,
    attrName: "modelService"
  },
  {
    name: IPluginService,
    service: PluginService,
    attrName: "pluginService"
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
  },
  {
    name: ITransformService,
    service: TransformService,
    attrName: "transformService"
  },
  // ==============================核心独立服务end========================

  // ==============================普通服务start========================
  {
    name: ISaveInfoService,
    service: SaveInfoService,
    attrName: "saveInfoService"
  },
  {
    name: IHistoryService,
    service: HistoryService,
    attrName: "historyService"
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
  // ==============================普通服务end========================
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


export const bindCommonServices = () => {
  commonServicesMap.forEach(({ name, service }) => {
    eBoardContainer.bind(name).to(service).inSingletonScope();
  });
};

export { commonServicesMap };
