/**
 * 文本编辑器配置
 * 集中管理 textarea 和 canvas 文本渲染的所有样式参数
 * 
 * 注意：所有尺寸都是 CSS 像素，DPR（设备像素比）会自动处理：
 * - Textarea 使用 CSS 像素定义样式
 * - Canvas context 已经通过 ctx.scale(dpr, dpr) 进行缩放
 * - 因此两者天然对齐，不需要手动乘以 dpr
 */

const TEXT_EDITOR_CONFIG = {
    // 字体设置
    fontSize: 16,
    fontFamily: 'Arial, sans-serif',
    lineHeight: 24, // fontSize * 1.5

    // 间距设置
    padding: 4, // 减小 padding 以更好地对齐

    // 边框设置
    borderWidth: 1,
    borderColor: '#4a90e2',

    // 背景设置
    backgroundColor: 'rgba(77, 148, 72, 1)',

    // 文本颜色
    textColor: 'black',

    // 微调选项（如果仍有偏差，可以调整这些值）
    verticalOffset: 0,  // 垂直偏移，用于微调文本位置
    horizontalOffset: 0, // 水平偏移
} as const;

/**
 * 获取 textarea 样式字符串
 */
export function getTextareaStyles(width: number, height: number, x: number, y: number) {
    return {
        position: 'relative',
        top: `${y}px`,
        left: `${x}px`,
        width: `${width}px`,
        height: `${height}px`,
        background: TEXT_EDITOR_CONFIG.backgroundColor,
        border: `${TEXT_EDITOR_CONFIG.borderWidth}px solid ${TEXT_EDITOR_CONFIG.borderColor}`,
        outline: 'none',
        resize: 'none',
        padding: `${TEXT_EDITOR_CONFIG.padding}px`,
        fontSize: `${TEXT_EDITOR_CONFIG.fontSize}px`,
        fontFamily: TEXT_EDITOR_CONFIG.fontFamily,
        lineHeight: `${TEXT_EDITOR_CONFIG.lineHeight}px`,
        margin: '0',
        zIndex: '10000',
        boxSizing: 'border-box',
        // 启用自动换行，与浏览器默认行为一致
        whiteSpace: 'pre-wrap',      // 保留换行符，同时自动换行
        overflowWrap: 'break-word',  // 长单词在边界处换行
        wordBreak: 'normal',         // 正常的单词断行规则（CJK 字符间可断行）
        overflowY: 'auto',
    } as const;
}

/**
 * 获取 canvas 文本渲染的样式参数
 */
export function getCanvasTextConfig(zoom: number = 1) {
    return {
        fontSize: TEXT_EDITOR_CONFIG.fontSize * zoom,
        fontFamily: TEXT_EDITOR_CONFIG.fontFamily,
        paddingTop: (TEXT_EDITOR_CONFIG.padding + TEXT_EDITOR_CONFIG.verticalOffset) * zoom,
        paddingLeft: (TEXT_EDITOR_CONFIG.padding + TEXT_EDITOR_CONFIG.horizontalOffset) * zoom,
        lineHeight: TEXT_EDITOR_CONFIG.lineHeight * zoom,
        textColor: TEXT_EDITOR_CONFIG.textColor,
    };
}
