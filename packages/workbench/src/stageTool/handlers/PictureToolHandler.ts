import { IToolHandler } from '../types';

export class PictureToolHandler implements IToolHandler {
    activate(board: any): void {
        try {
            // 获取 PicturePlugin
            const picturePlugin = board.getPlugin('PicturePlugin');
            console.log(picturePlugin, board, '??????')
            if (!picturePlugin || !picturePlugin.exports?.insertImage) {
                console.warn('PicturePlugin not found or insertImage method not available');
                return;
            }

            // 创建文件输入元素
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';

            input.onchange = async (e: Event) => {
                const target = e.target as HTMLInputElement;
                const file = target.files?.[0];
                if (!file) return;

                // 读取图片文件
                const reader = new FileReader();
                reader.onload = async (event) => {
                    const imageData = event.target?.result as string;

                    try {
                        // 调用插件的 insertImage 方法
                        const modelId = await picturePlugin.exports.insertImage(imageData);
                        console.log('Image inserted with model ID:', modelId);
                    } catch (error) {
                        console.error('Failed to insert image:', error);
                    }
                };

                reader.readAsDataURL(file);
            };

            // 触发文件选择对话框
            input.click();
        } catch (error) {
            console.warn('Failed to insert picture:', error);
        }
    }

    deactivate(board: any): void {
        // Optional cleanup
    }
}
