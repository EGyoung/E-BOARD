import { eBoardContainer } from "../../common/IocContainer";
import { IPluginService } from "../../services/pluginService/type";
import { IBoard, IPlugin, IPluginInitParams } from "../../types";

class RoamPlugin implements IPlugin {
  private board!: IBoard;
  private disposeList: (() => void)[] = [];
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
    const pluginService = eBoardContainer.get<IPluginService>(IPluginService);
    const drawPlugin = pluginService.getPlugin("DrawPlugin");

    canvas.addEventListener("wheel", e => {
      const { deltaX, deltaY } = e;
      this.view.x += deltaX;
      this.view.y += deltaY;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // TODO 优化
      (drawPlugin as any)?.setView(this.view);
      (drawPlugin as any)?.redrawByLinesList({
        delta: {
          x: this.view.x,
          y: this.view.y
        }
      });
    });
  };

  public dispose() {
    this.disposeList.forEach(dispose => dispose());
  }
}

export default RoamPlugin;
