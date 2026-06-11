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
            toolRegistry.activateTool('draw');
            setActiveTool('draw');
        }
    }, [board]);

    // 监听 mode service 的模式变化，同步更新底部工具栏的选中态
    useEffect(() => {
        if (!board) return;

        const modeService = board.getService('modeService');
        if (!modeService?.onModeChange) return;

        const { dispose } = modeService.onModeChange((event: any) => {
            const currentMode = event.currentMode;
            if (!currentMode) {
                setActiveTool(null);
                return;
            }
            // 通过 mode 查找对应的 tool id
            const tools = toolRegistry.getToolsByMode(currentMode);
            if (tools.length > 0) {
                setActiveTool(tools[0].id);
            }
        });

        return dispose;
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
    const eraserTools = allTools.filter(t => t.mode === ToolMode.ERASER);
    const selectTools = allTools.filter(t => t.mode === ToolMode.SELECT);
    const shapeTools = allTools.filter(t => t.mode === ToolMode.SHAPE || t.mode === ToolMode.ARROW || t.mode === ToolMode.LINE || t.mode === ToolMode.CIRCLE);
    const specialTools = allTools.filter(t =>
        t.mode === ToolMode.LASER_POINTER ||
        t.mode === ToolMode.MIND_MAP ||
        t.mode === ToolMode.TABLE
    );
    const actionTools = allTools.filter(t => !t.mode);

    return (
        <div className={`stage-tool-container ${isCollapsed ? 'collapsed' : ''}`}>
            {isCollapsed ? (
                <button
                    className="stage-tool-expand"
                    onClick={() => setIsCollapsed(false)}
                    title="展开工具栏"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="7" height="7"></rect>
                        <rect x="14" y="3" width="7" height="7"></rect>
                        <rect x="3" y="14" width="7" height="7"></rect>
                        <rect x="14" y="14" width="7" height="7"></rect>
                    </svg>
                </button>
            ) : (
                <div className="stage-tool-content">
                    {(drawTools.length > 0 || eraserTools.length > 0 || selectTools.length > 0) && (
                        <ToolGroup
                            title=""
                            tools={[...drawTools, ...eraserTools, ...selectTools]}
                            activeTool={activeTool}
                            onToolClick={handleToolClick}
                        />
                    )}
                    {shapeTools.length > 0 && (
                        <ToolGroup
                            title=""
                            tools={shapeTools}
                            activeTool={activeTool}
                            onToolClick={handleToolClick}
                        />
                    )}
                    {specialTools.length > 0 && (
                        <ToolGroup
                            title=""
                            tools={specialTools}
                            activeTool={activeTool}
                            onToolClick={handleToolClick}
                        />
                    )}
                    {actionTools.length > 0 && (
                        <ToolGroup
                            title=""
                            tools={actionTools}
                            activeTool={activeTool}
                            onToolClick={handleToolClick}
                        />
                    )}
                    <button
                        className="stage-tool-collapse"
                        onClick={() => setIsCollapsed(true)}
                        title="收起工具栏"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="4 14 10 14 10 20"></polyline>
                            <polyline points="20 10 14 10 14 4"></polyline>
                            <line x1="14" y1="10" x2="21" y2="3"></line>
                            <line x1="3" y1="21" x2="10" y2="14"></line>
                        </svg>
                    </button>
                </div>
            )}
        </div>
    );
};

export default StageTool;
