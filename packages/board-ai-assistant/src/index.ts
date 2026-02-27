import type { EBoard, IModelService, ITransformService } from "@e-board/board-core";

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

  public exports = {
    generateAndRender: this.generateAndRender.bind(this),
    renderFromJson: this.renderFromJson.bind(this)
  };

  public init({ board }: { board: EBoard }) {
    this.board = board;
  }

  public dispose(): void { }

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

    if (shape.type === "rectangle") {
      const width = typeof shape.width === "number" ? shape.width : 160;
      const height = typeof shape.height === "number" ? shape.height : 100;
      const center = this.getBoardCenterInWorld();
      const x = shape.x === "center" ? center.x - width / 2 : shape.x;
      const y = shape.y === "center" ? center.y - height / 2 : shape.y;

      modelService.createModel("rectangle", {
        type: "rectangle",
        points: [{ x, y }],
        width,
        height,
        options: {
          fillStyle: shape.fillStyle,
          strokeStyle: shape.strokeStyle,
          lineWidth: shape.lineWidth
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
      const transformService = this.board.getService("transformService") as unknown as ITransformService;
      const params = action.params || {};
      if (params.center) {
        this.moveViewportToWorldPoint(params.center);
        return false;
      }

      transformService.setView({
        x: params.x,
        y: params.y,
        zoom: params.zoom
      });
      return false;
    }

    if (action.type === "createElement") {
      return this.createElement(action.params);
    }

    return false;
  }

  public renderFromJson(payload: unknown): number {
    const data = this.normalizePayload(payload);
    let created = 0;

    data.actions.forEach(action => {
      if (this.runAction(action)) {
        created += 1;
      }
    });

    return created;
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
    const created = this.renderFromJson(data);
    return { created, data };
  }
}

export default BoardAIAssistantPlugin;