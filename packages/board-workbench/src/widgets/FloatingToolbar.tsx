import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import './styles.css';
import { floatingToolbarRegistry } from './registry/ToolbarRegistry';
import { registerDefaultToolbarItems } from './registry/registerDefaultToolbarItems';

interface ToolbarPosition {
    x: number;
    y: number;
    show: boolean;
}

interface FloatingToolbarProps {
    selectedElements: any[];
    onUpdate?: (updates: any) => void;
    onDelete?: () => void;
    onDuplicate?: () => void;
    board?: any;
}

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
    selectedElements,
    onUpdate,
    onDelete,
    onDuplicate,
    board,
}) => {
    const toolbarRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<ToolbarPosition>({ x: 0, y: 0, show: false });
    const [isInteracting, setIsInteracting] = useState(false);
    const selectedElementsRef = useRef(selectedElements);
    selectedElementsRef.current = selectedElements;

    const [strokeColor, setStrokeColor] = useState('#000000');
    const [fillColor, setFillColor] = useState('#ffffff');
    const [strokeWidth, setStrokeWidth] = useState(2);
    const [opacity, setOpacity] = useState(1);
    const [fontSize, setFontSize] = useState(16);
    const [fontFamily, setFontFamily] = useState('Arial');
    const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('left');
    const [lineDash, setLineDash] = useState<number[]>([]);
    const [, setRegistryVersion] = useState(0);

    useEffect(() => {
        registerDefaultToolbarItems();
        return floatingToolbarRegistry.subscribe(() => {
            setRegistryVersion(prev => prev + 1);
        });
    }, []);

    const recalcPosition = useCallback((elements?: any[]) => {
        const els = elements ?? selectedElementsRef.current;
        if (!els || els.length === 0 || !toolbarRef.current) {
            setPosition({ x: 0, y: 0, show: false });
            return;
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const el of els) {
            const box = el.ctrlElement?.getBoundingBox?.();
            if (!box) continue;
            if (box.x < minX) minX = box.x;
            if (box.y < minY) minY = box.y;
            if (box.x + box.width > maxX) maxX = box.x + box.width;
            if (box.y + box.height > maxY) maxY = box.y + box.height;
        }
        if (!isFinite(minX)) {
            setPosition({ x: 0, y: 0, show: false });
            return;
        }

        const toolbarWidth = toolbarRef.current.offsetWidth;
        const toolbarHeight = toolbarRef.current.offsetHeight;
        const margin = 10;

        let x = (minX + maxX) / 2 - toolbarWidth / 2;
        let y = maxY + margin;

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (x < 10) x = 10;
        if (x + toolbarWidth > viewportWidth - 10) {
            x = viewportWidth - toolbarWidth - 10;
        }
        if (y + toolbarHeight > viewportHeight - 10) {
            y = minY - toolbarHeight - margin;
        }

        setPosition({ x, y, show: true });
    }, [board]);

    useEffect(() => {
        if (!board) return;
        const eventService = board.getService?.('eventService');
        const transformService = board.getService?.('transformService');
        if (!eventService) return;

        const disposers: (() => void)[] = [];

        const { dispose: downDispose } = eventService.onPointerDown(() => {
            setIsInteracting(true);
        });
        disposers.push(downDispose);

        const { dispose: upDispose } = eventService.onPointerUp(() => {
            setIsInteracting(false);
            requestAnimationFrame(() => recalcPosition());
        });
        disposers.push(upDispose);

        if (transformService?.onTransformChange) {
            const { dispose: transformDispose } = transformService.onTransformChange(() => {
                setIsInteracting(true);
            });
            disposers.push(transformDispose);
        }

        const selectionPlugin = board.getPlugin?.('SelectionPlugin');
        const movingDispose = selectionPlugin?.exports?.onElementsMoving?.((models: any[]) => {
            selectedElementsRef.current = models || [];
            requestAnimationFrame(() => recalcPosition(models || []));
        });
        if (movingDispose?.dispose) {
            disposers.push(movingDispose.dispose);
        }

        return () => disposers.forEach(d => d());
    }, [board, recalcPosition]);

    useEffect(() => {
        if (selectedElements.length === 0) {
            setPosition({ x: 0, y: 0, show: false });
            return;
        }
        requestAnimationFrame(() => recalcPosition());
    }, [selectedElements, recalcPosition]);

    useEffect(() => {
        if (selectedElements.length === 0) return;
        const opts = selectedElements[0].options || {};

        if (opts.strokeStyle) setStrokeColor(opts.strokeStyle);
        if (opts.fillStyle) setFillColor(opts.fillStyle);
        if (opts.lineWidth) setStrokeWidth(opts.lineWidth);
        if (opts.globalAlpha !== undefined) setOpacity(opts.globalAlpha);
        if (opts.fontSize) setFontSize(opts.fontSize);
        if (opts.fontFamily) setFontFamily(opts.fontFamily);
        if (opts.textAlign) setTextAlign(opts.textAlign);
        if (opts.lineDash) setLineDash(opts.lineDash);
    }, [selectedElements]);

    const handleUpdate = (updates: any) => {
        onUpdate?.(updates);
    };

    if (selectedElements.length === 0) return null;

    const visible = position.show && !isInteracting;
    const types = new Set(selectedElements.map((el: any) => el.type));
    const isSingleType = types.size === 1;
    const elementType = isSingleType ? selectedElements[0].type : null;
    const isShape = isSingleType && ['rectangle', 'line', 'arrow'].includes(elementType);
    const hasFill = isSingleType && elementType === 'rectangle';
    const isText = isSingleType && elementType === 'text';
    const isPicture = isSingleType && elementType === 'picture';

    const toolbarContext = useMemo(() => ({
        selectedElements,
        isSingleType,
        elementType,
        isShape,
        hasFill,
        isText,
        isPicture,
        strokeColor,
        fillColor,
        strokeWidth,
        opacity,
        fontSize,
        textAlign,
        lineDash,
        setStrokeColor,
        setFillColor,
        setStrokeWidth,
        setOpacity,
        setFontSize,
        setTextAlign,
        setLineDash,
        updateElement: handleUpdate,
        onDelete,
        onDuplicate,
    }), [
        selectedElements,
        isSingleType,
        elementType,
        isShape,
        hasFill,
        isText,
        isPicture,
        strokeColor,
        fillColor,
        strokeWidth,
        opacity,
        fontSize,
        textAlign,
        lineDash,
        onDelete,
        onDuplicate,
    ]);

    const visibleItems = floatingToolbarRegistry.getVisibleItems(toolbarContext);

    return (
        <div
            ref={toolbarRef}
            className={`floating-toolbar ${visible ? 'floating-toolbar-visible' : 'floating-toolbar-hidden'}`}
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
            }}
        >
            {visibleItems.map((item, index) => (
                <React.Fragment key={item.id}>
                    {item.render(toolbarContext)}
                    {index < visibleItems.length - 1 && <div className="toolbar-divider" />}
                </React.Fragment>
            ))}
        </div>
    );
};

export default FloatingToolbar;
