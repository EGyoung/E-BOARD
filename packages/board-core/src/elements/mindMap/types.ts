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

/** 按层级的节点预设尺寸 */
export const NODE_SIZE_PRESETS = {
  /** 根节点（深度 0） */
  root: { width: 140, height: 54 },
  /** 一级子节点（深度 1） */
  level1: { width: 110, height: 42 },
  /** 二级及更深节点（深度 >= 2） */
  level2Plus: { width: 96, height: 36 },
} as const;

/** 按层级的节点预设样式（不含尺寸） */
export const NODE_STYLE_PRESETS = {
  root: {
    fillStyle: '#4A90D9',
    strokeStyle: '#3A7BC8',
    textColor: '#FFFFFF',
    fontSize: 16,
    borderRadius: 12,
  },
  level1: [
    { fillStyle: '#5CC9C1', strokeStyle: '#4AB8B0', textColor: '#FFFFFF', fontSize: 14, borderRadius: 10 },
    { fillStyle: '#F5A623', strokeStyle: '#E09515', textColor: '#FFFFFF', fontSize: 14, borderRadius: 10 },
    { fillStyle: '#B8A9D4', strokeStyle: '#A394C4', textColor: '#FFFFFF', fontSize: 14, borderRadius: 10 },
  ],
  level2Plus: {
    fillStyle: '#A8E6CF',
    strokeStyle: '#8DD4B5',
    textColor: '#2D5A3D',
    fontSize: 12,
    borderRadius: 8,
  },
} as const;

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
  isCollapsed?: boolean;
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
