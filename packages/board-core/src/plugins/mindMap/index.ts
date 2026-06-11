import { eBoardContainer } from "../../common/IocContainer";
import { IModeService, IEventService, IModelService, IPluginService } from "../../services";
import { uuid } from "@e-board/board-utils";
import { ITransformService } from "../../services/transformService/type";
import { IBoard, IPluginInitParams } from "../../types";
import { IPlugin } from "../type";
import type { MindMapNode } from "../../elements/mindMap";
import { NODE_SIZE_PRESETS, NODE_STYLE_PRESETS } from "../../elements/mindMap";

const CURRENT_MODE = "mindMap";

const DEFAULT_MIND_MAP_TREE: MindMapNode = {
  id: 'root',
  label: '中心主题',
  ...NODE_SIZE_PRESETS.root,
  style: { ...NODE_STYLE_PRESETS.root },
  children: [
    {
      id: 'child1',
      label: '主题 1',
      ...NODE_SIZE_PRESETS.level1,
      style: { ...NODE_STYLE_PRESETS.level1[0] },
      children: [
        { id: 'child1-1', label: '子主题 1-1', ...NODE_SIZE_PRESETS.level2Plus, style: { ...NODE_STYLE_PRESETS.level2Plus }, isCollapsed: false },
        { id: 'child1-2', label: '子主题 1-2', ...NODE_SIZE_PRESETS.level2Plus, style: { ...NODE_STYLE_PRESETS.level2Plus }, isCollapsed: false },
      ],
    },
    {
      id: 'child2',
      label: '主题 2',
      ...NODE_SIZE_PRESETS.level1,
      style: { ...NODE_STYLE_PRESETS.level1[1] },
      isCollapsed: false
    },
    {
      id: 'child3',
      label: '主题 3',
      ...NODE_SIZE_PRESETS.level1,
      style: { ...NODE_STYLE_PRESETS.level1[2] },
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
