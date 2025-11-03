import { toolRegistry } from './ToolRegistry';
import { ToolMode, ShapeType } from '../types';
import {
    DrawToolHandler,
    SelectToolHandler,
    ShapeToolHandler,
    ClearToolHandler,
    SaveToolHandler,
} from '../handlers';

export function registerDefaultTools() {
    // Register draw tool
    toolRegistry.register(
        {
            id: 'draw',
            name: '画笔',
            mode: ToolMode.DRAW,
        },
        new DrawToolHandler()
    );

    // Register select tool
    toolRegistry.register(
        {
            id: 'select',
            name: '选择',
            mode: ToolMode.SELECT,
        },
        new SelectToolHandler()
    );

    // Register shape tools
    toolRegistry.register(
        {
            id: 'shape-rectangle',
            name: '矩形',
            mode: ToolMode.SHAPE,
            shapeType: ShapeType.RECTANGLE,
        },
        new ShapeToolHandler(ShapeType.RECTANGLE)
    );

    toolRegistry.register(
        {
            id: 'shape-circle',
            name: '圆形',
            mode: ToolMode.SHAPE,
            shapeType: ShapeType.CIRCLE,
        },
        new ShapeToolHandler(ShapeType.CIRCLE)
    );

    toolRegistry.register(
        {
            id: 'shape-line',
            name: '直线',
            mode: ToolMode.SHAPE,
            shapeType: ShapeType.LINE,
        },
        new ShapeToolHandler(ShapeType.LINE)
    );

    toolRegistry.register(
        {
            id: 'shape-triangle',
            name: '三角形',
            mode: ToolMode.SHAPE,
            shapeType: ShapeType.TRIANGLE,
        },
        new ShapeToolHandler(ShapeType.TRIANGLE)
    );

    // Register action tools
    toolRegistry.register(
        {
            id: 'clear',
            name: '清空',
        },
        new ClearToolHandler()
    );

    toolRegistry.register(
        {
            id: 'save',
            name: '保存',
        },
        new SaveToolHandler()
    );
}
