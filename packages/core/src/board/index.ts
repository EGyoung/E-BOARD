import { commonServicesMap } from "../common/initServices";
import { IService, IBoard, IBoardInitParams } from "../types";
import { bindServices } from "./bindServices";
import { eBoardContainer, resetContainer } from "../common/IocContainer";
import { IPluginService } from "../services/pluginService/type";
const INTERACTION_CANVAS_ID = "interaction-canvas";
export class EBoard implements IBoard {
  private id!: string;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  // 交互层画布
  private interactionCanvas: HTMLCanvasElement | null = null;
  private interactionCtx: CanvasRenderingContext2D | null = null;
  private container!: HTMLDivElement;
  private dpr: number = window.devicePixelRatio || 1;
  private resizeObserver: ResizeObserver | null = null;
  private services: IService[] = [];
  private servicesMap: Map<Symbol, IService> = new Map();
  public config: Partial<IBoardInitParams> = {};

  constructor(params: IBoardInitParams) {
    this.initParams(params);
    this.initCanvas();
    this.initInteractionCanvas();
    this.prepareServices();
  }

  public prepareServices() {
    bindServices();
    this.initServices();
  }

  private updateCanvasSize(canvas: HTMLCanvasElement, width: number, height: number) {
    if (!canvas) return;

    // 设置画布的实际像素大小
    canvas.width = width * this.dpr;
    canvas.width = width * this.dpr;
    canvas.height = height * this.dpr;

    // 设置画布的显示大小
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }
  public getCtx() {
    return this.ctx;
  }

  public getInteractionCtx() {
    return this.interactionCtx;
  }

  public getInteractionCanvas() {
    return this.interactionCanvas;
  }

  private initParams(params: IBoardInitParams) {
    if (!params.container) {
      throw new Error("container is required");
    }
    if (!params.id) {
      throw new Error("id is required");
    }
    this.id = params.id;
    this.container = params.container;
    this.config = params;
  }

  private initCanvas() {
    const canvasElement = document?.querySelector(`#${this.id}`);
    this.canvas = canvasElement ? (canvasElement as HTMLCanvasElement) : this.createCanvas();
    this.updateCanvasSize(
      this.canvas,
      this.container.clientWidth || 800,
      this.container.clientHeight || 600
    );
    const ctx = this.canvas.getContext("2d", {
      alpha: true
    });
    if (ctx) {
      this.ctx = ctx;
      this.ctx.scale(this.dpr, this.dpr);
    }
  }

  private initInteractionCanvas() {
    if (this.interactionCanvas) return;
    const existingCanvas = document.querySelector(
      `#${INTERACTION_CANVAS_ID}`
    ) as HTMLCanvasElement | null;

    this.interactionCanvas = existingCanvas || document.createElement("canvas");
    this.interactionCanvas.id = `${INTERACTION_CANVAS_ID}`;
    this.interactionCanvas.style.position = "absolute";
    this.interactionCanvas.style.top = "0";
    this.interactionCanvas.style.left = "0";
    this.interactionCanvas.style.zIndex = "2"; // 确保在主画布之上

    this.updateCanvasSize(
      this.interactionCanvas,
      this.container.clientWidth || 800,
      this.container.clientHeight || 600
    );

    // 背景透明
    this.interactionCanvas.style.opacity = "1";

    // 画布透明

    this.container.appendChild(this.interactionCanvas);

    const ctx = this.interactionCanvas.getContext("2d", {
      alpha: true
    });
    if (ctx) {
      this.interactionCtx = ctx;
      this.interactionCtx.scale(this.dpr, this.dpr);
    }
  }

  private initServices() {
    commonServicesMap.forEach(({ name }) => {
      this.services.push(eBoardContainer.get(name));
      this.servicesMap.set(name, eBoardContainer.get(name));
    });
    this.services.forEach(service => service.init?.({ board: this }));
  }

  public getService(name: Symbol) {
    return this.servicesMap.get(name);
  }

  private createCanvas() {
    const canvas = document.createElement("canvas");
    canvas.id = this.id;

    // 基础样式设置
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.zIndex = "1";
    canvas.style.backgroundColor = "black";
    canvas.style.userSelect = "none";
    canvas.style.touchAction = "none";
    canvas.style.display = "block";

    // 确保容器有正确的样式
    if (this.container) {
      this.container.style.position = "relative";
      this.container.style.width = "100%";
      this.container.style.height = "100%";
      this.container.style.minHeight = "400px";
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

  public getServices() {
    return this.services;
  }

  public getPlugin(name: string) {
    const pluginService = eBoardContainer.get<IPluginService>(IPluginService);
    return pluginService.getPlugin(name);
  }

  public dispose() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.services.forEach(service => service.dispose?.());
    this.services = [];
    this.canvas = null;
    this.ctx = null;
    this.interactionCanvas = null;
    this.interactionCtx = null;
    resetContainer();
  }
}

export default EBoard;
