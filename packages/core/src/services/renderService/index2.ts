import { eBoardContainer } from "../../common/IocContainer";
import { IBoard, IServiceInitParams } from "../../types";
import { IModelService, ModelChangeType, BoundingBox } from '../modelService/type';
import { ITransformService } from "../transformService/type";
import { initContextAttrs } from "@e-board/utils";

import { IRenderService } from "./type";

interface IDrawModelHandler {
    (model: any, ctx?: CanvasRenderingContext2D): void;
}

type Range = {
    minX: number,
    minY: number,
    maxX: number,
    maxY: number
}

// 瓦片管理器 - 固定网格数量，动态瓦片大小
class TileManager {
    private gridRows: number;
    private gridCols: number;
    private tiles: Map<string, Set<any>> = new Map();
    private canvasWidth: number = 0;
    private canvasHeight: number = 0;

    constructor(gridRows = 32, gridCols = 32) {
        this.gridRows = gridRows;
        this.gridCols = gridCols;
    }

    // 设置画布尺寸
    setCanvasSize(width: number, height: number) {
        this.canvasWidth = width;
        this.canvasHeight = height;
    }

    // 获取当前瓦片尺寸（动态计算）
    getTileSize(): { width: number; height: number } {
        return {
            width: this.canvasWidth / this.gridCols,
            height: this.canvasHeight / this.gridRows
        };
    }

    // 获取范围覆盖的所有瓦片键
    private getTileKeysInRange(range: Range): string[] {
        const tileSize = this.getTileSize();
        const startTileX = Math.max(0, Math.floor(range.minX / tileSize.width));
        const startTileY = Math.max(0, Math.floor(range.minY / tileSize.height));
        const endTileX = Math.min(this.gridCols - 1, Math.floor(range.maxX / tileSize.width));
        const endTileY = Math.min(this.gridRows - 1, Math.floor(range.maxY / tileSize.height));

        const keys: string[] = [];
        for (let x = startTileX; x <= endTileX; x++) {
            for (let y = startTileY; y <= endTileY; y++) {
                keys.push(`${x},${y}`);
            }
        }
        return keys;
    }

    // 添加模型到瓦片索引
    addModel(model: any, boundingBox: BoundingBox) {
        const keys = this.getTileKeysInRange(boundingBox as Range);
        keys.forEach(key => {
            if (!this.tiles.has(key)) {
                this.tiles.set(key, new Set());
            }
            this.tiles.get(key)!.add(model);
        });
    }

    // 从瓦片索引中移除模型
    removeModel(model: any, boundingBox: BoundingBox) {
        const keys = this.getTileKeysInRange(boundingBox as Range);
        keys.forEach(key => {
            const tile = this.tiles.get(key);
            if (tile) {
                tile.delete(model);
                if (tile.size === 0) {
                    this.tiles.delete(key);
                }
            }
        });
    }

    // 更新模型在瓦片中的位置
    updateModel(model: any, oldBox: BoundingBox, newBox: BoundingBox) {
        this.removeModel(model, oldBox);
        this.addModel(model, newBox);
    }

    // 获取范围内的所有模型（去重）
    getModelsInRange(range: Range): Set<any> {
        const keys = this.getTileKeysInRange(range);
        const models = new Set<any>();
        keys.forEach(key => {
            const tile = this.tiles.get(key);
            if (tile) {
                tile.forEach(model => models.add(model));
            }
        });
        return models;
    }

    // 清空所有瓦片
    clear() {
        this.tiles.clear();
    }

    // 获取所有瓦片信息（用于调试可视化）
    getAllTiles(): Array<{ key: string; x: number; y: number; count: number }> {
        const result: Array<{ key: string; x: number; y: number; count: number }> = [];
        const tileSize = this.getTileSize();

        this.tiles.forEach((models, key) => {
            const [x, y] = key.split(',').map(Number);
            result.push({
                key,
                x: x * tileSize.width,
                y: y * tileSize.height,
                count: models.size
            });
        });
        return result;
    }

    // 获取网格配置
    getGridConfig() {
        return {
            rows: this.gridRows,
            cols: this.gridCols,
            tileSize: this.getTileSize()
        };
    }
}

class RenderService implements IRenderService {
    private static readonly DIRTY_PADDING = 2;
    private static readonly TILE_EXTEND_RANGE = 200;

    private board!: IBoard;
    private modelService = eBoardContainer.get<IModelService>(IModelService);
    private modelHandler = new Map<string, IDrawModelHandler>();
    private disposeList: (() => void)[] = [];
    private redrawRequested = false;
    private currentRanges: Range | null = null;
    private tileManager: TileManager;
    private needRebuildIndex = false;
    private lastViewState: { x: number; y: number; zoom: number } | null = null;

    constructor() {
        // 初始化瓦片管理器：32×32 = 1024个固定网格
        this.tileManager = new TileManager(32, 32);
    }

    init = ({ board }: IServiceInitParams) => {
        this.board = board;
        this.initModelChange();
        // 初始化时构建瓦片索引
        const transformService = eBoardContainer.get<ITransformService>(ITransformService);
        this.lastViewState = transformService.getView();

        // 设置画布尺寸
        const canvas = this.board.getCanvas();
        if (canvas) {
            this.tileManager.setCanvasSize(canvas.width, canvas.height);
        }

        this.rebuildTileIndex();
    };

    private rebuildTileIndex() {
        const models = this.modelService.getAllModels();
        this.tileManager.clear();

        models.forEach(model => {
            const box = model.ctrlElement?.getBoundingBox?.(model);
            if (box) {
                this.tileManager.addModel(model, this.normalizeBoundingBox(box));
            }
        });

        this.needRebuildIndex = false;
    }

    private initModelChange() {
        const { dispose } = this.modelService.onModelOperation(this.handleModelOperationChange);
        this.disposeList.push(dispose);
    }

    private expendDirtyRange(box: Range): Range {
        return {
            minX: box.minX - RenderService.DIRTY_PADDING,
            minY: box.minY - RenderService.DIRTY_PADDING,
            maxX: box.maxX + RenderService.DIRTY_PADDING,
            maxY: box.maxY + RenderService.DIRTY_PADDING,
        };
    }

    private accumulateRange(nextRange: Range) {
        if (!nextRange) return;
        if (!this.currentRanges) {
            this.currentRanges = { ...nextRange };
            return;
        }

        this.currentRanges = {
            minX: Math.min(this.currentRanges.minX, nextRange.minX),
            minY: Math.min(this.currentRanges.minY, nextRange.minY),
            maxX: Math.max(this.currentRanges.maxX, nextRange.maxX),
            maxY: Math.max(this.currentRanges.maxY, nextRange.maxY),
        };
    }

    private getExpandedBoundingBox(state?: any) {
        const box: BoundingBox | undefined = state?.ctrlElement?.getBoundingBox?.(state);
        return box ? this.expendDirtyRange(box as Range) : null;
    }

    // 规范化边界框，确保有 minX/minY/maxX/maxY 字段
    private normalizeBoundingBox(box: BoundingBox): BoundingBox {
        // 如果已经有 minX/minY/maxX/maxY，直接返回
        if (box.minX !== undefined && box.maxX !== undefined) {
            return box;
        }

        // 否则从 x/y/width/height 计算
        const minX = box.x;
        const minY = box.y;
        const maxX = box.x + box.width;
        const maxY = box.y + box.height;

        return {
            ...box,
            minX,
            minY,
            maxX,
            maxY
        };
    }

    private handleModelOperationChange: Parameters<typeof this.modelService.onModelOperation>[0] = (event) => {
        if (event.type === ModelChangeType.CREATE) {
            const boundingBox = this.getExpandedBoundingBox(event.model);
            if (!boundingBox) return;
            this.accumulateRange(boundingBox);

            const box = event.model?.ctrlElement?.getBoundingBox?.(event.model);
            if (box) {
                this.tileManager.addModel(event.model, this.normalizeBoundingBox(box));
            }
        } else if (event.type === ModelChangeType.DELETE) {
            const boundingBox = this.getExpandedBoundingBox(event.model);
            if (!boundingBox) return;
            this.accumulateRange(boundingBox);

            const box = event.model?.ctrlElement?.getBoundingBox?.(event.model);
            if (box) {
                this.tileManager.removeModel(event.model, this.normalizeBoundingBox(box));
            }
        } else if (event.type === ModelChangeType.UPDATE) {
            const currentModel = this.modelService.getModelById(event.modelId);
            if (!currentModel) return;

            const previousModel = { ...currentModel, ...event.previousState };
            const prevBoundingBox = this.getExpandedBoundingBox(previousModel);
            const currentBoundingBox = this.getExpandedBoundingBox(currentModel);

            if (!prevBoundingBox || !currentBoundingBox) return;

            // 合并旧位置和新位置的边界框作为脏区域
            this.accumulateRange({
                minX: Math.min(prevBoundingBox.minX, currentBoundingBox.minX),
                minY: Math.min(prevBoundingBox.minY, currentBoundingBox.minY),
                maxX: Math.max(prevBoundingBox.maxX, currentBoundingBox.maxX),
                maxY: Math.max(prevBoundingBox.maxY, currentBoundingBox.maxY),
            });

            // 更新瓦片索引
            const prevBox = previousModel.ctrlElement?.getBoundingBox?.(previousModel);
            const currentBox = currentModel.ctrlElement?.getBoundingBox?.(currentModel);
            if (prevBox && currentBox) {
                this.tileManager.updateModel(
                    currentModel,
                    this.normalizeBoundingBox(prevBox),
                    this.normalizeBoundingBox(currentBox)
                );
            }
        }

        this.reRender();
    }


    public registerDrawModelHandler(key: string, handler: IDrawModelHandler) {
        this.modelHandler.set(key, handler);
    }

    public unregisterDrawModelHandler(key: string) {
        this.modelHandler.delete(key);
    }

    public dispose(): void {
        this.modelHandler = new Map();
        this.disposeList.forEach(dispose => dispose());
        this.tileManager.clear();
    }

    public reRender = () => {
        if (!this.redrawRequested) {
            this.redrawRequested = true;
            requestAnimationFrame(() => {
                this._render();
                this.redrawRequested = false;
            });
        }
    };

    private _render = () => {
        const context = this.board.getCtx();
        const interactionCtx = this.board.getInteractionCtx();
        if (!context) return;
        const canvas = this.board.getCanvas();
        if (!canvas) return;
        const transformService = eBoardContainer.get<ITransformService>(ITransformService);

        // 检查视图是否发生变化（漫游、缩放）
        const currentView = transformService.getView();
        const viewChanged = this.lastViewState && (
            this.lastViewState.x !== currentView.x ||
            this.lastViewState.y !== currentView.y ||
            this.lastViewState.zoom !== currentView.zoom
        );

        // 如果视图变化或需要重建索引
        if (viewChanged || this.needRebuildIndex) {
            this.rebuildTileIndex();
            this.lastViewState = currentView;
            // 视图变化时触发全屏渲染
            this.currentRanges = null;
        }

        let modelsToRender: any[];
        let canvasBounds: Range | null = null;

        if (!this.currentRanges) {
            // 全屏渲染
            context.clearRect(0, 0, canvas.width, canvas.height);
            if (interactionCtx) {
                interactionCtx.clearRect(0, 0, interactionCtx.canvas.width, interactionCtx.canvas.height);
            }
            modelsToRender = this.modelService.getAllModels();
        } else {
            // 脏矩形渲染
            const { minX, minY, maxX, maxY } = this.currentRanges;
            const padding = RenderService.DIRTY_PADDING;
            const clearX = Math.floor(minX - padding);
            const clearY = Math.floor(minY - padding);
            const clearW = Math.ceil(maxX - minX + padding * 2);
            const clearH = Math.ceil(maxY - minY + padding * 2);

            canvasBounds = {
                minX: clearX,
                minY: clearY,
                maxX: clearX + clearW,
                maxY: clearY + clearH
            };

            context.clearRect(clearX, clearY, clearW, clearH);
            if (interactionCtx) {
                interactionCtx.clearRect(clearX, clearY, clearW, clearH);
            }
            context.save();
            context.beginPath();
            context.rect(clearX, clearY, clearW, clearH);
            context.clip();

            // 使用瓦片索引查询需要渲染的模型
            const extend = RenderService.TILE_EXTEND_RANGE;
            const extendedRange: Range = {
                minX: clearX - extend,
                minY: clearY - extend,
                maxX: clearX + clearW + extend,
                maxY: clearY + clearH + extend,
            };

            const modelsInTiles = this.tileManager.getModelsInRange(extendedRange);
            const allModels = this.modelService.getAllModels();
            modelsToRender = allModels.filter(model => modelsInTiles.has(model));

            // 降级策略：如果瓦片查询结果为空，使用相交检测
            if (modelsToRender.length === 0) {
                modelsToRender = allModels.filter(model => {
                    const modelBox = model.ctrlElement?.getBoundingBox?.(model);
                    return modelBox ? this.isIntersecting(extendedRange, modelBox as any) : true;
                });
            }
        }

        const zoom = transformService.getView().zoom;
        for (let i = 0; i < modelsToRender.length; i++) {
            const model = modelsToRender[i];

            // 脏矩形渲染时进行精确的相交检测
            if (canvasBounds) {
                const modelBox = model.ctrlElement?.getBoundingBox?.(model);
                if (!modelBox) continue;

                const expandedModelBox = this.expendDirtyRange(modelBox);
                if (!this.isIntersecting(canvasBounds, expandedModelBox)) {
                    continue;
                }
            }

            const handler = this.modelHandler.get(model.type);
            if (handler) {
                context.beginPath();
                initContextAttrs(context, { zoom }, model.options);
                handler(model, context);
                context.stroke();
            }
        }

        context.restore();
        this.currentRanges = null;

        // 绘制瓦片网格（调试用）
        // this.drawTileGrid(context);
    };

    private isIntersecting(a: Range, b: Range): boolean {
        return !(a.maxX <= b.minX || a.minX >= b.maxX || a.maxY <= b.minY || a.minY >= b.maxY);
    }

    // 绘制瓦片网格（用于调试）
    private drawTileGrid(context: CanvasRenderingContext2D) {
        const canvas = this.board.getCanvas();
        if (!canvas) return;

        const gridConfig = this.tileManager.getGridConfig();
        const tileSize = gridConfig.tileSize;

        context.save();

        // 绘制所有32×32网格
        for (let tileX = 0; tileX < gridConfig.cols; tileX++) {
            for (let tileY = 0; tileY < gridConfig.rows; tileY++) {
                const x = tileX * tileSize.width;
                const y = tileY * tileSize.height;
                const key = `${tileX},${tileY}`;

                // 检查这个瓦片中是否有元素
                const tiles = this.tileManager.getAllTiles();
                const tile = tiles.find(t => t.key === key);
                const hasElements = tile && tile.count > 0;

                // 绘制瓦片边框
                context.strokeStyle = hasElements
                    ? 'rgba(0, 150, 255, 0.5)'
                    : 'rgba(200, 200, 200, 0.1)';
                context.lineWidth = hasElements ? 1.5 : 0.5;
                context.strokeRect(x, y, tileSize.width, tileSize.height);

                // 如果有元素，绘制元素数量和背景
                if (hasElements) {
                    // 绘制半透明背景
                    context.fillStyle = 'rgba(0, 150, 255, 0.08)';
                    context.fillRect(x, y, tileSize.width, tileSize.height);

                    // 绘制元素计数
                    if (tileSize.width > 20) {
                        context.fillStyle = 'rgba(0, 100, 200, 0.8)';
                        context.font = 'bold 10px monospace';
                        context.fillText(`${tile!.count}`, x + 3, y + 12);
                    }
                }
            }
        }

        context.restore();
    }
}

export default RenderService;
