import React, { useEffect } from "react";
import { EBoard } from "@e-board/core";
import "./styles.css";

const App: React.FC = () => {
  useEffect(() => {
    const board = new EBoard({
      container: document.getElementById("board") as HTMLDivElement,
      id: "app-board",
    });

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
