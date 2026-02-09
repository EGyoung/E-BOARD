import { initContextAttrs } from "@e-board/board-utils";
import { eBoardContainer } from "../../common/IocContainer";
import { IModelService, IModeService, IEventService } from "../../services";
import { IConfigService, IModel } from "../../services";
import { IRenderService } from "../../services/renderService/type";
import { ITransformService } from "../../services/transformService/type";
import { IBoard, IPluginInitParams } from "../../types";
import { IPlugin } from "../type";
import { BaseCtrlElement } from "../../board/element/baseElement";

const CURRENT_MODE = "draw";
class DrawPlugin implements IPlugin {
  private board!: IBoard;
  private disposeList: (() => void)[] = [];
  private configService = eBoardContainer.get<IConfigService>(IConfigService);
  private modelService = eBoardContainer.get<IModelService>(IModelService);
  private renderService = eBoardContainer.get<IRenderService>(IRenderService);
  private transformService = eBoardContainer.get<ITransformService>(ITransformService);


  public pluginName = "DrawPlugin";

  public dependencies = [];

  public transformPoint(point: { x: number; y: number }, inverse = false) {
    return this.transformService.transformPoint(point, inverse);
  }

  private currentLinePoints: { x: number; y: number }[] = [];
  private lastScreenPoint: { x: number; y: number } | null = null;
  // 记录最小采样距离，避免高频指针事件导致的重复绘制与模型点暴增
  private readonly minDistanceSq = 1;

  public setCurrentLineWithDraw(point: { x: number; y: number }, isEnd = false) {
    const ctx = this.board.getInteractionCtx();
    if (!ctx) return;
    if (
      !isEnd &&
      this.lastScreenPoint &&
      this.lastScreenPoint.x === point.x &&
      this.lastScreenPoint.y === point.y
    ) {
      return;
    }
    if (!isEnd && this.lastScreenPoint) {
      const dx = point.x - this.lastScreenPoint.x;
      const dy = point.y - this.lastScreenPoint.y;
      if (dx * dx + dy * dy < this.minDistanceSq) {
        return;
      }
    }
    const transformedPoint = this.transformPoint(point, true);
    if (!this.currentLinePoints.length) {
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      this.currentLinePoints = [transformedPoint];
      this.lastScreenPoint = { x: point.x, y: point.y };
      return;
    }
    const points = this.currentLinePoints!;
    const previousScreenPoint = this.lastScreenPoint ?? point;

    // 如果点数太少，直接画直线
    if (points.length < 2) {
      ctx.lineTo(point.x, point.y);
    } else {
      // 使用上一帧的屏幕坐标平滑曲线
      const midPointX = (previousScreenPoint.x + point.x) / 2;
      const midPointY = (previousScreenPoint.y + point.y) / 2;
      ctx.quadraticCurveTo(previousScreenPoint.x, previousScreenPoint.y, midPointX, midPointY);
    }

    ctx.stroke();

    this.currentLinePoints.push({
      x: transformedPoint.x,
      y: transformedPoint.y
    });
    this.lastScreenPoint = { x: point.x, y: point.y };

    if (isEnd) {
      this.modelService.createModel("line", {
        points: this.currentLinePoints,
        options: { ...this.configService.getCtxConfig() },
        ctrlElementConstructor: BaseCtrlElement
      });
      this.currentLinePoints = [];
      this.lastScreenPoint = null;
    }
  }

  public init({ board }: IPluginInitParams) {
    this.board = board;
    this.initDrawMode();
    this.registerLineDrawHandler();

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

  private registerLineDrawHandler() {
    this.renderService.registerDrawModelHandler("line", this.drawLineModelHandler);
  }

  private drawLineModelHandler = (model: IModel, ctx?: CanvasRenderingContext2D, useWorldCoords = false) => {
    const context = this.board.getCtx();
    if (!context) return;
    context.save()
    const toScreenPoint = useWorldCoords
      ? (point: { x: number; y: number }) => point
      : (point: { x: number; y: number }) => this.transformPoint(point);
    model.points?.forEach((point, index) => {
      const transformedPoint = toScreenPoint(point);
      if (index === 0) {
        context.moveTo(transformedPoint.x, transformedPoint.y);
      } else if (index < 2) {
        context.lineTo(transformedPoint.x, transformedPoint.y);
      } else {
        const p1 = toScreenPoint(model.points![index - 1]);
        const p2 = toScreenPoint(point);
        const midPointX = (p1.x + p2.x) / 2;
        const midPointY = (p1.y + p2.y) / 2;
        context.quadraticCurveTo(p1.x, p1.y, midPointX, midPointY);
      }
    });
    context.restore()
  };

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
    let lastPoint = { x: 0, y: 0 };

    const { dispose: disposePointerDown } = eventService.onPointerDown(event => {
      const ctx = this.board.getInteractionCtx();
      if (!ctx) return;
      isDrawing = true;
      lastPoint = this.getCanvasPoint(event.clientX, event.clientY);
      const configService = eBoardContainer.get<IConfigService>(IConfigService);
      ctx.save()
      initContextAttrs(
        ctx,
        { zoom: this.transformService.getView().zoom },
        configService.getCtxConfig()
      );
      this.setCurrentLineWithDraw(lastPoint);
    });

    const { dispose: disposePointerMove } = eventService.onPointerMove(event => {
      if (!isDrawing) return;
      const currentPoint = this.getCanvasPoint(event.clientX, event.clientY);
      const ctx = this.board.getInteractionCtx();

      if (!ctx) return;
      this.setCurrentLineWithDraw(currentPoint);
    });

    const { dispose: disposePointerUp } = eventService.onPointerUp(event => {
      if (!isDrawing) return;
      const ctx = this.board.getInteractionCtx();
      if (!ctx) return;
      const lastPoint = this.getCanvasPoint(event.clientX, event.clientY);
      this.setCurrentLineWithDraw(lastPoint, true);
      ctx.restore()
      // 结束当前路径
      isDrawing = false;
    });

    this.disposeList.push(disposePointerDown, disposePointerMove, disposePointerUp);
  };

  public dispose() {
    this.disposeList.forEach(dispose => dispose());
    this.renderService.unregisterDrawModelHandler("line");
  }
}

export default DrawPlugin;
