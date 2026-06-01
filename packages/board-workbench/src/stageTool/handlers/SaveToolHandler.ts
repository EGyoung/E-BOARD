import { IToolHandler, ToolBoard } from '../types';

export class SaveToolHandler implements IToolHandler {
    activate(board: ToolBoard): void {
        try {
            const canvas = board.getCanvas();
            if (!canvas) {
                console.warn('Canvas not found');
                return;
            }

            // Convert canvas to image and download
            canvas.toBlob((blob: Blob | null) => {
                if (!blob) return;

                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                const timestamp = new Date().getTime();
                link.download = `canvas-${timestamp}.png`;
                link.href = url;
                link.click();
                URL.revokeObjectURL(url);
            });
        } catch (error) {
            console.warn('Failed to save canvas:', error);
        }
    }
}
