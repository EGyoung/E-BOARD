import { IBoard, IPluginInitParams } from "../../types";
import { IPlugin } from "../type";

class RoamPlugin implements IPlugin {
  private board!: IBoard;
  private disposeList: (() => void)[] = [];
  private offscreenCanvas!: HTMLCanvasElement;
  private offscreenCtx!: CanvasRenderingContext2D;

  public init({ board }: IPluginInitParams) {
    this.board = board;
    this.initRoam();
  }
  public initRoam = () => {
    const canvas = this.board.getCanvas();
    if (!canvas) return;
    const ctx = this.board.getCtx();
    if (!ctx) return;

    this.offscreenCanvas = document.createElement("canvas");
    this.offscreenCanvas.width = canvas.width;
    this.offscreenCanvas.height = canvas.height;
    this.offscreenCtx = this.offscreenCanvas.getContext("2d")!;

    canvas.addEventListener("wheel", e => {
      const { deltaX, deltaY } = e;

      this.offscreenCanvas.width = canvas.width;
      this.offscreenCanvas.height = canvas.height;
      this.offscreenCtx?.drawImage(canvas, 0, 0);
      const dpr = window.devicePixelRatio;
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      ctx?.drawImage(
        this.offscreenCanvas,
        dpr * deltaX,
        dpr * deltaY,
        canvas.width * dpr,
        canvas.height * dpr,
        0,
        0,
        canvas.width,
        canvas.height
      );
    });
  };

  public dispose() {
    this.disposeList.forEach(dispose => dispose());
  }
}

export default RoamPlugin;
