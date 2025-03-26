import { IBoard, IServiceInitParams } from "../../types";
import { Emitter} from '@e-board/utils'
import { IPointerEventService } from "./type";
import { injectable, decorate } from "inversify";

class PointerEventService implements IPointerEventService  {
    private board!: IBoard;
    private _pointerDownEvent =  new Emitter<PointerEvent>()
    private _pointerMoveEvent = new Emitter<PointerEvent>();
    private _pointerUpEvent =  new Emitter<PointerEvent>();
    
    // 存储事件处理函数的引用
    private handlePointerDown = (e: PointerEvent) => {
        console.log('pointer down fired');
        this._pointerDownEvent.fire(e);
    }
    
    private handlePointerMove = (e: PointerEvent) => {
        this._pointerMoveEvent.fire(e);
    }
    
    private handlePointerUp = (e: PointerEvent) => {
        this._pointerUpEvent.fire(e);
    }
    
    public onPointerDown =  this._pointerDownEvent.event
    public onPointerMove = this._pointerMoveEvent.event
    public onPointerUp = this._pointerUpEvent.event
    
    public init({ board }: IServiceInitParams) {
        this.board = board;
        const canvas =  this.board.getCanvas()
        if (!canvas) {
            throw new Error('canvas is not found');
        }
        this.initPointerEvent();
    }

    private initPointerEvent = () => {
        const canvas = this.board.getCanvas()
        if (!canvas) {
            throw new Error('canvas is not found');
        }
        
        canvas.addEventListener('pointerdown', this.handlePointerDown);
        canvas.addEventListener('pointermove', this.handlePointerMove);
        canvas.addEventListener('pointerup', this.handlePointerUp);
    }

    public dispose(): void {
        const canvas = this.board.getCanvas()
        if (!canvas) return
        
        canvas.removeEventListener('pointerdown', this.handlePointerDown);
        canvas.removeEventListener('pointermove', this.handlePointerMove);
        canvas.removeEventListener('pointerup', this.handlePointerUp);
    }
}

// 使用 decorate 替代装饰器语法
decorate(injectable(), PointerEventService);

export default PointerEventService;