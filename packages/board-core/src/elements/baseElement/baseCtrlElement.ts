import { calculateBBox, cloneDeep } from "@e-board/board-utils";
import { eBoardContainer } from "../../common/IocContainer";
import { IModel, IModelService, ITransformService } from "../../services";
import { IProps, IPoint } from "../type";

// 默认是线段
class BaseCtrlElement {
    private modelId: string
    constructor({ model }: IProps) {
        // 不能直接持有 model 引用，因为updateModel时做了拷贝
        this.modelId = model.id
    }

    protected static transformService: ITransformService | null = null;
    protected static modelService: IModelService | null = null

    // 只在第一次使用时去 Container 查找一次
    protected get transformService() {
        if (!BaseCtrlElement.transformService) {
            BaseCtrlElement.transformService = eBoardContainer.get<ITransformService>(ITransformService);
        }
        return BaseCtrlElement.transformService;
    }

    protected get modelService() {
        if (!BaseCtrlElement.modelService) {
            BaseCtrlElement.modelService = eBoardContainer.get<IModelService>(IModelService);
        }
        return BaseCtrlElement.modelService;
    }

    public get model() {
        if (!this.modelService) {
            throw new Error('modelService is undefined')
        }
        return this.modelService.getModelById(this.modelId) as IModel
    }
    public isHit = (params: { point: IPoint; }) => {
        const { point, } = params;
        const model = this.model;
        if (!model) {
            throw new Error('element model is undefined')
        }
        const zoom = this.transformService.getView().zoom || 1;
        const box = calculateBBox(
            model.points?.map(p => this.transformService.transformPoint(p)) || [],
            zoom * (model.options?.lineWidth || 0)
        );
        if (!box) return false;
        const selectRect = {
            x: Math.min(point!.x, point!.x + 1),
            y: Math.min(point!.y, point!.y + 1),
            width: 1,
            height: 1
        };
        const isIntersecting =
            box.minX < selectRect.x + selectRect.width &&
            box.maxX > selectRect.x &&
            box.minY < selectRect.y + selectRect.height &&
            box.maxY > selectRect.y;
        return isIntersecting;
    }


    // 脏矩形渲染时，会需要用到上一个状态的models来计算包围盒, 需要外面传入，其他情况默认使用最新的models
    public getBoundingBox = (model: IModel = this.model) => {
        const zoom = this.transformService.getView().zoom || 1;
        const box = calculateBBox(
            model.points?.map((p: any) => this.transformService.transformPoint(p)) || [],
            zoom * (this.model.options?.lineWidth || 0)
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

export { BaseCtrlElement }