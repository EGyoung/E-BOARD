import React from 'react';
import ToolButton from './ToolButton';
import { ToolConfig } from '../types';

interface ToolGroupProps {
    title: string;
    tools: ToolConfig[];
    activeTool: string | null;
    onToolClick: (id: string) => void;
}

const ToolGroup: React.FC<ToolGroupProps> = ({ title, tools, activeTool, onToolClick }) => {
    if (tools.length === 0) return null;

    return (
        <div className="tool-group">
            <div className="tool-group-title">{title}</div>
            <div className="tool-group-buttons">
                {tools.map((tool) => (
                    <ToolButton
                        key={tool.id}
                        id={tool.id}
                        name={tool.name}
                        icon={tool.icon}
                        isActive={activeTool === tool.id}
                        onClick={onToolClick}
                    />
                ))}
            </div>
        </div>
    );
};

export default ToolGroup;
