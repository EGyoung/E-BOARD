import { EBoard } from "@e-board/board-core";
import DrawProcessor from "./draw";

export class CommandProcessor {
    private board: EBoard

    constructor(board: EBoard) {
        this.board = board
    }

    private handlers: { [key: string]: new (board: EBoard) => { handler: any } } = {};

    register(key: string, handler: new (board: EBoard) => { handler: any }) {
        this.handlers[key] = handler;
    }

    execute(commandType: string, params: any) {
        const handler = this.handlers[commandType];
        if (handler) {
            const instance = new handler(this.board);
            instance.handler(params);
        } else {
            console.warn(`No handler registered for command type: ${commandType}`);
        }
    }
}

export const initCommandProcessor = (board: EBoard) => {
    const processor = new CommandProcessor(board);
    processor.register(DrawProcessor.commandName, DrawProcessor);
    return processor;
}