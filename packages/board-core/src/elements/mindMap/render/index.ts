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
    const [root] = model.points!;
    const zoom = this.transformService.getView().zoom;

    const nodes = this.buildDrawNodes(model, root, zoom, isViewChanged);
    for (const node of nodes) {
      this.renderBlock(node, ctx);
    }
  };

  // -- 构建带屏幕坐标的节点列表 ----------------------------------
  private buildDrawNodes(
    model: IModel<IMindMapModel>,
    root: { x: number; y: number },
    zoom: number,
    isViewChanged: boolean,
  ): DrawNode[] {
    const layout = layoutMindMap(model);
    return flattenLayout(layout).map((node) => {
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
  };

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
