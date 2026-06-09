import { inject, injectable } from "inversify";
import { IModel } from "../../../services/modelService/type";

import { BaseRender } from "../../baseElement/baseRender";
import { flattenLayout, layoutMindMap } from "../layout";
import { IMindMapModel, MindMapLayoutNode } from "../types";

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------
const DEFAULT_FONT_SIZE = 14;
const DEFAULT_LINE_WIDTH = 2;
const DEFAULT_BORDER_RADIUS = 8;
const DEFAULT_TEXT_COLOR = "#333333";

/** 折叠/展开按钮 */
const COLLAPSE_BTN_RADIUS = 8;
const COLLAPSE_BTN_BORDER = "#bbb";
const COLLAPSE_BTN_FILL = "#fff";
const COLLAPSE_BTN_SYMBOL = "#555";

/** 添加按钮（hover 出现） */
const ADD_BTN_RADIUS = 7;
const ADD_BTN_BORDER = "#4CAF50";
const ADD_BTN_FILL = "#E8F5E9";
const ADD_BTN_SYMBOL = "#4CAF50";

/** 按钮间距 */
const BTN_GAP = 6;         // 按钮与节点右侧边缘的间距
const BTN_SPACING = 20;    // 两个按钮之间的圆心距

/** hover 检测时节点向右扩展的距离（确保按钮可点击） */
const BTN_HOVER_EXTEND = BTN_GAP + COLLAPSE_BTN_RADIUS + BTN_SPACING + ADD_BTN_RADIUS * 2 + 4;

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------
interface DrawRect {
  x: number;
  y: number;
  w: number;
  h: number;
  zoom: number;
}

/** 布局节点 + 当前帧的绘制矩形 */
interface DrawNode extends MindMapLayoutNode {
  drawRect: DrawRect;
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

class Render extends BaseRender<IMindMapModel> {
  private transformService = this.board.getService("transformService");
  private eventService = this.board.getService("eventService");
  private modelService = this.board.getService("modelService");
  private renderService = this.board.getService("renderService");

  private clickDispose: (() => void) | null = null;
  private hoverDispose: (() => void) | null = null;
  private currentModel: IModel<IMindMapModel> | null = null;
  private hoveredNodeId: string | null = null;
  /** 上一次绘制的 hover 按钮区域（屏幕坐标），用于精确清除 */
  private prevHoverBtnRect: { x: number; y: number; w: number; h: number } | null = null;

  // -- 坐标转换工具 ------------------------------------------------
  private transformPoint(point: { x: number; y: number }, inverse = false) {
    return this.transformService.transformPoint(point, inverse);
  }

  // -- 主渲染入口 ------------------------------------------------
  public render = (
    model: IModel<IMindMapModel>,
    ctx: CanvasRenderingContext2D | null,
    isViewChanged = false,
  ): void => {
    this.currentModel = model;
    this.ensureClickListener();
    this.ensureHoverListener();
    const [root] = model.points!;
    const layout = layoutMindMap(model);
    const context = ctx || this.board.getCtx();
    if (!context) return;

    // 先绘制连接线（在节点下方），折叠节点不画子节点连线
    this.renderLines(layout, root, context, isViewChanged);

    // 再绘制节点块
    const nodes = this.buildDrawNodes(model, root, isViewChanged, layout);
    for (const node of nodes) {
      this.renderBlock(node, ctx);
    }
  };

  // -- 递归绘制父子连接线 ----------------------------------------
  private renderLines(
    node: MindMapLayoutNode,
    root: { x: number; y: number },
    ctx: CanvasRenderingContext2D,
    isViewChanged: boolean,
  ): void {
    if (!node.children || node.isCollapsed) return;

    const zoom = this.transformService.getView().zoom;

    for (const child of node.children) {
      let px: number, py: number, cx: number, cy: number;

      const parentWorldX = root.x + node.x + node.width;
      const parentWorldY = root.y + node.y + node.height / 2;
      const childWorldX = root.x + child.x;
      const childWorldY = root.y + child.y + child.height / 2;

      if (isViewChanged) {
        px = parentWorldX;
        py = parentWorldY;
        cx = childWorldX;
        cy = childWorldY;
      } else {
        const pScreen = this.transformPoint({ x: parentWorldX, y: parentWorldY });
        px = pScreen.x;
        py = pScreen.y;
        const cScreen = this.transformPoint({ x: childWorldX, y: childWorldY });
        cx = cScreen.x;
        cy = cScreen.y;
      }

      const lineWidth = isViewChanged ? 1.5 : 1.5 * zoom;

      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px, cy, cx, cy);
      ctx.strokeStyle = '#C0C0C0';
      ctx.lineWidth = lineWidth;
      ctx.stroke();

      this.renderLines(child, root, ctx, isViewChanged);
    }

    ctx.beginPath();
  }

  // -- 构建带屏幕坐标的节点列表 ----------------------------------
  private buildDrawNodes(
    model: IModel<IMindMapModel>,
    root: { x: number; y: number },
    isViewChanged: boolean,
    layout?: MindMapLayoutNode,
  ): DrawNode[] {
    const tree = layout ?? layoutMindMap(model);
    const { zoom } = this.transformService.getView();
    return flattenLayout(tree).map((node) => {
      const drawRect: DrawRect = isViewChanged
        ? { x: root.x + node.x, y: root.y + node.y, w: node.width, h: node.height, zoom: 1 }
        : (() => {
          const { x, y } = this.transformPoint({
            x: root.x + node.x,
            y: root.y + node.y,
          });
          return { x, y, w: node.width * zoom, h: node.height * zoom, zoom };
        })();

      return { ...node, drawRect };
    });
  }

  // -- 绘制单个节点块 --------------------------------------------
  private renderBlock = (
    node: DrawNode,
    ctx: CanvasRenderingContext2D | null,
  ): void => {
    const context = ctx || this.board.getCtx();
    if (!context) return;

    const { x, y, w, h, zoom } = node.drawRect;
    const style = node.style ?? {};

    // 圆角矩形
    const radius = (style.borderRadius ?? DEFAULT_BORDER_RADIUS) * zoom;
    this.drawRoundedRect(context, x, y, w, h, radius);

    // 填充
    if (style.fillStyle) {
      context.fillStyle = style.fillStyle;
      context.fill();
    }

    // 描边
    if (style.strokeStyle) {
      context.strokeStyle = style.strokeStyle;
      context.lineWidth = (style as any).lineWidth ?? DEFAULT_LINE_WIDTH;
      context.stroke();
    }

    // 文字
    const label = node.label?.trim();
    if (!label) return;

    const fontSize = Math.max(1, (style.fontSize ?? DEFAULT_FONT_SIZE) * zoom);
    const cx = x + w / 2;
    const cy = y + h / 2;

    context.save();
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = `${fontSize}px sans-serif`;
    context.fillStyle = style.textColor ?? DEFAULT_TEXT_COLOR;
    context.fillText(label, cx, cy);
    context.restore();

    // -- 按钮绘制 --------------------------------------------------
    const hasChildren = !!(node.children && node.children.length > 0);
    const isCollapsed = !!node.isCollapsed;

    // 折叠/展开按钮：有子节点的节点始终显示
    if (hasChildren || isCollapsed) {
      const btnCX = x + w + (BTN_GAP + COLLAPSE_BTN_RADIUS) * zoom;
      const btnCY = cy;
      this.renderCollapseButton(context, btnCX, btnCY, zoom, isCollapsed);
    }
  };

  // -- 折叠/展开按钮 ---------------------------------------------
  private renderCollapseButton = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    zoom: number,
    isCollapsed: boolean,
  ) => {
    const r = COLLAPSE_BTN_RADIUS * zoom;
    const lineW = 1.5 * zoom;
    const symbolLen = 5 * zoom; // +/− 符号的半长

    // 圆
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = COLLAPSE_BTN_FILL;
    ctx.fill();
    ctx.lineWidth = lineW;
    ctx.strokeStyle = COLLAPSE_BTN_BORDER;
    ctx.stroke();
    ctx.restore();

    // 符号：横线（展开 = "−"，折叠还需加竖线 = "+"）
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - symbolLen, cy);
    ctx.lineTo(cx + symbolLen, cy);
    ctx.strokeStyle = COLLAPSE_BTN_SYMBOL;
    ctx.lineWidth = lineW;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.restore();

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
  };

  // -- 添加按钮（hover 时显示）----------------------------------
  private renderAddButton = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    zoom: number,
  ) => {
    const r = ADD_BTN_RADIUS * zoom;
    const lineW = 1.5 * zoom;
    const symbolLen = 4.5 * zoom;

    // 圆形背景
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
  };

  // -- 事件委托：点击检测 ----------------------------------------
  private ensureClickListener = (): void => {
    if (this.clickDispose) return;

    const { dispose } = this.eventService.onPointerDown((event) => {
      const model = this.currentModel;
      if (!model?.points) return;

      const canvas = this.board.getInteractionCanvas();
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const eventX = event.clientX - rect.left;
      const eventY = event.clientY - rect.top;

      const [root] = model.points!;
      const layout = layoutMindMap(model);
      const nodes = flattenLayout(layout);
      const actualZoom = this.transformService.getView().zoom;

      for (const node of nodes) {
        const hasChildren = !!(node.children && node.children.length > 0);
        const isCollapsed = !!node.isCollapsed;

        // 折叠按钮的世界坐标（节点右侧）
        const collapseBtnWorldX = root.x + node.x + node.width + BTN_GAP + COLLAPSE_BTN_RADIUS;
        const collapseBtnWorldY = root.y + node.y + node.height / 2;
        const collapseScreen = this.transformPoint({ x: collapseBtnWorldX, y: collapseBtnWorldY });
        const collapseRadius = COLLAPSE_BTN_RADIUS * actualZoom;

        // 添加按钮的世界坐标
        const addOffset = (hasChildren || isCollapsed)
          ? (BTN_GAP + COLLAPSE_BTN_RADIUS) + BTN_SPACING + ADD_BTN_RADIUS
          : BTN_GAP + ADD_BTN_RADIUS;
        const addBtnWorldX = root.x + node.x + node.width + addOffset;
        const addBtnWorldY = root.y + node.y + node.height / 2;
        const addScreen = this.transformPoint({ x: addBtnWorldX, y: addBtnWorldY });
        const addRadius = ADD_BTN_RADIUS * actualZoom;

        // 检测折叠按钮（仅对有子节点的节点）
        if (hasChildren || isCollapsed) {
          const dx = eventX - collapseScreen.x;
          const dy = eventY - collapseScreen.y;
          if (dx * dx + dy * dy <= collapseRadius * collapseRadius) {
            this.toggleCollapse(node.id);
            return;
          }
        }

        // 检测添加按钮（仅对 hovered 节点或叶子节点）
        {
          const dx = eventX - addScreen.x;
          const dy = eventY - addScreen.y;
          if (dx * dx + dy * dy <= addRadius * addRadius) {
            this.addChildNode(node.id);
            return;
          }
        }
      }
    });

    this.clickDispose = dispose;
  };

  // -- 事件委托：hover 检测（画到 interaction canvas 覆盖层） -----
  private ensureHoverListener = (): void => {
    if (this.hoverDispose) return;

    // 每次主画布渲染结束后，SelectionPlugin 会清空 interaction canvas，
    // 我们需要重新绘制 hover 的 add 按钮
    const { dispose: renderDispose } = this.renderService.onRenderEnd(() => {
      this.drawHoverOverlay();
    });

    const { dispose: moveDispose } = this.eventService.onPointerMove((event) => {
      const model = this.currentModel;
      if (!model?.points) return;

      const canvas = this.board.getInteractionCanvas();
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const eventX = event.clientX - rect.left;
      const eventY = event.clientY - rect.top;

      const [root] = model.points!;
      const zoom = this.transformService.getView().zoom;
      const layout = layoutMindMap(model);
      const nodes = flattenLayout(layout);

      let newHoveredId: string | null = null;

      for (let i = nodes.length - 1; i >= 0; i--) {
        const node = nodes[i];
        const nodeWorldX = root.x + node.x;
        const nodeWorldY = root.y + node.y;
        const screenPos = this.transformPoint({ x: nodeWorldX, y: nodeWorldY });
        const screenW = node.width * zoom;
        const screenH = node.height * zoom;
        // hover 区域向右扩展到覆盖按钮
        const hoverRight = screenPos.x + screenW + BTN_HOVER_EXTEND * zoom;

        if (
          eventX >= screenPos.x &&
          eventX <= hoverRight &&
          eventY >= screenPos.y &&
          eventY <= screenPos.y + screenH
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
  };

  // -- 在 interaction canvas 上绘制 hover 的 add 按钮 ------------
  private drawHoverOverlay = () => {
    const ctx = this.board.getInteractionCtx();
    if (!ctx) return;

    // 先清除上一次的按钮区域（不影响 SelectionPlugin 画的其他内容）
    if (this.prevHoverBtnRect) {
      ctx.clearRect(
        this.prevHoverBtnRect.x,
        this.prevHoverBtnRect.y,
        this.prevHoverBtnRect.w,
        this.prevHoverBtnRect.h,
      );
      this.prevHoverBtnRect = null;
    }

    // 没有 hover 的节点时，只清除旧的即可
    if (!this.hoveredNodeId) return;

    const model = this.currentModel;
    if (!model?.points) return;

    const [root] = model.points!;
    const zoom = this.transformService.getView().zoom;
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
    const isCollapsed = !!node.isCollapsed;
    const offset = (hasChildren || isCollapsed)
      ? (BTN_GAP + COLLAPSE_BTN_RADIUS + BTN_SPACING + ADD_BTN_RADIUS) * zoom
      : (BTN_GAP + ADD_BTN_RADIUS) * zoom;

    const btnCX = screenPos.x + screenW + offset;
    const btnCY = screenCY;

    // 记录当前按钮的包围矩形，供下次清除使用
    const padding = 4 * zoom;
    const btnR = ADD_BTN_RADIUS * zoom;
    this.prevHoverBtnRect = {
      x: btnCX - btnR - padding,
      y: btnCY - btnR - padding,
      w: btnR * 2 + padding * 2,
      h: btnR * 2 + padding * 2,
    };

    this.renderAddButton(ctx, btnCX, btnCY, zoom);
  };

  // -- 树节点不可变更新：沿路径创建新引用，其余保持结构共享 -------
  /**
   * 在树中查找 targetId，对其调用 updater，沿路径创建新的浅拷贝。
   * 未修改的分支保持原引用不变（结构共享）。
   */
  private updateTreeNode(
    root: Record<string, any>,
    targetId: string,
    updater: (node: Record<string, any>) => Record<string, any>,
  ): Record<string, any> {
    if (root.id === targetId) {
      return updater(root);
    }
    if (root.children) {
      const newChildren = root.children.map((child: Record<string, any>) =>
        this.updateTreeNode(child, targetId, updater),
      );
      if (newChildren.some((c: Record<string, any>, i: number) => c !== root.children[i])) {
        return { ...root, children: newChildren };
      }
    }
    return root;
  }

  // -- 切换折叠状态 ----------------------------------------------
  private toggleCollapse = (id: string) => {
    if (!this.currentModel) return;

    const updated = this.updateTreeNode(
      this.currentModel as any,
      id,
      (node) => ({ ...node, isCollapsed: !node.isCollapsed }),
    );

    this.modelService.updateModel(this.currentModel.id, updated);
  };

  // -- 添加子节点 ------------------------------------------------
  private addChildNode = (id: string) => {
    if (!this.currentModel) return;

    const newNode = {
      id: `${id}-${Date.now()}`,
      label: '新节点',
      width: 90,
      height: 40,
      style: { fillStyle: '#95E1D3' },
      isCollapsed: false,
    };

    const updated = this.updateTreeNode(
      this.currentModel as any,
      id,
      (node) => ({
        ...node,
        children: [...(node.children || []), newNode],
      }),
    );

    this.modelService.updateModel(this.currentModel.id, updated);
  }


  // -- 圆角矩形路径 ----------------------------------------------
  private drawRoundedRect(
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
}

export { Render };