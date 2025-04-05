import { throttle, uuid } from "@e-board/utils";
import { eBoardContainer } from "../../common/IocContainer";
import { IPointerEventService } from "../../services";
import { IBoard, IPluginInitParams } from "../../types";
import { IPlugin } from "../type";
import { ILine } from "./type";
import { defaultData } from "./defaultData";

class LineFactory {
  public createLine(points: { x: number; y: number }[] = []) {
    return {
      id: uuid(),
      points
    };
  }
}

class DrawPlugin implements IPlugin {
  private board!: IBoard;
  private disposeList: (() => void)[] = [];
  private lineFactory = new LineFactory();
  private linesList: ILine[] = [];
  private currentLine: ILine | null = null;

  public redrawByLinesList(list: ILine[]) {
    const ctx = this.board.getCtx();
    const canvas = this.board.getCanvas();
    if (!ctx || !canvas) return;
    this.initContextAttrs(ctx);
    list.forEach(line => {
      ctx.beginPath();
      line.points.forEach((point, index) => {
        if (index === 0) {
          ctx.moveTo(point.x, point.y);
        } else if (index < 3) {
          ctx.lineTo(point.x, point.y);
        } else {
          const p1 = line.points[index - 1];
          const p2 = point;
          const midPointX = (p1.x + p2.x) / 2;
          const midPointY = (p1.y + p2.y) / 2;
          ctx.quadraticCurveTo(p1.x, p1.y, midPointX, midPointY);
        }
        ctx.stroke();
      });
    });
    ctx.closePath();
  }

  public setCurrentLineWithDraw(point: { x: number; y: number }, isEnd = false) {
    const ctx = this.board.getCtx();
    if (!ctx) return;

    if (!this.currentLine) {
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      this.currentLine = this.lineFactory.createLine([point]);
      return;
    }

    this.currentLine.points.push(point);
    const points = this.currentLine.points;

    // 如果点数太少，直接画直线
    if (points.length < 3) {
      ctx.lineTo(point.x, point.y);
    } else {
      // 获取最后三个点
      const p1 = points[points.length - 2]; // 前一个点
      const p2 = point; // 当前点
      const midPointX = (p1.x + p2.x) / 2;
      const midPointY = (p1.y + p2.y) / 2;

      ctx.quadraticCurveTo(p1.x, p1.y, midPointX, midPointY);
    }

    ctx.stroke();

    if (isEnd) {
      ctx.closePath();
      this.linesList.push(this.currentLine);
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
