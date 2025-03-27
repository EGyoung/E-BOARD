import { commonServicesMap } from "../common/initServices";
import { IService, IPlugin, IBoard, IPluginInitParams } from "../types";
import { bindServices } from "./bindServices";
import { eBoardContainer, resetContainer } from "../common/IocContainer";
import DrawPlugin from "../plugins/draw";

interface IBoardInitParams {
  container: HTMLDivElement;
  id: string;
}

export class EBoard implements IBoard {
  private id!: string;
  private canvas: HTMLCanvasElement | null = null;
  private container: HTMLDivElement | null = null;
  constructor(params: IBoardInitParams) {
    this.initParams(params);
    this.initCanvas();
    this.initEBoard();
  }

  private initParams(params: IBoardInitParams) {
    this.id = params.id;
    this.container = params.container;
  }

  private initCanvas() {
    const canvasElement = document?.querySelector(`#${this.id}`);
    this.canvas = !!canvasElement
      ? (canvasElement as HTMLCanvasElement)
      : this.createCanvas();
  }

  private services: IService[] = [];
  private plugins: IPlugin[] = [];

  public initEBoard() {
    bindServices();
    this.initServices();

    // todo 不要再core 里注册具体插件 待抽离
    this.registerPlugin(DrawPlugin);
    this.plugins.forEach((plugin) => plugin.init({ board: this }));
    console.log("EBoard initialized");
  }

  public registerPlugin(plugin: new ({ board }: IPluginInitParams) => IPlugin) {
    this.plugins.push(new plugin({ board: this }));
  }

  private initServices() {
    commonServicesMap.forEach(({ name }) => {
      this.services.push(eBoardContainer.get(name));
    });
    this.services.forEach((service) => service.init({ board: this }));
  }

  private createCanvas() {
    const canvas = document.createElement("canvas");
    canvas.id = this.id;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    // canvas.style.position = 'absolute';
    canvas.style.top = "500px";
    canvas.style.left = "500px";
    canvas.style.zIndex = "1";
    canvas.style.backgroundColor = "transparent";
    // canvas.style.pointerEvents = 'none';
    canvas.style.userSelect = "none";
    canvas.style.touchAction = "none";
    canvas.style.imageRendering = "pixelated";
    canvas.style.imageRendering = "-webkit-optimize-contrast";
    canvas.style.imageRendering = "-moz-crisp-edges";
    canvas.style.imageRendering = "-o-crisp-edges";
    canvas.style.imageRendering = "-webkit-optimize-contrast";

    // canvas 里随便画点东西
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "red";
      ctx.fillRect(0, 0, 100, 100);
    }
    this.container?.appendChild(canvas);
    return canvas;
  }

  public getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }

  public getContainer(): HTMLDivElement | null {
    return this.container;
  }

  dispose() {
    this.services.forEach((service) => service.dispose?.());
    this.plugins.forEach((plugin) => plugin.dispose());
    this.services = [];
    this.plugins = [];
    this.container = null;
    this.canvas = null;
    resetContainer();
  }
}

export default EBoard;
