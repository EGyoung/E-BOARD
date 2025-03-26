import React, { useEffect } from 'react';
import { Button } from '@e-board/ui';
import { EBoard } from '@e-board/core';
let isInit = false;
const App: React.FC = () => {
  useEffect(() => {
    if (isInit) return;
    isInit = true;
    console.log('App useEffect');
    const board = new EBoard({
      container: document.getElementById('board') as HTMLDivElement,
      id: 'app-board',
    });
    (window as any).board = board;
    // board.init();
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
