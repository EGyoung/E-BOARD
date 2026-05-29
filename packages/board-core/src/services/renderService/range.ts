import { BoundingBox } from '../modelService/type';
import { Range } from './type';

export const expandDirtyRange = (box: Range, padding: number): Range => {
    return {
        minX: box.minX - padding,
        minY: box.minY - padding,
        maxX: box.maxX + padding,
        maxY: box.maxY + padding,
    };
};

export const mergeRanges = (current: Range | null, next: Range | null): Range | null => {
    if (!next) return current;
    if (!current) {
        return { ...next };
    }

    return {
        minX: Math.min(current.minX, next.minX),
        minY: Math.min(current.minY, next.minY),
        maxX: Math.max(current.maxX, next.maxX),
        maxY: Math.max(current.maxY, next.maxY),
    };
};

export const normalizeBoundingBox = (box: any): BoundingBox => {
    if (box.minX !== undefined && box.maxX !== undefined) {
        return box;
    }

    const minX = box.x;
    const minY = box.y;
    const maxX = box.x + box.width;
    const maxY = box.y + box.height;

    return {
        ...box,
        minX,
        minY,
        maxX,
        maxY,
    };
};

export const isIntersect = (rangeA: Range, rangeB: Range): boolean => {
    return !(
        rangeA.maxX <= rangeB.minX ||
        rangeA.minX >= rangeB.maxX ||
        rangeA.maxY <= rangeB.minY ||
        rangeA.minY >= rangeB.maxY
    );
};