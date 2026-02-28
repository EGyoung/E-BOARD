import type { EBoard, IModelService, ITransformService } from "@e-board/board-core";
import type { TaskCallback, TaskContext } from "./schedule";
import { createRafTaskScheduler, TaskPriority } from "./schedule";

export * from "./schedule";

type Point = { x: number; y: number };

type RectangleShape = {
  type: "rectangle";
  x: number | "center";
  y: number | "center";
  width?: number;
  height?: number;
  fillStyle?: string;
  strokeStyle?: string;
  lineWidth?: number;
};

type LineShape = {
  type: "line";
  points: Array<{ x: number; y: number }>;
  strokeStyle?: string;
  lineWidth?: number;
};

type AIGeneratedShape = RectangleShape | LineShape;

type UpdateViewAction = {
  type: "updateView";
  params: {
    x?: number;
    y?: number;
    zoom?: number;
    center?: { x: number; y: number };
  };
};

type CreateElementAction = {
  type: "createElement";
  params: AIGeneratedShape;
};

type AIGeneratedAction = UpdateViewAction | CreateElementAction;

type AIGeneratedPayload = {
  actions: AIGeneratedAction[];
};

type GenerateParams = {
  endpoint?: string;
  prompt: string;
};

class BoardAIAssistantPlugin {
  public pluginName = "BoardAIAssistantPlugin";
  private board!: EBoard;
  private schedule = createRafTaskScheduler({ frameBudget: 10, onError: (error) => console.error("scheduler task error:", error) });

  public exports = {
    generateAndRender: this.generateAndRender.bind(this),
    renderFromJson: this.renderFromJson.bind(this),
    renderFromJsonAsync: this.renderFromJsonAsync.bind(this)
  };

  public init({ board }: { board: EBoard }) {
    this.board = board;
  }

  public dispose(): void {
    this.schedule.dispose();
  }

  private requestRender() {
    const renderService = this.board.getService("renderService") as { reRender?: () => void } | undefined;
    renderService?.reRender?.();
  }

  private getBoardCenterInWorld() {
    const canvas = this.board.getCanvas();
    const transformService = this.board.getService("transformService") as unknown as ITransformService;

    const fallback = { x: 0, y: 0 };
    if (!canvas || !transformService) return fallback;

    const centerInScreen = { x: canvas.width / 2, y: canvas.height / 2 };
    return transformService.transformPoint(centerInScreen, true);
  }

  private toWorldPoint(point: Point) {
    const transformService = this.board.getService("transformService") as unknown as ITransformService;
    return transformService.transformPoint(point, true);
  }

  private moveViewportToWorldPoint(point: Point) {
    const canvas = this.board.getCanvas();
    const transformService = this.board.getService("transformService") as unknown as ITransformService;
    if (!canvas || !transformService) return;

    const view = transformService.getView();
    transformService.setView({
      x: point.x - canvas.width / (2 * view.zoom),
      y: point.y - canvas.height / (2 * view.zoom)
    });
  }

  private updateView(params: UpdateViewAction["params"]): void {
    const transformService = this.board.getService("transformService") as unknown as ITransformService;
    const canvas = this.board.getCanvas();
    const view = transformService.getView();
    const nextZoom = params.zoom ?? view.zoom;

    if (params.center && canvas) {
      transformService.setView({
        x: params.center.x - canvas.width / (2 * nextZoom),
        y: params.center.y - canvas.height / (2 * nextZoom),
        zoom: nextZoom
      });
      return;
    }

    if (typeof params.x === "number" && typeof params.y === "number" && canvas) {
      transformService.setView({
        x: params.x - canvas.width / (2 * nextZoom),
        y: params.y - canvas.height / (2 * nextZoom),
        zoom: nextZoom
      });
      return;
    }

    transformService.setView({
      x: params.x,
      y: params.y,
      zoom: params.zoom
    });
  }

  private normalizePayload(payload: unknown): AIGeneratedPayload {
    if (!payload || typeof payload !== "object") {
      return { actions: [] };
    }
    const data = payload as Record<string, unknown>;
    if (Array.isArray(data.actions)) {
      return {
        actions: data.actions as AIGeneratedAction[]
      };
    }

    const elementsRaw = Array.isArray(data.elements) ? data.elements : Array.isArray(payload) ? payload : [];

    return {
      actions: (elementsRaw as AIGeneratedShape[]).map(shape => ({
        type: "createElement",
        params: shape
      }))
    };
  }

  private createElement(shape: AIGeneratedShape): boolean {
    const modelService = this.board.getService("modelService") as unknown as IModelService;
    const transformService = this.board.getService("transformService") as unknown as ITransformService;
    const currentView = transformService.getView();
    const zoom = currentView.zoom || 1;

    if (shape.type === "rectangle") {
      const rawWidth = typeof shape.width === "number" ? shape.width : 160;
      const rawHeight = typeof shape.height === "number" ? shape.height : 100;
      const width = rawWidth / zoom;
      const height = rawHeight / zoom;

      let x: number;
      let y: number;

      if (shape.x === "center" || shape.y === "center") {
        const center = this.getBoardCenterInWorld();
        x = shape.x === "center" ? center.x - width / 2 : this.toWorldPoint({ x: shape.x, y: 0 }).x;
        y = shape.y === "center" ? center.y - height / 2 : this.toWorldPoint({ x: 0, y: shape.y }).y;
      } else {
        const worldPoint = this.toWorldPoint({ x: shape.x, y: shape.y });
        x = worldPoint.x;
        y = worldPoint.y;
      }

      modelService.createModel("rectangle", {
        type: "rectangle",
        points: [{ x, y }],
        width,
        height,
        options: {
          ...this.board.getService('configService').getCtxConfig(),
          fillStyle: shape.fillStyle,
          strokeStyle: shape.strokeStyle,
          lineWidth: shape.lineWidth,

        }
      } as any);

      return true;
    }

    if (shape.type === "line") {
      if (!Array.isArray(shape.points) || shape.points.length < 2) {
        return false;
      }

      const worldPoints = shape.points.map(p => this.toWorldPoint(p));
      modelService.createModel("line", {
        type: "line",
        points: worldPoints,
        options: {
          strokeStyle: shape.strokeStyle,
          lineWidth: shape.lineWidth
        }
      } as any);

      return true;
    }

    return false;
  }

  private runAction(action: AIGeneratedAction): boolean {
    if (action.type === "updateView") {
      const params = action.params || {};
      this.updateView(params);
      return false;
    }

    if (action.type === "createElement") {
      return this.createElement(action.params);
    }

    return false;
  }

  private shouldYieldBetweenStages(actions: AIGeneratedAction[], index: number): boolean {
    if (index < 0 || index >= actions.length - 1) {
      return false;
    }
    return actions[index].type === "updateView" && actions[index + 1].type === "createElement";
  }

  private renderActionsWithScheduler(actions: AIGeneratedAction[]): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      let cursor = 0;
      let created = 0;

      const runChunk: TaskCallback = (context: TaskContext) => {
        while (cursor < actions.length) {
          const currentIndex = cursor;
          const action = actions[cursor];
          cursor += 1;

          if (this.runAction(action)) {
            created += 1;
          }

          if (this.shouldYieldBetweenStages(actions, currentIndex)) {
            this.requestRender();
            return runChunk;
          }

          if (context.timeRemaining() <= 0) {
            return runChunk;
          }
        }

        this.requestRender();
        resolve(created);
      };

      try {
        this.schedule.schedule(runChunk, {
          priority: TaskPriority.HIGH,
          timeout: 100
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  public renderFromJson(payload: unknown): number {
    const data = this.normalizePayload(payload);
    let created = 0;

    data.actions.forEach((action, index) => {
      if (this.runAction(action)) {
        created += 1;
      }

      if (this.shouldYieldBetweenStages(data.actions, index)) {
        this.requestRender();
      }
    });

    this.requestRender();

    return created;
  }

  public async renderFromJsonAsync(payload: unknown): Promise<number> {
    const data = this.normalizePayload(payload);
    return this.renderActionsWithScheduler(data.actions);
  }

  public async generateAndRender(params: GenerateParams): Promise<{ created: number; data: AIGeneratedPayload }> {
    const endpoint = params.endpoint || "http://localhost:3010/ai/generate";
    const canvas = this.board.getCanvas();
    const body = {
      prompt: params.prompt,
      board: {
        width: canvas?.width || 1200,
        height: canvas?.height || 800
      }
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `AI request failed with status ${response.status}`);
    }

    const result = await response.json();
    const data = this.normalizePayload(result?.data || result);
    const created = await this.renderFromJsonAsync(data);
    return { created, data };
  }
}

export default BoardAIAssistantPlugin;