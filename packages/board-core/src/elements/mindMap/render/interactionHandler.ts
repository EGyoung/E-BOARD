import { IModel } from "../../../services/modelService/type";
import { flattenLayout, layoutMindMap } from "../layout";
import { IMindMapModel, MindMapLayoutNode } from "../types";

// ---------------------------------------------------------------------------
// 常量（按钮布局）
// ---------------------------------------------------------------------------
export const COLLAPSE_BTN_RADIUS = 8;
const COLLAPSE_BTN_BORDER = "#bbb";
const COLLAPSE_BTN_FILL = "#fff";
const COLLAPSE_BTN_SYMBOL = "#555";

export const ADD_BTN_RADIUS = 7;
const ADD_BTN_BORDER = "#4CAF50";
const ADD_BTN_FILL = "#E8F5E9";
const ADD_BTN_SYMBOL = "#4CAF50";

const BTN_GAP = 6;
const BTN_SPACING = 20;

export const BTN_HOVER_EXTEND = BTN_GAP + COLLAPSE_BTN_RADIUS + BTN_SPACING + ADD_BTN_RADIUS * 2 + 4;

// ---------------------------------------------------------------------------
// 工具：计算按钮的屏幕坐标偏移量（世界坐标，未乘 zoom）
// ---------------------------------------------------------------------------
export function getAddBtnOffset(hasCollapseBtn: boolean): number {
  return hasCollapseBtn
    ? BTN_GAP + COLLAPSE_BTN_RADIUS + BTN_SPACING + ADD_BTN_RADIUS
    : BTN_GAP + ADD_BTN_RADIUS;
}

export function getCollapseBtnOffset(): number {
  return BTN_GAP + COLLAPSE_BTN_RADIUS;
}

// ---------------------------------------------------------------------------
// 纯绘制函数（无状态，不依赖 Render 实例）
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

export function renderAddButton(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  zoom: number,
): void {
  const r = ADD_BTN_RADIUS * zoom;
  const lineW = 1.5 * zoom;
  const symbolLen = 4.5 * zoom;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = ADD_BTN_FILL;
  ctx.fill();
  ctx.lineWidth = lineW;
  ctx.strokeStyle = ADD_BTN_BORDER;
  ctx.stroke();
  ctx.restore();

  // "+" 符号
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - symbolLen, cy);
  ctx.lineTo(cx + symbolLen, cy);
  ctx.moveTo(cx, cy - symbolLen);
  ctx.lineTo(cx, cy + symbolLen);
  ctx.strokeStyle = ADD_BTN_SYMBOL;
  ctx.lineWidth = lineW;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.restore();
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
// 交互处理器：管理所有事件监听和交互状态
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
    getInteractionCanvas: () => HTMLCanvasElement | null;
    getInteractionCtx: () => CanvasRenderingContext2D | null;
  };
}

export class InteractionHandler {
  private clickDispose: (() => void) | null = null;
  private hoverDispose: (() => void) | null = null;
  private hoveredNodeId: string | null = null;
  private prevHoverBtnRect: { x: number; y: number; w: number; h: number } | null = null;

  /** 由 Render 在每次 render() 调用时注入 */
  public currentModel: IModel<IMindMapModel> | null = null;

  constructor(private s: InteractionServices) {}

  // -- 坐标转换 --------------------------------------------------
  private transformPoint(point: { x: number; y: number }, inverse = false) {
    return this.s.transformService.transformPoint(point, inverse);
  }

  // -- 公开 API --------------------------------------------------

  public getHoveredNodeId(): string | null {
    return this.hoveredNodeId;
  }

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

        // 折叠按钮
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

        // 添加按钮
        {
          const offset = getAddBtnOffset(hasChildren || isCollapsed);
          const btnWorldX = root.x + node.x + node.width + offset;
          const btnWorldY = root.y + node.y + node.height / 2;
          const screen = this.transformPoint({ x: btnWorldX, y: btnWorldY });
          const r = ADD_BTN_RADIUS * actualZoom;
          const dx = eventX - screen.x;
          const dy = eventY - screen.y;
          if (dx * dx + dy * dy <= r * r) {
            this.addChildNode(node.id);
            return;
          }
        }
      }
    });

    this.clickDispose = dispose;
  }

  public ensureHoverListener(): void {
    if (this.hoverDispose) return;

    const { dispose: renderDispose } = this.s.renderService.onRenderEnd(() => {
      this.drawHoverOverlay();
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
        this.drawHoverOverlay();
      }
    });

    this.hoverDispose = () => {
      renderDispose();
      moveDispose();
    };
  }

  // -- hover 覆盖层绘制 ------------------------------------------

  private drawHoverOverlay(): void {
    const ctx = this.s.board.getInteractionCtx();
    if (!ctx) return;

    // 清除上一次的按钮区域
    if (this.prevHoverBtnRect) {
      ctx.clearRect(
        this.prevHoverBtnRect.x,
        this.prevHoverBtnRect.y,
        this.prevHoverBtnRect.w,
        this.prevHoverBtnRect.h,
      );
      this.prevHoverBtnRect = null;
    }

    if (!this.hoveredNodeId) return;

    const model = this.currentModel;
    if (!model?.points) return;

    const [root] = model.points!;
    const zoom = this.s.transformService.getView().zoom;
    const layout = layoutMindMap(model);
    const nodes = flattenLayout(layout);
    const node = nodes.find(n => n.id === this.hoveredNodeId);
    if (!node) return;

    const screenPos = this.transformPoint({
      x: root.x + node.x,
      y: root.y + node.y,
    });
    const screenW = node.width * zoom;
    const screenH = node.height * zoom;
    const screenCY = screenPos.y + screenH / 2;

    const hasChildren = !!(node.children && node.children.length > 0);
    const offset = getAddBtnOffset(hasChildren || !!node.isCollapsed) * zoom;

    const btnCX = screenPos.x + screenW + offset;
    const btnCY = screenCY;

    const padding = 4 * zoom;
    const btnR = ADD_BTN_RADIUS * zoom;
    this.prevHoverBtnRect = {
      x: btnCX - btnR - padding,
      y: btnCY - btnR - padding,
      w: btnR * 2 + padding * 2,
      h: btnR * 2 + padding * 2,
    };

    renderAddButton(ctx, btnCX, btnCY, zoom);
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

    const newNode = {
      id: `${id}-${Date.now()}`,
      label: '新节点',
      width: 90,
      height: 36,
      style: { fillStyle: '#95E1D3' },
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