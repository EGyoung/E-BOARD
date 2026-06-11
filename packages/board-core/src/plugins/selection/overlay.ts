import { IModelService } from "../../services/modelService/type";
import { ResizeHandle, HANDLE_SIZE, getHandlePositions } from "./handles";

type Box = { x: number; y: number; width: number; height: number };

/**
 * 选中框 DOM 覆盖层。
 * 用绝对定位 div 渲染选中虚线框 + AABB 外框 + 8 个手柄。
 * 独立于 Canvas 渲染管线，不受脏矩形/offscreen cache 影响。
 */
export class SelectionDOMOverlay {
  private handleEls = new Map<ResizeHandle, HTMLDivElement>();
  private selectionBoxEls = new Map<string, HTMLDivElement>();
  private aabbBoxEl: HTMLDivElement | null = null;

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
    "border-style: dashed;",
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

  // -- 公开接口 --------------------------------------------------

  /**
   * 重绘覆盖层。返回计算出的 AABB 包围盒（屏幕坐标）。
   */
  update(
    container: HTMLElement,
    selectedModelIds: Set<string>,
    modelService: IModelService,
  ): Box | null {
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

    const aabb: Box = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    const isMulti = boxes.length > 1;

    // 每个元素的虚线框
    for (const box of boxes) {
      const el = document.createElement("div");
      el.style.cssText =
        `left: ${box.x}px; top: ${box.y}px; width: ${box.w}px; height: ${box.h}px; ` +
        SelectionDOMOverlay.SEL_BOX_STYLE +
        (isMulti ? " border-style: dashed;" : " border-style: solid;");
      container.appendChild(el);
      this.selectionBoxEls.set(box.id, el);
    }

    // 多选 AABB 外框
    if (isMulti) {
      const el = document.createElement("div");
      el.style.cssText =
        `left: ${aabb.x}px; top: ${aabb.y}px; width: ${aabb.width}px; height: ${aabb.height}px; ` +
        SelectionDOMOverlay.AABB_BOX_STYLE;
      container.appendChild(el);
      this.aabbBoxEl = el;
    }

    // 手柄
    this.renderHandles(container, aabb);

    return aabb;
  }

  /** 移除所有 DOM 元素 */
  remove(): void {
    this.selectionBoxEls.forEach(el => el.remove());
    this.selectionBoxEls.clear();
    if (this.aabbBoxEl) {
      this.aabbBoxEl.remove();
      this.aabbBoxEl = null;
    }
    this.handleEls.forEach(el => el.remove());
    this.handleEls.clear();
  }

  // -- 手柄渲染 --------------------------------------------------

  private renderHandles(container: HTMLElement, box: Box): void {
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