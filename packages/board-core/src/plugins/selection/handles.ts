export type ResizeHandle =
  | "nw" | "n" | "ne"
  | "w" | "e"
  | "sw" | "s" | "se";

export const HANDLE_SIZE = 8;
export const MIN_ELEMENT_SIZE = 10;

export const HANDLE_CURSORS: Record<ResizeHandle, string> = {
  nw: "nwse-resize", n: "ns-resize", ne: "nesw-resize",
  w: "ew-resize", e: "ew-resize",
  sw: "nesw-resize", s: "ns-resize", se: "nwse-resize",
};

type Box = { x: number; y: number; width: number; height: number };

export function getHandlePositions(box: Box): Record<ResizeHandle, { x: number; y: number }> {
  const { x, y, width, height } = box;
  const mx = x + width / 2;
  const my = y + height / 2;
  return {
    nw: { x, y },
    n: { x: mx, y },
    ne: { x: x + width, y },
    w: { x, y: my },
    e: { x: x + width, y: my },
    sw: { x, y: y + height },
    s: { x: mx, y: y + height },
    se: { x: x + width, y: y + height },
  };
}

export function hitTestHandles(point: { x: number; y: number }, aabb: Box | null): ResizeHandle | null {
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

export class HandleManager {
  private handleElements = new Map<ResizeHandle, HTMLDivElement>();

  drawHandles(container: HTMLElement, box: Box) {
    const handles = getHandlePositions(box);
    const half = HANDLE_SIZE / 2;

    for (const [key, pos] of Object.entries(handles) as [ResizeHandle, { x: number; y: number }][]) {
      let el = this.handleElements.get(key);
      if (!el) {
        el = document.createElement("div");
        el.style.position = "absolute";
        el.style.width = `${HANDLE_SIZE}px`;
        el.style.height = `${HANDLE_SIZE}px`;
        el.style.background = "rgba(255, 255, 255, 0.98)";
        el.style.border = "1.5px solid rgba(0, 113, 227, 0.72)";
        el.style.boxSizing = "border-box";
        el.style.pointerEvents = "none";
        el.style.zIndex = "999";
        el.style.boxShadow = "0 2px 6px rgba(0, 113, 227, 0.16)";
        container.appendChild(el);
        this.handleElements.set(key, el);
      }
      el.style.left = `${pos.x - half}px`;
      el.style.top = `${pos.y - half}px`;
      el.style.display = "block";
    }
  }

  removeHandles() {
    this.handleElements.forEach(el => el.remove());
    this.handleElements.clear();
  }
}
