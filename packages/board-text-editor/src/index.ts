import { Cursor } from "./modules/cursor"

class TextEditor {
    private cursor: Cursor = new Cursor()
    private canvas: HTMLCanvasElement
    private interactionCanvas: HTMLCanvasElement
    constructor({ canvas, interactionCanvas }: { canvas: HTMLCanvasElement, interactionCanvas: HTMLCanvasElement }) {
        this.canvas = canvas
        this.interactionCanvas = interactionCanvas
        this.attachEvent()
    }
    private attachEvent() {
        this.interactionCanvas.addEventListener('dblclick', (e) => {
            this.cursor.show()
            this.cursor.updatePosition(e.clientX, e.clientY)
        })
    }



}

export { TextEditor }