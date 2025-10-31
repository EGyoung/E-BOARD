import { throttleByRaf, initContextAttrs } from "@e-board/utils";
import { eBoardContainer } from "../../common/IocContainer";
import { IModelService, IModeService, IPointerEventService } from "../../services";
import { IConfigService, IModel } from "../../services";
import { IRenderService } from "../../services/renderService/type";
import { ITransformService } from "../../services/transformService/type";
import { IBoard, IPluginInitParams } from "../../types";
import { IPlugin } from "../type";

const CURRENT_MODE = "draw";

interface Point {
  x: number;
  y: number;
}

class DrawPlugin implements IPlugin {
  private board!: IBoard;
  private disposeList: (() => void)[] = [];
  private configService = eBoardContainer.get<IConfigService>(IConfigService);
  private modelService = eBoardContainer.get<IModelService>(IModelService);
  private renderService = eBoardContainer.get<IRenderService>(IRenderService);
  private transformService = eBoardContainer.get<ITransformService>(ITransformService);

  private currentLine: IModel | null = null;

  public pluginName = "DrawPlugin";

  public dependencies = [];

  public transformPoint(point: { x: number; y: number }, inverse = false) {
    return this.transformService.transformPoint(point, inverse);
  }

  public setCurrentLineWithDraw(point: { x: number; y: number }, isEnd = false) {
    const ctx = this.board.getInteractionCtx();
    if (!ctx) return;
    const transformedPoint = this.transformPoint(point, true);
    if (!this.currentLine) {
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      this.currentLine = this.modelService.createModel("line", {
        points: [transformedPoint],
        options: this.configService.getCtxConfig()
      });
      this.currentLine.points?.push(transformedPoint);
      return;
    }
    const points = this.currentLine.points!;
    // 如果点数太少，直接画直线
    if (points.length < 2) {
      ctx.lineTo(point.x, point.y);
    } else {
      // 获取最后三个点
      const p1 = this.transformPoint(points[points.length - 1]); // 前一个点
      const p2 = point; // 当前点
      const midPointX = (p1.x + p2.x) / 2;
      const midPointY = (p1.y + p2.y) / 2;
      ctx.quadraticCurveTo(p1.x, p1.y, midPointX, midPointY);
    }

    ctx.stroke();
    // 如果不beginPath 会导致每次stroke 会重新绘制整条线段 导致降20倍速禁用GPU加速情况下长线段卡顿
    // FIXME: 优化贝塞尔
    ctx.beginPath();
    const p1 = this.transformPoint(points[points.length - 1]); // 前一个点
    const p2 = point; // 当前点
    const midPointX = (p1.x + p2.x) / 2;
    const midPointY = (p1.y + p2.y) / 2;
    ctx.moveTo(midPointX, midPointY);
    ctx.lineTo(point.x, point.y);

    this.currentLine.points?.push({
      x: transformedPoint.x,
      y: transformedPoint.y
    });

    if (isEnd) {
      this.modelService.updateModel(this.currentLine.id, {
        points: this.currentLine.points
      });
      this.currentLine = null;
    }
  }

  // public throttleSetCurrentLineWithDraw = throttleByRaf(this.setCurrentLineWithDraw.bind(this));
  public init({ board }: IPluginInitParams) {
    this.board = board;
    this.initDrawMode();
    this.registerLineDrawHandler();
  }

  private initSelectLine() {
    const pointerEventService = eBoardContainer.get<IPointerEventService>(IPointerEventService);
    const { dispose: pointerDownDispose } = pointerEventService.onPointerDown(
      this.handleSelectLinePointerDown
    );
    this.disposeList.push(() => {
      pointerDownDispose();
    });
  }

  private handleSelectLinePointerDown = (e: PointerEvent) => {
    const { clientX, clientY } = e;
    this.modelService.getAllModels().forEach(model => {
      if (model.type === "line") {
        const points = model.points;
        if (!points) return;
        for (let i = 0; i < points.length - 1; i++) {
          const distance = this.distanceToLineSegment(
            { x: clientX, y: clientY },
            points[i],
            points[i + 1]
          );
          if (distance < 5) {
            console.log("点击到了线段");
          }
        }
      }
    });
  };

  private distanceToLineSegment = (point: Point, p1: Point, p2: Point): number => {
    const { x, y } = point;
    const { x: x1, y: y1 } = p1;
    const { x: x2, y: y2 } = p2;

    const A = x - x1; // 点到起点的x分量
    const B = y - y1; // 点到起点的y分量
    const C = x2 - x1; // 线段的x分量
    const D = y2 - y1; // 线段的y分量

    const dot = A * C + B * D; // 向量点积
    const len_sq = C * C + D * D; // 线段长度平方

    // 如果线段退化为点,直接返回点到点的距离
    if (len_sq === 0) return Math.sqrt(A * A + B * B);

    // 计算投影点参数
    const param = dot / len_sq;

    // 根据参数确定最近点坐标
    let xx, yy;

    if (param < 0) {
      // 最近点是起点
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      // 最近点是终点
      xx = x2;
      yy = y2;
    } else {
      // 最近点在线段上
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    // 计算点到最近点的距离
    const dx = x - xx;
    const dy = y - yy;

    return Math.sqrt(dx * dx + dy * dy);
  };

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

  private drawLineModelHandler = (model: IModel, ctx?: CanvasRenderingContext2D) => {
    const context = this.board.getCtx();
    if (!context) return;

    model.points?.forEach((point, index) => {
      const transformedPoint = this.transformPoint(point);
      if (index === 0) {
        context.moveTo(transformedPoint.x, transformedPoint.y);
      } else if (index < 2) {
        context.lineTo(transformedPoint.x, transformedPoint.y);
      } else {
        const p1 = this.transformPoint(model.points![index - 1]);
        const p2 = this.transformPoint(point);
        const midPointX = (p1.x + p2.x) / 2;
        const midPointY = (p1.y + p2.y) / 2;
        context.quadraticCurveTo(p1.x, p1.y, midPointX, midPointY);
      }
    });
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
    const pointerEventService = eBoardContainer.get<IPointerEventService>(IPointerEventService);

    let isDrawing = false;
    let lastPoint = { x: 0, y: 0 };

    const { dispose: disposePointerDown } = pointerEventService.onPointerDown(event => {
      const ctx = this.board.getInteractionCtx();
      if (!ctx) return;
      isDrawing = true;
      lastPoint = this.getCanvasPoint(event.clientX, event.clientY);
      const configService = eBoardContainer.get<IConfigService>(IConfigService);

      initContextAttrs(
        ctx,
        { zoom: this.transformService.getView().zoom },
        configService.getCtxConfig()
      );
      this.setCurrentLineWithDraw(lastPoint);
    });

    const { dispose: disposePointerMove } = pointerEventService.onPointerMove(event => {
      if (!isDrawing) return;
      const currentPoint = this.getCanvasPoint(event.clientX, event.clientY);
      const ctx = this.board.getInteractionCtx();

      if (!ctx) return;
      this.setCurrentLineWithDraw(currentPoint);
    });

    const { dispose: disposePointerUp } = pointerEventService.onPointerUp(event => {
      if (!isDrawing) return;
      const ctx = this.board.getInteractionCtx();
      if (!ctx) return;
      const lastPoint = this.getCanvasPoint(event.clientX, event.clientY);
      this.setCurrentLineWithDraw(lastPoint, true);
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
