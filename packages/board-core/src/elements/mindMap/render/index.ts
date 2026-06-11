import { IModel } from "../../../services/modelService/type";

import { BaseRender } from "../../baseElement/baseRender";
import { flattenLayout, layoutMindMap } from "../layout";
import { IMindMapModel, MindMapLayoutNode } from "../types";
import {
  InteractionHandler,
  InteractionServices,
  renderCollapseButton,
  drawRoundedRect,
  COLLAPSE_BTN_RADIUS,
} from "./interactionHandler";

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------
const DEFAULT_FONT_SIZE = 14;
const DEFAULT_FONT_FAMILY = '"PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif';
const DEFAULT_BORDER_RADIUS = 10;
const DEFAULT_TEXT_COLOR = "#333333";
const DEFAULT_STROKE_WIDTH = 1.5;
const LINE_COLOR = "#C4D0E0";
const LINE_WIDTH = 2.5;
const SHADOW_BLUR = 6;
const SHADOW_OFFSET_Y = 2;
const SHADOW_COLOR = "rgba(0, 0, 0, 0.10)";
const BTN_GAP = 6;

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

interface DrawNode extends MindMapLayoutNode {
  drawRect: DrawRect;
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

class Render extends BaseRender<IMindMapModel> {
  private transformService = this.board.getService("transformService");
  private interaction: InteractionHandler;

  constructor(board: any) {
    super(board);
    const services: InteractionServices = {
      transformService: this.transformService,
      eventService: this.board.getService("eventService"),
      modelService: this.board.getService("modelService"),
      renderService: this.board.getService("renderService"),
      board: {
        getContainer: () => this.board.getContainer(),
        getInteractionCanvas: () => this.board.getInteractionCanvas(),
      },
    };
    this.interaction = new InteractionHandler(services);
  }

  // -- 坐标转换 ------------------------------------------------
  private transformPoint(point: { x: number; y: number }, inverse = false) {
    return this.transformService.transformPoint(point, inverse);
  }

  // -- 主渲染入口 ----------------------------------------------
  public render = (
    model: IModel<IMindMapModel>,
    ctx: CanvasRenderingContext2D | null,
    isViewChanged = false,
  ): void => {
    this.interaction.currentModel = model;
    this.interaction.ensureClickListener();
    this.interaction.ensureHoverListener();

    const [root] = model.points!;
    const layout = layoutMindMap(model);
    const context = ctx || this.board.getCtx();
    if (!context) return;

    // 连接线（折叠节点跳过子节点）
    this.renderLines(layout, root, context, isViewChanged);

    // 节点块
    const nodes = this.buildDrawNodes(model, root, isViewChanged, layout);
    for (const node of nodes) {
      this.renderBlock(node, ctx);
    }
  };

  // -- 递归绘制父子连接线 --------------------------------------
  private renderLines(
    node: MindMapLayoutNode,
    root: { x: number; y: number },
    ctx: CanvasRenderingContext2D,
    isViewChanged: boolean,
  ): void {
    if (!node.children || node.isCollapsed) return;

    const zoom = this.transformService.getView().zoom;

    for (const child of node.children) {
      const parentWorldX = root.x + node.x + node.width;
      const parentWorldY = root.y + node.y + node.height / 2;
      const childWorldX = root.x + child.x;
      const childWorldY = root.y + child.y + child.height / 2;

      let px: number, py: number, cx: number, cy: number;

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

      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px, cy, cx, cy);
      ctx.strokeStyle = LINE_COLOR;
      ctx.lineWidth = isViewChanged ? LINE_WIDTH : LINE_WIDTH * zoom;
      ctx.lineCap = "round";
      ctx.stroke();

      this.renderLines(child, root, ctx, isViewChanged);
    }

    ctx.beginPath();
  }

  // -- 构建带屏幕坐标的节点列表 --------------------------------
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

  // -- 绘制单个节点块 ------------------------------------------
  private renderBlock = (
    node: DrawNode,
    ctx: CanvasRenderingContext2D | null,
  ): void => {
    const context = ctx || this.board.getCtx();
    if (!context) return;

    const { x, y, w, h, zoom } = node.drawRect;
    const style = node.style ?? {};

    // 阴影
    context.save();
    context.shadowColor = SHADOW_COLOR;
    context.shadowBlur = SHADOW_BLUR * zoom;
    context.shadowOffsetX = 0;
    context.shadowOffsetY = SHADOW_OFFSET_Y * zoom;

    // 圆角矩形
    const radius = (style.borderRadius ?? DEFAULT_BORDER_RADIUS) * zoom;
    drawRoundedRect(context, x, y, w, h, radius);

    // 填充
    if (style.fillStyle) {
      context.fillStyle = style.fillStyle;
      context.fill();
    }
    // 无 fillStyle 时使用默认白色背景
    else {
      context.fillStyle = "#FFFFFF";
      context.fill();
    }

    // 清除阴影再描边（避免描边也有阴影）
    context.shadowColor = "transparent";
    context.shadowBlur = 0;
    context.shadowOffsetY = 0;

    // 描边
    context.strokeStyle = style.strokeStyle ?? "rgba(0,0,0,0.08)";
    context.lineWidth = ((style as any).lineWidth ?? DEFAULT_STROKE_WIDTH) * zoom;
    context.stroke();
    context.restore();

    // 文字
    const label = node.label?.trim();
    if (!label) return;

    const fontSize = Math.max(1, (style.fontSize ?? DEFAULT_FONT_SIZE) * zoom);
    const cx = x + w / 2;
    const cy = y + h / 2;

    context.save();
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = `600 ${fontSize}px ${DEFAULT_FONT_FAMILY}`;
    context.fillStyle = style.textColor ?? DEFAULT_TEXT_COLOR;
    context.fillText(label, cx, cy);
    context.restore();

    // 折叠/展开按钮：有子节点的节点始终显示
    const hasChildren = !!(node.children && node.children.length > 0);
    if (hasChildren || node.isCollapsed) {
      const btnCX = x + w + (BTN_GAP + COLLAPSE_BTN_RADIUS) * zoom;
      renderCollapseButton(context, btnCX, cy, zoom, !!node.isCollapsed);
    }
  };
}

export { Render };
