import React, { useEffect } from "react";
import { DrawShapePlugin, EBoard, IModeService } from "@e-board/core";
import "./styles.css";
import { RoamPlugin, SelectionPlugin, ClearPlugin } from "@e-board/core";
import Temp from '@e-board/workbrench'
const App: React.FC = () => {
  const eboard = React.useRef<EBoard | null>(null);
  useEffect(() => {
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

  const changeSelection = () => {
    if (!eboard.current) return;
    const board = eboard.current;

    const modeService = board.getService(IModeService) as IModeService;

    modeService.switchMode("selection");
  };

  const changePen = () => {
    if (!eboard.current) return;
    const board = eboard.current;

    const modeService = board.getService(IModeService) as IModeService;

    modeService.switchMode("draw");
  };

  const changeShape = () => {
    if (!eboard.current) return;
    const board = eboard.current;

    const modeService = board.getService(IModeService) as IModeService;

    modeService.switchMode("drawShape");
  };

  const clear = () => {
    if (!eboard.current) return;
    const board = eboard.current;
    board.getPlugin("ClearPlugin")?.exports.clear();
  };

  return (
    <div className="app-container">
      <div style={{ position: "absolute", zIndex: 10, top: 10, left: 10 }}>
        <button onClick={changeSelection}>选择</button>
        <button onClick={changePen}>pen</button>
        <button onClick={changeShape}>shape</button>
        <button onClick={clear}>清除画布</button>
        <Temp />
      </div>
      <div id="board" className="board-container" />
    </div>
  );
};

export default App;
