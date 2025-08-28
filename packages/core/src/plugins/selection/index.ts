import { CorePlugins, IBoard, IPluginInitParams } from "../../types";
import { eBoardContainer } from "../../common/IocContainer";
import { IModelService } from "../../services/modelService/type";
import { IPlugin } from "../type";
import { IModeService, IRenderService } from "../../services";
import { ITransformService } from "../../services/transformService/type";

const CURRENT_MODE = "selection";

class SelectionPlugin implements IPlugin {
  private board!: IBoard;
  private disposeList: (() => void)[] = [];
  private pointerDownPoint: { x: number; y: number } | null = null;
  private selectModels = new Set<string>();
  private initialModelPositions = new Map<string, { x: number; y: number }[]>();

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

  private handleElementMove(e: any) {
    this.pointerDownPoint = { x: e.clientX, y: e.clientY };
  }

  private initSelect() {
    const container = this.board.getContainer();
    const canvas = this.board.getInteractionCanvas();
    if (!canvas || !container) return;
    let currentSelectRange: any = null;
    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      this.pointerDownPoint = { x: e.clientX, y: e.clientY };

      if (this.selectModels.size > 0) {
        console.log(this.selectModels);
        this.handleElementMove(e);
        // 保存所有选中模型的初始位置
        const modelService = eBoardContainer.get<IModelService>(IModelService);
        this.initialModelPositions.clear();
        this.selectModels.forEach(id => {
          const model = modelService.getModelById(id);
          if (model?.points) {
            this.initialModelPositions.set(id, [...model.points]);
          }
        });
      } else {
        currentSelectRange = {
          x: this.pointerDownPoint.x,
          y: this.pointerDownPoint.y,
          width: 1,
          height: 1
        };
      }

      container.addEventListener("pointermove", handlePointerMove);
      container.addEventListener("pointerup", handlePointerUp);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!this.pointerDownPoint) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      if (this.selectModels.size > 0) {
        const deltaX = e.clientX - this.pointerDownPoint.x;
        const deltaY = e.clientY - this.pointerDownPoint.y;
        const modelService = eBoardContainer.get<IModelService>(IModelService);
        const renderService = eBoardContainer.get<IRenderService>(IRenderService);
        const transformService = eBoardContainer.get<ITransformService>(ITransformService);
        const x = deltaX / (transformService.getView().zoom || 1);
        const y = deltaY / (transformService.getView().zoom || 1);
        // 基于初始位置和总偏移量更新模型位置
        this.selectModels.forEach(id => {
          const initialPoints = this.initialModelPositions.get(id);
          if (!initialPoints) return;

          const tempModel = modelService.getModelById(id);
          if (!tempModel) return;

          modelService.updateModel(id, {
            ...tempModel,
            points: initialPoints.map(p => ({ x: p.x + x, y: p.y + y }))
          });
        });
        renderService.reRender();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

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

      if (this.selectModels.size > 0) {
        this.pointerDownPoint = null;
        this.selectModels.clear();
        this.initialModelPositions.clear(); // 清空初始位置缓存
        container.removeEventListener("pointermove", handlePointerMove);
        container.removeEventListener("pointerup", handlePointerUp);
        return;
      }

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
          console.log("选中了", model.id);
          this.selectModels.add(model.id);
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
