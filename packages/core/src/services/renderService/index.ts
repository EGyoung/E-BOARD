import { eBoardContainer } from "../../common/IocContainer";
import { IBoard, IServiceInitParams } from "../../types";
import { IModelService } from "../modelService/type";

import { IRenderService } from "./type";

interface IDrawModelHandler {
  (model: any): void;
}

class RenderService implements IRenderService {
  private board!: IBoard;
  private modelService = eBoardContainer.get<IModelService>(IModelService);
  private modelHandler = new Map<string, IDrawModelHandler>();

  init = ({ board }: IServiceInitParams) => {
    console.log(board, "board");
    this.board = board;
  };

  public registerDrawModelHandler(key: string, handler: IDrawModelHandler) {
    this.modelHandler.set(key, handler);
  }

  public unregisterDrawModelHandler(key: string) {
    this.modelHandler.delete(key);
  }

  public dispose(): void {
    this.modelHandler = new Map();
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
    this.initContextAttrs(context);
    context.beginPath();
    models.forEach(model => {
      const handler = this.modelHandler.get(model.type);
      if (handler) {
        handler(model);
      }
    });
    context.stroke();
  };
}

export default RenderService;
