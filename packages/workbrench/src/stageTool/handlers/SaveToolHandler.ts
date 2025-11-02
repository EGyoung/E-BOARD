import { IToolHandler } from '../types';

export class SaveToolHandler implements IToolHandler {
    activate(board: any): void {
        try {
            const canvas = board.canvas;
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

    deactivate(board: any): void {
        // No deactivation needed for save action
    }
}
