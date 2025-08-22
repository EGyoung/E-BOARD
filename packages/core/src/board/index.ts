import { commonServicesMap } from "../common/initServices";
import { IService, IBoard, IBoardInitParams } from "../types";
import { bindServices } from "./bindServices";
import { eBoardContainer, resetContainer } from "../common/IocContainer";
import { IPlugin } from "../plugins/type";
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
  private plugins: Map<string, IPlugin> = new Map();
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

  private updateCanvasSize(width: number, height: number) {
    if (!this.canvas) return;
    this.canvas.style.zIndex = "1"; // 确保在交互层之下

    // 设置画布的实际像素大小
    this.canvas.width = width * this.dpr;
    this.canvas.height = height * this.dpr;

    // 设置画布的显示大小
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    const ctx = this.canvas.getContext("2d", {
      alpha: false
    });

    if (ctx) {
      this.ctx = ctx;
      this.ctx.scale(this.dpr, this.dpr);
    }
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
    this.updateCanvasSize(this.container.clientWidth || 800, this.container.clientHeight || 600);
  }

  private initInteractionCanvas() {
    if (this.interactionCanvas) return;
    const existingCanvas = document.querySelector(`#${INTERACTION_CANVAS_ID}`);
    if (existingCanvas) {
      this.interactionCanvas = existingCanvas as HTMLCanvasElement;
      this.interactionCtx = this.interactionCanvas.getContext("2d", {
        alpha: false
      });
      if (this.interactionCtx) {
        this.interactionCtx.scale(this.dpr, this.dpr);
      }
      return;
    }

    this.interactionCanvas = document.createElement("canvas");
    this.interactionCanvas.id = `${INTERACTION_CANVAS_ID}`;
    this.interactionCanvas.style.position = "absolute";
    this.interactionCanvas.style.top = "0";
    this.interactionCanvas.style.left = "0";
    this.interactionCanvas.style.width = "100%";
    this.interactionCanvas.style.height = "100%";
    this.interactionCanvas.style.zIndex = "2"; // 确保在主画布之上

    // 背景透明
    this.interactionCanvas.style.opacity = "0";

    // 画布透明

    this.container.appendChild(this.interactionCanvas);

    const ctx = this.interactionCanvas.getContext("2d", {
      alpha: false
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
    this.services.forEach(service => service.init({ board: this }));
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
      // 重置背景色
      if (this.ctx) {
        this.ctx.fillStyle = "black";
        this.ctx.fillRect(
          0,
          0,
          this.container.clientWidth || 800,
          this.container.clientHeight || 600
        );
      }
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

  public dispose() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.services.forEach(service => service.dispose?.());
    this.plugins.forEach(plugin => plugin.dispose());
    this.services = [];
    this.plugins.clear();
    this.canvas = null;
    this.ctx = null;
    this.interactionCanvas = null;
    this.interactionCtx = null;
    resetContainer();
  }
}

export default EBoard;
