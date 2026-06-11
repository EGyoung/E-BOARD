import { IModel } from "../../../services/modelService/type";
import { flattenLayout, layoutMindMap, getNodeDepth, findNodeById } from "../layout";
import { NODE_SIZE_PRESETS, NODE_STYLE_PRESETS } from "../types";
import { IMindMapModel } from "../types";

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------
export const COLLAPSE_BTN_RADIUS = 8;
const COLLAPSE_BTN_BORDER = "#C4D0E0";
const COLLAPSE_BTN_FILL = "#F5F7FA";
const COLLAPSE_BTN_SYMBOL = "#7B8BA3";

const BTN_GAP = 6;
const BTN_SPACING = 20;
const ADD_BTN_SIZE = 22; // DOM 按钮的基准尺寸（px，在 zoom=1 时）

export const BTN_HOVER_EXTEND = BTN_GAP + COLLAPSE_BTN_RADIUS + BTN_SPACING + ADD_BTN_SIZE / 2;

// ---------------------------------------------------------------------------
// 工具：计算按钮的屏幕坐标偏移量（世界坐标，未乘 zoom）
// ---------------------------------------------------------------------------
function getAddBtnOffset(hasCollapseBtn: boolean): number {
  return hasCollapseBtn
    ? BTN_GAP + COLLAPSE_BTN_RADIUS + BTN_SPACING + ADD_BTN_SIZE / 2
    : BTN_GAP + ADD_BTN_SIZE / 2;
}

function getCollapseBtnOffset(): number {
  return BTN_GAP + COLLAPSE_BTN_RADIUS;
}

// ---------------------------------------------------------------------------
// 纯绘制函数（Canvas）
// ---------------------------------------------------------------------------

export function renderCollapseButton(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  zoom: number,
  isCollapsed: boolean,
): void {
  const r = COLLAPSE_BTN_RADIUS * zoom;
  const lineW = 1.5 * zoom;
  const symbolLen = 5 * zoom;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = COLLAPSE_BTN_FILL;
  ctx.fill();
  ctx.lineWidth = lineW;
  ctx.strokeStyle = COLLAPSE_BTN_BORDER;
  ctx.stroke();
  ctx.restore();

  // 横线（展开 = "−"）
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - symbolLen, cy);
  ctx.lineTo(cx + symbolLen, cy);
  ctx.strokeStyle = COLLAPSE_BTN_SYMBOL;
  ctx.lineWidth = lineW;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.restore();

  // 折叠时加竖线 = "+"
  if (isCollapsed) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy - symbolLen);
    ctx.lineTo(cx, cy + symbolLen);
    ctx.strokeStyle = COLLAPSE_BTN_SYMBOL;
    ctx.lineWidth = lineW;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.restore();
  }
}

export function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// 树操作：不可变更新（结构共享）
// ---------------------------------------------------------------------------
export function updateTreeNode(
  root: Record<string, any>,
  targetId: string,
  updater: (node: Record<string, any>) => Record<string, any>,
): Record<string, any> {
  if (root.id === targetId) {
    return updater(root);
  }
  if (root.children) {
    const newChildren = root.children.map((child: Record<string, any>) =>
      updateTreeNode(child, targetId, updater),
    );
    if (newChildren.some((c: Record<string, any>, i: number) => c !== root.children[i])) {
      return { ...root, children: newChildren };
    }
  }
  return root;
}

// ---------------------------------------------------------------------------
// 交互处理器
// ---------------------------------------------------------------------------

export interface InteractionServices {
  transformService: {
    getView: () => { zoom: number };
    transformPoint: (point: { x: number; y: number }, inverse?: boolean) => { x: number; y: number };
  };
  eventService: {
    onPointerDown: (cb: (e: PointerEvent) => void) => { dispose: () => void };
    onPointerMove: (cb: (e: PointerEvent) => void) => { dispose: () => void };
  };
  modelService: {
    updateModel: (id: string, updates: any) => any;
  };
  renderService: {
    onRenderEnd: (cb: () => void) => { dispose: () => void };
  };
  board: {
    getContainer: () => HTMLElement | null;
    getInteractionCanvas: () => HTMLCanvasElement | null;
  };
}

export class InteractionHandler {
  private clickDispose: (() => void) | null = null;
  private hoverDispose: (() => void) | null = null;
  private hoveredNodeId: string | null = null;

  /** DOM add 按钮（hover 时显示，点击添加子节点） */
  private addBtnEl: HTMLButtonElement | null = null;

  /** 由 Render 在每次 render() 调用时注入 */
  public currentModel: IModel<IMindMapModel> | null = null;

  constructor(private s: InteractionServices) { }

  // -- 坐标转换 --------------------------------------------------
  private transformPoint(point: { x: number; y: number }, inverse = false) {
    return this.s.transformService.transformPoint(point, inverse);
  }

  // -- DOM add 按钮 ----------------------------------------------

  /** 懒创建 DOM add 按钮元素 */
  private getOrCreateAddBtn(): HTMLButtonElement {
    if (this.addBtnEl) return this.addBtnEl;

    const container = this.s.board.getContainer();
    if (!container) throw new Error('container not found');

    const btn = document.createElement('button');
    btn.className = 'mindmap-add-btn';
    btn.innerHTML = `
      <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none"
           xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="11" fill="#EDF2FB" stroke="#4A90D9" stroke-width="1.5"/>
        <line x1="8" y1="12" x2="16" y2="12" stroke="#4A90D9" stroke-width="2" stroke-linecap="round"/>
        <line x1="12" y1="8" x2="12" y2="16" stroke="#4A90D9" stroke-width="2" stroke-linecap="round"/>
      </svg>`;
    Object.assign(btn.style, {
      position: 'absolute',
      display: 'none',
      width: ADD_BTN_SIZE + 'px',
      height: ADD_BTN_SIZE + 'px',
      padding: '0',
      border: 'none',
      background: 'transparent',
      cursor: 'pointer',
      zIndex: '10',
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'auto',
    });

    btn.addEventListener('pointerdown', (e) => {
      // e.stopPropagation();
      if (this.hoveredNodeId) {
        this.addChildNode(this.hoveredNodeId);
      }
    });

    // 防止按钮上的 pointer 事件干扰 canvas hover 检测
    btn.addEventListener('pointerdown', (e) => e.stopPropagation());

    container.appendChild(btn);
    this.addBtnEl = btn;
    return btn;
  }

  /** 更新 DOM add 按钮的位置和可见性 */
  private updateAddButton(): void {
    const btn = this.getOrCreateAddBtn();

    if (!this.hoveredNodeId) {
      btn.style.display = 'none';
      return;
    }

    const model = this.currentModel;
    if (!model?.points) {
      btn.style.display = 'none';
      return;
    }

    const [root] = model.points!;
    const zoom = this.s.transformService.getView().zoom;
    const layout = layoutMindMap(model);
    const nodes = flattenLayout(layout);
    const node = nodes.find(n => n.id === this.hoveredNodeId);
    if (!node) {
      btn.style.display = 'none';
      return;
    }

    // 世界坐标 → 屏幕坐标
    const screenPos = this.transformPoint({
      x: root.x + node.x + node.width,
      y: root.y + node.y + node.height / 2,
    });

    const hasChildren = !!(node.children && node.children.length > 0);
    const offset = getAddBtnOffset(hasChildren || !!node.isCollapsed) * zoom;

    // 屏幕坐标 + canvas 在页面中的偏移 → 相对于 container 的坐标
    const canvas = this.s.board.getInteractionCanvas();
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();
    const container = this.s.board.getContainer();
    const containerRect = container?.getBoundingClientRect();
    const containerLeft = containerRect?.left ?? 0;
    const containerTop = containerRect?.top ?? 0;
    const left = screenPos.x + offset + canvasRect.left - containerLeft;
    const top = screenPos.y + canvasRect.top - containerTop;

    btn.style.display = '';
    btn.style.left = left + 'px';
    btn.style.top = top + 'px';
    btn.style.width = ADD_BTN_SIZE * zoom + 'px';
    btn.style.height = ADD_BTN_SIZE * zoom + 'px';
  }

  /** 移除 DOM add 按钮 */
  private removeAddButton(): void {
    if (this.addBtnEl) {
      this.addBtnEl.remove();
      this.addBtnEl = null;
    }
  }

  // -- 公开 API --------------------------------------------------

  public getHoveredNodeId(): string | null {
    return this.hoveredNodeId;
  }

  /** 销毁所有监听器和 DOM 元素 */
  public dispose(): void {
    this.clickDispose?.();
    this.hoverDispose?.();
    this.removeAddButton();
  }

  // -- Canvas 点击检测（折叠按钮 + fallback for add 按钮）-------

  public ensureClickListener(): void {
    if (this.clickDispose) return;

    const { dispose } = this.s.eventService.onPointerDown((event) => {
      const model = this.currentModel;
      if (!model?.points) return;

      const canvas = this.s.board.getInteractionCanvas();
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const eventX = event.clientX - rect.left;
      const eventY = event.clientY - rect.top;

      const [root] = model.points!;
      const layout = layoutMindMap(model);
      const nodes = flattenLayout(layout);
      const actualZoom = this.s.transformService.getView().zoom;

      for (const node of nodes) {
        const hasChildren = !!(node.children && node.children.length > 0);
        const isCollapsed = !!node.isCollapsed;

        // 折叠按钮 hit test
        if (hasChildren || isCollapsed) {
          const offset = getCollapseBtnOffset();
          const btnWorldX = root.x + node.x + node.width + offset;
          const btnWorldY = root.y + node.y + node.height / 2;
          const screen = this.transformPoint({ x: btnWorldX, y: btnWorldY });
          const r = COLLAPSE_BTN_RADIUS * actualZoom;
          const dx = eventX - screen.x;
          const dy = eventY - screen.y;
          if (dx * dx + dy * dy <= r * r) {
            this.toggleCollapse(node.id);
            return;
          }
        }
      }
    });

    this.clickDispose = dispose;
  }

  // -- hover 检测 ------------------------------------------------

  public ensureHoverListener(): void {
    if (this.hoverDispose) return;

    // 视图变化时更新按钮位置（pan/zoom 会改变屏幕坐标）
    const { dispose: renderDispose } = this.s.renderService.onRenderEnd(() => {
      this.updateAddButton();
    });

    const { dispose: moveDispose } = this.s.eventService.onPointerMove((event) => {
      const model = this.currentModel;
      if (!model?.points) return;

      const canvas = this.s.board.getInteractionCanvas();
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const eventX = event.clientX - rect.left;
      const eventY = event.clientY - rect.top;

      const [root] = model.points!;
      const zoom = this.s.transformService.getView().zoom;
      const layout = layoutMindMap(model);
      const nodes = flattenLayout(layout);

      let newHoveredId: string | null = null;

      for (let i = nodes.length - 1; i >= 0; i--) {
        const node = nodes[i];
        const screenPos = this.transformPoint({
          x: root.x + node.x,
          y: root.y + node.y,
        });
        const hoverRight = screenPos.x + node.width * zoom + BTN_HOVER_EXTEND * zoom;

        if (
          eventX >= screenPos.x &&
          eventX <= hoverRight &&
          eventY >= screenPos.y &&
          eventY <= screenPos.y + node.height * zoom
        ) {
          newHoveredId = node.id;
          break;
        }
      }

      if (newHoveredId !== this.hoveredNodeId) {
        this.hoveredNodeId = newHoveredId;
        this.updateAddButton();
      }
    });

    this.hoverDispose = () => {
      renderDispose();
      moveDispose();
    };
  }

  // -- 模型变更 --------------------------------------------------

  private toggleCollapse(id: string): void {
    if (!this.currentModel) return;

    const updated = updateTreeNode(
      this.currentModel as any,
      id,
      (node) => ({ ...node, isCollapsed: !node.isCollapsed }),
    );

    this.s.modelService.updateModel(this.currentModel.id, updated);
  }

  private addChildNode(id: string): void {
    if (!this.currentModel) return;

    // 计算父节点深度，应用对应层级样式
    const depth = getNodeDepth(this.currentModel as any, id);
    const isLevel1 = depth === 0; // 父是根节点 → 新节点为 Level 1

    // Level 1：按已有子节点数轮换颜色
    const parentNode = findNodeById(
      layoutMindMap(this.currentModel as any),
      id,
    );
    const siblingCount = parentNode?.children?.length ?? 0;
    const colors = NODE_STYLE_PRESETS.level1;
    const colorStyle = isLevel1
      ? colors[siblingCount % colors.length]
      : NODE_STYLE_PRESETS.level2Plus;
    const size = isLevel1
      ? NODE_SIZE_PRESETS.level1
      : NODE_SIZE_PRESETS.level2Plus;

    const newNode = {
      id: `${id}-${Date.now()}`,
      label: '新节点',
      ...size,
      style: { ...colorStyle },
      isCollapsed: false,
    };

    const updated = updateTreeNode(
      this.currentModel as any,
      id,
      (node) => ({
        ...node,
        children: [...(node.children || []), newNode],
      }),
    );

    this.s.modelService.updateModel(this.currentModel.id, updated);
  }
}
