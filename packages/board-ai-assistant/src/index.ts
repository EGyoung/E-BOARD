import type { EBoard, IHistoryService, IModelService, ITransformService } from "@e-board/board-core";
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

type ArrowShape = {
  type: "arrow";
  points: Array<{ x: number; y: number }>;
  strokeStyle?: string;
  lineWidth?: number;
};

type TextShape = {
  type: "text";
  x: number | "center";
  y: number | "center";
  text: string;
  width?: number;
  height?: number;
  fillStyle?: string;
  strokeStyle?: string;
  lineWidth?: number;
  color?: string;
  fontSize?: number;
  backgroundColor?: string;
};

type AIGeneratedShape = RectangleShape | LineShape | TextShape | ArrowShape;

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

type NodeBox = {
  id: string;
  kind: "rectangle" | "text";
  x: number;
  y: number;
  width: number;
  height: number;
};

type ScreenRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

class BoardAIAssistantPlugin {
  public pluginName = "BoardAIAssistantPlugin";
  private board!: EBoard;
  private schedule = createRafTaskScheduler({ frameBudget: 10, onError: (error) => console.error("scheduler task error:", error) });
  private recentNodeBoxes: NodeBox[] = [];
  private readonly nodeGapX = 40;
  private readonly nodeGapY = 28;
  private labelSeed = 1;

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

  private resetLayoutSession(): void {
    this.recentNodeBoxes = [];
    this.labelSeed = 1;
    this.collectNodeBoxesFromBoard();
  }

  private collectNodeBoxesFromBoard(): void {
    const modelService = this.board.getService("modelService") as unknown as IModelService;
    const models = modelService.getAllModels() as Array<any>;

    models.forEach((model) => {
      if (model.type !== "rectangle" && model.type !== "text") {
        return;
      }

      const box = model.ctrlElement?.getBoundingBox?.(model);
      if (!box) {
        return;
      }

      this.pushNodeBox({
        kind: model.type,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height
      });
    });
  }

  private pushNodeBox(box: Omit<NodeBox, "id">): void {
    this.recentNodeBoxes.push({
      id: `node-${this.recentNodeBoxes.length + 1}`,
      ...box
    });
  }

  private isPointInOrNearBox(point: Point, box: NodeBox, padding = 24): boolean {
    return (
      point.x >= box.x - padding &&
      point.x <= box.x + box.width + padding &&
      point.y >= box.y - padding &&
      point.y <= box.y + box.height + padding
    );
  }

  private findNearestRectangleNode(point: Point): NodeBox | null {
    let bestNode: NodeBox | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    this.recentNodeBoxes.forEach((nodeBox) => {
      if (nodeBox.kind !== "rectangle") {
        return;
      }

      if (!this.isPointInOrNearBox(point, nodeBox)) {
        return;
      }

      const center = {
        x: nodeBox.x + nodeBox.width / 2,
        y: nodeBox.y + nodeBox.height / 2
      };
      const distance = this.getDistance(point, center);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestNode = nodeBox;
      }
    });

    return bestNode;
  }

  private resolveNodePosition(
    x: number | "center",
    y: number | "center",
    rawWidth: number,
    rawHeight: number,
    zoom: number,
    options?: { avoidOverlap?: boolean }
  ) {
    const width = rawWidth / zoom;
    const height = rawHeight / zoom;
    const canvas = this.board.getCanvas();
    const centerScreen = canvas ? { x: canvas.width / 2, y: canvas.height / 2 } : { x: 0, y: 0 };

    let screenX: number;
    let screenY: number;

    if (x === "center") {
      screenX = centerScreen.x - rawWidth / 2;
    } else {
      screenX = x;
    }

    if (y === "center") {
      screenY = centerScreen.y - rawHeight / 2;
    } else {
      screenY = y;
    }

    const shouldAvoidOverlap = options?.avoidOverlap ?? true;
    if (shouldAvoidOverlap) {
      const adjustedPosition = this.findNonOverlappingNodePosition(screenX, screenY, rawWidth, rawHeight);
      screenX = adjustedPosition.x;
      screenY = adjustedPosition.y;
    }

    const worldPoint = this.toWorldPoint({ x: screenX, y: screenY });

    return {
      x: worldPoint.x,
      y: worldPoint.y,
      width,
      height,
      screenX,
      screenY,
      screenWidth: rawWidth,
      screenHeight: rawHeight
    };
  }

  private isNodeOverlapping(a: ScreenRect, b: ScreenRect): boolean {
    return !(
      a.x + a.width + this.nodeGapX <= b.x ||
      a.x >= b.x + b.width + this.nodeGapX ||
      a.y + a.height + this.nodeGapY <= b.y ||
      a.y >= b.y + b.height + this.nodeGapY
    );
  }

  private clampNodePosition(x: number, y: number, width: number, height: number) {
    const canvas = this.board.getCanvas();
    if (!canvas) {
      return { x, y };
    }

    const margin = 8;
    const maxX = Math.max(margin, canvas.width - width - margin);
    const maxY = Math.max(margin, canvas.height - height - margin);

    return {
      x: Math.min(Math.max(x, margin), maxX),
      y: Math.min(Math.max(y, margin), maxY)
    };
  }

  private findNonOverlappingNodePosition(initialX: number, initialY: number, width: number, height: number) {
    let candidateX = initialX;
    let candidateY = initialY;

    for (let i = 0; i < 80; i += 1) {
      const clamped = this.clampNodePosition(candidateX, candidateY, width, height);
      candidateX = clamped.x;
      candidateY = clamped.y;

      const overlappingNode = this.recentNodeBoxes.find((nodeBox) =>
        this.isNodeOverlapping({ x: candidateX, y: candidateY, width, height }, nodeBox)
      );

      if (!overlappingNode) {
        return { x: candidateX, y: candidateY };
      }

      if (i % 2 === 0) {
        candidateX = overlappingNode.x + overlappingNode.width + this.nodeGapX;
      } else {
        candidateX = initialX;
        candidateY = overlappingNode.y + overlappingNode.height + this.nodeGapY;
      }
    }

    return this.clampNodePosition(candidateX, candidateY, width, height);
  }

  private getNodeEdgeCandidates(box: NodeBox): Point[] {
    return [
      { x: box.x + box.width / 2, y: box.y },
      { x: box.x + box.width / 2, y: box.y + box.height },
      { x: box.x, y: box.y + box.height / 2 },
      { x: box.x + box.width, y: box.y + box.height / 2 }
    ];
  }

  private getDistance(a: Point, b: Point): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private getSnapNodeBoxes(preferRectangle = false): NodeBox[] {
    if (!preferRectangle) {
      return this.recentNodeBoxes;
    }
    const rectangleBoxes = this.recentNodeBoxes.filter(box => box.kind === "rectangle");
    return rectangleBoxes.length > 0 ? rectangleBoxes : this.recentNodeBoxes;
  }

  private findNearestNode(point: Point, options?: { excludeNodeId?: string; preferRectangle?: boolean }): NodeBox | null {
    const candidateNodes = this.getSnapNodeBoxes(options?.preferRectangle ?? false);
    let bestNode: NodeBox | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    candidateNodes.forEach((nodeBox) => {
      if (options?.excludeNodeId && nodeBox.id === options.excludeNodeId) {
        return;
      }

      const center = {
        x: nodeBox.x + nodeBox.width / 2,
        y: nodeBox.y + nodeBox.height / 2
      };
      const distance = this.getDistance(point, center);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestNode = nodeBox;
      }
    });

    return bestNode;
  }

  private getShortestEdgePair(sourceNode: NodeBox, targetNode: NodeBox): { from: Point; to: Point } {
    const sourceCandidates = this.getNodeEdgeCandidates(sourceNode);
    const targetCandidates = this.getNodeEdgeCandidates(targetNode);

    let bestFrom = sourceCandidates[0];
    let bestTo = targetCandidates[0];
    let bestDistance = Number.POSITIVE_INFINITY;

    sourceCandidates.forEach((fromPoint) => {
      targetCandidates.forEach((toPoint) => {
        const distance = this.getDistance(fromPoint, toPoint);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestFrom = fromPoint;
          bestTo = toPoint;
        }
      });
    });

    return {
      from: bestFrom,
      to: bestTo
    };
  }

  private snapPointToNearestNodeEdge(
    point: Point,
    maxSnapDistance = 140,
    excludeNodeId?: string,
    preferRectangle = false
  ): { point: Point; nodeId: string } | null {
    let bestDistance = Number.POSITIVE_INFINITY;
    let bestPoint: Point | null = null;
    let bestNodeId: string | null = null;

    this.getSnapNodeBoxes(preferRectangle).forEach((nodeBox) => {
      if (excludeNodeId && nodeBox.id === excludeNodeId) {
        return;
      }

      const candidates = this.getNodeEdgeCandidates(nodeBox);
      candidates.forEach((candidate) => {
        const distance = this.getDistance(point, candidate);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestPoint = candidate;
          bestNodeId = nodeBox.id;
        }
      });
    });

    if (!bestPoint || !bestNodeId || bestDistance > maxSnapDistance) {
      return null;
    }

    return {
      point: bestPoint,
      nodeId: bestNodeId
    };
  }

  private snapArrowPoints(points: Point[]): Point[] {
    if (points.length < 2 || this.recentNodeBoxes.length === 0) {
      return points;
    }

    const nextPoints = [...points];
    const startIndex = 0;
    const endIndex = points.length - 1;

    const sourceNode =
      this.findNearestNode(points[startIndex], { preferRectangle: true }) ||
      this.findNearestNode(points[startIndex]);
    const targetNode =
      this.findNearestNode(points[endIndex], { excludeNodeId: sourceNode?.id, preferRectangle: true }) ||
      this.findNearestNode(points[endIndex], { excludeNodeId: sourceNode?.id });

    if (sourceNode && targetNode && sourceNode.id !== targetNode.id) {
      const shortestPair = this.getShortestEdgePair(sourceNode, targetNode);
      nextPoints[startIndex] = shortestPair.from;
      nextPoints[endIndex] = shortestPair.to;
      return nextPoints;
    }

    const startSnapped =
      this.snapPointToNearestNodeEdge(points[startIndex], 220, undefined, true) ||
      this.snapPointToNearestNodeEdge(points[startIndex], Number.POSITIVE_INFINITY, undefined, true) ||
      this.snapPointToNearestNodeEdge(points[startIndex], Number.POSITIVE_INFINITY);
    if (startSnapped) {
      nextPoints[startIndex] = startSnapped.point;
    }

    const endSnapped =
      this.snapPointToNearestNodeEdge(points[endIndex], 220, startSnapped?.nodeId, true) ||
      this.snapPointToNearestNodeEdge(points[endIndex], Number.POSITIVE_INFINITY, startSnapped?.nodeId, true) ||
      this.snapPointToNearestNodeEdge(points[endIndex], Number.POSITIVE_INFINITY, startSnapped?.nodeId);
    if (endSnapped) {
      nextPoints[endIndex] = endSnapped.point;
    }

    return nextPoints;
  }

  private isRectangleCreateAction(action: AIGeneratedAction): action is CreateElementAction {
    return action.type === "createElement" && action.params.type === "rectangle";
  }

  private isTextCreateAction(action: AIGeneratedAction): action is CreateElementAction {
    return action.type === "createElement" && action.params.type === "text";
  }

  private getShapeBounds(shape: AIGeneratedShape): ScreenRect | null {
    if (shape.type !== "rectangle" && shape.type !== "text") {
      return null;
    }

    if (typeof shape.x !== "number" || typeof shape.y !== "number") {
      return null;
    }

    const width = typeof shape.width === "number" ? shape.width : (shape.type === "rectangle" ? 160 : 180);
    const height = typeof shape.height === "number" ? shape.height : (shape.type === "rectangle" ? 100 : 64);

    return {
      x: shape.x,
      y: shape.y,
      width,
      height
    };
  }

  private isTextMappedToRectangle(rect: ScreenRect, textShape: TextShape): boolean {
    if (typeof textShape.x !== "number" || typeof textShape.y !== "number") {
      return false;
    }

    const point = { x: textShape.x, y: textShape.y };
    return this.isPointInOrNearBox(point, {
      id: "tmp",
      kind: "rectangle",
      ...rect
    }, 36);
  }

  private injectMissingNodeLabels(actions: AIGeneratedAction[]): AIGeneratedAction[] {
    const rectangleActions = actions.filter(this.isRectangleCreateAction.bind(this));
    const textActions = actions.filter(this.isTextCreateAction.bind(this));
    const synthesizedTexts: AIGeneratedAction[] = [];

    rectangleActions.forEach((rectAction) => {
      const rectShape = rectAction.params;
      if (rectShape.type !== "rectangle") {
        return;
      }
      const rectBounds = this.getShapeBounds(rectShape);
      if (!rectBounds) {
        return;
      }

      const hasLabel = textActions.some((textAction) => {
        const textShape = textAction.params;
        return textShape.type === "text" && this.isTextMappedToRectangle(rectBounds, textShape);
      });

      if (hasLabel) {
        return;
      }

      synthesizedTexts.push({
        type: "createElement",
        params: {
          type: "text",
          x: rectBounds.x,
          y: rectBounds.y,
          width: rectBounds.width,
          height: rectBounds.height,
          text: `节点${this.labelSeed++}`,
          color: "#000000",
          backgroundColor: "transparent",
          fontSize: 16
        }
      });
    });

    if (synthesizedTexts.length > 0) {
      console.warn(`BoardAIAssistantPlugin: synthesized ${synthesizedTexts.length} missing node label(s).`);
    }

    return [...actions, ...synthesizedTexts];
  }

  private getHistoryService() {
    return this.board.getService("historyService") as unknown as IHistoryService | undefined;
  }

  private withHistoryBatch<T>(runner: () => T): T {
    const historyService = this.getHistoryService();
    historyService?.startBatch?.();
    try {
      return runner();
    } finally {
      historyService?.endBatch?.();
    }
  }

  private async withHistoryBatchAsync<T>(runner: () => Promise<T>): Promise<T> {
    const historyService = this.getHistoryService();
    historyService?.startBatch?.();
    try {
      return await runner();
    } finally {
      historyService?.endBatch?.();
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  private isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
  }

  private isCoordinate(value: unknown): value is number | "center" {
    return value === "center" || this.isFiniteNumber(value);
  }

  private parsePoint(value: unknown): Point | null {
    if (!this.isRecord(value)) {
      return null;
    }
    const x = value.x;
    const y = value.y;
    if (!this.isFiniteNumber(x) || !this.isFiniteNumber(y)) {
      return null;
    }
    return { x, y };
  }

  private parseRectangleShape(value: unknown): RectangleShape | null {
    if (!this.isRecord(value)) {
      return null;
    }

    if (!this.isCoordinate(value.x) || !this.isCoordinate(value.y)) {
      return null;
    }

    if (typeof value.width !== "undefined" && (!this.isFiniteNumber(value.width) || value.width <= 0)) {
      return null;
    }

    if (typeof value.height !== "undefined" && (!this.isFiniteNumber(value.height) || value.height <= 0)) {
      return null;
    }

    if (typeof value.lineWidth !== "undefined" && (!this.isFiniteNumber(value.lineWidth) || value.lineWidth < 0)) {
      return null;
    }

    if (typeof value.fillStyle !== "undefined" && typeof value.fillStyle !== "string") {
      return null;
    }

    if (typeof value.strokeStyle !== "undefined" && typeof value.strokeStyle !== "string") {
      return null;
    }

    return {
      type: "rectangle",
      x: value.x,
      y: value.y,
      width: value.width,
      height: value.height,
      fillStyle: value.fillStyle,
      strokeStyle: value.strokeStyle,
      lineWidth: value.lineWidth
    };
  }

  private parseLineShape(value: unknown): LineShape | null {
    if (!this.isRecord(value) || !Array.isArray(value.points)) {
      return null;
    }

    const points = value.points
      .map((pointValue) => this.parsePoint(pointValue))
      .filter((point): point is Point => !!point);

    if (points.length < 2) {
      return null;
    }

    if (typeof value.lineWidth !== "undefined" && (!this.isFiniteNumber(value.lineWidth) || value.lineWidth < 0)) {
      return null;
    }

    if (typeof value.strokeStyle !== "undefined" && typeof value.strokeStyle !== "string") {
      return null;
    }

    return {
      type: "line",
      points,
      strokeStyle: value.strokeStyle,
      lineWidth: value.lineWidth
    };
  }

  private parseArrowShape(value: unknown): ArrowShape | null {
    if (!this.isRecord(value) || !Array.isArray(value.points)) {
      return null;
    }

    const points = value.points
      .map((pointValue) => this.parsePoint(pointValue))
      .filter((point): point is Point => !!point);

    if (points.length < 2) {
      return null;
    }

    if (typeof value.lineWidth !== "undefined" && (!this.isFiniteNumber(value.lineWidth) || value.lineWidth < 0)) {
      return null;
    }

    if (typeof value.strokeStyle !== "undefined" && typeof value.strokeStyle !== "string") {
      return null;
    }

    return {
      type: "arrow",
      points,
      strokeStyle: value.strokeStyle,
      lineWidth: value.lineWidth
    };
  }

  private parseTextShape(value: unknown): TextShape | null {
    if (!this.isRecord(value)) {
      return null;
    }

    if (!this.isCoordinate(value.x) || !this.isCoordinate(value.y)) {
      return null;
    }

    if (typeof value.text !== "string" || !value.text.trim()) {
      return null;
    }

    if (typeof value.width !== "undefined" && (!this.isFiniteNumber(value.width) || value.width <= 0)) {
      return null;
    }

    if (typeof value.height !== "undefined" && (!this.isFiniteNumber(value.height) || value.height <= 0)) {
      return null;
    }

    if (typeof value.lineWidth !== "undefined" && (!this.isFiniteNumber(value.lineWidth) || value.lineWidth < 0)) {
      return null;
    }

    if (typeof value.fontSize !== "undefined" && (!this.isFiniteNumber(value.fontSize) || value.fontSize <= 0)) {
      return null;
    }

    if (typeof value.fillStyle !== "undefined" && typeof value.fillStyle !== "string") {
      return null;
    }

    if (typeof value.strokeStyle !== "undefined" && typeof value.strokeStyle !== "string") {
      return null;
    }

    if (typeof value.color !== "undefined" && typeof value.color !== "string") {
      return null;
    }

    if (typeof value.backgroundColor !== "undefined" && typeof value.backgroundColor !== "string") {
      return null;
    }

    return {
      type: "text",
      x: value.x,
      y: value.y,
      text: value.text,
      width: value.width,
      height: value.height,
      fillStyle: value.fillStyle,
      strokeStyle: value.strokeStyle,
      lineWidth: value.lineWidth,
      color: value.color,
      fontSize: value.fontSize,
      backgroundColor: value.backgroundColor
    };
  }

  private parseShape(value: unknown): AIGeneratedShape | null {
    if (!this.isRecord(value) || typeof value.type !== "string") {
      return null;
    }

    if (value.type === "rectangle") {
      return this.parseRectangleShape(value);
    }

    if (value.type === "line") {
      return this.parseLineShape(value);
    }

    if (value.type === "arrow") {
      return this.parseArrowShape(value);
    }

    if (value.type === "text") {
      return this.parseTextShape(value);
    }

    return null;
  }

  private parseUpdateViewAction(value: unknown): UpdateViewAction | null {
    if (!this.isRecord(value) || !this.isRecord(value.params)) {
      return null;
    }

    const params = value.params;
    const nextParams: UpdateViewAction["params"] = {};

    if (typeof params.x !== "undefined") {
      if (!this.isFiniteNumber(params.x)) {
        return null;
      }
      nextParams.x = params.x;
    }

    if (typeof params.y !== "undefined") {
      if (!this.isFiniteNumber(params.y)) {
        return null;
      }
      nextParams.y = params.y;
    }

    if (typeof params.zoom !== "undefined") {
      if (!this.isFiniteNumber(params.zoom) || params.zoom <= 0) {
        return null;
      }
      nextParams.zoom = params.zoom;
    }

    if (typeof params.center !== "undefined") {
      const center = this.parsePoint(params.center);
      if (!center) {
        return null;
      }
      nextParams.center = center;
    }

    return {
      type: "updateView",
      params: nextParams
    };
  }

  private parseCreateElementAction(value: unknown): CreateElementAction | null {
    if (!this.isRecord(value)) {
      return null;
    }

    const shape = this.parseShape(value.params);
    if (!shape) {
      return null;
    }

    return {
      type: "createElement",
      params: shape
    };
  }

  private parseAction(value: unknown): AIGeneratedAction | null {
    if (!this.isRecord(value) || typeof value.type !== "string") {
      return null;
    }

    if (value.type === "updateView") {
      return this.parseUpdateViewAction(value);
    }

    if (value.type === "createElement") {
      return this.parseCreateElementAction(value);
    }

    return null;
  }

  private normalizePayload(payload: unknown): AIGeneratedPayload {
    if (!payload || typeof payload !== "object") {
      return { actions: [] };
    }
    const data = payload as Record<string, unknown>;
    let candidateActions: unknown[] = [];

    if (Array.isArray(data.actions)) {
      candidateActions = data.actions;
    } else {
      const elementsRaw = Array.isArray(data.elements) ? data.elements : Array.isArray(payload) ? payload : [];
      candidateActions = elementsRaw.map(shape => ({
        type: "createElement",
        params: shape
      }));
    }

    const actions = candidateActions
      .map((candidateAction) => this.parseAction(candidateAction))
      .filter((action): action is AIGeneratedAction => !!action);

    if (actions.length !== candidateActions.length) {
      console.warn(`BoardAIAssistantPlugin: filtered ${candidateActions.length - actions.length} invalid AI action(s).`);
    }

    return { actions };
  }

  private createElement(shape: AIGeneratedShape): boolean {
    const modelService = this.board.getService("modelService") as unknown as IModelService;
    const transformService = this.board.getService("transformService") as unknown as ITransformService;
    const currentView = transformService.getView();
    const zoom = currentView.zoom || 1;

    if (shape.type === "rectangle") {
      const rawWidth = typeof shape.width === "number" ? shape.width : 160;
      const rawHeight = typeof shape.height === "number" ? shape.height : 100;
      const placement = this.resolveNodePosition(shape.x, shape.y, rawWidth, rawHeight, zoom);

      modelService.createModel("rectangle", {
        type: "rectangle",
        points: [{ x: placement.x, y: placement.y }],
        width: placement.width,
        height: placement.height,
        options: {
          ...this.board.getService('configService').getCtxConfig(),
          fillStyle: shape.fillStyle,
          strokeStyle: shape.strokeStyle,
          lineWidth: shape.lineWidth,

        }
      } as any);

      this.pushNodeBox({
        kind: "rectangle",
        x: placement.screenX,
        y: placement.screenY,
        width: placement.screenWidth,
        height: placement.screenHeight
      });

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

    if (shape.type === "arrow") {
      if (!Array.isArray(shape.points) || shape.points.length < 2) {
        return false;
      }

      const snappedPoints = this.snapArrowPoints(shape.points);
      const worldPoints = snappedPoints.map(p => this.toWorldPoint(p));
      modelService.createModel("arrow", {
        type: "arrow",
        points: worldPoints,
        options: {
          strokeStyle: shape.strokeStyle,
          lineWidth: shape.lineWidth
        }
      } as any);

      return true;
    }

    if (shape.type === "text") {
      const text = shape.text.trim();
      if (!text) {
        return false;
      }

      const estimatedFontSize = typeof shape.fontSize === "number" ? shape.fontSize : 18;
      const estimatedWidth = Math.max(140, Math.ceil(text.length * estimatedFontSize * 0.65) + 24);
      const estimatedHeight = Math.max(56, Math.ceil(estimatedFontSize * 1.8) + 20);

      let rawWidth = typeof shape.width === "number" ? shape.width : estimatedWidth;
      let rawHeight = typeof shape.height === "number" ? shape.height : estimatedHeight;
      let textX = shape.x;
      let textY = shape.y;
      let lockToRectNode = false;

      if (typeof shape.x === "number" && typeof shape.y === "number") {
        const nearestRectNode = this.findNearestRectangleNode({ x: shape.x, y: shape.y });
        if (nearestRectNode) {
          textX = nearestRectNode.x;
          textY = nearestRectNode.y;
          rawWidth = nearestRectNode.width;
          rawHeight = nearestRectNode.height;
          lockToRectNode = true;
        }
      }

      const placement = this.resolveNodePosition(textX, textY, rawWidth, rawHeight, zoom, {
        avoidOverlap: !lockToRectNode
      });

      modelService.createModel("text", {
        type: "text",
        points: [{ x: placement.x, y: placement.y }],
        width: placement.width,
        height: placement.height,
        text,
        fontSize: shape.fontSize,
        options: {
          ...this.board.getService('configService').getCtxConfig(),
          fillStyle: shape.color ?? shape.fillStyle,
          backgroundColor: shape.backgroundColor,
          strokeStyle: shape.strokeStyle,
          lineWidth: shape.lineWidth
        }
      } as any);

      this.pushNodeBox({
        kind: "text",
        x: placement.screenX,
        y: placement.screenY,
        width: placement.screenWidth,
        height: placement.screenHeight
      });

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

  private isArrowCreateAction(action: AIGeneratedAction): action is CreateElementAction {
    return action.type === "createElement" && action.params.type === "arrow";
  }

  private reorderActionsForConnection(actions: AIGeneratedAction[]): AIGeneratedAction[] {
    const result: AIGeneratedAction[] = [];
    let segment: AIGeneratedAction[] = [];

    const flushSegment = () => {
      if (segment.length === 0) {
        return;
      }

      const normalizedSegment = this.injectMissingNodeLabels(segment);

      const nonArrowActions = normalizedSegment.filter(action => !this.isArrowCreateAction(action));
      const arrowActions = normalizedSegment.filter(action => this.isArrowCreateAction(action));

      result.push(...nonArrowActions, ...arrowActions);
      segment = [];
    };

    actions.forEach((action) => {
      if (action.type === "updateView") {
        flushSegment();
        result.push(action);
        return;
      }

      segment.push(action);
    });

    flushSegment();
    return result;
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
    return this.withHistoryBatch(() => {
      this.resetLayoutSession();
      const data = this.normalizePayload(payload);
      const orderedActions = this.reorderActionsForConnection(data.actions);
      let created = 0;

      orderedActions.forEach((action, index) => {
        if (this.runAction(action)) {
          created += 1;
        }

        if (this.shouldYieldBetweenStages(orderedActions, index)) {
          this.requestRender();
        }
      });

      this.requestRender();

      return created;
    });
  }

  public async renderFromJsonAsync(payload: unknown): Promise<number> {
    return this.withHistoryBatchAsync(async () => {
      this.resetLayoutSession();
      const data = this.normalizePayload(payload);
      const orderedActions = this.reorderActionsForConnection(data.actions);
      return this.renderActionsWithScheduler(orderedActions);
    });
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