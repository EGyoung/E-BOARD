import { IModel } from "../../../services/modelService/type";
import { BaseRender } from "../../baseElement/baseRender";
import { IArrowModel } from "../type";

class Render extends BaseRender<IArrowModel> {
    private transformService = this.board.getService('transformService')

    public transformPoint(point: { x: number; y: number }, inverse = false) {
        return this.transformService.transformPoint(point, inverse);
    }

    private drawArrowHead(
        context: CanvasRenderingContext2D,
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

        context.moveTo(leftX, leftY);
        context.lineTo(to.x, to.y);
        context.lineTo(rightX, rightY);
    }

    public render = (
        model: IModel<IArrowModel>,
        _: any,
        isViewChanged: boolean = false
    ) => {
        const context = this.board.getCtx();
        if (!context || !model.points || model.points.length < 2) return;

        context.save();

        const zoom = this.transformService.getView().zoom || 1;
        const toScreenPoint = isViewChanged
            ? (point: { x: number; y: number }) => point
            : (point: { x: number; y: number }) => this.transformPoint(point);

        model.points.forEach((point, index) => {
            const transformedPoint = toScreenPoint(point);
            if (index === 0) {
                context.moveTo(transformedPoint.x, transformedPoint.y);
            } else {
                context.lineTo(transformedPoint.x, transformedPoint.y);
            }
        });

        const to = toScreenPoint(model.points[model.points.length - 1]);
        const from = toScreenPoint(model.points[model.points.length - 2]);
        const lineWidth = model.options?.lineWidth ?? 2;
        const headLength = Math.max(8, lineWidth * (isViewChanged ? 4 : 4 * zoom));

        this.drawArrowHead(context, from, to, headLength);
        context.restore();
    };
}

export { Render }
