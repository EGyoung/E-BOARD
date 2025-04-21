import React, { useEffect } from "react";
import { EBoard, IModeService } from "@e-board/core";
import "./styles.css";
import { RoamPlugin } from "@e-board/core";
const App: React.FC = () => {
  useEffect(() => {
    const board = new EBoard({
      container: document.getElementById("board") as HTMLDivElement,
      id: "app-board",
      plugins: [RoamPlugin]
    });
    (window as any).board = board;
    const modeService = board.getService(IModeService) as IModeService;
    modeService.switchMode("draw");
    return () => {
      board.dispose();
    };
  }, []);

  return (
    <div className="app-container">
      <div id="board" className="board-container" />
    </div>
  );
};

export default App;
