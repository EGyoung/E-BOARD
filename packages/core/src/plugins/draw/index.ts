import { eBoardContainer } from "../../common/IocContainer";
import { IPointerEventService } from "../../services";
import { IBoard, IPluginInitParams } from "../../types";
import { IPlugin } from "../type";

class DrawPlugin implements IPlugin {
  private board!: IBoard;
  private disposeList: (() => void)[] = [];

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

  private setupContext(ctx: CanvasRenderingContext2D) {
    // 设置绘制样式
    ctx.lineCap = "round"; // 设置线条端点样式
    ctx.lineJoin = "round"; // 设置线条连接处样式
    ctx.strokeStyle = "white"; // 设置线条颜色
    ctx.lineWidth = 2; // 设置线条宽度
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
      this.setupContext(ctx);
      ctx.beginPath();
      ctx.moveTo(lastPoint.x, lastPoint.y);
    });

    const { dispose: disposePointerMove } = pointerEventService.onPointerMove(event => {
      if (!isDrawing) return;

      const currentPoint = this.getCanvasPoint(event.clientX, event.clientY);
      const ctx = this.board.getCtx();
      if (!ctx) return;
      // 继续当前路径
      ctx.lineTo(currentPoint.x, currentPoint.y);
      ctx.stroke();

      lastPoint = currentPoint;
    });

    const { dispose: disposePointerUp } = pointerEventService.onPointerUp(() => {
      if (!isDrawing) return;

      const ctx = this.board.getCtx();
      if (!ctx) return;
      // 结束当前路径
      ctx.closePath();
      isDrawing = false;
    });

    this.disposeList.push(disposePointerDown, disposePointerMove, disposePointerUp);
  };

  public dispose() {
    this.disposeList.forEach(dispose => dispose());
  }
}

export default DrawPlugin;
