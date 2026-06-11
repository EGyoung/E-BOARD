import React, { useLayoutEffect, useState } from "react";
import { DrawShapePlugin, EBoard, EraserPlugin, IConfigService, IModelService, ITransformService } from "@e-board/board-core";
import "./styles.css";
import { RoamPlugin, SelectionPlugin, ClearPlugin, PicturePlugin, HotkeyPlugin, DrawArrowPlugin, DrawLinePlugin, DrawCirclePlugin, MindMapPlugin } from "@e-board/board-core";
import { BoardCollaboration } from '@e-board/board-collaboration';
import BoardAIAssistantPlugin from "@e-board/board-ai-assistant";

import { StageTool, FloatingToolbar } from '@e-board/board-workbench';
const App: React.FC = () => {
  const eboard = React.useRef<EBoard | null>(null);
  const [selectedElement, setSelectedElement] = useState<any[]>([]);
  const [aiPrompt, setAiPrompt] = useState("帮我在画布正中间创建一个蓝色矩形");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState("");

  const getConfig = async () => {
    const config = await fetch('https://cdn.jsdelivr.net/gh/EGyoung/Juyoung-cdn@main/e-board-plugins-config/index.json').then(res => res.json())
    return config
  }




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
      const plugins = [HotkeyPlugin, RoamPlugin, SelectionPlugin, DrawShapePlugin, DrawArrowPlugin, DrawLinePlugin, DrawCirclePlugin, ClearPlugin, PicturePlugin, EraserPlugin, BoardAIAssistantPlugin, MindMapPlugin];
      const board = new EBoard({
        container: document.getElementById("board") as HTMLDivElement,
        id: "app-board",
        plugins
      });
      // initRemotePlugins(board);
      // const cleanupCollaboration = initCollaboration(board);
      (window as any).board = board;
      eboard.current = board;
      const modeService = board.getService('modeService');
      modeService.switchMode("draw");




      const { dispose } =
        eboard.current.getPlugin("SelectionPlugin")?.exports.onSelectedElements((models: any) => {
          console.log('[FloatingToolbar] selectedElements:', models);
          setSelectedElement(models || []);
        }) ?? {};


      return () => {
        disposed = true;
        board.dispose();
        dispose?.();
        // cleanupCollaboration();
      };
    };

    let cleanup: (() => void) | undefined;
    loadPlugins().then(fn => cleanup = fn);
    return () => {
      if (cleanup) cleanup();
      disposed = true;
    };
  }, []);

  const handleFloatingToolbarUpdate = (updates: any) => {
    if (!eboard.current || selectedElement.length === 0) return;
    const board = eboard.current;
    const modelService = board.getService('modelService') as unknown as IModelService;

    selectedElement.forEach((el: any) => {
      const currentModel = modelService.getModelById(el.id);
      if (!currentModel) return;
      const currentOptions = currentModel.options || {};
      modelService.updateModel(el.id, {
        options: { ...currentOptions, ...updates }
      });
    });
  };

  const handleDelete = () => {
    if (selectedElement.length === 0 || !eboard.current) return;
    const board = eboard.current;
    const modelService = board.getService('modelService') as unknown as IModelService;

    selectedElement.forEach((el: any) => {
      modelService.deleteModel(el.id);
    });

    const interactionCtx = board.getInteractionCtx();
    const interactionCanvas = board.getInteractionCanvas();
    if (interactionCtx && interactionCanvas) {
      interactionCtx.clearRect(0, 0, interactionCanvas.width, interactionCanvas.height);
    }
    setSelectedElement([]);
  };

  const handleDuplicate = () => {
    if (selectedElement.length === 0 || !eboard.current) return;
    const board = eboard.current;
    const modelService = board.getService('modelService') as unknown as IModelService;

    const offset = 20;
    selectedElement.forEach((el: any) => {
      modelService.createModel(el.type, {
        points: el.points?.map((p: any) => ({ x: p.x + offset, y: p.y + offset })),
        width: el.width,
        height: el.height,
        options: { ...el.options },
      });
    });
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
      "#0071e3", "#34c759", "#ff9f0a", "#ff375f",
      "#af52de", "#5ac8fa", "#ffd60a", "#8e8e93"
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
      });
    }
  };

  const handleAIGenerate = async () => {
    if (!eboard.current || !aiPrompt.trim()) return;

    const plugin = eboard.current.getPlugin("BoardAIAssistantPlugin") as any;
    if (!plugin?.exports?.generateAndRender && !plugin?.exports?.generateAndRenderStream) {
      setAiMessage("AI 插件未加载");
      return;
    }

    try {
      setAiLoading(true);
      setAiMessage("正在生成...");
      const result = plugin?.exports?.generateAndRenderStream
        ? await plugin.exports.generateAndRenderStream({
          prompt: aiPrompt,
          endpoint: "http://localhost:3010/ai/generate/stream"
        })
        : await plugin.exports.generateAndRender({
          prompt: aiPrompt,
          endpoint: "http://localhost:3010/ai/generate"
        });
      setAiMessage(`生成完成：已创建 ${result.created} 个图形`);
    } catch (error: any) {
      setAiMessage(`生成失败：${error?.message || "未知错误"}`);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="app-container">
      <div style={{ position: "absolute", zIndex: 10, top: 10, left: 10, display: "flex", flexDirection: "column", gap: "10px" }}>
        <StageTool board={eboard} />

        {/* Debug Tools */}
        <div style={{
          background: "rgba(255, 255, 255, 0.74)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          padding: "12px",
          borderRadius: "18px",
          color: "#1d1d1f",
          border: "1px solid rgba(255, 255, 255, 0.72)",
          boxShadow: "0 18px 48px rgba(15, 23, 42, 0.12)",
          fontSize: "12px"
        }}>
          <div style={{ marginBottom: "10px", fontWeight: 600, color: "#1d1d1f" }}>Debug Tools</div>
          <button
            onClick={() => handleGenerateRandomShapes(100)}
            style={{
              padding: "8px 12px",
              marginBottom: "6px",
              width: "100%",
              cursor: "pointer",
              borderRadius: "10px",
              border: "1px solid rgba(0, 113, 227, 0.12)",
              background: "rgba(0, 113, 227, 0.1)",
              color: "#0071e3",
              fontWeight: 600
            }}
          >
            生成 100 个矩形
          </button>
          <button
            onClick={() => handleGenerateRandomShapes(1000)}
            style={{
              padding: "8px 12px",
              marginBottom: "6px",
              width: "100%",
              cursor: "pointer",
              borderRadius: "10px",
              border: "1px solid rgba(255, 159, 10, 0.12)",
              background: "rgba(255, 159, 10, 0.1)",
              color: "#b95a00",
              fontWeight: 600
            }}
          >
            生成 1000 个矩形
          </button>
          <button
            onClick={() => handleGenerateRandomShapes(10000)}
            style={{
              padding: "8px 12px",
              width: "100%",
              cursor: "pointer",
              borderRadius: "10px",
              border: "1px solid rgba(255, 55, 95, 0.12)",
              background: "rgba(255, 55, 95, 0.1)",
              color: "#c21f45",
              fontWeight: 600
            }}
          >
            生成 10000 个矩形
          </button>
        </div>

        <div style={{
          background: "rgba(255, 255, 255, 0.74)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          padding: "12px",
          borderRadius: "18px",
          color: "#1d1d1f",
          border: "1px solid rgba(255, 255, 255, 0.72)",
          boxShadow: "0 18px 48px rgba(15, 23, 42, 0.12)",
          fontSize: "12px",
          width: "280px"
        }}>
          <div style={{ marginBottom: "10px", fontWeight: 600, color: "#1d1d1f" }}>AI Assistant</div>
          <textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            rows={3}
            style={{
              width: "100%",
              marginBottom: "8px",
              resize: "vertical",
              borderRadius: "12px",
              border: "1px solid rgba(29, 29, 31, 0.12)",
              background: "rgba(255, 255, 255, 0.88)",
              color: "#1d1d1f",
              padding: "10px 12px",
              boxSizing: "border-box"
            }}
          />
          <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
            <button
              onClick={() => setAiPrompt("帮我在画布正中间创建一个蓝色矩形")}
              style={{
                flex: 1,
                cursor: "pointer",
                borderRadius: "10px",
                border: "1px solid rgba(29, 29, 31, 0.1)",
                background: "rgba(255, 255, 255, 0.76)",
                color: "#1d1d1f",
                padding: "8px 10px"
              }}
            >
              示例1
            </button>
            <button
              onClick={() => setAiPrompt("帮我生成一个电商系统架构图")}
              style={{
                flex: 1,
                cursor: "pointer",
                borderRadius: "10px",
                border: "1px solid rgba(29, 29, 31, 0.1)",
                background: "rgba(255, 255, 255, 0.76)",
                color: "#1d1d1f",
                padding: "8px 10px"
              }}
            >
              示例2
            </button>
          </div>
          <button
            onClick={handleAIGenerate}
            disabled={aiLoading}
            style={{
              width: "100%",
              cursor: aiLoading ? "not-allowed" : "pointer",
              borderRadius: "12px",
              border: "1px solid rgba(0, 113, 227, 0.16)",
              background: aiLoading ? "rgba(0, 113, 227, 0.08)" : "#0071e3",
              color: aiLoading ? "#6e6e73" : "#ffffff",
              padding: "10px 12px",
              fontWeight: 600
            }}
          >
            {aiLoading ? "生成中..." : "AI 生成图形"}
          </button>
          {aiMessage && <div style={{ marginTop: "8px", color: "#0071e3" }}>{aiMessage}</div>}
        </div>
      </div>

      <FloatingToolbar
        selectedElements={selectedElement}
        onUpdate={handleFloatingToolbarUpdate}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        board={eboard.current}
      />

      <div id="board" className="board-container" />

    </div>
  );
};

export default App;
