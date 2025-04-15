import { eBoardContainer } from "../../common/IocContainer";
import { IBoard, IServiceInitParams } from "../../types";
import { IPointerEventService } from "../pointerEventService/type";
import { ISelectionService } from "./type";

class SelectionService implements ISelectionService {
  private board!: IBoard;
  private disposeList: (() => void)[] = [];
  private pointerDownPoint: { x: number; y: number } | null = null;

  init({ board }: IServiceInitParams) {
    return;
    this.board = board;
    const pointerEventService = eBoardContainer.get<IPointerEventService>(IPointerEventService);
    const { dispose: pointerDownDispose } = pointerEventService.onPointerDown(
      this.handlePointerDown
    );
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
    this.board.redraw();
    // 触发重新渲染
  };

  private handlePointerDown = (e: PointerEvent) => {
    this.pointerDownPoint = { x: e.clientX, y: e.clientY };
  };
}

export default SelectionService;
