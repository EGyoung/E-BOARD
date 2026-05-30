import React from 'react';
import { FloatingToolbarItem } from '../ToolbarRegistry';

const fontSizeItem: FloatingToolbarItem = {
    id: 'font-size',
    order: 60,
    isVisible: context => context.isText,
    render: (context) => (
        <div className="toolbar-section">
            <div className="toolbar-label">字号</div>
            <div className="button-group">
                {[12, 14, 16, 18, 20, 24].map((size) => (
                    <button
                        key={size}
                        className={`text-btn ${context.fontSize === size ? 'active' : ''}`}
                        onClick={() => {
                            context.setFontSize(size);
                            context.updateElement({ fontSize: size });
                        }}
                    >
                        {size}
                    </button>
                ))}
            </div>
        </div>
    ),
};

const textAlignItem: FloatingToolbarItem = {
    id: 'text-align',
    order: 70,
    isVisible: context => context.isText,
    render: (context) => (
        <div className="toolbar-section">
            <div className="toolbar-label">对齐</div>
            <div className="button-group">
                <button
                    className={`icon-btn ${context.textAlign === 'left' ? 'active' : ''}`}
                    onClick={() => {
                        context.setTextAlign('left');
                        context.updateElement({ textAlign: 'left' });
                    }}
                    title="左对齐"
                >
                    <svg width="16" height="16" viewBox="0 0 16 16">
                        <path d="M2 3h12M2 6h8M2 9h12M2 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                </button>
                <button
                    className={`icon-btn ${context.textAlign === 'center' ? 'active' : ''}`}
                    onClick={() => {
                        context.setTextAlign('center');
                        context.updateElement({ textAlign: 'center' });
                    }}
                    title="居中"
                >
                    <svg width="16" height="16" viewBox="0 0 16 16">
                        <path d="M2 3h12M4 6h8M2 9h12M4 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                </button>
                <button
                    className={`icon-btn ${context.textAlign === 'right' ? 'active' : ''}`}
                    onClick={() => {
                        context.setTextAlign('right');
                        context.updateElement({ textAlign: 'right' });
                    }}
                    title="右对齐"
                >
                    <svg width="16" height="16" viewBox="0 0 16 16">
                        <path d="M2 3h12M6 6h8M2 9h12M6 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                </button>
            </div>
        </div>
    ),
};

export const TEXT_ITEMS: FloatingToolbarItem[] = [fontSizeItem, textAlignItem];
