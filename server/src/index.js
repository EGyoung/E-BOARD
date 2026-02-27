const http = require("http");
const path = require("path");
const dotenv = require("dotenv");
const { WebSocketServer } = require("ws");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const PORT = 3010;
const PATH = "/collaboration";
const MAX_HISTORY = 1000;

const MODELSCOPE_API_KEY = process.env.MODELSCOPE_API_KEY;
const MODELSCOPE_BASE_URL = process.env.MODELSCOPE_BASE_URL;
const MODEL = process.env.MODEL;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

const readJsonBody = req =>
  new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) {
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", err => reject(err));
  });

const safeJsonParse = value => {
  if (!value || typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const extractJson = content => {
  if (typeof content !== "string") return null;

  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced && fenced[1]) {
    const parsed = safeJsonParse(fenced[1].trim());
    if (parsed) return parsed;
  }

  const startObj = content.indexOf("{");
  const endObj = content.lastIndexOf("}");
  if (startObj !== -1 && endObj > startObj) {
    const parsed = safeJsonParse(content.slice(startObj, endObj + 1));
    if (parsed) return parsed;
  }

  const startArr = content.indexOf("[");
  const endArr = content.lastIndexOf("]");
  if (startArr !== -1 && endArr > startArr) {
    const parsed = safeJsonParse(content.slice(startArr, endArr + 1));
    if (parsed) return parsed;
  }

  return null;
};

const normalizeResult = data => {
  if (!data) return { actions: [] };
  if (Array.isArray(data)) {
    return {
      actions: data.map(item => ({ type: "createElement", params: item }))
    };
  }
  if (Array.isArray(data.actions)) return { actions: data.actions };
  if (Array.isArray(data.elements)) {
    return {
      actions: data.elements.map(item => ({ type: "createElement", params: item }))
    };
  }
  return { actions: [] };
};

const buildMessages = ({ prompt, board }) => {
  const width = Number(board?.width) || 1728;
  const height = Number(board?.height) || 958;
  return [
    {
      role: "system",
      content:
        '你是一个画板绘图助手。你只能输出 JSON，不要输出任何解释。返回结构必须是 {"actions": [...]}。' +
        "每个 action 只能是两种之一：" +
        '1) updateView: {"type":"updateView","params":{"x"?:number,"y"?:number,"zoom"?:number,"center"?:{"x":number,"y":number}}}。' +
        '2) createElement: {"type":"createElement","params":{"type":"rectangle","x":number,"y":number,"width":number,"height":number,"fillStyle":string,"strokeStyle":string,"lineWidth":number}}。' +
        '其中 fillStyle 和 strokeStyle 必须是具体颜色值，只能用标准格式（如 #RRGGBB、rgb/rgba），禁止输出“color”、“red”、“blue”等颜色名。例如：白色输出 "#ffffff"，黑色输出 "#000000"，红色输出 "#ff0000"，绿色输出 "#00ff00"，蓝色输出 "#0000ff"，灰色输出 "#888888"，也可以用 rgb/rgba 格式，如 "rgb(255,255,255)"。' +
        "如果需要移动视口，请先输出 updateView action，再输出 createElement action。createElement 的 x/y 需要结合上一次 updateView 的 x/y 和 createElement 的 width/height，通过公式: elementX = (viewX - elementWidth) / 2 和 elementY = (viewY - elementHeight) / 2，确保元素中心点与视口中心对齐。" +
        `\n举例：帮我在画布中间生成一个蓝色矩形\n需要返回：\n\n[{\n  "type": "updateView",\n  "params": { "x": 864, "y": 479 } // 画布中心点 (以 1728x958 为例)\n},\n{\n  "type": "createElement",\n  "params": {\n    "type": "rectangle",\n    "x": (864 - 80)/2,\n    "y": (479 - 40)/2,\n    "width": 80,\n    "height": 40,\n    "fillStyle": "#0000ff",\n    "strokeStyle": "#000000",\n    "lineWidth": 2\n  }\n}]\n\n这样矩形中心点 (864,479) 与视口中心重合。`
    },
    {
      role: "user",
      content: `画布大小: ${width}x${height}。需求: ${prompt}`
    }
  ];
};

const callModel = async ({ prompt, board }) => {
  if (!MODELSCOPE_API_KEY || !MODELSCOPE_BASE_URL || !MODEL) {
    throw new Error("Missing model configuration in .env");
  }

  const response = await fetch(`${MODELSCOPE_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${MODELSCOPE_API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      messages: buildMessages({ prompt, board })
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Model request failed (${response.status}): ${text}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content || "";
  console.log(content, "content");
  const parsed = typeof content === "object" ? content : extractJson(content);
  return normalizeResult(parsed);
};

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/ai/generate") {
    readJsonBody(req)
      .then(async body => {
        const prompt = `${body?.prompt || ""}`.trim();
        if (!prompt) {
          res.writeHead(400, { ...CORS_HEADERS, "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "prompt is required" }));
          return;
        }

        const data = await callModel({ prompt, board: body?.board || {} });
        res.writeHead(200, { ...CORS_HEADERS, "Content-Type": "application/json" });
        res.end(JSON.stringify({ data }));
      })
      .catch(error => {
        res.writeHead(500, { ...CORS_HEADERS, "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message || "AI generation failed" }));
      });
    return;
  }

  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("E-Board collaboration WebSocket server\n");
});

const wss = new WebSocketServer({ noServer: true });
const clients = new Set();
const history = [];

const safeSend = (ws, payload) => {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
  }
};

const broadcast = (payload, except) => {
  for (const client of clients) {
    if (client !== except && client.readyState === client.OPEN) {
      client.send(JSON.stringify(payload));
    }
  }
};

wss.on("connection", ws => {
  clients.add(ws);
  console.log(`[${new Date().toISOString()}] New client connected. Total clients: ${clients.size}`);

  ws.on("message", data => {
    let message;
    try {
      message = JSON.parse(data.toString());
    } catch {
      return;
    }

    switch (message.type) {
      case "join":
        // 可扩展: 记录 userId / presence
        safeSend(ws, { type: "joined", data: { ok: true } });
        break;
      case "operation":
        if (message.data) {
          history.push(message.data);
          if (history.length > MAX_HISTORY) history.shift();
          broadcast({ type: "operation", data: message.data }, ws);
        }
        break;
      case "command":
        // 转发 command 给其它客户端（不写入 history，command 通常为临时交互数据）
        if (message.data) {
          broadcast({ type: "command", data: message.data }, ws);
        }
        break;
      case "sync-request":
        safeSend(ws, { type: "sync", data: { operations: history } });
        break;
      default:
        break;
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    console.log(
      `[${new Date().toISOString()}] Client disconnected. Total clients: ${clients.size}`
    );
  });

  ws.on("error", err => {
    clients.delete(ws);
  });
});

server.on("upgrade", (req, socket, head) => {
  if (req.url !== PATH) {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, ws => {
    wss.emit("connection", ws, req);
  });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Collaboration WS server running on ws://localhost:${PORT}${PATH}`);
});
