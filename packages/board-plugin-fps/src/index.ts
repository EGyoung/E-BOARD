import type { EBoard } from "@e-board/board-core";

class FpsPlugin {
    private board!: EBoard;
    private animationFrameId: number | null = null;
    private lastFrameTime = performance.now();
    private frameCount = 0;
    private fps = 0;
    private fpsHistory: number[] = [];
    private readonly historySize = 60; // 保持60帧历史用于平滑
    private enabled = true;
    private fpsElement: HTMLDivElement | null = null;

    public pluginName = "FpsPlugin";

    public exports = {
        getFps: this.getFps.bind(this),
        getAverageFps: this.getAverageFps.bind(this),
        setEnabled: this.setEnabled.bind(this),
        isEnabled: this.isEnabled.bind(this)
    };

    public init({ board }: { board: EBoard }) {
        this.board = board;
        this.createFpsElement();
        this.startFpsMonitor();
    }

    private createFpsElement() {
        const container = this.board.getContainer();
        if (!container) {
            console.warn('FpsPlugin: container not found');
            return;
        }

        // 确保container有相对定位
        const computedStyle = window.getComputedStyle(container);
        if (computedStyle.position === 'static') {
            container.style.position = 'relative';
        }

        // 创建FPS显示DOM元素
        this.fpsElement = document.createElement('div');
        this.fpsElement.style.position = 'absolute';
        this.fpsElement.style.top = '10px';
        this.fpsElement.style.right = '10px';
        this.fpsElement.style.width = '100px';
        this.fpsElement.style.height = '70px';
        this.fpsElement.style.backgroundColor = '#FFFF00';
        this.fpsElement.style.border = '2px solid #000000';
        this.fpsElement.style.borderRadius = '5px';
        this.fpsElement.style.padding = '5px';
        this.fpsElement.style.zIndex = '99999';
        this.fpsElement.style.pointerEvents = 'none';
        this.fpsElement.style.fontFamily = 'Arial, sans-serif';
        this.fpsElement.style.textAlign = 'center';
        this.fpsElement.style.display = 'flex';
        this.fpsElement.style.flexDirection = 'column';
        this.fpsElement.style.justifyContent = 'center';
        this.fpsElement.style.alignItems = 'center';

        this.fpsElement.innerHTML = `
            <div style="font-size: 32px; font-weight: bold; color: #000000;">0</div>
            <div style="font-size: 12px; font-weight: bold; color: #000000;">FPS</div>
            <div style="font-size: 10px; color: #000000;">avg: 0</div>
        `;

        container.appendChild(this.fpsElement);

        console.log('FpsPlugin: DOM element created', {
            container: container,
            element: this.fpsElement
        });
    }

    private startFpsMonitor = () => {
        const updateFps = (currentTime: number) => {
            this.frameCount++;
            const deltaTime = currentTime - this.lastFrameTime;

            // 每秒更新一次FPS
            if (deltaTime >= 1000) {
                this.fps = Math.round((this.frameCount * 1000) / deltaTime);
                this.fpsHistory.push(this.fps);

                // 保持历史记录在限定大小内
                if (this.fpsHistory.length > this.historySize) {
                    this.fpsHistory.shift();
                }

                this.frameCount = 0;
                this.lastFrameTime = currentTime;
            }

            // 绘制FPS显示
            if (this.enabled) {
                this.renderFps();
            }

            this.animationFrameId = requestAnimationFrame(updateFps);
        };

        this.animationFrameId = requestAnimationFrame(updateFps);
    };

    private renderFps = () => {
        if (!this.fpsElement) {
            console.warn('FpsPlugin: element not available');
            return;
        }

        const avgFps = this.getAverageFps();

        this.fpsElement.innerHTML = `
            <div style="font-size: 32px; font-weight: bold; color: #000000;">${this.fps}</div>
            <div style="font-size: 12px; font-weight: bold; color: #000000;">FPS</div>
            <div style="font-size: 10px; color: #000000;">avg: ${avgFps}</div>
        `;
    };

    public getFps(): number {
        return this.fps;
    }

    public getAverageFps(): number {
        if (this.fpsHistory.length === 0) return 0;
        const sum = this.fpsHistory.reduce((acc, val) => acc + val, 0);
        return Math.round(sum / this.fpsHistory.length);
    }

    public setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        if (this.fpsElement) {
            this.fpsElement.style.display = enabled ? 'flex' : 'none';
        }
    }

    public isEnabled(): boolean {
        return this.enabled;
    }

    public dispose(): void {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        // 移除FPS DOM元素
        if (this.fpsElement && this.fpsElement.parentNode) {
            this.fpsElement.parentNode.removeChild(this.fpsElement);
        }

        this.fpsElement = null;
        this.fpsHistory = [];
    }
}

export default FpsPlugin;
