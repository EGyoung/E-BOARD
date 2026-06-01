export enum ToolMode {
    DRAW = 'draw',
    ERASER = 'eraser',
    SELECT = 'selection',
    SHAPE = 'drawShape',
    LASER_POINTER = 'laserPointer',
    MIND_MAP = 'mindMap',
    TABLE = 'table',
    ARROW = 'drawArrow',
    LINE = 'drawLine',
    CIRCLE = 'drawCircle',
}

export enum ShapeType {
    RECTANGLE = 'rectangle',
    CIRCLE = 'circle',
    LINE = 'line',
    TRIANGLE = 'triangle',
}

export interface ToolConfig {
    id: string;
    name: string;
    icon?: string;
    mode?: ToolMode;
    shapeType?: ShapeType;
}

export interface IToolHandler {
    activate: (board: any) => void;
    deactivate?: (board: any) => void;
}
