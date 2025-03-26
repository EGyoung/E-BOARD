import { commonServicesMap } from '../common/initServices';
import { IService, IPlugin, IBoard } from '../types';
import { bindServices } from './bindServices';
import { eBoardContainer } from '../common/IocContainer';



export class EBoard implements IBoard {
    private canvas: HTMLCanvasElement | null;
    private container: HTMLDivElement | null;
    constructor(container: HTMLDivElement) {
        this.container = container;
        this.canvas = this.createCanvas();
        this.initEBoard()
        
    }
    private services: IService[] = [];
    private plugins: IPlugin[] = [];

    private initEBoard() {
        bindServices();
        this.initServices()
    }

    private initServices() {
        commonServicesMap.forEach(({ name }) => {
            this.services.push(eBoardContainer.get(name));
        });
        this.services.forEach(service => service.init({ board: this }));
    }

    private createCanvas() {
        const canvas = document.createElement('canvas');
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.position = 'absolute';
        canvas.style.top = '500px';
        canvas.style.left = '500px';
        canvas.style.zIndex = '1';
        canvas.style.backgroundColor = 'transparent';
        canvas.style.pointerEvents = 'none';
        canvas.style.userSelect = 'none';
        canvas.style.touchAction = 'none';
        canvas.style.imageRendering = 'pixelated';
        canvas.style.imageRendering = '-webkit-optimize-contrast';
        canvas.style.imageRendering = '-moz-crisp-edges';
        canvas.style.imageRendering = '-o-crisp-edges';
        canvas.style.imageRendering = '-webkit-optimize-contrast';

        // canvas 里随便画点东西
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = 'red';
            ctx.fillRect(0, 0, 100, 100);
        }
        this.container?.appendChild(canvas);
        return canvas;
    }

    public getCanvas(): HTMLCanvasElement | null {
        return this.canvas;
    }

    public getContainer(): HTMLDivElement | null {
        return this.container;
    }

    init() {
        this.services.forEach(service => service.init({board: this}));
        this.plugins.forEach(plugin => plugin.init());
        console.log('EBoard initialized');
    }

    dispose() {
        this.services.forEach(service => service.dispose());
        this.plugins.forEach(plugin => plugin.dispose());
        this.services = [];
        this.plugins = [];
        this.container = null;
        this.canvas = null;
    }
}

export default EBoard;