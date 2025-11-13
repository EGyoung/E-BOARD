import React, { useEffect, useLayoutEffect, useState } from "react";
import { DrawShapePlugin, EBoard, IConfigService, IModeService } from "@e-board/core";
import "./styles.css";
import { RoamPlugin, SelectionPlugin, ClearPlugin, PicturePlugin } from "@e-board/core";
import { Panel, StageTool, FloatingToolbar } from '@e-board/workbrench'

const App: React.FC = () => {
  const eboard = React.useRef<EBoard | null>(null);
  const [selectedElement, setSelectedElement] = useState<any>(null);

  useLayoutEffect(() => {
    const board = new EBoard({
      container: document.getElementById("board") as HTMLDivElement,
      id: "app-board",
      plugins: [RoamPlugin, SelectionPlugin, DrawShapePlugin, ClearPlugin, PicturePlugin]
    });
    (window as any).board = board;
    eboard.current = board;
    const modeService = board.getService(IModeService) as IModeService;
    modeService.switchMode("draw");

    const { dispose } =
      eboard.current.getPlugin("SelectionPlugin")?.exports.onSelectedElements((model: any) => {
        console.log("选中元素", model);
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

    const configService = board.getService(IConfigService) as unknown as IConfigService;
    configService.setCtxConfig({ strokeStyle: color });

  };

  const handleFillColorChange = (color: string) => {
    if (!eboard.current) return;
    const board = eboard.current;

    const configService = board.getService(IConfigService) as unknown as IConfigService;
    configService.setCtxConfig({ fillStyle: color });
  };

  const handleThicknessChange = (thickness: number) => {
    if (!eboard.current) return;
    const board = eboard.current;

    const configService = board.getService(IConfigService) as unknown as IConfigService;
    configService.setCtxConfig({ lineWidth: thickness });
  }

  const handleFloatingToolbarUpdate = (updates: any) => {
    if (!eboard.current) return;
    const board = eboard.current;

    const configService = board.getService(IConfigService) as unknown as IConfigService;
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
