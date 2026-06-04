import { eBoardContainer } from "../../common/IocContainer";
import { IModeService, IEventService, IModelService } from "../../services";
import { uuid } from "@e-board/board-utils";
import { ITransformService } from "../../services/transformService/type";
import { IBoard, IPluginInitParams } from "../../types";
import { IPlugin } from "../type";
import type { MindMapNode } from "../../elements/mindMap";

const CURRENT_MODE = "mindMap";

const DEFAULT_MIND_MAP_TREE: MindMapNode = {
  id: 'root',
  label: '中心主题',
  width: 120,
  height: 50,
  style: { fillStyle: '#FF6B6B' },
  children: [
    {
      id: 'child1',
      label: '主题 1',
      width: 100,
      height: 40,
      style: { fillStyle: '#4ECDC4' },
      children: [
        { id: 'child1-1', label: '子主题 1-1', width: 90, height: 36, style: { fillStyle: '#95E1D3' } },
        { id: 'child1-2', label: '子主题 1-2', width: 90, height: 36, style: { fillStyle: '#95E1D3' } },
      ],
    },
    {
      id: 'child2',
      label: '主题 2',
      width: 100,
      height: 40,
      style: { fillStyle: '#45B7D1' },
    },
    {
      id: 'child3',
      label: '主题 3',
      width: 100,
      height: 40,
      style: { fillStyle: '#96CEB4' },
    },
  ],
};

class MindMapPlugin implements IPlugin {
  private board!: IBoard;
  private disposeList: (() => void)[] = [];

  private transformService = eBoardContainer.get<ITransformService>(ITransformService);
  private modelService = eBoardContainer.get<IModelService>(IModelService);

  public pluginName = "MindMapPlugin";
  public dependencies = [];

  public init({ board }: IPluginInitParams) {
    this.board = board;
    this.initMindMapMode();
  }

  private initMindMapMode() {
    const modeService = eBoardContainer.get<IModeService>(IModeService);
    modeService.registerMode(CURRENT_MODE, {
      beforeSwitchMode: ({ currentMode }) => {
        if (currentMode === CURRENT_MODE) {
          this.disposeList.forEach(dispose => dispose());
          this.disposeList = [];
        }
      },
      afterSwitchMode: ({ currentMode }) => {
        if (currentMode === CURRENT_MODE) {
          const eventService = eBoardContainer.get<IEventService>(IEventService);

          const canvas = this.board.getCanvas();
          if (canvas) {
            const onPointerDown = (e: PointerEvent) => {
              try {
                const rect = canvas.getBoundingClientRect();
                const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
                const worldPoint = this.transformService.transformPoint(screenPoint, true);

                this.modelService.createModel('mindMap', {
                  ...DEFAULT_MIND_MAP_TREE,
                  id: uuid(),
                  points: [worldPoint],
                })
              } catch (err) {
                // swallow any errors from click handler
                // console.warn(err);
              }
            };

            const { dispose } = eventService.onPointerDown(onPointerDown)
            this.disposeList.push(() => dispose());
          }
        }
      },
    });
  }



  public dispose() {
    this.disposeList.forEach(dispose => dispose());
  }
}

export default MindMapPlugin;
