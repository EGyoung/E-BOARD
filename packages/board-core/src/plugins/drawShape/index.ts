import { initContextAttrs } from "@e-board/board-utils";
import { eBoardContainer } from "../../common/IocContainer";
import { IModelService, IModeService, IEventService } from "../../services";
import { IConfigService, IModel } from "../../services";
import { ITransformService } from "../../services/transformService/type";
import { IBoard, IPluginInitParams } from "../../types";
import { IPlugin } from "../type";

const CURRENT_MODE = "drawShape";

class DrawShapePlugin implements IPlugin {
  private board!: IBoard;
  private disposeList: (() => void)[] = [];
  private configService = eBoardContainer.get<IConfigService>(IConfigService);
  private modelService = eBoardContainer.get<IModelService>(IModelService);
  private transformService = eBoardContainer.get<ITransformService>(ITransformService);
  private lastPoint = { x: 0, y: 0 };

  private currentModel: IModel | null = null;

  public pluginName = "DrawShapePlugin";

  public dependencies = [];

  public transformPoint(point: { x: number; y: number }, inverse = false) {
    return this.transformService.transformPoint(point, inverse);
  }

  public setCurrentRectangleWithDraw(point: { x: number; y: number }, isEnd = false) {
    const ctx = this.board.getInteractionCtx();
    if (!ctx) return;
    const transformedPoint = this.transformPoint(point, true);
    if (!this.lastPoint) return
    if (!this.currentModel) {
      this.currentModel = this.modelService.createModel("rectangle", {
        points: [{ x: transformedPoint.x, y: transformedPoint.y }],
        width: 0,
        height: 0,
        isDrawing: true,
        options: {
          ...this.configService.getCtxConfig()
        },
      });
    };

    const [_point] = this.currentModel!.points!;
    const x = Math.min(_point.x, transformedPoint.x);
    const y = Math.min(_point.y, transformedPoint.y);
    const width = Math.abs(transformedPoint.x - _point.x);
    const height = Math.abs(transformedPoint.y - _point.y);

    // 清除交互层
    ctx.clearRect(0, 0, this.board.getCanvas()!.width, this.board.getCanvas()!.height);

    // 绘制矩形
    ctx.beginPath();
    ctx.save();
    ctx.rect(
      this.transformPoint({ x, y }).x,
      this.transformPoint({ x, y }).y,
      width * this.transformService.getView().zoom,
      height * this.transformService.getView().zoom
    );

    if (this.currentModel!.options?.fillStyle) {
      ctx.fillStyle = this.currentModel!.options?.fillStyle
      ctx.fill();
    }

    ctx.stroke();

    if (isEnd) {
      this.modelService.updateModel(this.currentModel!.id, {
        points: [{ x, y }],
        width,
        height,
        fillStyle: this.currentModel!.options?.fillStyle,
        isDrawing: false
      });
      this.currentModel = null;
    }
    ctx.restore()

  }

  public init({ board }: IPluginInitParams) {
    this.board = board;
    this.initDrawMode();
  }

  private initDrawMode() {
    const modeService = eBoardContainer.get<IModeService>(IModeService);
    modeService.registerMode(CURRENT_MODE, {
      beforeSwitchMode: ({ currentMode }) => {
        if (currentMode === CURRENT_MODE) {
          this.disposeList.forEach(dispose => dispose());
        }
      },
      afterSwitchMode: ({ currentMode }) => {
        if (currentMode === CURRENT_MODE) {
          this.initDraw();
        }
      }
    });
  }


  private getCanvasPoint(clientX: number, clientY: number) {
    const canvas = this.board.getCanvas();
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  private initDraw = () => {
    const eventService = eBoardContainer.get<IEventService>(IEventService);

    let isDrawing = false;

    const { dispose: disposePointerDown } = eventService.onPointerDown(event => {
      const ctx = this.board.getInteractionCtx();
      if (!ctx) return;
      isDrawing = true;
      this.lastPoint = this.getCanvasPoint(event.clientX, event.clientY);

      const configService = eBoardContainer.get<IConfigService>(IConfigService);

      initContextAttrs(
        ctx,
        { zoom: this.transformService.getView().zoom },
        { ...configService.getCtxConfig() }
      );
      this.setCurrentRectangleWithDraw(this.lastPoint);
    });

    const { dispose: disposePointerMove } = eventService.onPointerMove(event => {
      if (!isDrawing) return;
      const currentPoint = this.getCanvasPoint(event.clientX, event.clientY);
      const ctx = this.board.getInteractionCtx();

      if (!ctx) return;
      this.setCurrentRectangleWithDraw(currentPoint);
    });

    const { dispose: disposePointerUp } = eventService.onPointerUp(event => {
      if (!isDrawing) return;
      const ctx = this.board.getInteractionCtx();
      if (!ctx) return;
      const lastPoint = this.getCanvasPoint(event.clientX, event.clientY);
      this.setCurrentRectangleWithDraw(lastPoint, true);
      // 结束当前路径
      isDrawing = false;
    });

    this.disposeList.push(disposePointerDown, disposePointerMove, disposePointerUp);
  };

  public dispose() {
    this.disposeList.forEach(dispose => dispose());
  }
}

export default DrawShapePlugin;
