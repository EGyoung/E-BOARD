import { initContextAttrs } from "@e-board/board-utils";
import { eBoardContainer } from "../../common/IocContainer";
import { IModelService, IModeService, IEventService } from "../../services";
import { IConfigService } from "../../services";
import { ITransformService } from "../../services/transformService/type";
import { IBoard, IPluginInitParams } from "../../types";
import { IPlugin } from "../type";

const CURRENT_MODE = "drawArrow";

class DrawArrowPlugin implements IPlugin {
  private board!: IBoard;
  private disposeList: (() => void)[] = [];
  private modelService = eBoardContainer.get<IModelService>(IModelService);
  private configService = eBoardContainer.get<IConfigService>(IConfigService);
  private transformService = eBoardContainer.get<ITransformService>(ITransformService);

  private startPoint: { x: number; y: number } | null = null;

  public pluginName = "DrawArrowPlugin";
  public dependencies = [];

  private transformPoint(point: { x: number; y: number }, inverse = false) {
    return this.transformService.transformPoint(point, inverse);
  }

  private getCanvasPoint(clientX: number, clientY: number) {
    const canvas = this.board.getCanvas();
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  private drawArrowHead(
    ctx: CanvasRenderingContext2D,
    from: { x: number; y: number },
    to: { x: number; y: number },
    headLength: number
  ) {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const wingAngle = Math.PI / 7;

    const leftX = to.x - headLength * Math.cos(angle - wingAngle);
    const leftY = to.y - headLength * Math.sin(angle - wingAngle);
    const rightX = to.x - headLength * Math.cos(angle + wingAngle);
    const rightY = to.y - headLength * Math.sin(angle + wingAngle);

    ctx.moveTo(leftX, leftY);
    ctx.lineTo(to.x, to.y);
    ctx.lineTo(rightX, rightY);
  }

  private drawPreview(endCanvasPoint: { x: number; y: number }, isEnd = false) {
    const ctx = this.board.getInteractionCtx();
    if (!ctx || !this.startPoint) return;

    const canvas = this.board.getCanvas();
    if (!canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (isEnd) {
      const startWorldPoint = this.transformPoint(this.startPoint, true);
      const endWorldPoint = this.transformPoint(endCanvasPoint, true);
      this.modelService.createModel("arrow", {
        points: [startWorldPoint, endWorldPoint],
        options: { ...this.configService.getCtxConfig() },
      });
      this.startPoint = null;
      return;
    }

    // Draw preview on interaction layer only
    ctx.beginPath();
    ctx.save();
    ctx.moveTo(this.startPoint.x, this.startPoint.y);
    ctx.lineTo(endCanvasPoint.x, endCanvasPoint.y);

    const zoom = this.transformService.getView().zoom || 1;
    const lineWidth = this.configService.getCtxConfig()?.lineWidth ?? 2;
    const headLength = Math.max(8, lineWidth * 4 * zoom);
    this.drawArrowHead(ctx, this.startPoint, endCanvasPoint, headLength);

    ctx.stroke();
    ctx.restore();
  }

  public init({ board }: IPluginInitParams) {
    this.board = board;
    this.initDrawMode();
  }

  private initDrawMode() {
    const modeService = eBoardContainer.get<IModeService>(IModeService);
    modeService.registerMode(CURRENT_MODE, {
      beforeSwitchMode: ({ currentMode }) => {
        if (currentMode === CURRENT_MODE) {
          this.disposeList.forEach(dispose => dispose());
          this.disposeList = [];
        }
      },
      afterSwitchMode: ({ currentMode }) => {
        if (currentMode === CURRENT_MODE) {
          this.initDraw();
        }
      },
    });
  }

  private initDraw = () => {
    const eventService = eBoardContainer.get<IEventService>(IEventService);
    let isDrawing = false;

    const { dispose: disposePointerDown } = eventService.onPointerDown(event => {
      const ctx = this.board.getInteractionCtx();
      if (!ctx) return;
      isDrawing = true;
      this.startPoint = this.getCanvasPoint(event.clientX, event.clientY);

      initContextAttrs(
        ctx,
        { zoom: this.transformService.getView().zoom },
        { ...this.configService.getCtxConfig() }
      );
    });

    const { dispose: disposePointerMove } = eventService.onPointerMove(event => {
      if (!isDrawing) return;
      const currentPoint = this.getCanvasPoint(event.clientX, event.clientY);
      this.drawPreview(currentPoint);
    });

    const { dispose: disposePointerUp } = eventService.onPointerUp(event => {
      if (!isDrawing) return;
      isDrawing = false;
      const endPoint = this.getCanvasPoint(event.clientX, event.clientY);
      this.drawPreview(endPoint, true);
    });

    this.disposeList.push(disposePointerDown, disposePointerMove, disposePointerUp);
  };

  public dispose() {
    this.disposeList.forEach(dispose => dispose());
  }
}

export default DrawArrowPlugin;
