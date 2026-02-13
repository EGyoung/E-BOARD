import { IModel } from "@e-board/board-core";
import { BaseRender } from "../../baseElement/baseRender";
import { IPictureModel } from "../type";

class Render extends BaseRender<IPictureModel> {
    private transformService = this.board.getService('transformService')
    private renderService = this.board.getService('renderService')
    private imageCache = new Map<string, HTMLImageElement>();
    public transformPoint(point: { x: number; y: number }, inverse = false) {
        return this.transformService.transformPoint(point, inverse);
    }
    public render = (model: IModel<IPictureModel>, _: any, useWorldCoords = false) => {
        const context = this.board.getCtx();
        if (!context || !model.imageData || !model.points) return;

        context.save();

        let img = this.imageCache.get(model.id);
        if (!img) {
            img = new Image();
            img.src = model.imageData;
            this.imageCache.set(model.id, img);
        }

        if (img.complete) {
            const zoom = this.transformService.getView().zoom;
            const transformedPos = useWorldCoords ? model.points[0] : this.transformPoint(model.points[0]);
            const width = useWorldCoords ? (model.width || img.width) : (model.width || img.width) * zoom;
            const height = useWorldCoords ? (model.height || img.height) : (model.height || img.height) * zoom;

            // 将图片中心对齐到指定位置，而不是左上角
            const drawX = transformedPos.x
            const drawY = transformedPos.y

            context.drawImage(img, drawX, drawY, width, height);
        } else {
            img.onload = () => {
                this.renderService.reRender();
            };
        }

        context.restore();
    };
}


export { Render }