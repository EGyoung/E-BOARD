import { inject, injectable } from "inversify";
import { IModel } from "../../../services/modelService/type";

import { BaseRender } from "../../baseElement/baseRender";
import { findNodeById, flattenLayout, layoutMindMap } from "../layout";
import { IMindMapModel, MindMapLayoutNode } from "../types";

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------
const DEFAULT_FONT_SIZE = 14;
const DEFAULT_LINE_WIDTH = 2;
const DEFAULT_BORDER_RADIUS = 8;
const DEFAULT_TEXT_COLOR = "#333333";
const DEFAULT_BUTTON = 6

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
  private buttonDispose: (() => void) | null = null;
  private currentModel: IModel<IMindMapModel> | null = null;

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
    this.ensureButtonListener();
    const [root] = model.points!;
    const layout = layoutMindMap(model);
    const context = ctx || this.board.getCtx();
    if (!context) return;

    // 先绘制连接线（在节点下方）
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
    if (!node.children) return;

    const zoom = this.transformService.getView().zoom;

    for (const child of node.children) {
      let px: number, py: number, cx: number, cy: number;

      const parentWorldX = root.x + node.x + node.width;
      const parentWorldY = root.y + node.y + node.height / 2;
      const childWorldX = root.x + child.x;
      const childWorldY = root.y + child.y + child.height / 2;

      if (isViewChanged) {
        // direct/offscreen 路径：世界坐标，canvas transform 处理缩放
        px = parentWorldX;
        py = parentWorldY;
        cx = childWorldX;
        cy = childWorldY;
      } else {
        // dirty rect 路径：转换为屏幕坐标（CSS 像素）
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

    // 清空路径，避免外层 stroke() 重复描边
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
    this.initButton(context, x + w, cy, node.id, zoom);

  };

  // -- 按钮渲染（只绘制，不绑定事件）-------------------------------
  private initButton = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    _id: string,
    renderZoom: number,
  ) => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, DEFAULT_BUTTON * renderZoom, 0, Math.PI * 2);
    ctx.fillStyle = 'black';
    ctx.fill();
    ctx.lineWidth = 1.5 * renderZoom;
    ctx.strokeStyle = '#95E1D3';
    ctx.stroke();
    ctx.restore();
    ctx.beginPath();
  };

  // -- 事件委托：只注册一个全局监听器，点击时动态做 hit test ---------
  private ensureButtonListener = (): void => {
    if (this.buttonDispose) return;

    const { dispose } = this.eventService.onPointerDown((event) => {
      const model = this.currentModel;
      if (!model?.points) return;

      const canvas = this.board.getInteractionCanvas();
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const eventX = event.clientX - rect.left;
      const eventY = event.clientY - rect.top;

      // 动态计算当前所有按钮位置并做 hit test
      const [root] = model.points!;
      const layout = layoutMindMap(model);
      const nodes = flattenLayout(layout);

      for (const node of nodes) {
        // 按钮在世界坐标中的位置（节点右侧中点）
        const btnWorldX = root.x + node.x + node.width;
        const btnWorldY = root.y + node.y + node.height / 2;

        // 世界坐标 → 屏幕坐标
        const screenPos = this.transformPoint({ x: btnWorldX, y: btnWorldY });
        const actualZoom = this.transformService.getView().zoom;
        const hitRadius = DEFAULT_BUTTON * actualZoom;

        const dx = eventX - screenPos.x;
        const dy = eventY - screenPos.y;
        if (dx * dx + dy * dy <= hitRadius * hitRadius) {
          this.addChildNode(node.id);
          return;
        }
      }
    });

    this.buttonDispose = dispose;
  };

  private addChildNode = (id: string) => {
    if (!this.currentModel) return;
    console.log("add child to leaf node", id);

    const targetNode = findNodeById(this.currentModel as any, id);
    if (!targetNode) return;

    if (!targetNode.children) {
      targetNode.children = []
    }
    targetNode.children.push({
      id: `${id}-${Date.now()}`,
      label: '新节点',
      width: 90,
      height: 36,
      style: { fillStyle: '#95E1D3' },
      isCollapsed: false
    } as any)
    this.modelService.updateModel(this.currentModel.id, {
      ...this.currentModel,
    })
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
