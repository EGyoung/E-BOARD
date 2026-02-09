import { HotkeyConfig } from "./index";
import { eBoardContainer } from "../../common/IocContainer";
import { IHistoryService, IModelService, IPluginService, } from "../../services";

/**
 * 判断是否为 Mac 系统
 */
const isMac = (): boolean => {
    return /Mac|iPod|iPhone|iPad/.test(navigator.platform);
};

/**
 * 删除选中的模型
 */
const deleteSelectedModels = () => {
    const pluginService = eBoardContainer.get<IPluginService>(IPluginService);
    const modelService = eBoardContainer.get<IModelService>(IModelService);
    const selectionPlugin = pluginService.getPlugin('SelectionPlugin');

    if (!selectionPlugin?.exports?.getSelectedModels) return;

    const selectedModels = selectionPlugin.exports.getSelectedModels();
    if (selectedModels.length === 0) {
        console.log('没有选中的元素');
        return;
    }

    selectedModels.forEach((model: any) => {
        modelService.deleteModel(model.id);
    });

    console.log(`已删除 ${selectedModels.length} 个元素`);
};

/**
 * 获取默认快捷键配置
 */
export const getDefaultHotkeys = (clipboard: any[], board: any): HotkeyConfig[] => {
    const historyService = eBoardContainer.get<IHistoryService>(IHistoryService);
    const modelService = eBoardContainer.get<IModelService>(IModelService);
    const pluginService = eBoardContainer.get<IPluginService>(IPluginService);

    return [
        // 撤销
        {
            key: 'z',
            ctrl: !isMac(),
            meta: isMac(),
            handler: () => {
                const success = historyService.undo();
                console.log(success ? '撤销成功' : '无可撤销的操作');
            },
            description: '撤销'
        },

        // 重做 (Ctrl+Shift+Z / Command+Shift+Z)
        {
            key: 'z',
            ctrl: !isMac(),
            meta: isMac(),
            shift: true,
            handler: () => {
                const success = historyService.redo();
                console.log(success ? '重做成功' : '无可重做的操作');
            },
            description: '重做'
        },

        // 重做 (Ctrl+Y / Command+Y - Windows 习惯)
        {
            key: 'y',
            ctrl: !isMac(),
            meta: isMac(),
            handler: () => {
                const success = historyService.redo();
                console.log(success ? '重做成功' : '无可重做的操作');
            },
            description: '重做'
        },

        // 复制
        {
            key: 'c',
            ctrl: !isMac(),
            meta: isMac(),
            handler: () => {
                const selectionPlugin = pluginService.getPlugin('SelectionPlugin');
                if (!selectionPlugin?.exports?.getSelectedModels) return;

                const selectedModels = selectionPlugin.exports.getSelectedModels();
                if (selectedModels.length === 0) {
                    console.log('没有选中的元素');
                    return;
                }

                // 清空并重新赋值剪贴板
                clipboard.length = 0;
                clipboard.push(...selectedModels.map((model: any) => ({ ...model })));
                console.log(`已复制 ${selectedModels.length} 个元素`);
            },
            description: '复制选中元素'
        },

        // 剪切
        {
            key: 'x',
            ctrl: !isMac(),
            meta: isMac(),
            handler: () => {
                const selectionPlugin = pluginService.getPlugin('SelectionPlugin');
                if (!selectionPlugin?.exports?.getSelectedModels) return;

                const selectedModels = selectionPlugin.exports.getSelectedModels();
                if (selectedModels.length === 0) {
                    console.log('没有选中的元素');
                    return;
                }

                // 复制到剪贴板
                clipboard.length = 0;
                clipboard.push(...selectedModels.map((model: any) => ({ ...model })));

                // 删除选中的模型
                selectedModels.forEach((model: any) => {
                    modelService.deleteModel(model.id);
                });

                console.log(`已剪切 ${selectedModels.length} 个元素`);
            },
            description: '剪切选中元素'
        },

        // 粘贴
        {
            key: 'v',
            ctrl: !isMac(),
            meta: isMac(),
            handler: () => {
                if (!clipboard || clipboard.length === 0) {
                    console.log('剪贴板为空');
                    return;
                }

                // 粘贴时稍微偏移位置，避免完全重叠
                const offset = 20;
                clipboard.forEach((model: any) => {
                    const newModel = {
                        ...model,
                        points: model.points?.map((p: any) => ({ x: p.x + offset, y: p.y + offset }))
                    };
                    delete newModel.id; // 删除 id，让系统自动生成新 id
                    modelService.createModel(newModel.type, newModel);
                });

                console.log(`已粘贴 ${clipboard.length} 个元素`);
            },
            description: '粘贴'
        },

        // 删除 (Delete 键)
        {
            key: 'Delete',
            handler: () => {
                deleteSelectedModels();
            },
            description: '删除选中元素'
        },

        // 删除 (Backspace 键)
        {
            key: 'Backspace',
            handler: () => {
                deleteSelectedModels();
            },
            description: '删除选中元素'
        },

        // 全选
        {
            key: 'a',
            ctrl: !isMac(),
            meta: isMac(),
            handler: () => {
                const selectionPlugin = pluginService.getPlugin('SelectionPlugin');
                const allModels = modelService.getAllModels();

                if (!selectionPlugin?.exports?.addSelectedModels) return;

                allModels.forEach((model: any) => {
                    selectionPlugin.exports.addSelectedModels(model.id);
                });

                console.log(`已选中所有 ${allModels.length} 个元素`);
            },
            description: '全选'
        },

        // 取消选择
        {
            key: 'Escape',
            handler: () => {
                const selectionPlugin = pluginService.getPlugin('SelectionPlugin');
                if (!selectionPlugin) return;

                // 清空选择
                const ctx = board.getInteractionCtx();
                const canvas = board.getInteractionCanvas();
                if (ctx && canvas) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                }

                console.log('已取消选择');
            },
            description: '取消选择',
            preventDefault: false // 不阻止默认行为，允许其他插件处理
        }
    ];
};
