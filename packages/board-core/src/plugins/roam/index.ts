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
    zoom: 1
  };

  public pluginName = "RoamPlugin";

  public init({ board }: IPluginInitParams) {
    this.board = board;
    this.initRoam();
  }

  public initRoam = () => {
    const canvas = this.board.getInteractionCanvas();
    if (!canvas) return;
    const ctx = this.board.getInteractionCtx();
    if (!ctx) return;
    const transformService = eBoardContainer.get<ITransformService>(ITransformService);

    // 同步初始视图状态
    this.view = transformService.getView();

    canvas.addEventListener("wheel", e => {
      e.preventDefault();
      // Mac触摸板 "捏合" 手势会触发带有 ctrlKey 的 wheel 事件
      if (e.ctrlKey) {
        const zoomFactor = 1.1;

        // 获取鼠标相对于 canvas 的坐标
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // 计算缩放前鼠标在世界坐标系中的位置
        // 根据 TransformService 的公式：screenX = (worldX - offsetX) * zoom
        // 反推：worldX = screenX / zoom + offsetX
        const mouseWorldX = mouseX / this.view.zoom + this.view.x;
        const mouseWorldY = mouseY / this.view.zoom + this.view.y;

        // 执行缩放
        if (e.deltaY < 0) {
          this.view.zoom *= zoomFactor;
        } else {
          this.view.zoom /= zoomFactor;
        }

        // 限制最小和最大缩放
        this.view.zoom = Math.max(0.1, Math.min(this.view.zoom, 20));

        // 调整视图位置，使鼠标指向的世界坐标点在屏幕上保持不变
        // 根据公式：screenX = (worldX - offsetX) * zoom
        // 反推：offsetX = worldX - screenX / zoom
        this.view.x = mouseWorldX - mouseX / this.view.zoom;
        this.view.y = mouseWorldY - mouseY / this.view.zoom;
      } else {
        const { deltaX, deltaY } = e;
        // 平移：将屏幕坐标的移动转换为世界坐标的移动
        this.view.x += deltaX / this.view.zoom;
        this.view.y += deltaY / this.view.zoom;
      }
      transformService.setView(this.view);
    });
  };

  public dispose() {
    this.disposeList.forEach(dispose => dispose());
  }
}

export default RoamPlugin;
