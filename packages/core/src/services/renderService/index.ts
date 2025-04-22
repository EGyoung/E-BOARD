import { eBoardContainer } from "../../common/IocContainer";
import { IBoard, IServiceInitParams } from "../../types";
import { IModelService } from "../modelService/type";

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

  init = ({ board }: IServiceInitParams) => {
    this.board = board;
    this.initOffscreenCanvas();
  };

  private initOffscreenCanvas() {
    const mainCanvas = this.board.getCanvas()!;
    this.offscreenCanvas = document.createElement("canvas");
    this.offscreenCanvas.width = mainCanvas.width;
    this.offscreenCanvas.height = mainCanvas.height;
    this.offscreenCtx = this.offscreenCanvas.getContext("2d");
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

  private initContextAttrs(context: CanvasRenderingContext2D) {
    // 设置绘制样式
    context.lineCap = "round"; // 设置线条端点样式
    context.lineJoin = "round"; // 设置线条连接处样式
    context.strokeStyle = "white"; // 设置线条颜色
    context.lineWidth = 1; // 设置线条宽度
  }

  public reRender = () => {
    const context = this.board.getCtx();
    const models = this.modelService.getAllModels();
    if (!context) return;
    if (!this.offscreenCtx || !this.offscreenCanvas) return;
    this.offscreenCtx!.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
    this.initContextAttrs(this.offscreenCtx!);
    this.offscreenCtx!.beginPath();
    models.forEach(model => {
      const handler = this.modelHandler.get(model.type);
      if (handler && this.offscreenCtx) {
        handler(model, this.offscreenCtx as any);
      }
    });
    this.offscreenCtx!.stroke();
    context.clearRect(0, 0, this.board.getCanvas()!.width, this.board.getCanvas()!.height);
    context.drawImage(this.offscreenCanvas, 0, 0);
  };
}

export default RenderService;
