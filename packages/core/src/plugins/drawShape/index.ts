import { initContextAttrs } from "@e-board/utils";
import { eBoardContainer } from "../../common/IocContainer";
import { BoundingBox, IModelService, IModeService, IEventService } from "../../services";
import { IConfigService, IModel } from "../../services";
import { IRenderService } from "../../services/renderService/type";
import { ITransformService } from "../../services/transformService/type";
import { IBoard, IPluginInitParams } from "../../types";
import { IPlugin } from "../type";
import { TextEditor } from "./textEditor";
import { getCanvasTextConfig } from "./textEditor/config";

const CURRENT_MODE = "drawShape";
// const defaultFillStyle = 'pink'


type IShapeRectangle = {
  width: number;
  height: number;
}

class DrawShapePlugin implements IPlugin {
  private board!: IBoard;
  private disposeList: (() => void)[] = [];
  private configService = eBoardContainer.get<IConfigService>(IConfigService);
  private modelService = eBoardContainer.get<IModelService>(IModelService);
  private renderService = eBoardContainer.get<IRenderService>(IRenderService);
  private transformService = eBoardContainer.get<ITransformService>(ITransformService);
  private lastPoint = { x: 0, y: 0 };
  private textEditor: TextEditor | null = null

  private currentModel: IModel | null = null;

  public pluginName = "DrawShapePlugin";

  public dependencies = [];

  // private canSelection = true

  public transformPoint(point: { x: number; y: number }, inverse = false) {
    return this.transformService.transformPoint(point, inverse);
  }

  public setCurrentRectangleWithDraw(point: { x: number; y: number }, isEnd = false) {
    const ctx = this.board.getInteractionCtx();
    if (!ctx) return;
    const transformedPoint = this.transformPoint(point, true);
    if (!this.lastPoint) return
    if (!this.currentModel) {
      this.currentModel = this.modelService.createModel("rectangle", {
        points: [{ x: transformedPoint.x, y: transformedPoint.y }],
        width: 0,
        height: 0,
        isDrawing: true,
        options: {
          ...this.configService.getCtxConfig()
        },
        ctrlElement: {
          // canSelection: () => this.canSelection,
          isHint: (params: { point: { x: number, y: number }, model: { points: { x: number, y: number }[], options: any } }) => {
            const { point, model } = params;
            const [_point] = model.points!;
            const zoom = this.transformService.getView().zoom;

            // 将世界坐标转换为屏幕坐标
            const rectScreenPos = this.transformPoint(_point);
            const rectWidth = ((model as any).width || 0) * zoom;
            const rectHeight = ((model as any).height || 0) * zoom;

            // 检查点是否在矩形范围内（屏幕坐标系）
            const isInside = point.x >= rectScreenPos.x &&
              point.x <= rectScreenPos.x + rectWidth &&
              point.y >= rectScreenPos.y &&
              point.y <= rectScreenPos.y + rectHeight;

            return isInside;
          },
          getBoundingBox: (model: IModel<{ width: number, height: number }>) => {
            const [point] = model.points!;
            const width = model.width || 0;
            const height = model.height || 0;
            const zoom = this.transformService.getView().zoom;
            const strokeWidth =
              (model.options?.lineWidth ?? this.configService.getCtxConfig().lineWidth ?? 1) *
              zoom;
            const halfStroke = strokeWidth / 2;

            // 将世界坐标转换为屏幕坐标
            const screenPos = this.transformPoint(point);
            const screenWidth = width * zoom;
            const screenHeight = height * zoom;

            // 返回矩形的边界框（屏幕坐标系）
            return {
              x: screenPos.x,
              y: screenPos.y,
              width: screenWidth,
              height: screenHeight,
              minX: screenPos.x - halfStroke,
              minY: screenPos.y - halfStroke,
              maxX: screenPos.x + screenWidth + halfStroke,
              maxY: screenPos.y + screenHeight + halfStroke
            } as BoundingBox;
          },
          onElementMove: (e: any) => {
            // 移动距离
            const { movementX, movementY } = e;
            console.log('?????? move', movementX, movementY)
            if (
              Math.abs(movementX) <= 1 && Math.abs(movementY) <= 1
            ) {
              return
            }
            this.textEditor?.blurCurrentTextarea()
          }
        }
      });
    };

    const [_point] = this.currentModel!.points!;
    const x = Math.min(_point.x, transformedPoint.x);
    const y = Math.min(_point.y, transformedPoint.y);
    const width = Math.abs(transformedPoint.x - _point.x);
    const height = Math.abs(transformedPoint.y - _point.y);

    // 清除交互层
    ctx.clearRect(0, 0, this.board.getCanvas()!.width, this.board.getCanvas()!.height);

    // 绘制矩形
    ctx.beginPath();
    ctx.save();
    ctx.rect(
      this.transformPoint({ x, y }).x,
      this.transformPoint({ x, y }).y,
      width * this.transformService.getView().zoom,
      height * this.transformService.getView().zoom
    );

    if (this.currentModel!.options?.fillStyle) {
      ctx.fillStyle = this.currentModel!.options?.fillStyle
      ctx.fill();
    }

    ctx.stroke();

    if (isEnd) {
      this.modelService.updateModel(this.currentModel!.id, {
        points: [{ x, y }],
        width,
        height,
        fillStyle: this.currentModel!.options?.fillStyle,
        isDrawing: false
      });
      this.currentModel = null;
    }
    ctx.restore()

  }

  public init({ board }: IPluginInitParams) {
    this.board = board;
    this.initDrawMode();
    this.registerShapeDrawHandler();
    // 可以通过设置 debug: true 来启用调试模式
    this.textEditor = new TextEditor(this.board as any, { debug: false })
    this.textEditor.init()
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

  private registerShapeDrawHandler() {
    // 钜形
    this.renderService.registerDrawModelHandler("rectangle", this.drawRectangleModelHandler);
  }

  private drawRectangleModelHandler = (
    model: IModel<IShapeRectangle>,
  ) => {
    const context = this.board.getCtx();
    if (!context) return;
    const [point] = model.points!;
    const transformedPoint = this.transformPoint({ x: point.x, y: point.y });
    const zoom = this.transformService.getView().zoom;

    // 绘制矩形
    context.beginPath();
    context.rect(
      transformedPoint.x,
      transformedPoint.y,
      model.width * zoom,
      model.height * zoom
    );
    if (model.options?.fillStyle) {
      context.fillStyle = model.options.fillStyle;
      context.fill();
    }
    context.stroke();

    // 绘制文本（支持多行布局）
    if ((model as any).text) {
      context.save();

      // 添加裁剪避免由文字溢出导致的渲染残留
      context.beginPath();
      context.rect(
        transformedPoint.x,
        transformedPoint.y,
        model.width * zoom,
        model.height * zoom
      );
      context.clip();

      const textLayout = (model as any).textLayout;

      if (textLayout) {
        // 使用保存的文本布局信息
        // 注意：canvas context 已经通过 ctx.scale(dpr, dpr) 进行了缩放
        // 所以我们使用的是 CSS 像素，不需要再乘以 dpr
        const { lines, lineHeight, fontSize, fontFamily, paddingTop, paddingLeft, dpr } = textLayout;

        // 使用 CSS 像素，canvas 已经处理了 DPR 缩放
        context.font = `${fontSize * zoom}px ${fontFamily}`;
        context.fillStyle = 'black';
        context.textBaseline = 'top';

        // 绘制每一行文本
        // transformedPoint、padding、lineHeight 都是 CSS 像素
        // canvas context 的 scale(dpr, dpr) 会自动处理到物理像素的转换
        lines.forEach((line: string, index: number) => {
          const textX = transformedPoint.x + (paddingLeft * zoom);
          const textY = transformedPoint.y + (paddingTop * zoom) + (index * lineHeight * zoom);
          context.fillText(line, textX, textY);
        });
      } else {
        // 降级方案：使用配置中的默认值
        const config = getCanvasTextConfig(zoom);
        context.font = `${config.fontSize}px ${config.fontFamily}`;
        context.fillStyle = config.textColor;
        context.textBaseline = 'top';
        context.fillText((model as any).text, transformedPoint.x + config.paddingLeft, transformedPoint.y + config.paddingTop);
      }

      context.restore();
    }
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
    const eventService = eBoardContainer.get<IEventService>(IEventService);

    let isDrawing = false;

    const { dispose: disposePointerDown } = eventService.onPointerDown(event => {
      const ctx = this.board.getInteractionCtx();
      if (!ctx) return;
      isDrawing = true;
      this.lastPoint = this.getCanvasPoint(event.clientX, event.clientY);

      const configService = eBoardContainer.get<IConfigService>(IConfigService);

      initContextAttrs(
        ctx,
        { zoom: this.transformService.getView().zoom },
        { ...configService.getCtxConfig() }
      );
      this.setCurrentRectangleWithDraw(this.lastPoint);
    });

    const { dispose: disposePointerMove } = eventService.onPointerMove(event => {
      if (!isDrawing) return;
      const currentPoint = this.getCanvasPoint(event.clientX, event.clientY);
      const ctx = this.board.getInteractionCtx();

      if (!ctx) return;
      this.setCurrentRectangleWithDraw(currentPoint);
    });

    const { dispose: disposePointerUp } = eventService.onPointerUp(event => {
      if (!isDrawing) return;
      const ctx = this.board.getInteractionCtx();
      if (!ctx) return;
      const lastPoint = this.getCanvasPoint(event.clientX, event.clientY);
      this.setCurrentRectangleWithDraw(lastPoint, true);
      // 结束当前路径
      isDrawing = false;
    });

    this.disposeList.push(disposePointerDown, disposePointerMove, disposePointerUp);
  };

  public dispose() {
    this.disposeList.forEach(dispose => dispose());
    this.renderService.unregisterDrawModelHandler("rectangle");
    this.textEditor?.dispose()
  }
}

export default DrawShapePlugin;
