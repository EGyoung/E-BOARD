import { IModel, IModelService } from "../../services/modelService/type";

// ---------------------------------------------------------------------------
// 类型 & 手柄工具
// ---------------------------------------------------------------------------

export type ScreenRect = { x: number; y: number; width: number; height: number };

export type ResizeHandle = "nw" | "n" | "ne" | "w" | "e" | "sw" | "s" | "se";

export const HANDLE_SIZE = 8;
export const MIN_ELEMENT_SIZE = 10;

export function getHandlePositions(box: ScreenRect): Record<ResizeHandle, { x: number; y: number }> {
  const { x, y, width, height } = box;
  const mx = x + width / 2;
  const my = y + height / 2;
  return {
    nw: { x, y }, n: { x: mx, y }, ne: { x: x + width, y },
    w: { x, y: my }, e: { x: x + width, y: my },
    sw: { x, y: y + height }, s: { x: mx, y: y + height }, se: { x: x + width, y: y + height },
  };
}

export function hitTestHandles(point: { x: number; y: number }, aabb: ScreenRect | null): ResizeHandle | null {
  if (!aabb) return null;
  const handles = getHandlePositions(aabb);
  const half = HANDLE_SIZE / 2 + 2;
  for (const [key, pos] of Object.entries(handles)) {
    if (Math.abs(point.x - pos.x) <= half && Math.abs(point.y - pos.y) <= half) {
      return key as ResizeHandle;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// SelectionDOMOverlay
// ---------------------------------------------------------------------------

export class SelectionDOMOverlay {
  private handleEls = new Map<ResizeHandle, HTMLDivElement>();
  private selectionBoxEls = new Map<string, HTMLDivElement>();
  private aabbBoxEl: HTMLDivElement | null = null;
  private marqueeEl: HTMLDivElement | null = null;

  // -- 样式常量 --------------------------------------------------
  private static readonly SEL_BOX_STYLE = [
    "position: absolute;",
    "border: 2px solid rgba(0,113,227,0.62);",
    "pointer-events: none;",
    "z-index: 998;",
    "box-sizing: border-box;",
  ].join("");

  private static readonly AABB_BOX_STYLE = [
    "position: absolute;",
    "border: 2px solid rgba(0,113,227,0.88);",
    "pointer-events: none;",
    "z-index: 998;",
    "box-sizing: border-box;",
  ].join("");

  private static readonly HANDLE_STYLE = [
    "position: absolute;",
    "background: rgba(255,255,255,0.98);",
    "border: 1.5px solid rgba(0,113,227,0.72);",
    "box-sizing: border-box;",
    "pointer-events: none;",
    "z-index: 999;",
    "box-shadow: 0 2px 6px rgba(0,113,227,0.16);",
  ].join("");

  /** 超过此数量跳过逐元素选中框，只渲染 AABB 外框 */
  private static readonly MAX_INDIVIDUAL_BOXES = 20;

  // -- 公开接口 --------------------------------------------------

  /**
   * 重绘覆盖层。返回计算出的 AABB 包围盒（屏幕坐标）。
   * @param showHandles 是否显示缩放手柄，默认 true
   */
  update(
    container: HTMLElement,
    selectedModelIds: Set<string>,
    modelService: IModelService,
    showHandles: boolean = true,
  ): ScreenRect | null {
    this.remove();

    if (selectedModelIds.size === 0) return null;

    const boxes: { id: string; x: number; y: number; w: number; h: number }[] = [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const id of selectedModelIds) {
      const model = modelService.getModelById(id);
      if (!model) continue;
      const box = model.ctrlElement?.getBoundingBox?.();
      if (!box) continue;
      boxes.push({ id, x: box.x, y: box.y, w: box.width, h: box.height });
      minX = Math.min(minX, box.x);
      minY = Math.min(minY, box.y);
      maxX = Math.max(maxX, box.x + box.width);
      maxY = Math.max(maxY, box.y + box.height);
    }

    if (!isFinite(minX)) return null;

    const aabb: ScreenRect = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    const isMulti = boxes.length > 1;
    const showIndividual = boxes.length <= SelectionDOMOverlay.MAX_INDIVIDUAL_BOXES;

    // 元素选中框（超阈值时只显示 AABB）
    if (showIndividual) {
      for (const box of boxes) {
        const el = document.createElement("div");
        el.style.cssText =
          `left: ${box.x}px; top: ${box.y}px; width: ${box.w}px; height: ${box.h}px; ` +
          SelectionDOMOverlay.SEL_BOX_STYLE +
          (isMulti ? " border-style: dashed;" : " border-style: solid;");
        container.appendChild(el);
        this.selectionBoxEls.set(box.id, el);
      }
    }

    // AABB 外框（多选时始终显示）
    if (isMulti) {
      const el = document.createElement("div");
      el.style.cssText =
        `left: ${aabb.x}px; top: ${aabb.y}px; width: ${aabb.width}px; height: ${aabb.height}px; ` +
        SelectionDOMOverlay.AABB_BOX_STYLE;
      container.appendChild(el);
      this.aabbBoxEl = el;
    }

    // 手柄
    if (showHandles) {
      this.renderHandles(container, aabb);
    }

    return aabb;
  }

  /** 移除所有 DOM 元素（选中框、手柄、marquee） */
  remove(): void {
    this.selectionBoxEls.forEach(el => el.remove());
    this.selectionBoxEls.clear();
    if (this.aabbBoxEl) {
      this.aabbBoxEl.remove();
      this.aabbBoxEl = null;
    }
    this.handleEls.forEach(el => el.remove());
    this.handleEls.clear();
    this.hideMarquee();
  }

  // -- Marquee（拖选瞬时框）---------------------------------------

  private static readonly MARQUEE_STYLE = [
    "position: absolute;",
    "border: 2px solid rgba(0,113,227,0.72);",
    "border-style: dashed;",
    "pointer-events: none;",
    "z-index: 997;",
    "box-sizing: border-box;",
  ].join("");

  showMarquee(container: HTMLElement, rect: ScreenRect): void {
    if (!this.marqueeEl) {
      this.marqueeEl = document.createElement("div");
      this.marqueeEl.style.cssText = SelectionDOMOverlay.MARQUEE_STYLE;
      container.appendChild(this.marqueeEl);
    }
    this.marqueeEl.style.left = `${rect.x}px`;
    this.marqueeEl.style.top = `${rect.y}px`;
    this.marqueeEl.style.width = `${rect.width}px`;
    this.marqueeEl.style.height = `${rect.height}px`;
  }

  hideMarquee(): void {
    if (this.marqueeEl) {
      this.marqueeEl.remove();
      this.marqueeEl = null;
    }
  }

  // -- 手柄渲染 --------------------------------------------------

  private renderHandles(container: HTMLElement, box: ScreenRect): void {
    const handles = getHandlePositions(box);
    const half = HANDLE_SIZE / 2;

    for (const [key, pos] of Object.entries(handles) as [ResizeHandle, { x: number; y: number }][]) {
      let el = this.handleEls.get(key);
      if (!el) {
        el = document.createElement("div");
        el.style.cssText =
          `width: ${HANDLE_SIZE}px; height: ${HANDLE_SIZE}px; ` +
          SelectionDOMOverlay.HANDLE_STYLE;
        container.appendChild(el);
        this.handleEls.set(key, el);
      }
      el.style.left = `${pos.x - half}px`;
      el.style.top = `${pos.y - half}px`;
    }
  }
}

// ---------------------------------------------------------------------------
// Marquee 碰撞检测
// ---------------------------------------------------------------------------

type Range = { x: number; y: number; width: number; height: number };

/** 计算拖选框覆盖的 model ID 列表 */
export function computeSelectedByMarquee(range: Range, models: IModel[]): string[] {
  const selectRect = {
    x: Math.min(range.x, range.x + range.width),
    y: Math.min(range.y, range.y + range.height),
    width: Math.abs(range.width),
    height: Math.abs(range.height),
  };

  const selected: string[] = [];
  for (const model of models) {
    const bounding = model.ctrlElement?.getBoundingBox();
    if (!bounding) continue;

    if (
      bounding.minX < selectRect.x + selectRect.width &&
      bounding.maxX > selectRect.x &&
      bounding.minY < selectRect.y + selectRect.height &&
      bounding.maxY > selectRect.y
    ) {
      selected.push(model.id);
    }
  }
  return selected;
}