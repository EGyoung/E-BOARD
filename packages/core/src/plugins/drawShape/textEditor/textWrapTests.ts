/**
 * 文本换行测试用例
 * 用于验证中英文混合文本的换行处理
 */

export const TEXT_WRAP_TEST_CASES = [
    {
        name: '纯中文',
        input: '这是一段很长的中文文本，用来测试自动换行功能是否正常工作。',
        expected: '应该按字符宽度自动换行'
    },
    {
        name: '纯英文',
        input: 'This is a very long English text to test the automatic word wrapping functionality.',
        expected: '应该尽量在空格处换行，不打断单词'
    },
    {
        name: '中英文混合',
        input: '这是中文 this is English 混合的文本 mixed text 测试。',
        expected: '中文可以任意断开，英文尽量在空格处断开'
    },
    {
        name: '中文包含标点',
        input: '这是一段包含标点符号的文本，比如：逗号、句号。还有问号？',
        expected: '标点符号应该正确处理'
    },
    {
        name: '英文包含标点',
        input: 'This text includes punctuation marks, such as: commas, periods. And questions?',
        expected: '标点符号应该正确处理'
    },
    {
        name: '数字和符号',
        input: '测试数字123和符号@#$，还有English456和more!@#',
        expected: '数字和符号应该正确处理'
    },
    {
        name: 'Emoji表情',
        input: '这是文本😀包含Emoji🎉的测试👍',
        expected: 'Emoji应该正确计算宽度'
    },
    {
        name: '多行文本',
        input: '第一行文本\n第二行文本\n第三行包含English',
        expected: '换行符应该被保留'
    }
];

/**
 * 辅助函数：测试文本换行
 */
export function testTextWrapping(
    text: string,
    maxWidth: number,
    fontSize: number = 16,
    fontFamily: string = 'Arial'
): string[] {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return [text];

    ctx.font = `${fontSize}px ${fontFamily}`;
    const lines = text.split('\n');
    const wrappedLines: string[] = [];

    lines.forEach(line => {
        if (line === '') {
            wrappedLines.push('');
            return;
        }

        let currentLine = '';
        let i = 0;

        while (i < line.length) {
            const char = line[i];
            const testLine = currentLine + char;
            const metrics = ctx.measureText(testLine);

            if (metrics.width > maxWidth && currentLine !== '') {
                const lastSpaceIndex = currentLine.lastIndexOf(' ');
                if (lastSpaceIndex > 0 && lastSpaceIndex > currentLine.length * 0.5) {
                    wrappedLines.push(currentLine.substring(0, lastSpaceIndex));
                    currentLine = currentLine.substring(lastSpaceIndex + 1) + char;
                } else {
                    wrappedLines.push(currentLine);
                    currentLine = char;
                }
            } else {
                currentLine = testLine;
            }

            i++;
        }

        if (currentLine) {
            wrappedLines.push(currentLine);
        }
    });

    return wrappedLines;
}

/**
 * 运行所有测试用例
 */
export function runTextWrapTests(maxWidth: number = 200): void {
    console.group('📝 文本换行测试');

    TEXT_WRAP_TEST_CASES.forEach((testCase, index) => {
        console.group(`测试 ${index + 1}: ${testCase.name}`);
        console.log('输入:', testCase.input);
        console.log('预期:', testCase.expected);

        const result = testTextWrapping(testCase.input, maxWidth);
        console.log('结果:', result);
        console.log('行数:', result.length);

        // 验证每行宽度
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.font = '16px Arial';
            result.forEach((line, lineIndex) => {
                const width = ctx.measureText(line).width;
                const isValid = width <= maxWidth || lineIndex === result.length - 1;
                console.log(`  行 ${lineIndex + 1}: "${line}" (宽度: ${width.toFixed(2)}px) ${isValid ? '✓' : '✗ 超出限制'}`);
            });
        }

        console.groupEnd();
    });

    console.groupEnd();
}
