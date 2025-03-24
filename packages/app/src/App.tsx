import React, { useEffect } from 'react';
import { Button } from '@e-board/ui';
import { EBoard } from '@e-board/core';
const App: React.FC = () => {
  useEffect(() => {
    const board = new EBoard(document.getElementById('board') as HTMLDivElement);
    board.init();
  }, [])
  return (
    <>
      <div id="board"/>
      <h1>Welcome to E-Board</h1>
      <Button>按钮</Button>
    </>
  
  );
};

export default App; 