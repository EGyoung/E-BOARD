import React, { useLayoutEffect, useState } from "react";
import { DrawShapePlugin, EBoard, IConfigService, IModeService, IModelService, ITransformService } from "@e-board/core";
import "./styles.css";
import { RoamPlugin, SelectionPlugin, ClearPlugin, PicturePlugin, FpsPlugin } from "@e-board/core";
import { Panel, StageTool, FloatingToolbar } from '@e-board/workbench'

const App: React.FC = () => {
  const eboard = React.useRef<EBoard | null>(null);
  const [selectedElement, setSelectedElement] = useState<any>(null);

  useLayoutEffect(() => {
    const board = new EBoard({
      container: document.getElementById("board") as HTMLDivElement,
      id: "app-board",
      plugins: [RoamPlugin, SelectionPlugin, DrawShapePlugin, ClearPlugin, PicturePlugin, FpsPlugin]
    });
    (window as any).board = board;
    eboard.current = board;
    const modeService = board.getService('modeService');
    modeService.switchMode("draw");

    const { dispose } =
      eboard.current.getPlugin("SelectionPlugin")?.exports.onSelectedElements((model: any) => {
        // console.log("选中元素", model);
        // 更新选中的元素，用于显示浮动工具栏
        setSelectedElement(model && model.length > 0 ? model[0] : null);
      }) ?? {};
    return () => {
      board.dispose();
      dispose?.();
    };
  }, []);

  const handleColorChange = (color: string) => {
    if (!eboard.current) return;
    const board = eboard.current;

    const configService = board.getService('configService') as unknown as IConfigService;
    configService.setCtxConfig({ strokeStyle: color });

  };

  const handleFillColorChange = (color: string) => {
    if (!eboard.current) return;
    const board = eboard.current;

    const configService = board.getService('configService') as unknown as IConfigService;
    configService.setCtxConfig({ fillStyle: color });
  };

  const handleThicknessChange = (thickness: number) => {
    if (!eboard.current) return;
    const board = eboard.current;

    const configService = board.getService('configService') as unknown as IConfigService;
    configService.setCtxConfig({ lineWidth: thickness });
  }

  const handleFloatingToolbarUpdate = (updates: any) => {
    if (!eboard.current) return;
    const board = eboard.current;

    const configService = board.getService('configService') as unknown as IConfigService;
    configService.setCtxConfig(updates);

    // 如果有选中的元素，也更新元素本身的样式
    if (selectedElement && selectedElement.updateStyle) {
      selectedElement.updateStyle(updates);
    }
  };

  const handleDelete = () => {
    if (!selectedElement) return;
    // 实现删除逻辑
    console.log('删除元素', selectedElement);
    setSelectedElement(null);
  };

  const handleDuplicate = () => {
    if (!selectedElement) return;
    // 实现复制逻辑
    console.log('复制元素', selectedElement);
  };

  const handleGenerateRandomShapes = (count: number = 1000) => {
    if (!eboard.current) return;

    const board = eboard.current;
    const canvas = board.getCanvas();
    if (!canvas) return;

    const modelService = board.getService('modelService') as unknown as IModelService;
    const configService = board.getService('configService') as unknown as IConfigService;
    const transformService = board.getService('transformService') as unknown as ITransformService;

    const view = transformService.getView();
    const zoom = view.zoom || 1;
    const width = canvas.width;
    const height = canvas.height;

    const minRectSize = 10 / zoom;
    const maxRectSize = 80 / zoom;

    const colors = [
      "#e74c3c", "#3498db", "#2ecc71", "#9b59b6",
      "#f1c40f", "#e67e22", "#1abc9c", "#34495e"
    ];

    const transformPoint = (point: { x: number; y: number }, inverse = false) => {
      return transformService.transformPoint(point, inverse);
    };

    for (let i = 0; i < count; i++) {
      const screenX = Math.random() * width;
      const screenY = Math.random() * height;
      const worldPoint = transformPoint({ x: screenX, y: screenY }, true);

      const rectW = minRectSize + Math.random() * (maxRectSize - minRectSize);
      const rectH = minRectSize + Math.random() * (maxRectSize - minRectSize);
      const fillStyle = colors[i % colors.length];

      modelService.createModel("rectangle", {
        points: [{ x: worldPoint.x, y: worldPoint.y }],
        width: rectW,
        height: rectH,
        options: {
          ...configService.getCtxConfig(),
          fillStyle
        },
        ctrlElement: {
          isHint: (params: { point: { x: number, y: number }, model: any }) => {
            const { point, model } = params;
            const [_point] = model.points!;
            const zoom = transformService.getView().zoom;

            const rectScreenPos = transformPoint(_point);
            const rectWidth = (model.width || 0) * zoom;
            const rectHeight = (model.height || 0) * zoom;

            return (
              point.x >= rectScreenPos.x &&
              point.x <= rectScreenPos.x + rectWidth &&
              point.y >= rectScreenPos.y &&
              point.y <= rectScreenPos.y + rectHeight
            );
          },
          getBoundingBox: (model: any) => {
            const [point] = model.points!;
            const width = model.width || 0;
            const height = model.height || 0;
            const zoom = transformService.getView().zoom;
            const strokeWidth = (model.options?.lineWidth ?? configService.getCtxConfig().lineWidth ?? 1) * zoom;
            const halfStroke = strokeWidth / 2;

            const screenPos = transformPoint(point);
            const screenWidth = width * zoom;
            const screenHeight = height * zoom;

            return {
              x: screenPos.x,
              y: screenPos.y,
              width: screenWidth,
              height: screenHeight,
              minX: screenPos.x - halfStroke,
              minY: screenPos.y - halfStroke,
              maxX: screenPos.x + screenWidth + halfStroke,
              maxY: screenPos.y + screenHeight + halfStroke
            };
          }
        }
      });
    }
  };

  return (
    <div className="app-container">
      <div style={{ position: "absolute", zIndex: 10, top: 10, left: 10, display: "flex", flexDirection: "column", gap: "10px" }}>
        <Panel
          onThicknessChange={handleThicknessChange}
          onColorChange={handleColorChange}
          onFillColorChange={handleFillColorChange}
          board={eboard.current}
        />
        <StageTool board={eboard} />

        {/* Debug Tools */}
        <div style={{
          background: "rgba(0, 0, 0, 0.8)",
          padding: "10px",
          borderRadius: "8px",
          color: "white",
          fontSize: "12px"
        }}>
          <div style={{ marginBottom: "8px", fontWeight: "bold" }}>🔧 Debug Tools</div>
          <button
            onClick={() => handleGenerateRandomShapes(100)}
            style={{
              padding: "6px 12px",
              marginBottom: "4px",
              width: "100%",
              cursor: "pointer",
              borderRadius: "4px",
              border: "none",
              background: "#3498db",
              color: "white"
            }}
          >
            生成 100 个矩形
          </button>
          <button
            onClick={() => handleGenerateRandomShapes(1000)}
            style={{
              padding: "6px 12px",
              marginBottom: "4px",
              width: "100%",
              cursor: "pointer",
              borderRadius: "4px",
              border: "none",
              background: "#e67e22",
              color: "white"
            }}
          >
            生成 1000 个矩形
          </button>
          <button
            onClick={() => handleGenerateRandomShapes(10000)}
            style={{
              padding: "6px 12px",
              width: "100%",
              cursor: "pointer",
              borderRadius: "4px",
              border: "none",
              background: "#e74c3c",
              color: "white"
            }}
          >
            生成 10000 个矩形
          </button>
        </div>
      </div>

      {/* 浮动工具栏 - 跟随选中元素 */}
      {/* <FloatingToolbar
        selectedElement={selectedElement}
        onUpdate={handleFloatingToolbarUpdate}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        board={eboard.current}
      /> */}

      <div id="board" className="board-container" />
    </div>
  );
};

export default App;
