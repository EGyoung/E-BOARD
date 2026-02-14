import type { EBoard } from "@e-board/board-core";
import type DrawPlugin from '@e-board/board-core/src/plugins/draw';

class CommandFactory {
    private board: EBoard
    private disposeList: (() => void)[] = []
    private onCommandExecute: ((params: any) => void)[] = []
    constructor({ board }: { board: EBoard }) {
        this.board = board
        this.init()
    }
    public registerCommandExecute(fn: (params: any) => void) {
        this.onCommandExecute.push(fn)
        return {
            dispose: () => {
                this.onCommandExecute = this.onCommandExecute.filter(f => f !== fn)
            }
        }
    }

    private init() {
        // const SelectionPlugin = this.board.getPlugin('SelectionPlugin')
        // const { dispose } = SelectionPlugin.exports.onElementsMoving((models: any) => {
        //     this.onCommandExecute.forEach(fn => fn({
        //         commandType: 'move',
        //         params: {
        //             models
        //         }
        //     }))
        // })

        const DrawPlugin = this.board.getPlugin('DrawPlugin') as DrawPlugin
        const { dispose: drawDispose } = DrawPlugin.onDraw((params) => {
            this.onCommandExecute.forEach(fn => fn({
                commandType: 'draw',
                params
            }))
        })
        this.disposeList.push(drawDispose)
    }
    public dispose() {
        this.disposeList.forEach((dispose) => dispose())
    }
}


export { CommandFactory }