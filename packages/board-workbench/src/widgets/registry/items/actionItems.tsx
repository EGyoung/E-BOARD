import React from 'react';
import { FloatingToolbarItem } from '../ToolbarRegistry';

const actionsItem: FloatingToolbarItem = {
    id: 'actions',
    order: 999,
    render: (context) => (
        <div className="toolbar-section">
            <div className="button-group">
                <button
                    className="action-btn"
                    onClick={context.onDuplicate}
                    title="复制"
                >
                    <svg width="16" height="16" viewBox="0 0 16 16">
                        <rect x="2" y="2" width="8" height="8" stroke="currentColor" fill="none" strokeWidth="1.5" />
                        <rect x="6" y="6" width="8" height="8" stroke="currentColor" fill="none" strokeWidth="1.5" />
                    </svg>
                </button>
                <button
                    className="action-btn delete"
                    onClick={context.onDelete}
                    title="删除"
                >
                    <svg width="16" height="16" viewBox="0 0 16 16">
                        <path d="M3 4h10M5 4V3h6v1M6 7v5M10 7v5M4 4v9h8V4" stroke="currentColor" fill="none" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                </button>
            </div>
        </div>
    ),
};

export const ACTION_ITEMS: FloatingToolbarItem[] = [actionsItem];
