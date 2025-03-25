export interface ISelectionService {
    select(element: HTMLElement): void;
    deselect(): void;
    getSelectedElement(): HTMLElement | null;
}
