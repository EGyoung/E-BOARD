import { commonServicesMap } from "../common/initServices";
import { IService, IBoard, IBoardInitParams } from "../types";
import { bindServices } from "./bindServices";
import { eBoardContainer, resetContainer } from "../common/IocContainer";
import { IPluginService } from "../services/pluginService/type";
import { ICanvasService } from "../services/canvasService/type";
import { IPlugin } from "../plugins/type";

export class EBoard implements IBoard {
  public id: string;
  private container: HTMLDivElement;
  private services: IService[] = [];
  private servicesMap: Map<Symbol, IService> = new Map();
  public config: Partial<IBoardInitParams> = {};

  constructor(params: IBoardInitParams) {
    this.validateParams(params);
    this.id = params.id;
    this.container = params.container;
    this.config = params;

    this.prepareContainer();
    this.prepareServices();
  }

  private validateParams(params: IBoardInitParams): void {
    if (!params.container) {
      throw new Error("container is required");
    }
    if (!params.id) {
      throw new Error("id is required");
    }
  }

  private prepareContainer(): void {
    Object.assign(this.container.style, {
      position: "relative",
      width: "100%",
      height: "100%",
      minHeight: "400px"
    });
  }

  public prepareServices(): void {
    bindServices();
    this.initServices();
  }

  private initServices(): void {
    commonServicesMap.forEach(({ name }) => {
      const service = eBoardContainer.get<IService>(name);
      this.services.push(service);
      this.servicesMap.set(name, service);
    });
    this.services.forEach(service => service.init?.({ board: this }));
  }


  public getCanvas(): HTMLCanvasElement | null {
    const canvasService = this.getService(ICanvasService) as ICanvasService;
    return canvasService?.getCanvas() || null;
  }

  public getCtx(): CanvasRenderingContext2D | null {
    const canvasService = this.getService(ICanvasService) as ICanvasService;
    return canvasService?.getCtx() || null;
  }

  public getInteractionCanvas(): HTMLCanvasElement | null {
    const canvasService = this.getService(ICanvasService) as ICanvasService;
    return canvasService?.getInteractionCanvas() || null;
  }

  public getInteractionCtx(): CanvasRenderingContext2D | null {
    const canvasService = this.getService(ICanvasService) as ICanvasService;
    return canvasService?.getInteractionCtx() || null;
  }

  public getService<T extends IService = IService>(name: Symbol): T {
    return this.servicesMap.get(name) as T;
  }

  public getServices(): IService[] {
    return this.services;
  }

  public getContainer(): HTMLDivElement {
    return this.container;
  }

  public getPlugin<T extends IPlugin = IPlugin>(name: string): T {
    const pluginService = eBoardContainer.get<IPluginService>(IPluginService);
    return pluginService.getPlugin(name) as T;
  }

  public dispose(): void {
    this.services.forEach(service => service.dispose?.());
    this.services = [];
    this.servicesMap.clear();
    resetContainer();
  }
}

export default EBoard;
