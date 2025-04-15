import { eBoardContainer } from "../../common/IocContainer";
import { IModelService, IPointerEventService } from "../../services";
import type { IModel } from "../../services";
import { IBoard, IPlugin, IPluginInitParams } from "../../types";
import { defaultData } from "./defaultData";
class DrawPlugin implements IPlugin {
  private board!: IBoard;
  private disposeList: (() => void)[] = [];
  private modelService = eBoardContainer.get<IModelService>(IModelService);
  // private linesList: ILine[] = [];
  private currentLine: IModel | null = null;

  public pluginName = "DrawPlugin";

  private view = {
    x: 0,
    y: 0
  };

  public setView(view: { x: number; y: number }) {
    this.view = view;
  }

  public transformPoint(point: { x: number; y: number }, inverse = false) {
    if (inverse) {
      return {
        x: point.x + this.view.x,
        y: point.y + this.view.y
      };
    }
    return {
      x: point.x - this.view.x,
      y: point.y - this.view.y
    };
  }

  public redrawByLinesList({
    list,
    ctx,
    delta
  }: {
    list?: IModel[];
    ctx?: CanvasRenderingContext2D;
    delta?: { x: number; y: number };
  }) {
    const context = ctx || this.board.getCtx();
    const linesList = list || this.modelService.getAllModels();
    if (!context) return;
    this.initContextAttrs(context);
    linesList.forEach(line => {
      context.beginPath();
      line.points?.forEach((point, index) => {
        const transformedPoint = this.transformPoint(point);
        if (index === 0) {
          context.moveTo(transformedPoint.x, transformedPoint.y);
        } else if (index < 2) {
          context.lineTo(transformedPoint.x, transformedPoint.y);
        } else {
          const p1 = this.transformPoint(line.points![index - 1]);
          const p2 = this.transformPoint(point);
          const midPointX = (p1.x + p2.x) / 2;
          const midPointY = (p1.y + p2.y) / 2;
          context.quadraticCurveTo(p1.x, p1.y, midPointX, midPointY);
        }
        context.stroke();
      });
      context.closePath();
    });
  }

  public setCurrentLineWithDraw(point: { x: number; y: number }, isEnd = false) {
    const ctx = this.board.getCtx();
    if (!ctx) return;
    const transformedPoint = this.transformPoint(point, true);
    if (!this.currentLine) {
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      this.currentLine = this.modelService.createModel("line", { points: [transformedPoint] });
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
    this.currentLine.points?.push({
      x: transformedPoint.x,
      y: transformedPoint.y
    });
    ctx.stroke();

    if (isEnd) {
      ctx.closePath();
      this.modelService.createModel("line", { points: this.currentLine.points });
      this.currentLine = null;
    }
  }
  public init({ board }: IPluginInitParams) {
    this.board = board;
    this.initDraw();
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

  private initContextAttrs(ctx: CanvasRenderingContext2D) {
    // 设置绘制样式
    ctx.lineCap = "round"; // 设置线条端点样式
    ctx.lineJoin = "round"; // 设置线条连接处样式
    ctx.strokeStyle = "white"; // 设置线条颜色
    ctx.lineWidth = 1; // 设置线条宽度
  }

  private initDraw = () => {
    const ctx = this.board.getCtx();
    if (!ctx) return;
    const pointerEventService = eBoardContainer.get<IPointerEventService>(IPointerEventService);

    let isDrawing = false;
    let lastPoint = { x: 0, y: 0 };

    const { dispose: disposePointerDown } = pointerEventService.onPointerDown(event => {
      isDrawing = true;
      lastPoint = this.getCanvasPoint(event.clientX, event.clientY);
      this.initContextAttrs(ctx);
      this.setCurrentLineWithDraw(lastPoint);
    });

    const { dispose: disposePointerMove } = pointerEventService.onPointerMove(event => {
      if (!isDrawing) return;
      const currentPoint = this.getCanvasPoint(event.clientX, event.clientY);
      const ctx = this.board.getCtx();
      if (!ctx) return;
      this.setCurrentLineWithDraw(currentPoint);
    });

    const { dispose: disposePointerUp } = pointerEventService.onPointerUp(event => {
      if (!isDrawing) return;

      const ctx = this.board.getCtx();
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
  }
}

export default DrawPlugin;
