import React, { useEffect, useState, useRef, useCallback } from 'react';
import './styles.css';

interface SelectionOverlayProps {
    selectedElements: any[];
    board: any;
    isDragging: boolean;
}

interface BoxRect {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

const HANDLE_SIZE = 6;
const HANDLE_POSITIONS = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'] as const;

function getHandleStyle(pos: string, box: { x: number; y: number; width: number; height: number }) {
    const half = HANDLE_SIZE / 2;
    let left = 0, top = 0;

    if (pos.includes('w')) left = box.x - half;
    else if (pos.includes('e')) left = box.x + box.width - half;
    else left = box.x + box.width / 2 - half;

    if (pos.includes('n')) top = box.y - half;
    else if (pos.includes('s')) top = box.y + box.height - half;
    else top = box.y + box.height / 2 - half;

    return { left, top };
}

export const SelectionOverlay: React.FC<SelectionOverlayProps> = ({
    selectedElements,
    board,
    isDragging,
}) => {
    const [boxes, setBoxes] = useState<BoxRect[]>([]);
    const [aabb, setAabb] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
    const selectedElementsRef = useRef(selectedElements);
    selectedElementsRef.current = selectedElements;

    const recalc = useCallback((elements?: any[]) => {
        const els = elements ?? selectedElementsRef.current;
        if (!els || els.length === 0) {
            setBoxes([]);
            setAabb(null);
            return;
        }

        const newBoxes: BoxRect[] = [];
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        for (const el of els) {
            const box = el.ctrlElement?.getBoundingBox?.();
            if (!box) continue;
            newBoxes.push({ id: el.id, x: box.x, y: box.y, width: box.width, height: box.height });
            if (box.x < minX) minX = box.x;
            if (box.y < minY) minY = box.y;
            if (box.x + box.width > maxX) maxX = box.x + box.width;
            if (box.y + box.height > maxY) maxY = box.y + box.height;
        }

        setBoxes(newBoxes);
        if (isFinite(minX)) {
            setAabb({ x: minX, y: minY, width: maxX - minX, height: maxY - minY });
        } else {
            setAabb(null);
        }
    }, []);

    useEffect(() => {
        if (!board) return;
        const eventService = board.getService?.('eventService');
        const transformService = board.getService?.('transformService');
        const modelService = board.getService?.('modelService');
        if (!eventService) return;

        const disposers: (() => void)[] = [];

        const { dispose: upDispose } = eventService.onPointerUp(() => {
            requestAnimationFrame(() => recalc());
        });
        disposers.push(upDispose);

        if (transformService?.onTransformChange) {
            const { dispose: transformDispose } = transformService.onTransformChange(() => {
                recalc();
            });
            disposers.push(transformDispose);
        }

        // model 变更时（如添加子节点、折叠等），刷新选中框
        if (modelService?.onModelOperation) {
            const { dispose: modelDispose } = modelService.onModelOperation((event: any) => {
                const selectedIds = selectedElementsRef.current?.map((el: any) => el.id) ?? [];
                if (selectedIds.includes(event.modelId)) {
                    requestAnimationFrame(() => recalc());
                }
            });
            disposers.push(modelDispose);
        }

        const selectionPlugin = board.getPlugin?.('SelectionPlugin');
        const movingDispose = selectionPlugin?.exports?.onElementsMoving?.((models: any[]) => {
            selectedElementsRef.current = models || [];
            requestAnimationFrame(() => recalc(models || []));
        });
        if (movingDispose?.dispose) {
            disposers.push(movingDispose.dispose);
        }

        return () => disposers.forEach(d => d());
    }, [board, recalc]);

    useEffect(() => {
        recalc();
    }, [selectedElements, recalc]);

    if (selectedElements.length === 0 || isDragging || !aabb) return null;

    const isMultiSelect = selectedElements.length > 1;

    return (
        <div className="selection-overlay">
            {isMultiSelect && (
                <div
                    className="selection-box selection-box-group"
                    style={{
                        left: aabb.x,
                        top: aabb.y,
                        width: aabb.width,
                        height: aabb.height,
                    }}
                />
            )}
            {boxes.map((box) => (
                <div
                    key={box.id}
                    className={
                        'selection-box' + (isMultiSelect ? ' selection-box-dashed' : '')
                    }
                    style={{
                        left: box.x,
                        top: box.y,
                        width: box.width,
                        height: box.height,
                    }}
                />
            ))}
            {HANDLE_POSITIONS.map((pos) => {
                const style = getHandleStyle(pos, aabb);
                return (
                    <div
                        key={pos}
                        className="selection-handle"
                        style={{
                            left: style.left,
                            top: style.top,
                            width: HANDLE_SIZE,
                            height: HANDLE_SIZE,
                        }}
                    />
                );
            })}
        </div>
    );
};

export default SelectionOverlay;
