import type EBoard from '../../../board/index';
import type SelectionPlugin from '../../selection';
import { logTextareaDebugInfo } from './debugHelper';
import { getTextareaStyles } from './config';
import type RoamPlugin from '../../roam';
import { IModeService } from '../../../../../core/src/services';
import { eBoardContainer } from '../../../../../core/src/common/IocContainer';

export interface TextLayoutInfo {
    lines: string[];
    lineHeight: number;
    fontSize: number;
    fontFamily: string;
    textAlign: string;
    paddingTop: number;
    paddingLeft: number;
    dpr: number;  // 设备像素比
}

class TextEditor {
    private disposeLists: (() => void)[] = []
    private removeTextareaFns: (() => void)[] = []
    private debugMode: boolean = false;  // 调试模式开关

    constructor(private board: EBoard, options?: { debug?: boolean }) {
        this.board = board
        this.debugMode = options?.debug || false;
    }

    /**
     * 获取textarea的文本布局信息
     * @param textarea - HTML textarea元素
     * @returns 文本布局信息，包括行、字体、对齐等
     */
    public getTextLayoutInfo(textarea: HTMLTextAreaElement): TextLayoutInfo {
        // 获取设备像素比
        const dpr = window.devicePixelRatio || 1;

        // 获取计算后的样式
        const computedStyle = window.getComputedStyle(textarea);
        const fontSize = parseFloat(computedStyle.fontSize) || 16;
        const fontFamily = computedStyle.fontFamily || 'Arial';

        // 正确处理 lineHeight：如果是相对值（如 '1.5'），需要转换为绝对像素值
        let lineHeight: number;
        const lineHeightValue = computedStyle.lineHeight;
        if (lineHeightValue === 'normal') {
            lineHeight = fontSize * 1.2;
        } else if (lineHeightValue.endsWith('px')) {
            lineHeight = parseFloat(lineHeightValue);
        } else {
            // 如果是相对值（如 '1.5'），乘以 fontSize
            const ratio = parseFloat(lineHeightValue);
            lineHeight = isNaN(ratio) ? fontSize * 1.2 : fontSize * ratio;
        }

        const textAlign = computedStyle.textAlign || 'left';
        const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
        const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
        const paddingRight = parseFloat(computedStyle.paddingRight) || 0;

        // 获取文本内容并按换行符分割
        const text = textarea.value;
        const manualLines = text.split('\n');

        // 处理自动换行（模拟 overflow-wrap: break-word 行为）
        const textareaWidth = textarea.clientWidth - paddingLeft - paddingRight;
        const wrappedLines: string[] = [];

        // 创建临时 canvas 来测量文本宽度
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            // 降级方案：无法测量，只使用手动换行
            return {
                lines: manualLines,
                lineHeight,
                fontSize,
                fontFamily,
                textAlign,
                paddingTop,
                paddingLeft,
                dpr
            };
        }

        ctx.font = `${fontSize}px ${fontFamily}`;

        // 对每一个手动换行的行进行处理
        manualLines.forEach(line => {
            if (line === '') {
                wrappedLines.push('');
                return;
            }

            // 改进的换行算法：
            // 逐字符累加，遇到溢出时回溯寻找断点
            let currentLine = '';

            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                const testLine = currentLine + char;
                const metrics = ctx.measureText(testLine);

                if (metrics.width > textareaWidth) {
                    // 发生溢出！

                    // 如果当前行为空（说明单字符宽度就超出了，极少见），强制放入
                    if (currentLine === '') {
                        wrappedLines.push(char);
                        continue;
                    }

                    // 回溯寻找最佳换行点
                    let breakIndex = -1;

                    // 从当前行末尾向前扫描
                    for (let k = currentLine.length - 1; k >= 0; k--) {
                        const checkChar = currentLine[k];
                        const isSpace = /\s/.test(checkChar);
                        const isCJK = /[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff]/.test(checkChar);
                        const isPunctuation = /[.,;:!?，。；：！？、]/.test(checkChar);

                        // 在空格、CJK字符、标点符号 *后面* 可以换行
                        if (isSpace || isCJK || isPunctuation) {
                            breakIndex = k + 1;
                            break;
                        }
                    }

                    if (breakIndex !== -1) {
                        // 找到软换行点（例如空格后）
                        const lineToKeep = currentLine.substring(0, breakIndex);
                        const lineToMove = currentLine.substring(breakIndex);

                        // 如果分割后前面的部分为空（例如行首就是空格且太长？不常见），避免死循环
                        if (lineToKeep === '') {
                            wrappedLines.push(currentLine);
                            currentLine = char;
                        } else {
                            wrappedLines.push(lineToKeep);
                            currentLine = lineToMove + char;
                        }
                    } else {
                        // 没有找到软换行点（长英文单词），强制硬换行
                        wrappedLines.push(currentLine);
                        currentLine = char;
                    }
                } else {
                    currentLine = testLine;
                }
            }

            if (currentLine) {
                wrappedLines.push(currentLine);
            }
        })

        return {
            lines: wrappedLines,
            lineHeight,
            fontSize,
            fontFamily,
            textAlign,
            paddingTop,
            paddingLeft,
            dpr
        };
    }
    public disposeWrapper = ({ dispose }: { dispose: () => void }) => {
        this.disposeLists.push(dispose)
    }



    public init = () => {
        // const selectionPlugin = this.board.getPlugin('SelectionPlugin') as SelectionPlugin
        const container = this.board.getContainer()

        const onHintElements = (e: PointerEvent) => {
            const modeService = this.board.getService('modeService')
            if (modeService.getCurrentMode() !== 'selection') return
            const modelService = this.board.getService('modelService')
            modelService.getAllModels().forEach((model) => {
                const ctrlElement = model.ctrlElement
                if (ctrlElement && ctrlElement.isHint({
                    point: {
                        x: e.clientX,
                        y: e.clientY
                    }, model
                })) {
                    if (model.isDrawing) return
                    console.log(model, 'selected models =======')
                    // 
                    if (model) {
                        // 删除之前的 textarea
                        this.removeTextareaFns.forEach((fn) => fn())
                        this.removeTextareaFns = []
                    }
                    // console.log(models, '选中元素 ======')
                    const { x, y, width, height } = model.ctrlElement.getBoundingBox(model)
                    const textarea = this.createTextarea({
                        x: x, y: y, height, width
                    })
                    const container = this.board.getContainer()
                    // 插入到最上面
                    container.appendChild(textarea)
                    // 进入编辑状态
                    textarea.focus()
                    // 失去焦点后，更新模型内容并删除 textarea
                    const id = model.id
                    textarea.id = id
                    if (model.text) {
                        textarea.value = model.text
                    }
                    const handleBlur = () => {
                        const newText = textarea.value
                        const textLayout = this.getTextLayoutInfo(textarea)

                        // // 调试模式：打印布局信息
                        // if (this.debugMode) {
                        //     console.log('💬 Text Layout Info:', textLayout);
                        //     logTextareaDebugInfo(textarea);
                        // }

                        const modelService = this.board.getService('modelService')
                        modelService.updateModel(id, {
                            text: newText,
                            textLayout: textLayout
                        })
                        container.removeChild(textarea)
                        // 删除之前的 textarea
                        this.removeTextareaFns.forEach((fn) => fn())
                        this.removeTextareaFns = []

                    }
                    textarea.addEventListener('blur', handleBlur)
                    this.removeTextareaFns.push(() => {
                        textarea.removeEventListener('blur', handleBlur)
                        if (container.contains(textarea)) {
                            container.removeChild(textarea)
                        }
                    })
                }
            })
        }

        container.addEventListener("pointerdown", onHintElements);

        this.disposeLists.push(() => {
            container.removeEventListener("pointerdown", onHintElements);
        });

        // 监听回车，删除对应的 textarea
        const handleKeyDown = (e: KeyboardEvent) => {
            e.stopPropagation()

        }
        const handlePointerUp = (e: PointerEvent) => {
            const modeService = eBoardContainer.get<IModeService>(IModeService)

            console.log(modeService.getCurrentMode(), 'current mode ========')
            // if (modeService.getCurrentMode() !== 'selection') return
            const activeElement = document.activeElement as HTMLTextAreaElement
            console.log(activeElement, 'activeElement =======')
            if (activeElement && activeElement.tagName === 'TEXTAREA') {
                // 点击的不是当前的 textarea，则让 textarea 失去焦点
                if (e.target !== activeElement) {
                    activeElement.blur()
                }
            }
        }
        container.addEventListener('keydown', handleKeyDown, { capture: true })
        container.addEventListener('pointerup', handlePointerUp)
        this.disposeWrapper({
            dispose: () => {
                container.removeEventListener('keydown', handleKeyDown, { capture: true })
                window.removeEventListener('pointerup', handlePointerUp)
            }
        })
        this.initTransformListeners();
    }

    public blurCurrentTextarea() {
        const activeElement = document.activeElement as HTMLTextAreaElement
        if (activeElement && activeElement.tagName === 'TEXTAREA') {
            // 让 textarea 失去焦点
            activeElement.blur()
        }
    }

    private initTransformListeners() {

        const transformService = this.board.getService('transformService')
        this.disposeWrapper(transformService.onTransformChange(() => {
            this.blurCurrentTextarea()
        }))
    }

    private createTextarea({ width, height, x, y }: { width: number, height: number, x: number, y: number }) {
        const textarea = document.createElement('textarea')
        const styles = getTextareaStyles(width, height, x, y);

        // 应用所有样式
        Object.assign(textarea.style, styles);

        return textarea

    }

    public dispose() {
        this.disposeLists.forEach((fun) => fun())
    }
}


export { TextEditor }