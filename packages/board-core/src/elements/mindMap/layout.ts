import { MindMapNode, MindMapLayoutNode, MindMapLayoutOptions } from './types';

/** 默认布局参数 */
export const DEFAULT_OPTIONS = {
  startX: 300,
  startY: 300,
  hGap: 80,
  vGap: 30,
} as const;

/**
 * 计算节点的子树总高度（递归）
 * - 叶子节点：返回自身高度
 * - 单子节点：递归进入
 * - 多子节点：累加各子树高度 + 间距，与自身高度取较大值
 */
export function getSubtreeHeight(node: MindMapNode, vGap: number): number {
  if (!node.children || node.children.length === 0 || node.isCollapsed) {
    return node.height;
  }

  if (node.children.length === 1) {
    return getSubtreeHeight(node.children[0], vGap);
  }

  let total = 0;
  for (const child of node.children) {
    total += getSubtreeHeight(child, vGap);
  }
  total += vGap * (node.children.length - 1);

  return Math.max(node.height, total);
}

/**
 * 核心布局算法：给定树根 + 参数，返回带坐标的布局树
 *
 * 布局规则：
 * 1. 每个子节点分配一个「区域」，高度 = 该子节点的子树高度
 * 2. 子节点在其区域内垂直居中
 * 3. 所有子节点区域 + 间距 = 子区块总高度
 * 4. 子区块相对于父节点垂直居中
 */
export function layoutMindMap(
  node: MindMapNode,
  options: MindMapLayoutOptions = {},
): MindMapLayoutNode {
  const startX = options.startX ?? 0;
  const startY = options.startY ?? 0;
  const hGap = options.hGap ?? DEFAULT_OPTIONS.hGap;
  const vGap = options.vGap ?? DEFAULT_OPTIONS.vGap;

  function layout(n: MindMapNode, x: number, y: number): MindMapLayoutNode {
    const result: MindMapLayoutNode = {
      id: n.id,
      x,
      y,
      width: n.width,
      height: n.height,
      style: n.style,
      label: n.label,
      isCollapsed: n.isCollapsed,
    };

    if (!n.children || n.children.length === 0 || n.isCollapsed) {
      return result;
    }

    // 1. 每个子节点的子树高度
    const subtreeHeights = n.children.map((c) => getSubtreeHeight(c, vGap));

    // 2. 子节点区块总高度
    const totalChildrenH = subtreeHeights.reduce((a, b) => a + b, 0);
    const blockHeight = totalChildrenH + vGap * (n.children.length - 1);

    // 3. 子区块顶部（相对于父节点垂直居中）
    const blockTop = y + (n.height - blockHeight) / 2;

    // 4. 逐个分配区域：子节点在区域内居中
    let regionCursor = blockTop;
    const childX = x + hGap + n.width;

    result.children = n.children.map((child, i) => {
      const regionH = subtreeHeights[i];
      const childY = regionCursor + (regionH - child.height) / 2;

      const childResult = layout(child, childX, childY);

      regionCursor += regionH + vGap;
      return childResult;
    });

    return result;
  }

  return layout(node, startX, startY);
}

/**
 * 将布局树拍平为一维数组（方便遍历渲染）
 */
export function flattenLayout(root: MindMapLayoutNode): MindMapLayoutNode[] {
  const result: MindMapLayoutNode[] = [root];
  if (root.children) {
    for (const child of root.children) {
      result.push(...flattenLayout(child));
    }
  }
  return result;
}


export const findNodeById = (root: MindMapLayoutNode, id: string) => {
  if (root.id === id) return root

  if (root.children) {
    for (const child of root.children) {
      const found = findNodeById(child, id) as MindMapLayoutNode | null;
      if (found) return found;
    }
  }
  return null;
};
