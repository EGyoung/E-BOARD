import { IModel } from "../../../services/modelService/type";
import { BaseRender } from "../../baseElement/baseRender";
import { getTextLayoutMetrics } from "../metrics";
import { ITextModel } from "../type";

class Render extends BaseRender<ITextModel> {
    private transformService = this.board.getService('transformService')

    public transformPoint(point: { x: number; y: number }, inverse = false) {
        return this.transformService.transformPoint(point, inverse);
    }

    public render = (
        model: IModel<ITextModel>,
        _: any,
        isViewChanged: boolean = false
    ) => {
        const context = this.board.getCtx();
        if (!context || !model.points || model.points.length === 0) return;

        const [anchor] = model.points;
        const zoom = this.transformService.getView().zoom || 1;
        const metrics = getTextLayoutMetrics(model);
        const drawPoint = isViewChanged ? anchor : this.transformPoint(anchor);
        const drawWidth = isViewChanged ? metrics.width : metrics.width * zoom;
        const drawHeight = isViewChanged ? metrics.height : metrics.height * zoom;
        const drawFontSize = isViewChanged ? metrics.fontSize : metrics.fontSize * zoom;
        const drawPadding = isViewChanged ? metrics.padding : metrics.padding * zoom;
        const drawLineHeight = isViewChanged ? metrics.lineHeight : metrics.lineHeight * zoom;

        context.save();

        const backgroundColor = model.options?.backgroundColor;
        if (backgroundColor) {
            context.fillStyle = backgroundColor;
            context.fillRect(drawPoint.x, drawPoint.y, drawWidth, drawHeight);
        }

        context.font = `${drawFontSize}px sans-serif`;
        context.textBaseline = "top";
        context.textAlign = "center";
        const textColor = model.options?.fillStyle ?? "#000000";
        context.fillStyle = textColor;

        const contentLeft = drawPoint.x + drawPadding;
        const contentTop = drawPoint.y + drawPadding;
        const contentWidth = Math.max(0, drawWidth - drawPadding * 2);
        const contentHeight = Math.max(0, drawHeight - drawPadding * 2);
        const textBlockHeight = metrics.lines.length * drawLineHeight;
        const startY = contentTop + Math.max(0, (contentHeight - textBlockHeight) / 2);
        const centerX = contentLeft + contentWidth / 2;

        metrics.lines.forEach((line, index) => {
            const lineY = startY + index * drawLineHeight;
            context.fillText(line, centerX, lineY);
        });

        context.restore();
    };
}

export { Render }
