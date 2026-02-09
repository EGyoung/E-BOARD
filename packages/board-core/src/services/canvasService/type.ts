import { IService } from "../../types";

export const ICanvasService = Symbol("ICanvasService");

export interface ICanvasService extends IService {
    // 主画布
    getCanvas(): HTMLCanvasElement | null;
    getCtx(): CanvasRenderingContext2D | null;

    // 交互层画布
    getInteractionCanvas(): HTMLCanvasElement | null;
    getInteractionCtx(): CanvasRenderingContext2D | null;

    // 尺寸管理
    updateCanvasSize(width: number, height: number): void;

    // 事件
    onCanvasResize: (listener: (size: { width: number; height: number }) => void) => {
        dispose: () => void;
    };
}
