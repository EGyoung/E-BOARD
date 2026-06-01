import { calculateBBox } from "@e-board/board-utils";
import { IModel } from "../../../services";
import { BaseCtrlElement } from "../../baseElement/baseCtrlElement";

class ArrowCtrlElement extends BaseCtrlElement {
    public getBoundingBox = (model: IModel = this.model) => {
        const zoom = this.transformService.getView().zoom || 1;
        const lineWidth = model.options?.lineWidth ?? 2;
        const headLength = Math.max(8, lineWidth * 4 * zoom);
        const padding = zoom * lineWidth + headLength;

        const box = calculateBBox(
            model.points?.map((p: any) => this.transformService.transformPoint(p)) || [],
            padding
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

export { ArrowCtrlElement };
