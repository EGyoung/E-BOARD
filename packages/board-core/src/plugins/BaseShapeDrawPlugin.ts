import { initContextAttrs } from "@e-board/board-utils";
import { eBoardContainer } from "../common/IocContainer";
import { IModelService, IModeService, IEventService } from "../services";
import { IConfigService } from "../services";
import { ITransformService } from "../services/transformService/type";
import { IBoard, IPluginInitParams } from "../types";
import { IPlugin } from "./type";

export interface DrawContext {
  ctx: CanvasRenderingContext2D;
  startCanvasPoint: { x: number; y: number };
  endCanvasPoint: { x: number; y: number };
  startWorldPoint: { x: number; y: number };
  endWorldPoint: { x: number; y: number };
  zoom: number;
}

abstract class BaseShapeDrawPlugin implements IPlugin {
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

  protected abstract drawPreview(dc: DrawContext): void;
  protected abstract createModel(dc: DrawContext): void;

  protected transformPoint(point: { x: number; y: number }, inverse = false) {
    return this.transformService.transformPoint(point, inverse);
  }

  protected getCanvasPoint(clientX: number, clientY: number) {
    const canvas = this.board.getCanvas();
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  private handleDraw(endCanvasPoint: { x: number; y: number }, isEnd = false) {
    const ctx = this.board.getInteractionCtx();
    if (!ctx || !this.startPoint) return;

    const canvas = this.board.getCanvas();
    if (!canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const dc: DrawContext = {
      ctx,
      startCanvasPoint: this.startPoint,
      endCanvasPoint,
      startWorldPoint: this.transformPoint(this.startPoint, true),
      endWorldPoint: this.transformPoint(endCanvasPoint, true),
      zoom: this.transformService.getView().zoom || 1,
    };

    if (isEnd) {
      this.createModel(dc);
      this.startPoint = null;
      return;
    }

    ctx.beginPath();
    ctx.save();
    this.drawPreview(dc);
    ctx.stroke();
    if ((this.configService.getCtxConfig() as any)?.fillStyle) {
      ctx.fillStyle = (this.configService.getCtxConfig() as any).fillStyle;
      ctx.fill();
    }
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
      this.handleDraw(this.getCanvasPoint(event.clientX, event.clientY));
    });

    const { dispose: disposePointerUp } = eventService.onPointerUp(event => {
      if (!isDrawing) return;
      isDrawing = false;
      this.handleDraw(this.getCanvasPoint(event.clientX, event.clientY), true);
    });

    this.disposeList.push(disposePointerDown, disposePointerMove, disposePointerUp);
  };

  public dispose() {
    this.disposeList.forEach(dispose => dispose());
  }
}

export { BaseShapeDrawPlugin };
