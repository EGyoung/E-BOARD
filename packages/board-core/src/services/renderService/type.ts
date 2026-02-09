import type RenderService from "./index";
export type IRenderService = RenderService;

export const IRenderService = Symbol("IRenderService");
export type Range = {
    minX: number,
    minY: number,
    maxX: number,
    maxY: number
}

export interface IDrawModelHandler {
    (model: any, ctx?: CanvasRenderingContext2D, useWorldCoords?: boolean): void;
}
export interface View {
    x: number;
    y: number;
    zoom: number;
}