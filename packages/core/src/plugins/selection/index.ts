import { IBoard, IPluginInitParams } from "../../types";
import { eBoardContainer } from "../../common/IocContainer";
import { IModelService } from "../../services/modelService/type";
import { IPlugin } from "../type";
import { IModeService } from "../../services";
import { ITransformService } from "../../services/transformService/type";

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
    let currentSelectRange: any = null;
    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      this.pointerDownPoint = { x: e.clientX, y: e.clientY };
      currentSelectRange = {
        x: this.pointerDownPoint.x,
        y: this.pointerDownPoint.y,
        width: 1,
        height: 1
      };
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
      ctx.save();
      ctx.strokeStyle = "pink";
      // 虚线
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 2;
      ctx.strokeRect(this.pointerDownPoint.x, this.pointerDownPoint.y, width, height);
      currentSelectRange = {
        x: this.pointerDownPoint.x,
        y: this.pointerDownPoint.y,
        width: width || 1,
        height: height || 1
      };
      ctx.restore();
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!this.pointerDownPoint) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.pointerDownPoint = null;
      container.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("pointerup", handlePointerUp);

      // 计算所有的包围盒
      const modelService = eBoardContainer.get<IModelService>(IModelService);
      const transformService = eBoardContainer.get<ITransformService>(ITransformService);
      const models = modelService.getAllModels();
      const zoom = transformService.getView().zoom || 1;
      models.forEach(model => {
        const box = this.calculateBBox(
          model.points?.map(p => transformService.transformPoint(p)) || [],
          zoom * (model.options?.lineWidth || 0)
        );
        if (!box) return;
        const width = box.maxX - box.minX;
        const height = box.maxY - box.minY;

        if (!currentSelectRange) return;
        const selectRect = {
          x: Math.min(currentSelectRange.x, currentSelectRange.x + currentSelectRange.width),
          y: Math.min(currentSelectRange.y, currentSelectRange.y + currentSelectRange.height),
          width: Math.abs(currentSelectRange.width),
          height: Math.abs(currentSelectRange.height)
        };
        const isIntersecting =
          box.minX < selectRect.x + selectRect.width &&
          box.maxX > selectRect.x &&
          box.minY < selectRect.y + selectRect.height &&
          box.maxY > selectRect.y;
        // 判断是否相交
        if (isIntersecting) {
          const ctx = this.board.getInteractionCtx();
          if (!ctx) return;
          ctx.save();

          ctx.strokeStyle = "blue";
          ctx.setLineDash([5, 5]);
          ctx.lineWidth = 2;

          ctx.strokeRect(box.minX, box.minY, width, height);
          ctx.restore();
        }
      });
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

  private calculateBBox(points: { x: number; y: number }[], padding = 0) {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    if (points.length === 0) return null;
    points.forEach(p => {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    });
    return {
      minX: minX - padding,
      minY: minY - padding,
      maxX: maxX + padding,
      maxY: maxY + padding
    };
  }
}

export default SelectionPlugin;
