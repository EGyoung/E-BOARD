/** 模型数据（存储于 model.options 和 model 顶层字段） */
export type IMindMapModel = {
  width: number;
  height: number;
};

/** 单个节点样式 */
export interface MindMapNodeStyle {
  fillStyle?: string;
  strokeStyle?: string;
  textColor?: string;
  fontSize?: number;
  borderRadius?: number;
}

/** 思维导图节点配置（树形结构，通过 children 嵌套） */
export interface MindMapNode {
  id: string;
  label?: string;
  width: number;
  height: number;
  style?: MindMapNodeStyle;
  children?: MindMapNode[];
  isCollapsed?: boolean; // 是否折叠子节点
}

/** 布局计算后的单个节点（含坐标，保持树形结构） */
export interface MindMapLayoutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  style?: MindMapNodeStyle;
  label?: string;
  children?: MindMapLayoutNode[];
}

/** 布局参数 */
export interface MindMapLayoutOptions {
  /** 起始 X 坐标，默认 300 */
  startX?: number;
  /** 起始 Y 坐标，默认 300 */
  startY?: number;
  /** 父子节点水平间距，默认 80 */
  hGap?: number;
  /** 兄弟节点垂直间距，默认 30 */
  vGap?: number;
}
