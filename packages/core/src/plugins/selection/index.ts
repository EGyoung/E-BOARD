import { IBoard, IPluginInitParams } from "../../types";
import { eBoardContainer } from "../../common/IocContainer";
import { IModel, IModelService } from "../../services/modelService/type";
import { IPlugin } from "../type";
import { IModeService, IRenderService } from "../../services";
import { ITransformService } from "../../services/transformService/type";
import { Emitter } from "@e-board/utils";

const CURRENT_MODE = "selection";

class SelectionPlugin implements IPlugin {
  private board!: IBoard;
  private disposeList: (() => void)[] = [];
  private AABbBox: { x: number; y: number; width: number; height: number } | null = null; // 所有的笔画的aabb盒子
  private pointerDownPoint: { x: number; y: number } | null = null;
  private selectModels = new Set<string>();
  private initialModelPositions = new Map<string, { x: number; y: number }[]>();
  private currentSelectRange: { x: number; y: number; width: number; height: number } | null = null;
  private modelService = eBoardContainer.get<IModelService>(IModelService);
  private transformService = eBoardContainer.get<ITransformService>(ITransformService);
  private readonly _onSelectedElements = new Emitter<IModel>();
  private emitSelectedElement = this._onSelectedElements.fire.bind(this._onSelectedElements);
  public onSelectedElements = this._onSelectedElements.event;
  public pluginName = "SelectionPlugin";

  public exports = {
    getSelectedModelsId: this.getSelectedModelsId.bind(this),
    getSelectedModels: this.getSelectedModels.bind(this),
    onSelectedElements: this.onSelectedElements.bind(this)
  };

  public getSelectedModelsId() {
    return Array.from(this.selectModels);
  }

  public getSelectedModels() {
    return this.getSelectedModelsId()
      .map(id => this.modelService.getModelById(id))
      .filter(Boolean);
  }

  public init({ board }: IPluginInitParams) {
    this.board = board;
    const modeService = eBoardContainer.get<IModeService>(IModeService);
    const canvas = this.board.getInteractionCanvas();
    if (!canvas) return;
    // todo 通过roam来监听
    canvas.addEventListener("wheel", e => {
      this.updateAABbBox()
    });

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

  private resetAllState() {
    const canvas = this.board.getInteractionCanvas();
    const ctx = this.board.getInteractionCtx();
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // this.selectModels.clear();
    this.initialModelPositions.clear();
    this.currentSelectRange = null;
  }

  private initSelect() {
    const container = this.board.getContainer();
    const canvas = this.board.getInteractionCanvas();
    const ctx = this.board.getInteractionCtx();

    if (!canvas || !container) return;
    if (!ctx) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      // 判断点是否在AABB盒子内
      if (this.AABbBox) {
        // AABB盒子的坐标已经是经过transform的屏幕坐标，可以直接与clientX/Y比较
        if (
          e.clientX >= this.AABbBox.x &&
          e.clientX <= this.AABbBox.x + this.AABbBox.width &&
          e.clientY >= this.AABbBox.y &&
          e.clientY <= this.AABbBox.y + this.AABbBox.height
        ) {
          // console.log(this.selectModels, 'this.selectModels')
          // 在AABB盒子内，开始拖拽已选模型
          this.pointerDownPoint = { x: e.clientX, y: e.clientY };

          if (this.selectModels.size > 0) {
            // 保存所有选中模型的初始位置
            this.initialModelPositions.clear();
            this.selectModels.forEach(id => {
              const model = this.modelService.getModelById(id);
              if (model?.points) {
                this.initialModelPositions.set(id, [...model.points]);
              }
            });
            container.addEventListener("pointermove", handlePointerMove);
            container.addEventListener("pointerup", handlePointerUp);
            return;
          }
        }
      }
      this.resetAllState();
      this.selectModels.clear()

      this.pointerDownPoint = { x: e.clientX, y: e.clientY };
      const models = this.modelService.getAllModels().reverse();
      let count = 0
      for (const model of models) {
        if (!model) return;
        count++
        const ctrlElement = model.ctrlElement
        if (!ctrlElement) continue;
        const isIntersecting = ctrlElement.isHint({
          point: this.pointerDownPoint,
          model: model,
        })
        const bounding = ctrlElement.getBoundingBox(model)
        if (!bounding) continue;
        const width = bounding.width;
        const height = bounding.height;
        const x = bounding.x;
        const y = bounding.y;

        if (isIntersecting) {
          const ctx = this.board.getInteractionCtx();
          this.addSelectedModels(model.id);
          if (!ctx) return;
          ctx.save();

          ctx.strokeStyle = "white";
          ctx.setLineDash([5, 5]);
          ctx.lineWidth = 2;

          ctx.strokeRect(x, y, width, height);
          ctx.restore();
          break
        }
        // 判断是否最后一个
        if (count === models.length) {
          this.selectModels.clear();
        }
      }

      if (this.selectModels.size > 0) {
        // 保存所有选中模型的初始位置
        this.initialModelPositions.clear();
        this.selectModels.forEach(id => {
          const model = this.modelService.getModelById(id);
          if (model?.points) {
            this.initialModelPositions.set(id, [...model.points]);
          }
        });
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
        const x = deltaX / (this.transformService.getView().zoom || 1);
        const y = deltaY / (this.transformService.getView().zoom || 1);
        // 基于初始位置和总偏移量更新模型位置
        this.selectModels.forEach(id => {
          const initialPoints = this.initialModelPositions.get(id);
          if (!initialPoints) return;

          const tempModel = this.modelService.getModelById(id);
          if (!tempModel) return;

          this.modelService.updateModel(id, {
            ...tempModel,
            points: initialPoints.map(p => ({ x: p.x + x, y: p.y + y }))
          });
        });
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      const width = e.clientX - this.pointerDownPoint.x;
      const height = e.clientY - this.pointerDownPoint.y;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.strokeStyle = "rgba(14, 87, 75, 1)";
      // 虚线
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 2;
      ctx.strokeRect(this.pointerDownPoint.x, this.pointerDownPoint.y, width, height);
      this.currentSelectRange = {
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
        container.removeEventListener("pointermove", handlePointerMove);
        container.removeEventListener("pointerup", handlePointerUp);
        this.selectModels.forEach(id => {
          // 重新渲染外包围
          const model = this.modelService.getModelById(id);
          if (!model) return;
          const bounding = model.ctrlElement?.getBoundingBox(model);

          if (!bounding) return;
          const width = bounding.width;
          const height = bounding.height;
          const x = bounding.x;
          const y = bounding.y;
          const ctx = this.board.getInteractionCtx();
          if (!ctx) return;
          ctx.save();
          ctx.strokeStyle = "white";
          ctx.setLineDash([5, 5]);
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, width, height);
          ctx.restore();
        });
        this.updateAABbBox();
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.pointerDownPoint = null;
      container.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("pointerup", handlePointerUp);

      // 计算所有的包围盒
      const models = this.modelService.getAllModels();
      models.forEach(model => {
        const bounding = model.ctrlElement?.getBoundingBox(model);


        if (!this.currentSelectRange) return;
        const selectRect = {
          x: Math.min(
            this.currentSelectRange.x,
            this.currentSelectRange.x + this.currentSelectRange.width
          ),
          y: Math.min(
            this.currentSelectRange.y,
            this.currentSelectRange.y + this.currentSelectRange.height
          ),
          width: Math.abs(this.currentSelectRange.width),
          height: Math.abs(this.currentSelectRange.height)
        };
        const isIntersecting =
          bounding.minX < selectRect.x + selectRect.width &&
          bounding.maxX > selectRect.x &&
          bounding.minY < selectRect.y + selectRect.height &&
          bounding.maxY > selectRect.y;
        // 判断是否相交
        if (isIntersecting) {
          const ctx = this.board.getInteractionCtx();
          // console.log("选中了", model.id);
          this.addSelectedModels(model.id);
          if (this.selectModels.size > 0) {
            this.updateAABbBox();
          }
          if (!ctx) return;
          ctx.save();

          ctx.strokeStyle = "white";
          ctx.setLineDash([5, 5]);
          ctx.lineWidth = 2;

          ctx.strokeRect(bounding.x, bounding.y, bounding.width, bounding.height);
          ctx.restore();
        }
      });
    };

    container.addEventListener("pointerdown", handlePointerDown);

    this.disposeList.push(() => {
      container.removeEventListener("pointerdown", handlePointerDown);
    });


  }

  public addSelectedModels(id: string) {
    if (!this.selectModels.has(id)) {
      this.selectModels.add(id);
      const model = this.modelService.getModelById(id);
      if (model) {
        this.emitSelectedElement(model);
      }
    }

  }

  private updateAABbBox() {
    // const zoom = this.transformService.getView().zoom || 1;
    const boxes = Array.from(this.selectModels)
      .map(id => {
        const model = this.modelService.getModelById(id);
        if (!model) return null;
        const bounding = model.ctrlElement?.getBoundingBox(model);
        return bounding;
      })
      .filter(Boolean);

    if (boxes.length === 0) {
      this.AABbBox = null;
      return;
    }

    let minX = Math.min(...boxes.map(box => box!.minX));
    let minY = Math.min(...boxes.map(box => box!.minY));
    let maxX = Math.max(...boxes.map(box => box!.maxX));
    let maxY = Math.max(...boxes.map(box => box!.maxY));
    this.AABbBox = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
    // 绘制AABB盒子
    const ctx = this.board.getInteractionCtx();
    const canvas = this.board.getInteractionCanvas();
    if (!ctx || !canvas) return;
    ctx.save();
    ctx.strokeStyle = "pink";
    ctx.setLineDash([10, 5]);
    ctx.lineWidth = 2;
    ctx.strokeRect(this.AABbBox.x, this.AABbBox.y, this.AABbBox.width, this.AABbBox.height);
    ctx.restore();
  }

  public dispose() {
    this.disposeList.forEach(dispose => dispose());
    this.disposeList = [];
  }

}

export default SelectionPlugin;
