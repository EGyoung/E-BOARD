import { IToolHandler, ToolBoard } from '../types';

export class TableToolHandler implements IToolHandler {
    activate(board: ToolBoard): void {
        try {
            // TODO: Implement table drawing mode
            // This would require a table plugin in the core
            console.log('Table mode activated');

            // Example implementation when table plugin is available:
            // const pluginService = board.getService(IPluginService);
            // if (pluginService) {
            //     pluginService.setActivePlugin('table');
            // }
        } catch (error) {
            console.warn('Failed to activate table mode:', error);
        }
    }

    deactivate(board: ToolBoard): void {
        try {
            console.log('Table mode deactivated');
            // Cleanup table mode
        } catch (error) {
            console.warn('Failed to deactivate table mode:', error);
        }
    }
}
