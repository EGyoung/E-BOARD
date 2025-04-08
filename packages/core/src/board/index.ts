import { commonServicesMap } from "../common/initServices";
import {
  IService,
  IPlugin,
  IBoard,
  IPluginInitParams,
  EBoardMode,
  CorePlugins,
  IBoardInitParams
} from "../types";
import { bindServices } from "./bindServices";
import { eBoardContainer, resetContainer } from "../common/IocContainer";
import { getDefaultPlugins } from "../common/getDefaultPlugins";

export class EBoard implements IBoard {
  private id!: string;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private container!: HTMLDivElement;
  private mode: typeof EBoardMode | string = EBoardMode.PEN;
  private dpr: number = window.devicePixelRatio || 1;
  private resizeObserver: ResizeObserver | null = null;
  private services: IService[] = [];
  private plugins: Map<string, IPlugin> = new Map();
  private disableDefaultPlugins: boolean = false;

  constructor(params: IBoardInitParams) {
    this.initParams(params);
    this.initCanvas();
    this.prepareServices();
    this.registerPlugins(params.plugins);
  }

  public prepareServices() {
    bindServices();
    this.initServices();
  }

  public isCorePlugin(name: string): boolean {
    return Object.values(CorePlugins).includes(name as any);
  }

  public registerPlugin(PluginClass: new ({ board }: IPluginInitParams) => IPlugin) {
    try {
      const plugin = new PluginClass({ board: this });
      if (!plugin.pluginName) {
        throw new Error("Plugin must have a pluginName");
      }

      // 检查插件名称是否已存在
      if (this.plugins.has(plugin.pluginName)) {
        throw new Error(`Plugin with name ${plugin.pluginName} already exists`);
      }

      this.plugins.set(plugin.pluginName, plugin);

      // 如果画板已经初始化，立即初始化插件
      if (this.canvas) {
        plugin.init({ board: this });
      }
    } catch (error) {
      console.error("Failed to register plugin:", error);
    }
  }

  public removePlugin(name: string) {
    // 防止移除核心插件
    if (this.isCorePlugin(name) && !this.disableDefaultPlugins) {
      console.warn(`Cannot remove core plugin: ${name}`);
      return;
    }

    const plugin = this.plugins.get(name);
    if (plugin) {
      plugin.dispose();
      this.plugins.delete(name);
    }
  }

  public getPlugin(name: string): IPlugin | undefined {
    return this.plugins.get(name);
  }

  private updateCanvasSize(width: number, height: number) {
    if (!this.canvas) return;

    // 设置画布的实际像素大小
    this.canvas.width = width * this.dpr;
    this.canvas.height = height * this.dpr;

    // 设置画布的显示大小
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    const ctx = this.canvas.getContext("2d", {
      willReadFrequently: true,
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
    this.disableDefaultPlugins = params.disableDefaultPlugins || false;
    this.id = params.id;
    this.container = params.container;
  }

  private registerPlugins(plugins?: Array<new ({ board }: IPluginInitParams) => IPlugin>) {
    const DEFAULT_PLUGINS = getDefaultPlugins();
    // // 注册初始插件
    const allPlugins = [
      ...(this.disableDefaultPlugins ? [] : Object.values(DEFAULT_PLUGINS)),
      ...(plugins || [])
    ];
    allPlugins.forEach(plugin => this.registerPlugin(plugin));
  }

  private initCanvas() {
    const canvasElement = document?.querySelector(`#${this.id}`);
    this.canvas = canvasElement ? (canvasElement as HTMLCanvasElement) : this.createCanvas();
    this.updateCanvasSize(this.container.clientWidth || 800, this.container.clientHeight || 600);
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

  public dispose() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.services.forEach(service => service.dispose?.());
    this.plugins.forEach(plugin => plugin.dispose());
    this.services = [];
    this.plugins.clear();
    this.canvas = null;
    this.ctx = null;
    resetContainer();
  }
}

export default EBoard;
