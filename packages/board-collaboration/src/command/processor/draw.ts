import type { EBoard } from "@e-board/board-core";

class DrawProcessor {
    private interactionCtx: CanvasRenderingContext2D | null = null
    private board: EBoard
    constructor(board: EBoard) {
        this.interactionCtx = board.getInteractionCtx()
        this.board = board
    }
    static commandName = 'draw'

    private get transformService() {
        return this.board.getService('transformService')
    }

    private transformPoint(point: { x: number; y: number }, inverse = false) {
        return this.transformService.transformPoint(point, inverse);
    }

    private getZoom() {
        return this.transformService.getView().zoom || 1;
    }

    handler(params: any) {
        const { isEnd, options, isBegin } = params;
        const points = params.points.map((point: { x: number; y: number }) => this.transformPoint(point));
        if (!this.interactionCtx) return;
        this.interactionCtx.save();
        this.interactionCtx.lineCap = options.lineCap;
        this.interactionCtx.lineJoin = options.lineJoin;
        this.interactionCtx.lineWidth = options.lineWidth * this.getZoom();
        this.interactionCtx.strokeStyle = options.strokeStyle;
        if (isBegin) {
            this.interactionCtx.beginPath();
            this.interactionCtx.moveTo(points[0].x, points[0].y);
        } else {
            this.interactionCtx.beginPath();
            if (points.length > 1) {
                this.interactionCtx.moveTo(points[0].x, points[0].y);
                for (let i = 1; i < points.length; i++) {
                    const point = points[i];
                    const previousScreenPoint = points[i - 1];
                    const midPointX = (previousScreenPoint.x + point.x) / 2;
                    const midPointY = (previousScreenPoint.y + point.y) / 2;
                    this.interactionCtx.quadraticCurveTo(previousScreenPoint.x, previousScreenPoint.y, midPointX, midPointY);
                }
                this.interactionCtx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
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