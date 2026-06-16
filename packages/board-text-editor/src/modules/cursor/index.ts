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
    private style: Required<CursorStyle>
    private isVisible = true
    private timer = 0

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
            this.ensureDom(id)
        }
        this.startTimer()
    }

    stopAll() {
        this.stopTimer()
    }

    show() {
        this.ensureDom(this.currentCursorId)
        this.startTimer()
    }

    stop() {
        this.stopTimer()
    }

    /** 隐藏光标 DOM 但不销毁，可配合 show 恢复 */
    hide() {
        const dom = this.domMap.get(this.currentCursorId)
        if (dom) dom.style.visibility = 'hidden'
    }

    private ensureDom(id: string) {
        if (!this.domMap.has(id)) {
            const dom = this.createCaret(id)
            this.domMap.set(id, dom)
            document.body.appendChild(dom)
        }
    }

    private startTimer() {
        this.stopTimer()
        // 初始为 false，第一次 tick 立即隐藏，之后正常闪烁
        this.isVisible = true

        const tick = () => {
            const visibility = this.isVisible ? 'visible' : 'hidden'
            for (const id of this.cursorIds) {
                const dom = this.domMap.get(id)
                if (dom) dom.style.visibility = visibility
            }
            this.isVisible = !this.isVisible
        }

        // 立即执行第一次切换，之后正常循环
        tick()
        this.timer = window.setInterval(tick, BLINK_MS)
    }

    private stopTimer() {
        if (this.timer) {
            window.clearInterval(this.timer)
            this.timer = 0
        }
    }

    updatePosition(left: number, top: number) {
        const dom = this.domMap.get(this.currentCursorId)
        if (!dom) return
        dom.style.left = `${left}px`
        dom.style.top = `${top}px`
    }

    dispose() {
        this.stopTimer()
        this.domMap.forEach(dom => dom.remove())
        this.domMap.clear()
        this.cursorIds = []
    }
}

export { Cursor }
