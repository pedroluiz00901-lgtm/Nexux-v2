
const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");

const root = path.join(__dirname, "public");
const rooms = new Map();
const port = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || "/").split("?")[0]);

  let f = path.join(
    root,
    p === "/" ? "index.html" : p.replace(/^\/+/, "")
  );

  if (!f.startsWith(root)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(f, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("Not found");
    }

    res.writeHead(200, {
      "Content-Type": f.endsWith(".html")
        ? "text/html; charset=utf-8"
        : "application/octet-stream"
    });

    res.end(data);
  });
});

const wss = new WebSocketServer({ server });

function send(ws, data) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(data));
  }
}

wss.on("connection", ws => {
  ws.on("message", raw => {
    let msg;

    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === "join") {
      const room = String(msg.room || "")
        .trim()
        .toUpperCase();

      if (!/^[A-Z0-9-]{3,20}$/.test(room)) {
        return send(ws, {
          type: "error",
          message: "Código inválido"
        });
      }

      ws.room = room;

      if (!rooms.has(room)) {
        rooms.set(room, new Set());
      }

      const peers = rooms.get(room);
      peers.add(ws);

      send(ws, { type: "joined" });

      for (const peer of peers) {
        if (peer !== ws) {
          send(peer, { type: "peer-joined" });
        }
      }

      return;
    }

    if (ws.room) {
      for (const peer of rooms.get(ws.room) || []) {
        if (peer !== ws) {
          send(peer, msg);
        }
      }
    }
  });

  ws.on("close", () => {
    if (!ws.room) return;

    const peers = rooms.get(ws.room);
    if (!peers) return;

    peers.delete(ws);

    for (const peer of peers) {
      send(peer, { type: "peer-left" });
    }

    if (!peers.size) {
      rooms.delete(ws.room);
    }
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log("NEXUX TELAGEM na porta " + port);
});
