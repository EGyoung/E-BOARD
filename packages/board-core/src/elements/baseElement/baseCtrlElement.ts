import { calculateBBox, cloneDeep } from "@e-board/board-utils";
import { eBoardContainer } from "../../common/IocContainer";
import { IModel, IModelData, IModelService, ITransformService } from "../../services";
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

    /**
     * 直接设置模型字段，替换式更新。
     * 调用后自动触发视图重绘。
     *
     * @example
     *   ctrl.setState({ points: [{ x: 0, y: 0 }] })
     *   ctrl.setState({ options: { strokeStyle: '#ff0000' } })
     */
    public setState = (updates: Partial<IModelData>): void => {
        this.modelService.updateModel(this.modelId, updates);
    }

    /**
     * 深度合并模型字段，对嵌套对象（如 options）做逐属性合并而非整体替换。
     * 调用后自动触发视图重绘。
     *
     * @example
     *   ctrl.merge({ options: { lineWidth: 4 } })  // 只改 lineWidth，保留其他 options
     *   ctrl.merge({ width: 200, height: 100 })
     */
    public merge = (updates: Partial<IModelData>): void => {
        const current = this.model;
        if (!current) return;

        const merged: Record<string, any> = {};
        for (const key of Object.keys(updates) as (keyof typeof updates)[]) {
            const val = updates[key];
            if (val === undefined) continue;

            const currentVal = (current as any)[key];
            if (
                currentVal !== null &&
                currentVal !== undefined &&
                typeof currentVal === 'object' &&
                !Array.isArray(currentVal) &&
                typeof val === 'object' &&
                !Array.isArray(val)
            ) {
                // 嵌套对象：逐属性合并
                merged[key] = { ...currentVal, ...(val as object) };
            } else {
                merged[key] = val;
            }
        }

        this.modelService.updateModel(this.modelId, merged);
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


    /** 是否允许缩放，默认 true。子类可覆写返回 false 来禁止缩放 */
    public canResize = (): boolean => {
        return true;
    }

    // 脏矩形渲染时，会需要用到上一个状态的models来计算包围盒, 需要外面传入，其他情况默认使用最新的models
    public getBoundingBox = (model: IModel = this.model) => {
        const zoom = this.transformService.getView().zoom || 1;
        const box = calculateBBox(
            model.points?.map((p: any) => this.transformService.transformPoint(p)) || [],
            zoom * (model.options?.lineWidth || 0)
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