import { IBoard, IServiceInitParams } from "../../types";

class PointerEventService {
    private board!: IBoard;
    constructor() {
        console.log('PointerEventService initialized');
    }

    init({ board }: IServiceInitParams) {
        this.board = board;
        const canvas =  this.board.getCanvas()
        if (!canvas) {
            throw new Error('canvas is not found');
        }
        console.log(canvas,'canvas');
        console.log('PointerEventService init', board);
    }
}

export default PointerEventService;