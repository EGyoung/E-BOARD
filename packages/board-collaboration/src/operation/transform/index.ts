import { CreateHandler } from "./create";
import { UpdateHandler } from "./update";
import { DeleteHandler } from "./delete";
import { IOperationHandler } from "./type";

class OperationManager {
    private handlers: Map<string, IOperationHandler> = new Map();

    constructor() {
        this.register(new CreateHandler());
        this.register(new UpdateHandler());
        this.register(new DeleteHandler());
    }

    register(handler: IOperationHandler) {
        this.handlers.set(handler.type, handler);
    }

    getHandler(type: string) {
        return this.handlers.get(type);
    }
}

export const operationManager = new OperationManager();
export * from "./type";
