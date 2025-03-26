import { eBoardContainer } from '../../common/IocContainer';
import { IPointerEventService } from '../../services';
import { IBoard, IPluginInitParams } from '../../types';
import { IPlugin } from '../type';

class DrawPlugin implements IPlugin {
  private board!: IBoard;
  private disposeList: (() => void)[] = [];
  public init({ board }: IPluginInitParams) {
    this.board = board;
    console.log('DrawPlugin init', board);
    this.initDraw();
  }

  private initDraw = () => {
    const canvas = this.board.getCanvas();
    const ctx = canvas?.getContext('2d');
    if (!ctx) {
      throw new Error('ctx is not found');
    }
    const pointerEventService = eBoardContainer.get<IPointerEventService>(IPointerEventService);

    // 实现绘制功能
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    console.error(pointerEventService, 'pointerEventService');
    const { dispose: disposePointerDown } = pointerEventService.onPointerDown(event => {
      console.log('pointerdown');
      isDrawing = true;
      lastX = event.clientX;
      lastY = event.clientY;
    });
    const { dispose: disposePointerMove } = pointerEventService.onPointerMove(event => {
      if (!isDrawing) return;
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(event.clientX, event.clientY);
      // 设置绘制颜色
      ctx.strokeStyle = 'white';
      ctx.stroke();
      console.log('???????');
      lastX = event.clientX;
      lastY = event.clientY;
    });

    const { dispose: disposePointerUp } = pointerEventService.onPointerUp(event => {
      isDrawing = false;
    });

    this.disposeList.push(disposePointerDown, disposePointerMove, disposePointerUp);
  };

  public dispose() {
    // this.disposeList.forEach(dispose => dispose());
  }
}

export default DrawPlugin;
