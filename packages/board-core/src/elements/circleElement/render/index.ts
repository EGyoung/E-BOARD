import { IModel } from "../../../services/modelService/type";
import { BaseRender } from "../../baseElement/baseRender";
import { ICircleModel } from "../type";

class Render extends BaseRender<ICircleModel> {
    private transformService = this.board.getService('transformService');

    public transformPoint(point: { x: number; y: number }, inverse = false) {
        return this.transformService.transformPoint(point, inverse);
    }

    public render = (
        model: IModel<ICircleModel>,
        ctx: any,
        isViewChanged: boolean = false
    ) => {
        const context: CanvasRenderingContext2D = ctx || this.board.getCtx();
        if (!context || !model.points?.length) return;

        const [point] = model.points;
        const zoom = isViewChanged ? 1 : this.transformService.getView().zoom;
        const center = isViewChanged
            ? { x: point.x + model.width / 2, y: point.y + model.height / 2 }
            : (() => {
                const tp = this.transformPoint(point);
                return { x: tp.x + (model.width * zoom) / 2, y: tp.y + (model.height * zoom) / 2 };
            })();

        const rx = (model.width * zoom) / 2;
        const ry = (model.height * zoom) / 2;

        context.ellipse(center.x, center.y, rx, ry, 0, 0, Math.PI * 2);

        if (model.options?.fillStyle) {
            context.fillStyle = model.options.fillStyle;
            context.fill();
        }
    };
}

export { Render };
