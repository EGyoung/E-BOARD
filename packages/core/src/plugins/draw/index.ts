import { initContextAttrs } from "@e-board/utils";
import { eBoardContainer } from "../../common/IocContainer";
import { IModelService, IModeService, IPointerEventService } from "../../services";
import { IConfigService, IModel } from "../../services";
import { IRenderService } from "../../services/renderService/type";
import { ITransformService } from "../../services/transformService/type";
import { IBoard, IPluginInitParams } from "../../types";
import { IPlugin } from "../type";

const CURRENT_MODE = "draw";
class DrawPlugin implements IPlugin {
  private board!: IBoard;
  private disposeList: (() => void)[] = [];
  private configService = eBoardContainer.get<IConfigService>(IConfigService);
  private modelService = eBoardContainer.get<IModelService>(IModelService);
  private renderService = eBoardContainer.get<IRenderService>(IRenderService);
  private transformService = eBoardContainer.get<ITransformService>(ITransformService);


  public pluginName = "DrawPlugin";

  public dependencies = [];

  public transformPoint(point: { x: number; y: number }, inverse = false) {
    return this.transformService.transformPoint(point, inverse);
  }

  private createCtrlElement() {
    // 计算包围盒
    const calculateBBox = (points: { x: number; y: number }[], padding = 0) => {
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      if (points.length === 0) return null;
      points.forEach(p => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      });
      return {
        minX: minX - padding,
        minY: minY - padding,
        maxX: maxX + padding,
        maxY: maxY + padding
      };
    }
    return {
      isHint: (params: { point: { x: number, y: number }, model: { points: { x: number, y: number }[], options: any } }) => {
        const { point, model } = params;
        const zoom = this.transformService.getView().zoom || 1;
        const box = calculateBBox(
          model.points?.map(p => this.transformService.transformPoint(p)) || [],
          zoom * (model.options?.lineWidth || 0)
        );
        if (!box) return false;
        const selectRect = {
          x: Math.min(point!.x, point!.x + 1),
          y: Math.min(point!.y, point!.y + 1),
          width: 1,
          height: 1
        };
        const isIntersecting =
          box.minX < selectRect.x + selectRect.width &&
          box.maxX > selectRect.x &&
          box.minY < selectRect.y + selectRect.height &&
          box.maxY > selectRect.y;
        return isIntersecting;

      },
      getBoundingBox: (model: { points: { x: number, y: number }[], options: any }) => {
        const zoom = this.transformService.getView().zoom || 1;
        const box = calculateBBox(
          model.points?.map(p => this.transformService.transformPoint(p)) || [],
          zoom * (model.options?.lineWidth || 0)
        );
        const width = box ? box.maxX - box.minX : 0;
        const height = box ? box.maxY - box.minY : 0;
        return box ? {
          x: box.minX,
          y: box.minY,
          width,
          height,
          ...(box ?? {})
        } : { x: 0, y: 0, width: 0, height: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 };
      }
    }
  }

  private currentLinePoints: { x: number; y: number }[] = [];
  private lastScreenPoint: { x: number; y: number } | null = null;
  // 记录最小采样距离，避免高频指针事件导致的重复绘制与模型点暴增
  private readonly minDistanceSq = 1;

  public setCurrentLineWithDraw(point: { x: number; y: number }, isEnd = false) {
    const ctx = this.board.getInteractionCtx();
    if (!ctx) return;
    if (
      !isEnd &&
      this.lastScreenPoint &&
      this.lastScreenPoint.x === point.x &&
      this.lastScreenPoint.y === point.y
    ) {
      return;
    }
    if (!isEnd && this.lastScreenPoint) {
      const dx = point.x - this.lastScreenPoint.x;
      const dy = point.y - this.lastScreenPoint.y;
      if (dx * dx + dy * dy < this.minDistanceSq) {
        return;
      }
    }
    const transformedPoint = this.transformPoint(point, true);
    if (!this.currentLinePoints.length) {
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      this.currentLinePoints = [transformedPoint];
      this.lastScreenPoint = { x: point.x, y: point.y };
      return;
    }
    const points = this.currentLinePoints!;
    const previousScreenPoint = this.lastScreenPoint ?? point;

    // 如果点数太少，直接画直线
    if (points.length < 2) {
      ctx.lineTo(point.x, point.y);
    } else {
      // 使用上一帧的屏幕坐标平滑曲线
      const midPointX = (previousScreenPoint.x + point.x) / 2;
      const midPointY = (previousScreenPoint.y + point.y) / 2;
      ctx.quadraticCurveTo(previousScreenPoint.x, previousScreenPoint.y, midPointX, midPointY);
    }

    ctx.stroke();

    this.currentLinePoints.push({
      x: transformedPoint.x,
      y: transformedPoint.y
    });
    this.lastScreenPoint = { x: point.x, y: point.y };

    if (isEnd) {
      this.modelService.createModel("line", {
        points: this.currentLinePoints,
        options: { ...this.configService.getCtxConfig() },
        ctrlElement: this.createCtrlElement()
      });
      this.currentLinePoints = [];
      this.lastScreenPoint = null;
    }
  }

  public init({ board }: IPluginInitParams) {
    this.board = board;
    this.initDrawMode();
    this.registerLineDrawHandler();

  }

  private initDrawMode() {
    const modeService = eBoardContainer.get<IModeService>(IModeService);
    modeService.registerMode(CURRENT_MODE, {
      beforeSwitchMode: ({ currentMode }) => {
        if (currentMode === CURRENT_MODE) {
          this.disposeList.forEach(dispose => dispose());
        }
      },
      afterSwitchMode: ({ currentMode }) => {
        if (currentMode === CURRENT_MODE) {
          this.initDraw();
        }
      }
    });
  }

  private registerLineDrawHandler() {
    this.renderService.registerDrawModelHandler("line", this.drawLineModelHandler);
  }

  private drawLineModelHandler = (model: IModel, ctx?: CanvasRenderingContext2D) => {
    const context = this.board.getCtx();
    if (!context) return;
    context.save()
    model.points?.forEach((point, index) => {
      const transformedPoint = this.transformPoint(point);
      if (index === 0) {
        context.moveTo(transformedPoint.x, transformedPoint.y);
      } else if (index < 2) {
        context.lineTo(transformedPoint.x, transformedPoint.y);
      } else {
        const p1 = this.transformPoint(model.points![index - 1]);
        const p2 = this.transformPoint(point);
        const midPointX = (p1.x + p2.x) / 2;
        const midPointY = (p1.y + p2.y) / 2;
        context.quadraticCurveTo(p1.x, p1.y, midPointX, midPointY);
      }
    });
    context.restore()
  };

  private getCanvasPoint(clientX: number, clientY: number) {
    const canvas = this.board.getCanvas();
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  private initDraw = () => {
    const pointerEventService = eBoardContainer.get<IPointerEventService>(IPointerEventService);
    let isDrawing = false;
    let lastPoint = { x: 0, y: 0 };

    const { dispose: disposePointerDown } = pointerEventService.onPointerDown(event => {
      const ctx = this.board.getInteractionCtx();
      if (!ctx) return;
      isDrawing = true;
      lastPoint = this.getCanvasPoint(event.clientX, event.clientY);
      const configService = eBoardContainer.get<IConfigService>(IConfigService);
      ctx.save()
      initContextAttrs(
        ctx,
        { zoom: this.transformService.getView().zoom },
        configService.getCtxConfig()
      );
      this.setCurrentLineWithDraw(lastPoint);
    });

    const { dispose: disposePointerMove } = pointerEventService.onPointerMove(event => {
      if (!isDrawing) return;
      const currentPoint = this.getCanvasPoint(event.clientX, event.clientY);
      const ctx = this.board.getInteractionCtx();

      if (!ctx) return;
      this.setCurrentLineWithDraw(currentPoint);
    });

    const { dispose: disposePointerUp } = pointerEventService.onPointerUp(event => {
      if (!isDrawing) return;
      const ctx = this.board.getInteractionCtx();
      if (!ctx) return;
      const lastPoint = this.getCanvasPoint(event.clientX, event.clientY);
      this.setCurrentLineWithDraw(lastPoint, true);
      ctx.restore()
      // 结束当前路径
      isDrawing = false;
    });

    this.disposeList.push(disposePointerDown, disposePointerMove, disposePointerUp);
  };

  public dispose() {
    this.disposeList.forEach(dispose => dispose());
    this.renderService.unregisterDrawModelHandler("line");
  }
}

export default DrawPlugin;
