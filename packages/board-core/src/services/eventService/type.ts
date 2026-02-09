import { IService } from "../type";

export interface IEventService extends IService {
  onPointerDown(cb: (event: PointerEvent) => void): { dispose: () => void };
  onPointerMove(cb: (event: PointerEvent) => void): { dispose: () => void };
  onPointerUp(cb: (event: PointerEvent) => void): { dispose: () => void };
}

export const IEventService = Symbol("IEventService");
