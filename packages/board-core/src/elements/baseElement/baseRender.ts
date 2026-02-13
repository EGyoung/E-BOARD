import { EBoard } from '../../board'
import { IShapeRectangle } from '../rectElement/type'
import { IModel } from '@e-board/board-core'
class BaseRender<T extends Record<string, any>> {
    protected board: EBoard
    constructor(board: EBoard) {
        this.board = board
    }
    public render = (model: IModel<T>, _: any, isViewChanged: boolean = false): void => {
        throw new Error('render method not implemented')
    }
}


export { BaseRender }
