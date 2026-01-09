/**
 * 文本布局调试辅助工具
 * 用于可视化和调试 textarea 与 canvas 文本渲染的对齐问题
 */

export interface DebugInfo {
    textarea: {
        fontSize: number;
        fontFamily: string;
        lineHeight: number;
        padding: { top: number; right: number; bottom: number; left: number };
        border: { top: number; right: number; bottom: number; left: number };
        clientWidth: number;
        clientHeight: number;
        offsetWidth: number;
        offsetHeight: number;
        boxSizing: string;
    };
    computed: {
        textAreaWidth: number;
        effectiveTextWidth: number;
    };
}

/**
 * 获取 textarea 的详细调试信息
 */
export function getTextareaDebugInfo(textarea: HTMLTextAreaElement): DebugInfo {
    const computedStyle = window.getComputedStyle(textarea);

    return {
        textarea: {
            fontSize: parseFloat(computedStyle.fontSize),
            fontFamily: computedStyle.fontFamily,
            lineHeight: parseFloat(computedStyle.lineHeight),
            padding: {
                top: parseFloat(computedStyle.paddingTop),
                right: parseFloat(computedStyle.paddingRight),
                bottom: parseFloat(computedStyle.paddingBottom),
                left: parseFloat(computedStyle.paddingLeft),
            },
            border: {
                top: parseFloat(computedStyle.borderTopWidth),
                right: parseFloat(computedStyle.borderRightWidth),
                bottom: parseFloat(computedStyle.borderBottomWidth),
                left: parseFloat(computedStyle.borderLeftWidth),
            },
            clientWidth: textarea.clientWidth,
            clientHeight: textarea.clientHeight,
            offsetWidth: textarea.offsetWidth,
            offsetHeight: textarea.offsetHeight,
            boxSizing: computedStyle.boxSizing,
        },
        computed: {
            textAreaWidth: textarea.offsetWidth,
            effectiveTextWidth: textarea.clientWidth -
                parseFloat(computedStyle.paddingLeft) -
                parseFloat(computedStyle.paddingRight),
        }
    };
}

/**
 * 在控制台打印格式化的调试信息
 */
export function logTextareaDebugInfo(textarea: HTMLTextAreaElement): void {
    const info = getTextareaDebugInfo(textarea);

    console.group('📐 Textarea Debug Info');
    console.log('Font:', `${info.textarea.fontSize}px ${info.textarea.fontFamily}`);
    console.log('Line Height:', `${info.textarea.lineHeight}px`);
    console.log('Padding:', info.textarea.padding);
    console.log('Border:', info.textarea.border);
    console.log('Client Size:', `${info.textarea.clientWidth}x${info.textarea.clientHeight}`);
    console.log('Offset Size:', `${info.textarea.offsetWidth}x${info.textarea.offsetHeight}`);
    console.log('Box Sizing:', info.textarea.boxSizing);
    console.log('Effective Text Width:', `${info.computed.effectiveTextWidth}px`);
    console.groupEnd();
}

/**
 * 在 canvas 上绘制调试网格，显示文本布局区域
 */
export function drawDebugGrid(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    padding: { top: number; left: number },
    lineHeight: number,
    lineCount: number,
    zoom: number = 1
): void {
    ctx.save();

    // 绘制外边框（矩形边界）
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width * zoom, height * zoom);

    // 绘制内边距区域（文本实际区域）
    ctx.strokeStyle = 'blue';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(
        x + padding.left * zoom,
        y + padding.top * zoom,
        (width - padding.left * 2) * zoom,
        (height - padding.top * 2) * zoom
    );

    // 绘制每行的基线
    ctx.strokeStyle = 'green';
    ctx.setLineDash([3, 3]);
    for (let i = 0; i < lineCount; i++) {
        const lineY = y + padding.top * zoom + (i * lineHeight * zoom);
        ctx.beginPath();
        ctx.moveTo(x, lineY);
        ctx.lineTo(x + width * zoom, lineY);
        ctx.stroke();
    }

    ctx.restore();

    // 添加图例
    console.log('🎨 Debug Grid Legend:');
    console.log('  🔴 Red: Rectangle boundary');
    console.log('  🔵 Blue: Text area (with padding)');
    console.log('  🟢 Green: Line baselines');
}
