import { commonServicesMap } from "../common/initServices";
import { IService, IPlugin, IBoard, IPluginInitParams, EBoardMode } from "../types";
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
  private ctx: CanvasRenderingContext2D | null = null;
  private container!: HTMLDivElement;
  private mode: typeof EBoardMode | string = EBoardMode.PEN;
  private dpr: number = window.devicePixelRatio || 1;
  private resizeObserver: ResizeObserver | null = null;

  private services: IService[] = [];
  private plugins: IPlugin[] = [];

  constructor(params: IBoardInitParams) {
    this.initParams(params);
    this.initCanvas();
    this.initEBoard();
    this.initResizeObserver();
  }

  private initResizeObserver() {
    if (!this.canvas) return;

    this.resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        // this.updateCanvasSize(width, height);
        this.resetView(width, height);
      }
    });

    this.resizeObserver.observe(this.container);
  }

  private resetView(width: number, height: number) {
    if (!this.canvas) return;
    const offscreenCanvas = document.createElement("canvas");
    const offscreenCanvasCtx = offscreenCanvas.getContext("2d");
    offscreenCanvas.width = this.canvas.width;
    offscreenCanvas.height = this.canvas.height;
    offscreenCanvasCtx?.drawImage(this.canvas, 0, 0);

    this.updateCanvasSize(width, height);

    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(
      offscreenCanvas,
      0,
      0,
      this.canvas.width,
      this.canvas.height,
      0,
      0,
      this.canvas.width / this.dpr,
      this.canvas.height / this.dpr
    );
  }

  private updateCanvasSize(width: number, height: number) {
    if (!this.canvas) return;

    // 设置画布的实际像素大小
    this.canvas.width = width * this.dpr;
    this.canvas.height = height * this.dpr;

    // 设置画布的显示大
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    const ctx = this.canvas.getContext("2d", {
      willReadFrequently: true, // 频繁读取
      alpha: false // 不透明
    });

    if (ctx) {
      this.ctx = ctx;
      this.ctx.scale(this.dpr, this.dpr);
    }
  }

  public getCtx() {
    return this.ctx;
  }

  public setBoardMode(mode: typeof EBoardMode | string) {
    this.mode = mode;
  }

  public getBoardMode() {
    return this.mode;
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
  }

  private initCanvas() {
    const canvasElement = document?.querySelector(`#${this.id}`);
    this.canvas = canvasElement ? (canvasElement as HTMLCanvasElement) : this.createCanvas();
    this.updateCanvasSize(this.container.clientWidth || 800, this.container.clientHeight || 600);
  }

  public initEBoard() {
    bindServices();
    this.initServices();

    // todo 不要再core 里注册具体插件 待抽离
    this.registerPlugin(DrawPlugin);
    this.plugins.forEach(plugin => plugin.init({ board: this }));
  }

  public registerPlugin(plugin: new ({ board }: IPluginInitParams) => IPlugin) {
    this.plugins.push(new plugin({ board: this }));
  }

  private initServices() {
    commonServicesMap.forEach(({ name }) => {
      this.services.push(eBoardContainer.get(name));
    });
    this.services.forEach(service => service.init({ board: this }));
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
      // 重置一下背景色
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

  dispose() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.services.forEach(service => service.dispose?.());
    this.plugins.forEach(plugin => plugin.dispose());
    this.services = [];
    this.plugins = [];
    // this.container = null;
    this.canvas = null;
    resetContainer();
  }
}

export default EBoard;
