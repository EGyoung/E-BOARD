import { IPoint } from "src/elements/type";
import { eBoardContainer } from "../../../common/IocContainer";
import { IConfigService, IModel } from "../../../services";
import { BaseCtrlElement } from "../../baseElement/baseCtrlElement";
import { layoutMindMap, flattenLayout } from "../layout";

class MindMapCtrlElement extends BaseCtrlElement {
    protected static configService: IConfigService | null = null;

    protected get configService() {
        if (!MindMapCtrlElement.configService) {
            MindMapCtrlElement.configService = eBoardContainer.get<IConfigService>(IConfigService);
        }
        return MindMapCtrlElement.configService;
    }

    public isHit = (params: { point: IPoint; }) => {
        const { point } = params;
        const model = this.model;
        if (!model || !model.points?.[0]) {
            return false;
        }

        const rootPoint = model.points[0];
        const zoom = this.transformService.getView().zoom || 1;

        // 计算整棵思维导图树的布局（含所有子节点），得到每个节点的相对坐标
        const layout = layoutMindMap(model as any);
        const nodes = flattenLayout(layout);

        for (const node of nodes) {
            // 每个节点在世界坐标系中的位置
            const worldX = rootPoint.x + node.x;
            const worldY = rootPoint.y + node.y;
            // 转换为屏幕坐标
            const screenPos = this.transformService.transformPoint({ x: worldX, y: worldY });
            const screenW = node.width * zoom;
            const screenH = node.height * zoom;

            // 检查点是否在节点矩形范围内（屏幕坐标系）
            if (
                point.x >= screenPos.x &&
                point.x <= screenPos.x + screenW &&
                point.y >= screenPos.y &&
                point.y <= screenPos.y + screenH
            ) {
                return true;
            }
        }

        return false;
    }

    public getBoundingBox = (model: IModel = this.model) => {
        try {
            const point = model.points?.[0];
            if (!point) {
                return { x: 0, y: 0, width: 0, height: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 };
            }

            const zoom = this.transformService.getView().zoom || 1;
            const strokeWidth = (model.options?.lineWidth ?? 2) * zoom;
            const halfStroke = strokeWidth / 2;

            // 计算整棵思维导图树的布局（含所有子节点），得到每个节点的相对坐标
            const layout = layoutMindMap(model as any);
            const nodes = flattenLayout(layout);

            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

            for (const node of nodes) {
                // 每个节点在世界坐标系中的位置
                const worldX = point.x + node.x;
                const worldY = point.y + node.y;
                // 转换为屏幕坐标
                const screenPos = this.transformService.transformPoint({ x: worldX, y: worldY });
                const screenW = node.width * zoom;
                const screenH = node.height * zoom;

                minX = Math.min(minX, screenPos.x);
                minY = Math.min(minY, screenPos.y);
                maxX = Math.max(maxX, screenPos.x + screenW);
                maxY = Math.max(maxY, screenPos.y + screenH);
            }

            return {
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY,
                minX: minX - halfStroke,
                minY: minY - halfStroke,
                maxX: maxX + halfStroke,
                maxY: maxY + halfStroke,
            };
        } catch (err) {
            return { x: 0, y: 0, width: 0, height: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 };
        }
    };
}

export { MindMapCtrlElement };
