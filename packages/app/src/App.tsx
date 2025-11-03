import React, { useEffect, useLayoutEffect } from "react";
import { DrawShapePlugin, EBoard, IConfigService, IModeService } from "@e-board/core";
import "./styles.css";
import { RoamPlugin, SelectionPlugin, ClearPlugin } from "@e-board/core";
import { Panel, StageTool } from '@e-board/workbrench'
const App: React.FC = () => {
  const eboard = React.useRef<EBoard | null>(null);
  useLayoutEffect(() => {
    const board = new EBoard({
      container: document.getElementById("board") as HTMLDivElement,
      id: "app-board",
      plugins: [RoamPlugin, SelectionPlugin, DrawShapePlugin, ClearPlugin]
    });
    (window as any).board = board;
    eboard.current = board;
    const modeService = board.getService(IModeService) as IModeService;
    modeService.switchMode("draw");

    const { dispose } =
      eboard.current.getPlugin("SelectionPlugin")?.exports.onSelectedElements((model: any) => {
        console.log("选中元素", model);
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

  const handleThicknessChange = (thickness: number) => {
    if (!eboard.current) return;
    const board = eboard.current;

    const configService = board.getService(IConfigService) as unknown as IConfigService;
    configService.setCtxConfig({ lineWidth: thickness });
  }
  return (
    <div className="app-container">
      <div style={{ position: "absolute", zIndex: 10, top: 10, left: 10, display: "flex", flexDirection: "column", gap: "10px" }}>
        <Panel onThicknessChange={handleThicknessChange} onColorChange={handleColorChange} board={eboard.current} />
        <StageTool board={eboard} />
      </div>
      <div id="board" className="board-container" />
    </div>
  );
};

export default App;
