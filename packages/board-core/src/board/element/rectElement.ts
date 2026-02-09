import { eBoardContainer } from "../../common/IocContainer";
import { BoundingBox, IConfigService, IModel, ITransformService } from "../../services";
import { BaseCtrlElement } from "./baseElement";


// 矩形元素控制类
class RectCtrlElement extends BaseCtrlElement {
    protected static configService: IConfigService | null = null;

    // 只在第一次使用时去 Container 查找一次
    protected get configService() {
        if (!RectCtrlElement.configService) {
            RectCtrlElement.configService = eBoardContainer.get<IConfigService>(IConfigService);
        }
        return RectCtrlElement.configService;
    }

    public isHit = (params: { point: { x: number, y: number } }) => {
        const { point } = params;
        const [_point] = this.model.points!;
        const zoom = this.transformService.getView().zoom;
        // 将世界坐标转换为屏幕坐标
        const rectScreenPos = this.transformService.transformPoint(_point);
        const rectWidth = (this.model.width || 0) * zoom;
        const rectHeight = (this.model.height || 0) * zoom;

        // 检查点是否在矩形范围内（屏幕坐标系）
        const isInside = point.x >= rectScreenPos.x &&
            point.x <= rectScreenPos.x + rectWidth &&
            point.y >= rectScreenPos.y &&
            point.y <= rectScreenPos.y + rectHeight;
        return isInside;
    }

    public getBoundingBox = (model: IModel = this.model) => {
        const [point] = model.points!;
        const width = model.width || 0;
        const height = model.height || 0;
        const zoom = this.transformService.getView().zoom || 1;
        const strokeWidth =
            (model.options?.lineWidth ?? this.configService.getCtxConfig().lineWidth ?? 1) *
            zoom;
        const halfStroke = strokeWidth / 2;

        // 将世界坐标转换为屏幕坐标
        const screenPos = this.transformService.transformPoint(point);
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
    }
}


export { RectCtrlElement };