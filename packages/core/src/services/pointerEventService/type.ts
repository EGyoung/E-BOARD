import { IService } from "../type";

export interface IPointerEventService extends IService {
    onPointerDown(cb: (event: PointerEvent) => void ): { dispose: () => void };
    onPointerMove(cb: (event: PointerEvent) => void): { dispose: () => void };
    onPointerUp(cb: (event: PointerEvent) => void): { dispose: () => void };
}

export const IPointerEventService = Symbol('IPointerEventService');