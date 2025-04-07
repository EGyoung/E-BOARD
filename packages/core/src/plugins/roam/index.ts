import { IBoard, IPlugin, IPluginInitParams } from "../../types";

class RoamPlugin implements IPlugin {
  private board!: IBoard;
  private disposeList: (() => void)[] = [];
  private offscreenCanvas!: HTMLCanvasElement;
  private offscreenCtx!: CanvasRenderingContext2D;
  private view = {
    x: 0,
    y: 0,
    scale: 1
  };

  public pluginName = "RoamPlugin";

  public init({ board }: IPluginInitParams) {
    this.board = board;
    this.initRoam();
  }
  public initRoam = () => {
    const canvas = this.board.getCanvas();
    if (!canvas) return;
    const ctx = this.board.getCtx();
    if (!ctx) return;

    // this.offscreenCanvas = document.createElement("canvas");
    // this.offscreenCanvas.width = canvas.width;
    // this.offscreenCanvas.height = canvas.height;
    // this.offscreenCtx = this.offscreenCanvas.getContext("2d")!;

    const drawPlugin = this.board.getPlugin("DrawPlugin");

    canvas.addEventListener("wheel", e => {
      const { deltaX, deltaY } = e;

      // this.offscreenCanvas.width = canvas.width;
      // this.offscreenCanvas.height = canvas.height;

      this.view.x += deltaX;
      this.view.y += deltaY;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawPlugin?.setView(this.view);
      (drawPlugin as any)?.redrawByLinesList({
        // ctx: this.offscreenCtx,
        delta: {
          x: this.view.x,
          y: this.view.y
        }
      });
      // const dpr = window.devicePixelRatio;

      // ctx?.clearRect(0, 0, canvas.width, canvas.height);
      // ctx?.drawImage(
      //   this.offscreenCanvas,
      //   this.view.x,
      //   this.view.y,
      //   canvas.width,
      //   canvas.height,
      //   0,
      //   0,
      //   canvas.width,
      //   canvas.height
      // );
    });
  };

  public dispose() {
    this.disposeList.forEach(dispose => dispose());
  }
}

export default RoamPlugin;
