import { eBoardContainer } from "../../../common/IocContainer";
import { BoundingBox, IConfigService, IModel } from "../../../services";
import { BaseCtrlElement } from "../../baseElement/baseCtrlElement";
import { getTextLayoutMetrics } from "../metrics";

class TextCtrlElement extends BaseCtrlElement {
    protected static configService: IConfigService | null = null;

    protected get configService() {
        if (!TextCtrlElement.configService) {
            TextCtrlElement.configService = eBoardContainer.get<IConfigService>(IConfigService);
        }
        return TextCtrlElement.configService;
    }

    public isHit = (params: { point: { x: number, y: number } }) => {
        const { point } = params;
        const box = this.getBoundingBox();
        return point.x >= box.minX && point.x <= box.maxX && point.y >= box.minY && point.y <= box.maxY;
    }

    public getBoundingBox = (model: IModel = this.model) => {
        const [anchor] = model.points || [{ x: 0, y: 0 }];
        const { width, height } = getTextLayoutMetrics(model as any);
        const zoom = this.transformService.getView().zoom || 1;
        const strokeWidth =
            (model.options?.lineWidth ?? this.configService.getCtxConfig().lineWidth ?? 1) *
            zoom;
        const halfStroke = strokeWidth / 2;

        const screenPos = this.transformService.transformPoint(anchor);
        const screenWidth = width * zoom;
        const screenHeight = height * zoom;

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
    }
}

export { TextCtrlElement };
