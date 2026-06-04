import { IElement } from "../../services";
import { MindMapCtrlElement } from "./ctrlElement";
import { Render } from "./render";
import SaveInfoProvider from "./saveInfoProvider";
import { IMindMapModel } from "./types";

// ========== IElement 定义 ==========
const mindMapElement = {
    type: "mindMap",
    ctrlElement: MindMapCtrlElement,
    saveInfoProvider: SaveInfoProvider,
    render: Render,
} satisfies IElement<IMindMapModel>;

export default mindMapElement;

// ========== 布局 & 渲染工具函数 ==========
export type { MindMapNode, MindMapNodeStyle, MindMapLayoutNode, MindMapLayoutOptions, IMindMapModel } from './types';
