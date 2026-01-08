import { Range } from "./type";

class TileManager {
    private tailRows: number;
    private tailCols: number;
    private canvasSize: {
        width: number;
        height: number;
    } = { width: 0, height: 0 };
    private dpr = window.devicePixelRatio || 1;

    private tailMap: Map<string, Set<string>> = new Map();

    constructor(rows: number, cols: number, canvasSize: { width: number; height: number }) {
        this.tailRows = rows;
        this.tailCols = cols;
        this.canvasSize = canvasSize;
    }

    // 计算出一个瓦片的大小
    public getTileSize() {
        const cssWidth = this.canvasSize.width / this.dpr;
        const cssHeight = this.canvasSize.height / this.dpr;
        return {
            width: cssWidth / this.tailCols,
            height: cssHeight / this.tailRows
        }
    }

    // 根据元素的范围来获取 这个范围内覆盖到的瓦片key, 最左上角 （0，0） 最右下角（31，31）
    private getKeysByBoundingBox(boundingBox: Range): string[] {
        const tileSize = this.getTileSize();
        const startTileX = Math.max(0, Math.floor(boundingBox.minX / tileSize.width));
        const startTileY = Math.max(0, Math.floor(boundingBox.minY / tileSize.height));
        const endTileX = Math.min(this.tailCols - 1, Math.floor(boundingBox.maxX / tileSize.width));
        const endTileY = Math.min(this.tailRows - 1, Math.floor(boundingBox.maxY / tileSize.height));
        const keys: string[] = [];
        for (let x = startTileX; x <= endTileX; x++) {
            for (let y = startTileY; y <= endTileY; y++) {
                keys.push(`${x},${y}`);
            }
        }
        return keys;
    }

    public addModelId(modelId: string | undefined, boundingBox: Range) {
        if (!modelId) return;
        const keys = this.getKeysByBoundingBox(boundingBox);
        keys.forEach((key) => {
            if (!this.tailMap.has(key)) {
                this.tailMap.set(key, new Set());
            }
            this.tailMap.get(key)?.add(modelId);
        })
    }

    public removeModelId(modelId: string | undefined, boundingBox: Range) {
        if (!modelId) return;
        const keys = this.getKeysByBoundingBox(boundingBox);
        keys.forEach((key) => {
            this.tailMap.get(key)?.delete(modelId);
            // 判断是否已经为空
            if (this.tailMap.get(key)?.size === 0) {
                // 如果为空，则从 map 中删除该键
                this.tailMap.delete(key);
            }
        })
    }

    public updateModelId(modelId: string | undefined, oldBoundingBox: Range, newBoundingBox: Range) {
        if (!modelId) return;
        this.removeModelId(modelId, oldBoundingBox);
        this.addModelId(modelId, newBoundingBox);
    }

    public getModelIdsInRange(boundingBox: Range) {
        const keys = this.getKeysByBoundingBox(boundingBox);
        const resultSet: Set<string> = new Set();
        keys.forEach((key) => {
            const ids = this.tailMap.get(key);
            if (ids) {
                ids.forEach((id) => {
                    resultSet.add(id)
                });
            }
        });
        return resultSet;
    }

    public clear() {
        this.tailMap.clear();
    }
}
export { TileManager };