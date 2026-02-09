import { IBoard, IServiceInitParams } from "../../types";
import { Emitter } from "@e-board/board-utils";
import { IEventService } from "./type";
import { injectable, decorate } from "inversify";

class EventService implements IEventService {
  private board!: IBoard;
  private _pointerDownEvent = new Emitter<PointerEvent>();
  private _pointerMoveEvent = new Emitter<PointerEvent>();
  private _pointerUpEvent = new Emitter<PointerEvent>();
  private _doubleClickEvent = new Emitter<MouseEvent>();

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

  private handleDoubleClick = (e: MouseEvent) => {
    e.preventDefault();
    this._doubleClickEvent.fire(e);
  }

  public onPointerDown = this._pointerDownEvent.event;
  public onPointerMove = this._pointerMoveEvent.event;
  public onPointerUp = this._pointerUpEvent.event;
  public onDoubleClick = this._doubleClickEvent.event;

  public init({ board }: IServiceInitParams) {
    this.board = board;
    const canvas = this.board.getInteractionCanvas();
    if (!canvas) {
      throw new Error("canvas is not found");
    }
    this.initPointerEvent();
  }

  private initPointerEvent = () => {
    const canvas = this.board.getInteractionCanvas();
    if (!canvas) {
      throw new Error("canvas is not found");
    }

    canvas.style.touchAction = "none"; // 禁用触摸事件的默认行为

    canvas.addEventListener("pointerdown", this.handlePointerDown);
    canvas.addEventListener("pointermove", this.handlePointerMove);
    canvas.addEventListener("pointerup", this.handlePointerUp);
    canvas.addEventListener("pointerleave", this.handlePointerLeave);
    canvas.addEventListener("dblclick", this.handleDoubleClick);
  };

  public dispose(): void {
    const canvas = this.board.getInteractionCanvas();
    if (!canvas) return;

    canvas.removeEventListener("pointerdown", this.handlePointerDown);
    canvas.removeEventListener("pointermove", this.handlePointerMove);
    canvas.removeEventListener("pointerup", this.handlePointerUp);
    canvas.removeEventListener("pointerleave", this.handlePointerLeave);
  }
}

// 使用 decorate 替代装饰器语法
decorate(injectable(), EventService);

export default EventService;
