import { ICanvasService } from "./type";
import { IServiceInitParams } from "../../types";
import { Emitter } from "@e-board/board-utils";

const INTERACTION_CANVAS_ID = "interaction-canvas";

class CanvasService implements ICanvasService {
    private canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;
    private interactionCanvas: HTMLCanvasElement | null = null;
    private interactionCtx: CanvasRenderingContext2D | null = null;
    private dpr: number = window.devicePixelRatio || 1;
    private container: HTMLDivElement | null = null;
    private boardId: string = "";

    private _canvasResize = new Emitter<{ width: number; height: number }>();
    public onCanvasResize = this._canvasResize.event;

    init(params: IServiceInitParams): void {
        const { board } = params;
        this.container = board.getContainer();
        // 从 board 获取 id
        this.boardId = (board as any).id;

        this.initMainCanvas();
        this.initInteractionCanvas();
    }

    private initMainCanvas(): void {
        if (!this.container) return;

        // 检查是否已存在画布
        const existing = document.querySelector(`#${this.boardId}`) as HTMLCanvasElement;
        this.canvas = existing || this.createCanvas(this.boardId, {
            zIndex: "1",
            backgroundColor: "rgba(10, 34, 30, 1)"
        });

        const { clientWidth = 800, clientHeight = 600 } = this.container;
        this.updateCanvas(this.canvas, clientWidth, clientHeight);

        this.ctx = this.initContext(this.canvas);
    }

    private initInteractionCanvas(): void {
        if (!this.container) return;

        const existing = document.querySelector(`#${INTERACTION_CANVAS_ID}`) as HTMLCanvasElement;
        this.interactionCanvas = existing || this.createCanvas(INTERACTION_CANVAS_ID, {
            zIndex: "2"
        });

        const { clientWidth = 800, clientHeight = 600 } = this.container;
        this.updateCanvas(this.interactionCanvas, clientWidth, clientHeight);

        this.interactionCtx = this.initContext(this.interactionCanvas);
    }

    private createCanvas(
        id: string,
        options: { zIndex: string; backgroundColor?: string }
    ): HTMLCanvasElement {
        const canvas = document.createElement("canvas");
        canvas.id = id;

        Object.assign(canvas.style, {
            position: "absolute",
            top: "0",
            left: "0",
            width: "100%",
            height: "100%",
            display: "block",
            userSelect: "none",
            touchAction: "none",
            zIndex: options.zIndex
        });

        if (options.backgroundColor) {
            canvas.style.backgroundColor = options.backgroundColor;
        }

        this.container?.appendChild(canvas);
        return canvas;
    }

    private updateCanvas(canvas: HTMLCanvasElement, width: number, height: number): void {
        canvas.width = width * this.dpr;
        canvas.height = height * this.dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
    }

    private initContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
        const ctx = canvas.getContext("2d", { alpha: true });
        if (ctx) {
            ctx.scale(this.dpr, this.dpr);
        }
        return ctx;
    }

    // Public API
    getCanvas(): HTMLCanvasElement | null {
        return this.canvas;
    }

    getCtx(): CanvasRenderingContext2D | null {
        return this.ctx;
    }

    getInteractionCanvas(): HTMLCanvasElement | null {
        return this.interactionCanvas;
    }

    getInteractionCtx(): CanvasRenderingContext2D | null {
        return this.interactionCtx;
    }

    updateCanvasSize(width: number, height: number): void {
        if (this.canvas && this.ctx) {
            this.updateCanvas(this.canvas, width, height);
            this.ctx.scale(this.dpr, this.dpr);
        }

        if (this.interactionCanvas && this.interactionCtx) {
            this.updateCanvas(this.interactionCanvas, width, height);
            this.interactionCtx.scale(this.dpr, this.dpr);
        }

        this._canvasResize.fire({ width, height });
    }

    dispose(): void {
        this.canvas?.remove();
        this.interactionCanvas?.remove();
        this._canvasResize.dispose();

        this.canvas = null;
        this.ctx = null;
        this.interactionCanvas = null;
        this.interactionCtx = null;
        this.container = null;
    }
}
export default CanvasService;