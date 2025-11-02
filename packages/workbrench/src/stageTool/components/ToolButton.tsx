import React from 'react';

interface ToolButtonProps {
    id: string;
    name: string;
    icon?: string;
    isActive?: boolean;
    onClick: (id: string) => void;
}

const ToolButton: React.FC<ToolButtonProps> = ({ id, name, icon, isActive, onClick }) => {
    return (
        <button
            className={`tool-button ${isActive ? 'active' : ''}`}
            onClick={() => onClick(id)}
            title={name}
        >
            {icon && <span className="tool-icon">{icon}</span>}
            <span className="tool-name">{name}</span>
        </button>
    );
};

export default ToolButton;
