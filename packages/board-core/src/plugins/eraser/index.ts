import { eBoardContainer } from '../../common/IocContainer';
import { IBoard, IPluginInitParams } from '../../types';
import { IEventService, IHistoryService, IModel, IModelService, IModeService, ITransformService, OperationSource } from '../../services';
import { IPlugin } from '../type';
import { calculateStrokeFragments, isStrokeHitByEraserSegment } from './geometry';
import { EraseTransactionState, LineModel, Point } from './type';
import { drawCursor as eraserDrawCursor } from './renderer';

const CURRENT_MODE = 'eraser';
const DEFAULT_ERASER_SIZE = 24;
const DENSIFY_STEP = 2;

class EraserPlugin implements IPlugin {
  private board!: IBoard;
  private disposeList: (() => void)[] = [];
  private isErasing = false;
  private erasingState: EraseTransactionState | null = null;
  private hiddenLineIds = new Set<string>();
  private lastCursorScreenPoint: Point | null = null;
  private eraserSize = DEFAULT_ERASER_SIZE;
  private modelService = eBoardContainer.get<IModelService>(IModelService);
  private transformService = eBoardContainer.get<ITransformService>(ITransformService);
  private historyService = eBoardContainer.get<IHistoryService>(IHistoryService);

  public pluginName = 'EraserPlugin';
  public dependencies = [];
  public exports = {
    setEraserSize: (size: number) => this.setEraserSize(size),
    getEraserSize: () => this.eraserSize,
  };

  public init({ board }: IPluginInitParams) {
    this.board = board;
    this.initEraserMode();
  }

  private initEraserMode() {
    const modeService = eBoardContainer.get<IModeService>(IModeService);
    modeService.registerMode(CURRENT_MODE, {
      beforeSwitchMode: ({ currentMode }) => {
        if (currentMode === CURRENT_MODE) {
          this.disposePointerEvents();
          this.discardPreview();
          this.resetTransaction();
          this.clearInteractionCanvas();
          this.setCanvasCursor('default');
        }
      },
      afterSwitchMode: ({ currentMode }) => {
        if (currentMode === CURRENT_MODE) {
          this.initPointerEvents();
          this.setCanvasCursor('none');
        }
      },
    });
  }

  private setEraserSize(size: number) {
    this.eraserSize = Math.max(4, size);
  }

  private getCanvasPoint(clientX: number, clientY: number): Point {
    const canvas = this.board.getCanvas();
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  private toWorldPoint(point: Point): Point {
    return this.transformService.transformPoint(point, true);
  }

  private toScreenPoint(point: Point): Point {
    return this.transformService.transformPoint(point);
  }

  private getEraserRadius() {
    const zoom = this.transformService.getView().zoom || 1;
    return this.eraserSize / 2 / zoom;
  }

  private isLineModel(model: IModel<Record<string, any>>): model is LineModel {
    return model.type === 'line' && Array.isArray(model.points) && model.points.length > 1;
  }

  private getLineWidth(model: LineModel) {
    return Number(model.options?.lineWidth || 1);
  }

  private cloneLine(line: LineModel): LineModel {
    return {
      ...line,
      points: this.densifyPoints(line.points).map(point => ({ ...point })),
      options: { ...(line.options || {}) },
    };
  }


  // 做点插值处理，方便让点和点之间更加密集
  private appendDensifiedLine(result: Point[], start: Point, end: Point, step: number) {
    /**
     * 返回点和点之间实际的长度 
     * dx = end.x - start.x, dy = end.y - start.y。
        Math.hypot(dx, dy) 等价于 Math.sqrt(dx*dx + dy*dy)，返回线段的实际长度（坐标单位）。
     */
    /**
     * step表示差值的间隔 Count表示要插入的点个数是多少
     */
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    const count = Math.max(1, Math.ceil(length / step));

    for (let j = 1; j <= count; j++) {
      const t = j / count;
      result.push({
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
      });
    }
  }


  private densifyPoints(points: Point[], step = DENSIFY_STEP) {
    if (points.length < 2) return points.map(point => ({ ...point }));

    const result: Point[] = [{ ...points[0] }];

    for (let i = 1; i < points.length; i++) {
      this.appendDensifiedLine(result, points[i - 1], points[i], step);
    }

    return result;
  }

  private createLineModel(points: Point[], line: LineModel) {
    return this.modelService.createModel('line', {
      points: points.map(point => ({ ...point })),
      options: { ...(line.options || {}) },
    }) as LineModel;
  }

  private deleteModel(id: string, operationSource = OperationSource.LOCAL) {
    return (this.modelService as any).deleteModel(id, operationSource);
  }

  private restoreOriginalModels(operationSource = OperationSource.REMOTE) {
    if (!this.erasingState) return;

    this.erasingState.affectedLines.forEach(line => {
      if (this.modelService.getModelById(line.id)) return;

      (this.modelService as any).createModel(line.type, {
        ...line,
        id: line.id,
        points: line.points.map(point => ({ ...point })),
        options: { ...(line.options || {}) },
      }, operationSource);
    });
    this.hiddenLineIds.clear();
  }

  private hideAffectedOriginals() {
    if (!this.erasingState) return;

    this.erasingState.affectedLines.forEach((_, lineId) => {
      if (this.hiddenLineIds.has(lineId)) return;
      if (!this.modelService.getModelById(lineId)) return;

      this.deleteModel(lineId, OperationSource.REMOTE);
      this.hiddenLineIds.add(lineId);
    });
  }

  private discardPreview() {
    this.restoreOriginalModels(OperationSource.REMOTE);
    this.hiddenLineIds.clear();
  }

  private initPointerEvents = () => {
    const eventService = eBoardContainer.get<IEventService>(IEventService);
    const renderService = (this.board as any).getService('renderService');

    // 渲染结束后也得drawOverlay 否则擦除时会闪烁
    const renderEndDispose = renderService?.onRenderEnd?.(() => this.drawOverlay())?.dispose;

    const { dispose: disposePointerDown } = eventService.onPointerDown(event => {
      this.isErasing = true;
      const screenPoint = this.getCanvasPoint(event.clientX, event.clientY);
      const worldPoint = this.toWorldPoint(screenPoint);
      this.lastCursorScreenPoint = screenPoint;
      this.erasingState = {
        eraserPath: [worldPoint],
        affectedLines: new Map(),
        tempFragments: new Map(),
      };
      this.handleEraserMove(worldPoint);
      this.drawOverlay();
    });

    const { dispose: disposePointerMove } = eventService.onPointerMove(event => {
      const screenPoint = this.getCanvasPoint(event.clientX, event.clientY);
      this.lastCursorScreenPoint = screenPoint;

      if (!this.isErasing) {
        this.drawOverlay();
        return;
      }

      const worldPoint = this.toWorldPoint(screenPoint);
      this.erasingState?.eraserPath.push(worldPoint);
      // 只要两个点就行了 防止越擦越卡
      if (this.erasingState && this.erasingState.eraserPath.length > 2) {
        this.erasingState.eraserPath.shift();
      }
      this.handleEraserMove(worldPoint);
      this.drawOverlay();
    });

    const { dispose: disposePointerUp } = eventService.onPointerUp(event => {
      if (!this.isErasing) return;
      const screenPoint = this.getCanvasPoint(event.clientX, event.clientY);
      const worldPoint = this.toWorldPoint(screenPoint);
      this.lastCursorScreenPoint = screenPoint;
      this.erasingState?.eraserPath.push(worldPoint);
      // this.handleEraserMove(worldPoint);
      this.commitErase();
      this.isErasing = false;
      this.resetTransaction();
      this.clearInteractionCanvas();
      this.drawOverlay();
    });

    this.disposeList.push(disposePointerDown, disposePointerMove, disposePointerUp);
    if (renderEndDispose) this.disposeList.push(renderEndDispose);
  };

  private disposePointerEvents() {
    this.disposeList.forEach(dispose => dispose());
    this.disposeList = [];
  }

  private handleEraserMove(pos: Point) {
    if (!this.erasingState) return;

    const eraserPath = this.erasingState.eraserPath;
    const previousPoint = eraserPath.length > 1 ? eraserPath[eraserPath.length - 2] : pos;
    const eraserRadius = this.getEraserRadius();

    this.modelService.getAllModels().forEach(model => {
      if (!this.isLineModel(model) || this.erasingState?.affectedLines.has(model.id)) return;

      const denseLine = this.cloneLine(model);
      // 判断橡皮和线段是否发生了碰撞检测
      if (isStrokeHitByEraserSegment(
        denseLine.points,
        this.getLineWidth(model),
        previousPoint,
        pos,
        eraserRadius,
      )) {
        this.erasingState?.affectedLines.set(model.id, denseLine);
        this.erasingState?.tempFragments.set(model.id, [denseLine.points]);
      }
    });

    const currentEraserSegment = previousPoint === pos ? [pos] : [previousPoint, pos];

    this.erasingState.affectedLines.forEach(line => {
      const currentFragments = this.erasingState?.tempFragments.get(line.id) || [line.points];
      // 等价于先map 再 flat
      const nextFragments = currentFragments.flatMap(points => calculateStrokeFragments(
        points,
        currentEraserSegment,
        eraserRadius,
        this.getLineWidth(line),
      ));
      this.erasingState?.tempFragments.set(line.id, nextFragments);
    });

    // 将被擦除的线段从models里删除 然后新增线段
    this.hideAffectedOriginals();
  }

  private commitErase() {
    if (!this.erasingState || this.erasingState.affectedLines.size === 0) {
      this.discardPreview();
      return;
    }

    const affectedLines = Array.from(this.erasingState.affectedLines.values());
    const tempFragments = new Map(this.erasingState.tempFragments);

    this.restoreOriginalModels(OperationSource.REMOTE);

    this.historyService.startBatch();

    try {
      affectedLines.forEach(line => {
        this.deleteModel(line.id);
        const fragments = tempFragments.get(line.id) || [];

        fragments.forEach(points => {
          if (points.length < 2) return;
          this.createLineModel(points, line);
        });
      });
    } finally {
      this.historyService.endBatch();
    }
  }

  // 绘制覆盖层 => 覆盖层包括鼠标以及断开的线段
  private drawOverlay() {
    const interactionCtx = this.board.getInteractionCtx();
    const interactionCanvas = this.board.getInteractionCanvas();
    if (!interactionCtx || !interactionCanvas) return;

    interactionCtx.clearRect(0, 0, interactionCanvas.width, interactionCanvas.height);

    if (this.erasingState) {
      this.erasingState.tempFragments.forEach((fragments, lineId) => {
        const line = this.erasingState?.affectedLines.get(lineId);
        if (!line) return;
        // 暂时裂开的点先绘制到交互层中
        fragments.forEach(points => this.drawLineFragment(interactionCtx, line, points));
      });
    }

    if (this.lastCursorScreenPoint) {
      eraserDrawCursor(interactionCtx, this.lastCursorScreenPoint, this.eraserSize);
    }
  }

  private drawLineFragment(ctx: CanvasRenderingContext2D, line: LineModel, points: Point[]) {
    if (points.length < 2) return;

    const zoom = this.transformService.getView().zoom || 1;
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = String(line.options?.strokeStyle || '#1d1d1f');
    ctx.lineWidth = this.getLineWidth(line) * zoom;
    ctx.lineCap = line.options?.lineCap || 'round';
    ctx.lineJoin = line.options?.lineJoin || 'round';
    // TODO: 这个鸡吧绘制逻辑有很多份 应该统一抽离 活着换一种方式实现 不然后面如果加上笔锋 这里的渲染逻辑都要改
    points.forEach((point, index) => {
      const screenPoint = this.toScreenPoint(point);
      if (index === 0) {
        ctx.moveTo(screenPoint.x, screenPoint.y);
      } else if (index < 2) {
        ctx.lineTo(screenPoint.x, screenPoint.y);
      } else {
        const previousScreenPoint = this.toScreenPoint(points[index - 1]);
        const midPointX = (previousScreenPoint.x + screenPoint.x) / 2;
        const midPointY = (previousScreenPoint.y + screenPoint.y) / 2;
        ctx.quadraticCurveTo(previousScreenPoint.x, previousScreenPoint.y, midPointX, midPointY);
      }
    });

    ctx.stroke();
    ctx.restore();
  }


  private clearInteractionCanvas() {
    const interactionCtx = this.board.getInteractionCtx();
    const interactionCanvas = this.board.getInteractionCanvas();
    if (!interactionCtx || !interactionCanvas) return;
    interactionCtx.clearRect(0, 0, interactionCanvas.width, interactionCanvas.height);
  }

  private setCanvasCursor(cursor: string) {
    const interactionCanvas = this.board.getInteractionCanvas();
    if (!interactionCanvas) return;
    interactionCanvas.style.cursor = cursor;
  }

  private resetTransaction() {
    this.isErasing = false;
    this.erasingState = null;
    this.hiddenLineIds.clear();
  }

  public dispose() {
    this.disposePointerEvents();
    this.discardPreview();
    this.resetTransaction();
    this.clearInteractionCanvas();
    this.setCanvasCursor('default');
  }
}

export default EraserPlugin;
