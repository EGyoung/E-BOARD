import { IBoard, IServiceInitParams } from "../../types";
import { Emitter } from "@e-board/utils";
import { IPointerEventService } from "./type";
import { injectable, decorate } from "inversify";

class PointerEventService implements IPointerEventService {
  private board!: IBoard;
  private _pointerDownEvent = new Emitter<PointerEvent>();
  private _pointerMoveEvent = new Emitter<PointerEvent>();
  private _pointerUpEvent = new Emitter<PointerEvent>();

  private handlePointerDown = (e: PointerEvent) => {
    e.preventDefault();
    this._pointerDownEvent.fire(e);
  };

  private handlePointerMove = (e: PointerEvent) => {
    e.preventDefault();
    this._pointerMoveEvent.fire(e);
  };

  private handlePointerUp = (e: PointerEvent) => {
    e.preventDefault();
    this._pointerUpEvent.fire(e);
  };

  private handlePointerLeave = (e: PointerEvent) => {
    e.preventDefault();
    this._pointerUpEvent.fire(e);
  };

  public onPointerDown = this._pointerDownEvent.event;
  public onPointerMove = this._pointerMoveEvent.event;
  public onPointerUp = this._pointerUpEvent.event;

  public init({ board }: IServiceInitParams) {
    this.board = board;
    const canvas = this.board.getCanvas();
    if (!canvas) {
      throw new Error("canvas is not found");
    }
    this.initPointerEvent();
  }

  private initPointerEvent = () => {
    const canvas = this.board.getCanvas();
    if (!canvas) {
      throw new Error("canvas is not found");
    }

    canvas.style.touchAction = "none"; // 禁用触摸事件的默认行为

    canvas.addEventListener("pointerdown", this.handlePointerDown);
    canvas.addEventListener("pointermove", this.handlePointerMove);
    canvas.addEventListener("pointerup", this.handlePointerUp);
    canvas.addEventListener("pointerleave", this.handlePointerLeave);
  };

  public dispose(): void {
    const canvas = this.board.getCanvas();
    if (!canvas) return;

    canvas.removeEventListener("pointerdown", this.handlePointerDown);
    canvas.removeEventListener("pointermove", this.handlePointerMove);
    canvas.removeEventListener("pointerup", this.handlePointerUp);
    canvas.removeEventListener("pointerleave", this.handlePointerLeave);
  }
}

// 使用 decorate 替代装饰器语法
decorate(injectable(), PointerEventService);

export default PointerEventService;
