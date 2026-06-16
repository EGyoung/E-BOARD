import { uuid } from "@e-board/board-utils"

const BLINK_MS = 500

interface CursorStyle {
    width?: string
    height?: string
    background?: string
    color?: string
}

const DEFAULT_STYLE: Required<CursorStyle> = {
    width: '2px',
    height: '20px',
    background: '#0071e3',
    color: '#0071e3',
}

class Cursor {
    private cursorIds: string[] = []
    private currentCursorId = ''
    private domMap = new Map<string, HTMLDivElement>()
    private visibleMap = new Map<string, boolean>()
    private timerMap = new Map<string, number>()
    private style: Required<CursorStyle>

    constructor(style?: CursorStyle) {
        this.style = { ...DEFAULT_STYLE, ...style }
        const id = this.createCursorId()
        this.cursorIds.push(id)
        this.currentCursorId = id
    }

    private createCursorId = () => {
        return uuid() + '-cursor'
    }

    private createCaret(id: string) {
        const div = document.createElement('div')
        div.id = id
        div.style.cssText = `
            width: ${this.style.width};
            height: ${this.style.height};
            background: ${this.style.background};
            color: ${this.style.color};
            position: absolute;
            left: 0;
            top: 0;
            visibility: visible;
        `
        return div
    }

    showAll() {
        for (const id of this.cursorIds) {
            this.showById(id)
        }
    }

    stopAll() {
        for (const id of this.cursorIds) {
            this.stopById(id)
        }
    }

    show() {
        this.showById(this.currentCursorId)
    }

    stop() {
        this.stopById(this.currentCursorId)
    }

    /** 隐藏光标 DOM 但不销毁，可配合 show 恢复 */
    hide() {
        const dom = this.domMap.get(this.currentCursorId)
        if (dom) dom.style.visibility = 'hidden'
    }

    private showById(id: string) {
        this.stopById(id)
        this.visibleMap.set(id, false)

        if (!this.domMap.has(id)) {
            const dom = this.createCaret(id)
            this.domMap.set(id, dom)
            document.body.appendChild(dom)
        }

        const timer = window.setInterval(() => {
            const dom = this.domMap.get(id)
            if (!dom) return
            const isVisible = this.visibleMap.get(id) ?? false
            dom.style.visibility = isVisible ? 'visible' : 'hidden'
            this.visibleMap.set(id, !isVisible)
        }, BLINK_MS)

        this.timerMap.set(id, timer)
    }

    private stopById(id: string) {
        const timer = this.timerMap.get(id)
        if (timer) {
            window.clearInterval(timer)
            this.timerMap.delete(id)
        }
    }

    updatePosition(left: number, top: number) {
        const dom = this.domMap.get(this.currentCursorId)
        if (!dom) return
        dom.style.left = `${left}px`
        dom.style.top = `${top}px`
    }

    dispose() {
        this.stopAll()
        this.domMap.forEach(dom => dom.remove())
        this.domMap.clear()
        this.visibleMap.clear()
        this.cursorIds = []
    }
}

export { Cursor }
