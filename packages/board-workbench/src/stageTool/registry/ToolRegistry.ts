import { ToolConfig, IToolHandler } from '../types';

class ToolRegistry {
    private tools: Map<string, { config: ToolConfig; handler: IToolHandler }> = new Map();
    private currentTool: string | null = null;
    private board: any = null;

    setBoard(board: any) {
        this.board = board;
    }

    register(config: ToolConfig, handler: IToolHandler) {
        this.tools.set(config.id, { config, handler });
    }

    unregister(id: string) {
        this.tools.delete(id);
    }

    getTool(id: string) {
        return this.tools.get(id);
    }

    getAllTools() {
        return Array.from(this.tools.values()).map(t => t.config);
    }

    getToolsByMode(mode: string) {
        return Array.from(this.tools.values())
            .filter(t => t.config.mode === mode)
            .map(t => t.config);
    }

    activateTool(id: string) {
        if (!this.board) {
            console.warn('Board instance not set');
            return;
        }

        const newToolData = this.tools.get(id);

        if (newToolData && !newToolData?.config.mode) {
            newToolData.handler.activate(this.board);
            return
        }

        if (this.currentTool === id) {
            return;
        }

        // Deactivate current tool
        if (this.currentTool) {
            const currentToolData = this.tools.get(this.currentTool);
            if (currentToolData?.handler.deactivate) {
                currentToolData.handler.deactivate(this.board);
            }
        }

        // Activate new tool
        if (newToolData) {
            newToolData.handler.activate(this.board);
            this.currentTool = id;
        }
    }

    getCurrentTool() {
        return this.currentTool;
    }
}

export const toolRegistry = new ToolRegistry();
