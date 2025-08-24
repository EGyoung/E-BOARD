import { eBoardContainer } from "../../common/IocContainer";
import { IBoard, IServiceInitParams } from "../../types";
import { IModelService } from "../modelService/type";
import { ITransformService } from "../transformService/type";
import { initContextAttrs } from "@e-board/utils";

import { IRenderService } from "./type";

interface IDrawModelHandler {
  (model: any, ctx?: CanvasRenderingContext2D): void;
}

class RenderService implements IRenderService {
  private board!: IBoard;
  private modelService = eBoardContainer.get<IModelService>(IModelService);
  private modelHandler = new Map<string, IDrawModelHandler>();

  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | null = null;
  private redrawRequested = false;

  init = ({ board }: IServiceInitParams) => {
    this.board = board;
    this.initOffscreenCanvas();
  };

  private initOffscreenCanvas() {
    const mainCanvas = this.board.getCanvas()!;
    const { width, height } = mainCanvas.style;
    this.offscreenCanvas = document.createElement("canvas");
    this.offscreenCanvas.width = parseInt(width);
    this.offscreenCanvas.height = parseInt(height);
    this.offscreenCtx = this.offscreenCanvas.getContext("2d", {
      alpha: false
    });

    const transformService = eBoardContainer.get<ITransformService>(ITransformService);
    initContextAttrs(this.offscreenCtx!, { zoom: transformService.getView().zoom });
  }

  public registerDrawModelHandler(key: string, handler: IDrawModelHandler) {
    this.modelHandler.set(key, handler);
  }

  public unregisterDrawModelHandler(key: string) {
    this.modelHandler.delete(key);
  }

  public dispose(): void {
    this.modelHandler = new Map();
    this.offscreenCtx = null;
    this.offscreenCanvas = document.createElement("canvas");
  }

  public reRender = () => {
    if (!this.redrawRequested) {
      this.redrawRequested = true;
      requestAnimationFrame(() => {
        this._render();
        this.redrawRequested = false;
      });
    }
  };

  private _render = () => {
    console.time("render");
    const context = this.board.getCtx();
    const models = this.modelService.getAllModels();
    if (!context) return;
    const canvas = this.board.getCanvas();
    if (!canvas) return;
    // 清空画布
    context.save();
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.restore();

    // 设置绘制属性（包括根据缩放调整的线条宽度）
    const transformService = eBoardContainer.get<ITransformService>(ITransformService);
    initContextAttrs(context, { zoom: transformService.getView().zoom });

    // 绘制笔记
    context.beginPath();
    models.forEach(model => {
      const handler = this.modelHandler.get(model.type);
      if (handler) {
        handler(model, context as any);
      }
    });
    context.stroke();
    console.timeEnd("render");
  };
}

export default RenderService;
