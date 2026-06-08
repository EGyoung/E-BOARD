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
  btnWorldX: number;
  btnWorldY: number;
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
  private disposeMap: Record<string, () => void> = {};

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

    const nodes = this.buildDrawNodes(model, root, isViewChanged);
    for (const node of nodes) {
      this.renderBlock(node, ctx);
    }
  };

  // -- 构建带屏幕坐标的节点列表 ----------------------------------
  private buildDrawNodes(
    model: IModel<IMindMapModel>,
    root: { x: number; y: number },
    isViewChanged: boolean,
  ): DrawNode[] {
    const layout = layoutMindMap(model);
    const { zoom } = this.transformService.getView();
    return flattenLayout(layout).map((node) => {
      const btnWorldX = root.x + node.x + node.width;
        const btnWorldY = root.y + node.y + node.height / 2;
        const drawRect: DrawRect = isViewChanged
          ? { x: root.x + node.x, y: root.y + node.y, w: node.width, h: node.height, zoom: 1, btnWorldX, btnWorldY }
          : (() => {
            const { x, y } = this.transformPoint({
              x: root.x + node.x,
              y: root.y + node.y,
            });
            return { x, y, w: node.width * zoom, h: node.height * zoom, zoom, btnWorldX, btnWorldY };
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
    this.initButton(context, x + w, cy, node.id, zoom, node.drawRect.btnWorldX, node.drawRect.btnWorldY);

  };

  private initButton =
    (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      id: string,
      renderZoom: number,
      btnWorldX: number,
      btnWorldY: number,
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
      this.addButtonEventListener(btnWorldX, btnWorldY, `btn-${id}`)
    }

  private addButtonEventListener = (
    btnWorldX: number,
    btnWorldY: number,
    id: string,
  ) => {
    if (this.disposeMap[id]) {
      return
    }
    const { dispose } = this.eventService.onPointerDown((event) => {
      const canvas = this.board.getInteractionCanvas();
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const eventX = event.clientX - rect.left;
      const eventY = event.clientY - rect.top;

      // 始终用世界坐标 + 当前视图动态换算屏幕位置
      const screenPos = this.transformPoint({ x: btnWorldX, y: btnWorldY });
      const actualZoom = this.transformService.getView().zoom;
      const hitRadius = DEFAULT_BUTTON * actualZoom;

      const dx = eventX - screenPos.x;
      const dy = eventY - screenPos.y;
      if (dx * dx + dy * dy <= hitRadius * hitRadius) {
        console.log(`Button ${id} clicked!`);
      }
    })
    this.disposeMap[id] = dispose;
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
