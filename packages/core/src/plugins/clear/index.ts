import { eBoardContainer } from "../../common/IocContainer";
import { IModelService, IRenderService } from "../../services";
import { IBoard, IPluginInitParams } from "../../types";
import { IPlugin } from "../type";

class ClearPlugin implements IPlugin {
  private board!: IBoard;
  private disposeList: (() => void)[] = [];

  public pluginName = "ClearPlugin";

  public init({ board }: IPluginInitParams) {
    this.board = board;
    this.clearAll();
  }

  public clearAll = () => {
    const canvas = this.board.getInteractionCanvas();
    if (!canvas) return;
    const ctx = this.board.getInteractionCtx();
    if (!ctx) return;
    const modelService = eBoardContainer.get<IModelService>(IModelService);
    const renderService = eBoardContainer.get<IRenderService>(IRenderService);
    modelService.clearModels();
    renderService.reRender();
  };

  public dispose() {
    this.disposeList.forEach(dispose => dispose());
  }

  public exports = {
    clear: this.clearAll
  };
}

export default ClearPlugin;
