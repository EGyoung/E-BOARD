import React from 'react';
import { FloatingToolbarItem } from '../ToolbarRegistry';

const DASH_PATTERN_A = [5, 5];
const DASH_PATTERN_B = [2, 3];

function isSameDash(a: number[], b: number[]) {
    if (a.length !== b.length) return false;
    return a.every((value, index) => value === b[index]);
}

const strokeColorItem: FloatingToolbarItem = {
    id: 'stroke-color',
    order: 10,
    isVisible: context => !context.isPicture,
    render: (context) => (
        <div className="toolbar-section">
            <div className="toolbar-label">描边</div>
            <div className="color-picker-group">
                <input
                    type="color"
                    value={context.strokeColor}
                    onChange={(e) => {
                        context.setStrokeColor(e.target.value);
                        context.updateElement({ strokeStyle: e.target.value });
                    }}
                    className="color-input"
                    title="描边颜色"
                />
                <span className="color-hex">{context.strokeColor}</span>
            </div>
        </div>
    ),
};

const fillColorItem: FloatingToolbarItem = {
    id: 'fill-color',
    order: 20,
    isVisible: context => context.hasFill,
    render: (context) => (
        <div className="toolbar-section">
            <div className="toolbar-label">填充</div>
            <div className="color-picker-group">
                <input
                    type="color"
                    value={context.fillColor}
                    onChange={(e) => {
                        context.setFillColor(e.target.value);
                        context.updateElement({ fillStyle: e.target.value });
                    }}
                    className="color-input"
                    title="填充颜色"
                />
                <span className="color-hex">{context.fillColor}</span>
            </div>
        </div>
    ),
};

const strokeWidthItem: FloatingToolbarItem = {
    id: 'stroke-width',
    order: 30,
    isVisible: context => !context.isPicture,
    render: (context) => (
        <div className="toolbar-section">
            <div className="toolbar-label">粗细</div>
            <div className="button-group">
                {[1, 2, 4, 6, 8].map((width) => (
                    <button
                        key={width}
                        className={`icon-btn ${context.strokeWidth === width ? 'active' : ''}`}
                        onClick={() => {
                            context.setStrokeWidth(width);
                            context.updateElement({ lineWidth: width });
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
    ),
};

const lineStyleItem: FloatingToolbarItem = {
    id: 'line-style',
    order: 40,
    isVisible: context => context.isShape,
    render: (context) => (
        <div className="toolbar-section">
            <div className="toolbar-label">线型</div>
            <div className="button-group">
                <button
                    className={`icon-btn ${context.lineDash.length === 0 ? 'active' : ''}`}
                    onClick={() => {
                        context.setLineDash([]);
                        context.updateElement({ lineDash: [] });
                    }}
                    title="实线"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24">
                        <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="2" />
                    </svg>
                </button>
                <button
                    className={`icon-btn ${isSameDash(context.lineDash, DASH_PATTERN_A) ? 'active' : ''}`}
                    onClick={() => {
                        context.setLineDash(DASH_PATTERN_A);
                        context.updateElement({ lineDash: DASH_PATTERN_A });
                    }}
                    title="虚线"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24">
                        <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="2" strokeDasharray="5,5" />
                    </svg>
                </button>
                <button
                    className={`icon-btn ${isSameDash(context.lineDash, DASH_PATTERN_B) ? 'active' : ''}`}
                    onClick={() => {
                        context.setLineDash(DASH_PATTERN_B);
                        context.updateElement({ lineDash: DASH_PATTERN_B });
                    }}
                    title="点线"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24">
                        <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="2" strokeDasharray="2,3" />
                    </svg>
                </button>
            </div>
        </div>
    ),
};

const opacityItem: FloatingToolbarItem = {
    id: 'opacity',
    order: 50,
    isVisible: context => context.isShape || context.isPicture,
    render: (context) => (
        <div className="toolbar-section">
            <div className="toolbar-label">透明度</div>
            <div className="slider-group">
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={context.opacity * 100}
                    onChange={(e) => {
                        const value = Number(e.target.value) / 100;
                        context.setOpacity(value);
                        context.updateElement({ globalAlpha: value });
                    }}
                    className="slider"
                />
                <span className="value-display">{Math.round(context.opacity * 100)}%</span>
            </div>
        </div>
    ),
};

export const APPEARANCE_ITEMS: FloatingToolbarItem[] = [
    strokeColorItem,
    fillColorItem,
    strokeWidthItem,
    lineStyleItem,
    opacityItem,
];
