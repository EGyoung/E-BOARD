import React, { useEffect, useState, useRef, useCallback } from 'react';
import './styles.css';

interface ToolbarPosition {
    x: number;
    y: number;
    show: boolean;
}

interface FloatingToolbarProps {
    selectedElement: any;
    onUpdate?: (updates: any) => void;
    onDelete?: () => void;
    onDuplicate?: () => void;
    board?: any;
}

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
    selectedElement,
    onUpdate,
    onDelete,
    onDuplicate,
    board,
}) => {
    const toolbarRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<ToolbarPosition>({ x: 0, y: 0, show: false });

    // 样式状态
    const [strokeColor, setStrokeColor] = useState('#000000');
    const [fillColor, setFillColor] = useState('#ffffff');
    const [strokeWidth, setStrokeWidth] = useState(2);
    const [opacity, setOpacity] = useState(1);
    const [fontSize, setFontSize] = useState(16);
    const [fontFamily, setFontFamily] = useState('Arial');
    const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('left');
    const [lineDash, setLineDash] = useState<number[]>([]);

    // 计算工具栏位置
    const calculatePosition = useCallback(() => {
        console.log('calculatePosition called, selectedElement:', selectedElement);

        if (!selectedElement || !toolbarRef.current) {
            console.log('No selectedElement or toolbarRef');
            setPosition({ x: 0, y: 0, show: false });
            return;
        }

        const bounds = selectedElement.bounds || selectedElement.getBounds?.();
        console.log('Element bounds:', bounds);

        if (!bounds) {
            console.log('No bounds found');
            setPosition({ x: 0, y: 0, show: false });
            return;
        }

        const toolbarWidth = toolbarRef.current.offsetWidth;
        const toolbarHeight = toolbarRef.current.offsetHeight;
        const margin = 10;

        // 计算 X 位置（元素中心）
        let x = bounds.x + bounds.width / 2 - toolbarWidth / 2;

        // 计算 Y 位置（元素下方）
        let y = bounds.y + bounds.height + margin;

        // 边界检查
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (x < 10) x = 10;
        if (x + toolbarWidth > viewportWidth - 10) {
            x = viewportWidth - toolbarWidth - 10;
        }

        // 如果下方空间不足，显示在上方
        if (y + toolbarHeight > viewportHeight - 10) {
            y = bounds.y - toolbarHeight - margin;
        }

        console.log('Setting position:', { x, y, show: true });
        setPosition({ x, y, show: true });
    }, [selectedElement]);

    useEffect(() => {
        calculatePosition();
        const interval = setInterval(calculatePosition, 100);
        return () => clearInterval(interval);
    }, [calculatePosition]);

    console.log('FloatingToolbar render, position:', position, 'selectedElement:', selectedElement);

    // 从选中元素读取样式
    useEffect(() => {
        if (!selectedElement) return;

        if (selectedElement.strokeStyle) setStrokeColor(selectedElement.strokeStyle);
        if (selectedElement.fillStyle) setFillColor(selectedElement.fillStyle);
        if (selectedElement.lineWidth) setStrokeWidth(selectedElement.lineWidth);
        if (selectedElement.opacity !== undefined) setOpacity(selectedElement.opacity);
        if (selectedElement.fontSize) setFontSize(selectedElement.fontSize);
        if (selectedElement.fontFamily) setFontFamily(selectedElement.fontFamily);
        if (selectedElement.textAlign) setTextAlign(selectedElement.textAlign);
        if (selectedElement.lineDash) setLineDash(selectedElement.lineDash);
    }, [selectedElement]);

    const handleUpdate = (updates: any) => {
        onUpdate?.(updates);
    };

    if (!position.show) return null;

    return (
        <div
            ref={toolbarRef}
            className="floating-toolbar"
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
            }}
        >
            {/* 描边颜色 */}
            <div className="toolbar-section">
                <div className="toolbar-label">描边</div>
                <div className="color-picker-group">
                    <input
                        type="color"
                        value={strokeColor}
                        onChange={(e) => {
                            setStrokeColor(e.target.value);
                            handleUpdate({ strokeStyle: e.target.value });
                        }}
                        className="color-input"
                        title="描边颜色"
                    />
                    <span className="color-hex">{strokeColor}</span>
                </div>
            </div>

            <div className="toolbar-divider" />

            {/* 填充颜色 */}
            <div className="toolbar-section">
                <div className="toolbar-label">填充</div>
                <div className="color-picker-group">
                    <input
                        type="color"
                        value={fillColor}
                        onChange={(e) => {
                            setFillColor(e.target.value);
                            handleUpdate({ fillStyle: e.target.value });
                        }}
                        className="color-input"
                        title="填充颜色"
                    />
                    <span className="color-hex">{fillColor}</span>
                </div>
            </div>

            <div className="toolbar-divider" />

            {/* 线条粗细 */}
            <div className="toolbar-section">
                <div className="toolbar-label">粗细</div>
                <div className="button-group">
                    {[1, 2, 4, 6, 8].map((width) => (
                        <button
                            key={width}
                            className={`icon-btn ${strokeWidth === width ? 'active' : ''}`}
                            onClick={() => {
                                setStrokeWidth(width);
                                handleUpdate({ lineWidth: width });
                            }}
                            title={`${width}px`}
                        >
                            <div
                                className="stroke-preview"
                                style={{
                                    width: `${Math.min(width * 3, 20)}px`,
                                    height: `${Math.min(width * 3, 20)}px`,
                                }}
                            />
                        </button>
                    ))}
                </div>
            </div>

            <div className="toolbar-divider" />

            {/* 虚线样式 */}
            <div className="toolbar-section">
                <div className="toolbar-label">线型</div>
                <div className="button-group">
                    <button
                        className={`icon-btn ${lineDash.length === 0 ? 'active' : ''}`}
                        onClick={() => {
                            setLineDash([]);
                            handleUpdate({ lineDash: [] });
                        }}
                        title="实线"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24">
                            <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="2" />
                        </svg>
                    </button>
                    <button
                        className={`icon-btn ${JSON.stringify(lineDash) === JSON.stringify([5, 5]) ? 'active' : ''}`}
                        onClick={() => {
                            setLineDash([5, 5]);
                            handleUpdate({ lineDash: [5, 5] });
                        }}
                        title="虚线"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24">
                            <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="2" strokeDasharray="5,5" />
                        </svg>
                    </button>
                    <button
                        className={`icon-btn ${JSON.stringify(lineDash) === JSON.stringify([2, 3]) ? 'active' : ''}`}
                        onClick={() => {
                            setLineDash([2, 3]);
                            handleUpdate({ lineDash: [2, 3] });
                        }}
                        title="点线"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24">
                            <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="2" strokeDasharray="2,3" />
                        </svg>
                    </button>
                </div>
            </div>

            <div className="toolbar-divider" />

            {/* 不透明度 */}
            <div className="toolbar-section">
                <div className="toolbar-label">透明度</div>
                <div className="slider-group">
                    <input
                        type="range"
                        min="0"
                        max="100"
                        value={opacity * 100}
                        onChange={(e) => {
                            const value = Number(e.target.value) / 100;
                            setOpacity(value);
                            handleUpdate({ opacity: value });
                        }}
                        className="slider"
                    />
                    <span className="value-display">{Math.round(opacity * 100)}%</span>
                </div>
            </div>

            <div className="toolbar-divider" />

            {/* 字体大小 */}
            <div className="toolbar-section">
                <div className="toolbar-label">字号</div>
                <div className="button-group">
                    {[12, 14, 16, 18, 20, 24].map((size) => (
                        <button
                            key={size}
                            className={`text-btn ${fontSize === size ? 'active' : ''}`}
                            onClick={() => {
                                setFontSize(size);
                                handleUpdate({ fontSize: size });
                            }}
                        >
                            {size}
                        </button>
                    ))}
                </div>
            </div>

            <div className="toolbar-divider" />

            {/* 文本对齐 */}
            <div className="toolbar-section">
                <div className="toolbar-label">对齐</div>
                <div className="button-group">
                    <button
                        className={`icon-btn ${textAlign === 'left' ? 'active' : ''}`}
                        onClick={() => {
                            setTextAlign('left');
                            handleUpdate({ textAlign: 'left' });
                        }}
                        title="左对齐"
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16">
                            <path d="M2 3h12M2 6h8M2 9h12M2 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                    </button>
                    <button
                        className={`icon-btn ${textAlign === 'center' ? 'active' : ''}`}
                        onClick={() => {
                            setTextAlign('center');
                            handleUpdate({ textAlign: 'center' });
                        }}
                        title="居中"
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16">
                            <path d="M2 3h12M4 6h8M2 9h12M4 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                    </button>
                    <button
                        className={`icon-btn ${textAlign === 'right' ? 'active' : ''}`}
                        onClick={() => {
                            setTextAlign('right');
                            handleUpdate({ textAlign: 'right' });
                        }}
                        title="右对齐"
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16">
                            <path d="M2 3h12M6 6h8M2 9h12M6 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                    </button>
                </div>
            </div>

            <div className="toolbar-divider" />

            {/* 操作按钮 */}
            <div className="toolbar-section">
                <div className="button-group">
                    <button
                        className="action-btn"
                        onClick={onDuplicate}
                        title="复制"
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16">
                            <rect x="2" y="2" width="8" height="8" stroke="currentColor" fill="none" strokeWidth="1.5" />
                            <rect x="6" y="6" width="8" height="8" stroke="currentColor" fill="none" strokeWidth="1.5" />
                        </svg>
                    </button>
                    <button
                        className="action-btn delete"
                        onClick={onDelete}
                        title="删除"
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16">
                            <path d="M3 4h10M5 4V3h6v1M6 7v5M10 7v5M4 4v9h8V4" stroke="currentColor" fill="none" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FloatingToolbar;
