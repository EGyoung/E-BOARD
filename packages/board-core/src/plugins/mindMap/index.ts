import { eBoardContainer } from "../../common/IocContainer";
import { IModeService, IEventService, IModelService, IPluginService } from "../../services";
import { uuid } from "@e-board/board-utils";
import { ITransformService } from "../../services/transformService/type";
import { IBoard, IPluginInitParams } from "../../types";
import { IPlugin } from "../type";
import type { MindMapNode } from "../../elements/mindMap";

const CURRENT_MODE = "mindMap";

const DEFAULT_MIND_MAP_TREE: MindMapNode = {
  id: 'root',
  label: '中心主题',
  width: 140,
  height: 54,
  style: {
    fillStyle: '#4A90D9',
    strokeStyle: '#3A7BC8',
    textColor: '#FFFFFF',
    fontSize: 16,
    borderRadius: 12,
  },
  children: [
    {
      id: 'child1',
      label: '主题 1',
      width: 110,
      height: 42,
      style: { fillStyle: '#5CC9C1', strokeStyle: '#4AB8B0', textColor: '#FFFFFF', fontSize: 14, borderRadius: 10 },
      children: [
        { id: 'child1-1', label: '子主题 1-1', width: 96, height: 36, style: { fillStyle: '#A8E6CF', strokeStyle: '#8DD4B5', textColor: '#2D5A3D', fontSize: 12, borderRadius: 8 }, isCollapsed: false },
        { id: 'child1-2', label: '子主题 1-2', width: 96, height: 36, style: { fillStyle: '#A8E6CF', strokeStyle: '#8DD4B5', textColor: '#2D5A3D', fontSize: 12, borderRadius: 8 }, isCollapsed: false },
      ],
    },
    {
      id: 'child2',
      label: '主题 2',
      width: 110,
      height: 42,
      style: { fillStyle: '#F5A623', strokeStyle: '#E09515', textColor: '#FFFFFF', fontSize: 14, borderRadius: 10 },
      isCollapsed: false
    },
    {
      id: 'child3',
      label: '主题 3',
      width: 110,
      height: 42,
      style: { fillStyle: '#B8A9D4', strokeStyle: '#A394C4', textColor: '#FFFFFF', fontSize: 14, borderRadius: 10 },
      isCollapsed: false
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

                const model = this.modelService.createModel('mindMap', {
                  ...DEFAULT_MIND_MAP_TREE,
                  id: uuid(),
                  points: [worldPoint],
                });

                // 创建完成后切换到选中态，显示底部工具栏
                const modeService = eBoardContainer.get<IModeService>(IModeService);
                modeService.switchMode('selection');

                const pluginService = eBoardContainer.get<IPluginService>(IPluginService);
                const selectionPlugin = pluginService.getPlugin('SelectionPlugin');
                selectionPlugin?.exports?.addSelectedModels?.(model.id);
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
