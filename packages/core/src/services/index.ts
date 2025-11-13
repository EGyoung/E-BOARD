import { IService } from "./type";

export * from "./pointerEventService/type";
export * from "./selectionService/type";
export * from "./modelService/type";
export * from "./modeService/type";
export * from "./renderService/type";
export * from "./transformService/type";
export * from "./shapeService/type";
export * from "./configService/type";
export * from "./historyService/type";
export * from "./canvasService/type";

export { default as PointerEventService } from "./pointerEventService";
export { default as SelectionService } from "./selectionService";
export { default as ModelService } from "./modelService";
export { default as ModeService } from "./modeService";
export { default as RenderService } from "./renderService";
export { default as TransformService } from "./transformService";
export { default as ShapeService } from "./shapeService";
export { default as ConfigService } from "./configService";
export { default as HistoryService } from "./historyService";
export { default as CanvasService } from "./canvasService";
export type { IService };
