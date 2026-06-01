import type { EBoard } from '@e-board/board-core';

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

export type ToolBoard = EBoard;

export interface IToolHandler {
    activate: (board: ToolBoard) => void;
    deactivate?: (board: ToolBoard) => void;
}
