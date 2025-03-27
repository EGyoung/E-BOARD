import React, { useEffect } from "react";
import { Button } from "@e-board/ui";
import { EBoard } from "@e-board/core";
let isInit = false;
const App: React.FC = () => {
  useEffect(() => {
    console.log("App useEffect");
    // if (!isInit) {
    // isInit = true;
    const board = new EBoard({
      container: document.getElementById("board") as HTMLDivElement,
      id: "app-board",
    });
    (window as any).board = board;
    // board.init();
    return () => {
      board.dispose();
    };
    // }
  }, []);
  return (
    <>
      <div id="board" />
      {/* <h1>Welcome to E-Board</h1> */}
      {/* <Button>按钮</Button> */}
    </>
  );
};

export default App;
