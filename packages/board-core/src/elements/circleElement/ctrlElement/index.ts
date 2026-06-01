import { eBoardContainer } from "../../../common/IocContainer";
import { BoundingBox, IConfigService, IModel, ITransformService } from "../../../services";
import { BaseCtrlElement } from "../../baseElement/baseCtrlElement";

class CircleCtrlElement extends BaseCtrlElement {
    protected static configService: IConfigService | null = null;

    protected get configService() {
        if (!CircleCtrlElement.configService) {
            CircleCtrlElement.configService = eBoardContainer.get<IConfigService>(IConfigService);
        }
        return CircleCtrlElement.configService;
    }

    public isHit = (params: { point: { x: number; y: number } }) => {
        const { point } = params;
        const [p] = this.model.points!;
        const zoom = this.transformService.getView().zoom;
        const screenPos = this.transformService.transformPoint(p);
        const rx = (this.model.width || 0) * zoom / 2;
        const ry = (this.model.height || 0) * zoom / 2;
        const cx = screenPos.x + rx;
        const cy = screenPos.y + ry;

        const dx = (point.x - cx) / rx;
        const dy = (point.y - cy) / ry;
        return dx * dx + dy * dy <= 1;
    }

    public getBoundingBox = (model: IModel = this.model): BoundingBox => {
        const [point] = model.points!;
        const width = model.width || 0;
        const height = model.height || 0;
        const zoom = this.transformService.getView().zoom || 1;
        const strokeWidth =
            (model.options?.lineWidth ?? this.configService.getCtxConfig().lineWidth ?? 1) * zoom;
        const halfStroke = strokeWidth / 2;

        const screenPos = this.transformService.transformPoint(point);
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
        };
    }
}

export { CircleCtrlElement };
