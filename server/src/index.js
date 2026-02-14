const http = require("http");
const { WebSocketServer } = require("ws");

const PORT = 3010;
const PATH = "/collaboration";
const MAX_HISTORY = 1000;
const MAX_MESSAGE_BYTES = 64 * 1024;

const server = http.createServer((req, res) => {
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
    const raw = data.toString();
    if (raw.length > MAX_MESSAGE_BYTES) {
      safeSend(ws, { type: "error", data: { reason: "payload_too_large" } });
      return;
    }
    try {
      message = JSON.parse(raw);
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
          if (message.id) {
            let payload;
            try {
              payload = typeof message.data === "string" ? JSON.parse(message.data) : message.data;
            } catch {
              payload = null;
            }
            safeSend(ws, { type: "ack", data: { batchId: payload?.batchId || message.id } });
          }
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
      case "snapshot":
        if (message.data) {
          broadcast({ type: "snapshot", data: message.data }, ws);
        }
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
