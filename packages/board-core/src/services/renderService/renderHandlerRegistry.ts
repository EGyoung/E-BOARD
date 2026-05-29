import { IBoard } from '../../types';
import { IElementService } from '../elementService/type';

export class RenderHandlerRegistry {
    private readonly handlers = new Map<string, any>();

    constructor(
        private readonly board: IBoard,
        private readonly elementService: IElementService,
    ) { }

    public get(type: string) {
        const cachedHandler = this.handlers.get(type);
        if (cachedHandler) {
            return cachedHandler;
        }

        const component = this.elementService.getElement(type);
        if (!component) {
            return null;
        }

        const renderHandler = new component.render(this.board);
        this.handlers.set(type, renderHandler);
        return renderHandler;
    }

    public clear() {
        this.handlers.clear();
    }
}