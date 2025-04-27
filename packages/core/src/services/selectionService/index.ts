import { eBoardContainer } from "../../common/IocContainer";
import { IBoard, IServiceInitParams } from "../../types";
import { IPointerEventService } from "../pointerEventService/type";
import { ISelectionService } from "./type";
interface Point {
  x: number;
  y: number;
}

class SelectionService implements ISelectionService {
  private board!: IBoard;
  private disposeList: (() => void)[] = [];
  private pointerDownPoint: { x: number; y: number } | null = null;

  init({ board }: IServiceInitParams) {
    this.board = board;
    const pointerEventService = eBoardContainer.get<IPointerEventService>(IPointerEventService);
    const { dispose: pointerDownDispose } = pointerEventService.onPointerDown(
      this.handlePointerDown
    );
    this.disposeList.push(() => {
      pointerDownDispose();
    });
    return;

    const { dispose: pointerMoveDispose } = pointerEventService.onPointerMove(
      this.handlePointerMove
    );
    const { dispose: pointerUpDispose } = pointerEventService.onPointerUp(this.handlePointerUp);

    this.disposeList.push(() => {
      pointerDownDispose();
      pointerMoveDispose();
      pointerUpDispose();
    });
  }

  private handlePointerMove = (e: PointerEvent) => {
    if (!this.pointerDownPoint) return;
    const { clientX, clientY } = e;
    const deltaX = clientX - this.pointerDownPoint.x;
    const deltaY = clientY - this.pointerDownPoint.y;

    const ctx = this.board.getCtx();
    if (!ctx) return;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); // Clear the canvas
    ctx.strokeRect(this.pointerDownPoint.x, this.pointerDownPoint.y, deltaX, deltaY);
    ctx.fillStyle = "rgba(189, 189, 251, 0.5)"; // Set the fill color with transparency

    ctx.fillRect(this.pointerDownPoint.x, this.pointerDownPoint.y, deltaX, deltaY);
    ctx.strokeStyle = "blue"; // Set the stroke color
    ctx.lineWidth = 2; // Set the line width
    ctx.stroke(); // Draw the rectangle

    // this.board.redraw();
  };

  private handlePointerUp = (e: PointerEvent) => {
    this.pointerDownPoint = null;
    const ctx = this.board.getCtx();
    if (!ctx) return;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); // Clear the canvas

    // TODO 调用renderService重新渲染
    // this.board.redraw();

    // 触发重新渲染
  };

  private handlePointerDown = (e: PointerEvent) => {
    // this.pointerDownPoint = { x: e.clientX, y: e.clientY };
  };

  /**
   * 计算点到线段的最短距离
   * @param point 要计算的点
   * @param p1 线段起点
   * @param p2 线段终点
   * @returns 点到线段的最短距离
   *
   * 算法步骤:
   * 1. 将点和线段转换为向量:
   *    - A,B 是点到线段起点的向量
   *    - C,D 是线段的向量
   *
   * 2. 计算点在线段上的投影位置:
   *    - dot 是两个向量的点积
   *    - len_sq 是线段向量的长度平方
   *    - param 是投影点在线段上的参数(0-1之间表示在线段内)
   *
   * 3. 根据 param 确定最近点:
   *    - param < 0: 最近点是线段起点
   *    - param > 1: 最近点是线段终点
   *    - 0 <= param <= 1: 最近点在线段上
   *
   * 4. 计算点到最近点的距离
   */
}

export default SelectionService;
