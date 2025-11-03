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
            icon: '✏️',
            mode: ToolMode.DRAW,
        },
        new DrawToolHandler()
    );

    // Register select tool
    toolRegistry.register(
        {
            id: 'select',
            name: '选择',
            icon: '👆',
            mode: ToolMode.SELECT,
        },
        new SelectToolHandler()
    );

    // Register shape tools
    toolRegistry.register(
        {
            id: 'shape-rectangle',
            name: '矩形',
            icon: '□',
            mode: ToolMode.SHAPE,
            shapeType: ShapeType.RECTANGLE,
        },
        new ShapeToolHandler(ShapeType.RECTANGLE)
    );

    toolRegistry.register(
        {
            id: 'shape-circle',
            name: '圆形',
            icon: '○',
            mode: ToolMode.SHAPE,
            shapeType: ShapeType.CIRCLE,
        },
        new ShapeToolHandler(ShapeType.CIRCLE)
    );

    toolRegistry.register(
        {
            id: 'shape-line',
            name: '直线',
            icon: '/',
            mode: ToolMode.SHAPE,
            shapeType: ShapeType.LINE,
        },
        new ShapeToolHandler(ShapeType.LINE)
    );

    toolRegistry.register(
        {
            id: 'shape-triangle',
            name: '三角形',
            icon: '△',
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
            icon: '🗑',
        },
        new ClearToolHandler()
    );

    toolRegistry.register(
        {
            id: 'save',
            name: '保存',
            icon: '💾',
        },
        new SaveToolHandler()
    );
}
