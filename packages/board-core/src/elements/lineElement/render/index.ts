



import { IModel } from "../../../services/modelService/type";

import { BaseRender } from "../../baseElement/baseRender";
import { ILineModel } from "../type";


class Render extends BaseRender<ILineModel> {
    private transformService = this.board.getService('transformService')
    public transformPoint(point: { x: number; y: number }, inverse = false) {
        return this.transformService.transformPoint(point, inverse);
    }
    public render = (
        model: IModel<ILineModel>,
        _: any,
        isViewChanged: boolean = false
    ) => {
        const context = this.board.getCtx();
        if (!context) return;
        context.save()
        const toScreenPoint = isViewChanged
            ? (point: { x: number; y: number }) => point
            : (point: { x: number; y: number }) => this.transformPoint(point);
        model.points?.forEach((point, index) => {
            const transformedPoint = toScreenPoint(point);
            if (index === 0) {
                context.moveTo(transformedPoint.x, transformedPoint.y);
            } else if (index < 2) {
                context.lineTo(transformedPoint.x, transformedPoint.y);
            } else {
                const p1 = toScreenPoint(model.points![index - 1]);
                const p2 = toScreenPoint(point);
                const midPointX = (p1.x + p2.x) / 2;
                const midPointY = (p1.y + p2.y) / 2;
                context.quadraticCurveTo(p1.x, p1.y, midPointX, midPointY);
            }
        });
        context.restore()
    };
}

export { Render }