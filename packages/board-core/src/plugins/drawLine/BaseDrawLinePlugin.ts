import { initContextAttrs } from "@e-board/board-utils";
import { eBoardContainer } from "../../common/IocContainer";
import { IModelService, IModeService, IEventService } from "../../services";
import { IConfigService } from "../../services";
import { ITransformService } from "../../services/transformService/type";
import { IBoard, IPluginInitParams } from "../../types";
import { IPlugin } from "../type";

abstract class BaseDrawLinePlugin implements IPlugin {
  protected board!: IBoard;
  protected disposeList: (() => void)[] = [];

  private _modelService: IModelService | null = null;
  private _configService: IConfigService | null = null;
  private _transformService: ITransformService | null = null;

  protected get modelService() {
    if (!this._modelService) this._modelService = eBoardContainer.get<IModelService>(IModelService);
    return this._modelService;
  }
  protected get configService() {
    if (!this._configService) this._configService = eBoardContainer.get<IConfigService>(IConfigService);
    return this._configService;
  }
  protected get transformService() {
    if (!this._transformService) this._transformService = eBoardContainer.get<ITransformService>(ITransformService);
    return this._transformService;
  }

  protected startPoint: { x: number; y: number } | null = null;

  public abstract pluginName: string;
  public dependencies = [];

  protected abstract get modeName(): string;
  protected abstract get modelType(): string;

  protected transformPoint(point: { x: number; y: number }, inverse = false) {
    return this.transformService.transformPoint(point, inverse);
  }

  protected getCanvasPoint(clientX: number, clientY: number) {
    const canvas = this.board.getCanvas();
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  protected drawPreviewExtras(
    _ctx: CanvasRenderingContext2D,
    _start: { x: number; y: number },
    _end: { x: number; y: number }
  ) {}

  private drawPreview(endCanvasPoint: { x: number; y: number }, isEnd = false) {
    const ctx = this.board.getInteractionCtx();
    if (!ctx || !this.startPoint) return;

    const canvas = this.board.getCanvas();
    if (!canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (isEnd) {
      const startWorldPoint = this.transformPoint(this.startPoint, true);
      const endWorldPoint = this.transformPoint(endCanvasPoint, true);
      this.modelService.createModel(this.modelType, {
        points: [startWorldPoint, endWorldPoint],
        options: { ...this.configService.getCtxConfig() },
      });
      this.startPoint = null;
      return;
    }

    ctx.beginPath();
    ctx.save();
    ctx.moveTo(this.startPoint.x, this.startPoint.y);
    ctx.lineTo(endCanvasPoint.x, endCanvasPoint.y);

    this.drawPreviewExtras(ctx, this.startPoint, endCanvasPoint);

    ctx.stroke();
    ctx.restore();
  }

  public init({ board }: IPluginInitParams) {
    this.board = board;
    this.initDrawMode();
  }

  private initDrawMode() {
    const modeService = eBoardContainer.get<IModeService>(IModeService);
    modeService.registerMode(this.modeName, {
      beforeSwitchMode: ({ currentMode }) => {
        if (currentMode === this.modeName) {
          this.disposeList.forEach(dispose => dispose());
          this.disposeList = [];
        }
      },
      afterSwitchMode: ({ currentMode }) => {
        if (currentMode === this.modeName) {
          this.bindEvents();
        }
      },
    });
  }

  private bindEvents = () => {
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

export { BaseDrawLinePlugin };
