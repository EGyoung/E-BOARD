import { eBoardContainer } from "../../common/IocContainer";
import { ITransformService } from "../../services/transformService/type";
import { IBoard, IPluginInitParams } from "../../types";
import { IPlugin } from "../type";

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
    const transformService = eBoardContainer.get<ITransformService>(ITransformService);
    canvas.addEventListener("wheel", e => {
      const { deltaX, deltaY } = e;
      this.view.x += deltaX;
      this.view.y += deltaY;
      transformService.setView(this.view);
    });
  };

  public dispose() {
    this.disposeList.forEach(dispose => dispose());
  }
}

export default RoamPlugin;
