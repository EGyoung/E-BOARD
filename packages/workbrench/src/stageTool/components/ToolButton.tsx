import React from 'react';

interface ToolButtonProps {
    id: string;
    name: string;
    icon?: string;
    isActive?: boolean;
    onClick: (id: string) => void;
}

// SVG 图标映射
const iconMap: Record<string, JSX.Element> = {
    'draw': (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
            <path d="M2 2l7.586 7.586"></path>
            <circle cx="11" cy="11" r="2"></circle>
        </svg>
    ),
    'select': (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"></path>
            <path d="M13 13l6 6"></path>
        </svg>
    ),
    'rectangle': (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        </svg>
    ),
    'circle': (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
        </svg>
    ),
    'line': (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="20" x2="20" y2="4"></line>
        </svg>
    ),
    'triangle': (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
        </svg>
    ),
    'clear': (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
    ),
    'save': (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
            <polyline points="17 21 17 13 7 13 7 21"></polyline>
            <polyline points="7 3 7 8 15 8"></polyline>
        </svg>
    ),
    'undo': (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7v6h6"></path>
            <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path>
        </svg>
    ),
    'redo': (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 7v6h-6"></path>
            <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"></path>
        </svg>
    ),
    'laser-pointer': (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <line x1="12" y1="1" x2="12" y2="6"></line>
            <line x1="12" y1="18" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="7.86" y2="7.86"></line>
            <line x1="16.14" y1="16.14" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="6" y2="12"></line>
            <line x1="18" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="7.86" y2="16.14"></line>
            <line x1="16.14" y1="7.86" x2="19.78" y2="4.22"></line>
        </svg>
    ),
    'mind-map': (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <circle cx="6" cy="6" r="2"></circle>
            <circle cx="18" cy="6" r="2"></circle>
            <circle cx="6" cy="18" r="2"></circle>
            <circle cx="18" cy="18" r="2"></circle>
            <line x1="10.5" y1="10.5" x2="7.5" y2="7.5"></line>
            <line x1="13.5" y1="10.5" x2="16.5" y2="7.5"></line>
            <line x1="10.5" y1="13.5" x2="7.5" y2="16.5"></line>
            <line x1="13.5" y1="13.5" x2="16.5" y2="16.5"></line>
        </svg>
    ),
    'table': (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="3" y1="9" x2="21" y2="9"></line>
            <line x1="3" y1="15" x2="21" y2="15"></line>
            <line x1="9" y1="3" x2="9" y2="21"></line>
            <line x1="15" y1="3" x2="15" y2="21"></line>
        </svg>
    ),
};

const ToolButton: React.FC<ToolButtonProps> = ({ id, name, icon, isActive, onClick }) => {
    // 从 id 中提取图标类型（例如 'shape-rectangle' -> 'rectangle'）
    const iconType = id.startsWith('shape-') ? id.replace('shape-', '') : id;
    const svgIcon = iconMap[iconType];

    return (
        <button
            className={`tool-button ${isActive ? 'active' : ''}`}
            onClick={() => onClick(id)}
            title={name}
        >
            <span className="tool-icon">
                {svgIcon || icon || '●'}
            </span>
            <span className="tool-name">{name}</span>
        </button>
    );
};

export default ToolButton;
