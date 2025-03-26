import { IService } from "../type";

export interface IPointerEventService extends IService {
    onPointerDown(event: PointerEvent): void;
    onPointerMove(event: PointerEvent): void;
    onPointerUp(event: PointerEvent): void;
}

export const IPointerEventService = Symbol('IPointerEventService');