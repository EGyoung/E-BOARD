import React, { useState, useEffect } from 'react';
import { toolRegistry } from './registry/ToolRegistry';
import { registerDefaultTools } from './registry/registerDefaultTools';
import { ToolGroup } from './components';
import { ToolMode } from './types';
import './styles.css';

interface StageToolProps {
    board?: any;
}

const StageTool: React.FC<StageToolProps> = (props: any) => {
    const board = props.board.current;
    const [activeTool, setActiveTool] = useState<string | null>(null);
    const [allTools, setAllTools] = useState(toolRegistry.getAllTools());
    const [isCollapsed, setIsCollapsed] = useState(false);
    useEffect(() => {
        // Register default tools on mount
        registerDefaultTools();
        setAllTools(toolRegistry.getAllTools());

        // Set board instance
        if (board) {
            toolRegistry.setBoard(board);
        }
    }, [board]);

    const handleToolClick = (id: string) => {
        toolRegistry.activateTool(id);

        // For action tools (clear, save), don't keep them active
        const tool = toolRegistry.getTool(id);
        if (tool && !tool.config.mode) {
            setActiveTool(null);
        } else {
            setActiveTool(id);
        }
    };

    const drawTools = allTools.filter(t => t.mode === ToolMode.DRAW);
    const selectTools = allTools.filter(t => t.mode === ToolMode.SELECT);
    const shapeTools = allTools.filter(t => t.mode === ToolMode.SHAPE);
    const specialTools = allTools.filter(t =>
        t.mode === ToolMode.LASER_POINTER ||
        t.mode === ToolMode.MIND_MAP ||
        t.mode === ToolMode.TABLE
    );
    const actionTools = allTools.filter(t => !t.mode);

    return (
        <div className={`stage-tool-container ${isCollapsed ? 'collapsed' : ''}`}>
            <button
                className="stage-tool-toggle"
                onClick={() => setIsCollapsed(!isCollapsed)}
                title={isCollapsed ? '展开工具栏' : '收起工具栏'}
            >
                {isCollapsed ? '▲' : '▼'}
            </button>

            <div className="stage-tool-content">
                {(drawTools.length > 0 || selectTools.length > 0) && (
                    <ToolGroup
                        title="工具"
                        tools={[...drawTools, ...selectTools]}
                        activeTool={activeTool}
                        onToolClick={handleToolClick}
                    />
                )}
                {shapeTools.length > 0 && (
                    <ToolGroup
                        title="形状"
                        tools={shapeTools}
                        activeTool={activeTool}
                        onToolClick={handleToolClick}
                    />
                )}
                {specialTools.length > 0 && (
                    <ToolGroup
                        title="特殊工具"
                        tools={specialTools}
                        activeTool={activeTool}
                        onToolClick={handleToolClick}
                    />
                )}
                {actionTools.length > 0 && (
                    <ToolGroup
                        title="操作"
                        tools={actionTools}
                        activeTool={activeTool}
                        onToolClick={handleToolClick}
                    />
                )}
            </div>
        </div>
    );
};

export default StageTool;
