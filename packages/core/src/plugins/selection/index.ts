import { IBoard, IPluginInitParams } from "../../types";
import { eBoardContainer } from "../../common/IocContainer";
import { IModelService } from "../../services/modelService/type";
import { IPlugin } from "../type";
import { IModeService } from "../../services";

const CURRENT_MODE = "selection";

class SelectionPlugin implements IPlugin {
  private board!: IBoard;
  private disposeList: (() => void)[] = [];
  private pointerDownPoint: { x: number; y: number } | null = null;

  public pluginName = "SelectionPlugin";

  public init({ board }: IPluginInitParams) {
    this.board = board;
    const modeService = eBoardContainer.get<IModeService>(IModeService);
    modeService.registerMode(CURRENT_MODE, {
      beforeSwitchMode: ({ currentMode }) => {
        if (currentMode === CURRENT_MODE) {
          this.disposeList.forEach(dispose => dispose());
        }
      },
      afterSwitchMode: ({ currentMode }) => {
        if (currentMode === CURRENT_MODE) {
          this.initSelect();
        }
      }
    });
  }

  private initSelect() {
    const container = this.board.getContainer();
    const canvas = this.board.getInteractionCanvas();
    if (!canvas || !container) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      this.pointerDownPoint = { x: e.clientX, y: e.clientY };
      container.addEventListener("pointermove", handlePointerMove);
      container.addEventListener("pointerup", handlePointerUp);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!this.pointerDownPoint) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const width = e.clientX - this.pointerDownPoint.x;
      const height = e.clientY - this.pointerDownPoint.y;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "pink";
      // 虚线
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 1;
      ctx.strokeRect(this.pointerDownPoint.x, this.pointerDownPoint.y, width, height);
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!this.pointerDownPoint) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.pointerDownPoint = null;
      container.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("pointerup", handlePointerUp);
    };

    container.addEventListener("pointerdown", handlePointerDown);
    this.disposeList.push(() => {
      container.removeEventListener("pointerdown", handlePointerDown);
    });
  }

  public dispose() {
    this.disposeList.forEach(dispose => dispose());
    this.disposeList = [];
  }
}

export default SelectionPlugin;
