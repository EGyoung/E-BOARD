import { IModel } from "../../services/modelService/type";
import { ITextModel } from "./type";

type TextMetricsResult = {
    text: string;
    lines: string[];
    fontSize: number;
    lineHeight: number;
    padding: number;
    contentWidth: number;
    contentHeight: number;
    width: number;
    height: number;
};

let measureCanvas: HTMLCanvasElement | null = null;

const getMeasureContext = (): CanvasRenderingContext2D | null => {
    if (typeof document === "undefined") {
        return null;
    }
    if (!measureCanvas) {
        measureCanvas = document.createElement("canvas");
    }
    return measureCanvas.getContext("2d");
};

const measureLineWidth = (line: string, fontSize: number): number => {
    const ctx = getMeasureContext();
    if (!ctx) {
        return line.length * fontSize * 0.6;
    }

    ctx.font = `${fontSize}px sans-serif`;
    return ctx.measureText(line || " ").width;
};

export const getTextLayoutMetrics = (model: IModel<ITextModel>): TextMetricsResult => {
    const text = `${model.text ?? ""}`;
    const lines = text.split("\n");
    const fontSize = model.fontSize ?? model.options?.fontSize ?? 16;
    const padding = model.padding ?? model.options?.padding ?? 8;
    const lineHeight = model.lineHeight ?? model.options?.lineHeight ?? fontSize * 1.4;

    const contentWidth = Math.max(1, ...lines.map(line => measureLineWidth(line, fontSize)));
    const contentHeight = Math.max(1, lines.length) * lineHeight;

    const autoWidth = contentWidth + padding * 2;
    const autoHeight = contentHeight + padding * 2;

    const width = Math.max(model.width ?? 0, autoWidth);
    const height = Math.max(model.height ?? 0, autoHeight);

    return {
        text,
        lines,
        fontSize,
        lineHeight,
        padding,
        contentWidth,
        contentHeight,
        width,
        height
    };
};
