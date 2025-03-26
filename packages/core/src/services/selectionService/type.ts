import { IService } from "../type";

export interface ISelectionService extends IService {
  select(element: HTMLElement): void;
  deselect(): void;
  getSelectedElement(): HTMLElement | null;
}

export const ISelectionService = Symbol("ISelectionService");
