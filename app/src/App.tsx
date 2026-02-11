import React, { useEffect, useLayoutEffect, useState } from "react";
import { DrawShapePlugin, EBoard, IConfigService, IModelService, ITransformService, RectCtrlElement } from "@e-board/board-core";
import "./styles.css";
import { RoamPlugin, SelectionPlugin, ClearPlugin, PicturePlugin, HotkeyPlugin } from "@e-board/board-core";
import { BoardCollaboration } from '@e-board/board-collaboration';

import { Panel, StageTool } from '@e-board/board-workbench';
import { WebSocketProvider } from "@e-board/board-websocket";
const WS_URL = 'ws://localhost:3010/collaboration';
const App: React.FC = () => {
  const eboard = React.useRef<EBoard | null>(null);
  const [selectedElement, setSelectedElement] = useState<any>(null);

  const getConfig = async () => {
    const config = await fetch('https://cdn.jsdelivr.net/gh/EGyoung/Juyoung-cdn@main/e-board-plugins-config/index.json').then(res => res.json())
    return config
  }

  useEffect(() => {
    try {
      const wsProvider = new WebSocketProvider();
      wsProvider.connect(WS_URL);
      wsProvider.onMessage((...args) => {
        console.log('Received message from server:', ...args);
      })
    } catch (err) {
      console.error('WebSocket 连接失败:', err);
    }

  }, [])


  const initCollaboration = (board: any) => {
    const boardCollaboration = new BoardCollaboration(board)
    return () => {
      boardCollaboration.dispose();
    }
  }

  // 远程插件加载工具
  function loadRemotePlugin(url: string, globalName: string): Promise<any> {
    console.log(globalName, '正在加载远程插件：', url);
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.onload = () => {
        if ((window as any)[globalName]) {
          resolve((window as any)[globalName].default);
        } else {
          reject(new Error('Remote plugin not found: ' + globalName));
        }
      };
      script.onerror = () => reject(new Error('Failed to load remote plugin: ' + url));
      document.head.appendChild(script);
    });
  }

  useLayoutEffect(() => {
    // 远程插件配置

    let disposed = false;

    const initRemotePlugins = async (board: any) => {
      const remotePluginConfig: any = await getConfig()
      for (const _plugin of Object.values(remotePluginConfig as any)) {
        const plugin = _plugin as any;
        if (plugin.enabled) {
          console.log(`插件 ${plugin.name} 已启用，远程地址：${plugin.src}`);
          board.registerPlugin(await loadRemotePlugin(plugin.src, plugin.name));
        } else {
          console.log(`插件 ${plugin.name} 未启用`);
        }
      }
    }

    const loadPlugins = async () => {
      const plugins = [HotkeyPlugin, RoamPlugin, SelectionPlugin, DrawShapePlugin, ClearPlugin, PicturePlugin];
      const board = new EBoard({
        container: document.getElementById("board") as HTMLDivElement,
        id: "app-board",
        plugins
      });
      initRemotePlugins(board);
      const cleanupCollaboration = initCollaboration(board);
      (window as any).board = board;
      eboard.current = board;
      const modeService = board.getService('modeService');
      modeService.switchMode("draw");




      const { dispose } =
        eboard.current.getPlugin("SelectionPlugin")?.exports.onSelectedElements((model: any) => {
          setSelectedElement(model && model.length > 0 ? model[0] : null);
        }) ?? {};
      return () => {
        disposed = true;
        board.dispose();
        dispose?.();
        cleanupCollaboration();
      };
    };

    let cleanup: (() => void) | undefined;
    loadPlugins().then(fn => cleanup = fn);
    return () => {
      if (cleanup) cleanup();
      disposed = true;
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
        ctrlElementConstructor: RectCtrlElement
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
