import type { EBoard } from "@e-board/board-core";

class DrawProcessor {
    private interactionCtx: CanvasRenderingContext2D | null = null
    constructor(board: EBoard) {
        this.interactionCtx = board.getInteractionCtx()
    }
    static commandName = 'draw'

    handler(params: any) {
        const { isEnd, points, options, isBegin } = params;
        if (!this.interactionCtx) return;
        this.interactionCtx.save();
        this.interactionCtx.lineCap = options.lineCap;
        this.interactionCtx.lineJoin = options.lineJoin;
        this.interactionCtx.lineWidth = options.lineWidth;
        this.interactionCtx.strokeStyle = options.strokeStyle;
        if (isBegin) {
            this.interactionCtx.beginPath();
            this.interactionCtx.moveTo(points[0].x, points[0].y);
        } else {
            this.interactionCtx.beginPath();
            for (let i = 1; i < points.length; i++) {
                const point = points[i];
                this.interactionCtx.lineTo(point.x, point.y);
            }
            this.interactionCtx.stroke();
        }
        if (isEnd) {
            this.interactionCtx.closePath();
        }
        this.interactionCtx.restore();
    }
}

export default DrawProcessor    