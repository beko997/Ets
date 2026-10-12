/* global process */
import express from "express";
import { WebSocketServer } from "ws";
import { createServer } from "http";
import fs from "fs";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Tek bir kalıcı klasör: DATA_DIR (varsayılan ./data). Volume/disk'i buraya bağla.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DATA_FILE = process.env.DATA_FILE || path.join(DATA_DIR, "data.json");
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(DATA_DIR, "uploads");
const PUBLIC_DIR = path.join(__dirname, "public");
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(path.join(PUBLIC_DIR, "index.html"))) {
  console.error("UYARI: public/index.html bulunamadı → " + PUBLIC_DIR);
}

// --- JSON dosya deposu (harici bağımlılık yok) ---
function load() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const d = JSON.parse(raw);
    d.rooms = d.rooms || {};
    d.messages = d.messages || {};
    return d;
  } catch {
    return { rooms: {}, messages: {} };
  }
}
let db = load();
function persist() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(db));
  } catch (e) {
    console.error("persist başarısız:", e.message);
  }
}

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.use(express.json());
app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.use(express.static(PUBLIC_DIR));
app.use("/uploads", express.static(UPLOAD_DIR));

// Oda oluştur
app.post("/api/rooms", (req, res) => {
  const id = crypto.randomUUID();
  db.rooms[id] = { id, label: (req.body && req.body.label) || null, created_at: Date.now() };
  db.messages[id] = [];
  persist();
  res.json({ id });
});

// Oda mesajlarını listele
app.get("/api/rooms/:id/messages", (req, res) => {
  const msgs = db.messages[req.params.id] || [];
  res.json({ messages: msgs });
});

// Şifreli medya yükle (ham ikili gövde) → şifreli dosyayı diske yazar
app.post(
  "/api/rooms/:id/media",
  express.raw({ type: "*/*", limit: "100mb" }),
  (req, res) => {
    const id = crypto.randomUUID();
    fs.writeFileSync(path.join(UPLOAD_DIR, id), req.body);
    res.json({ url: `/uploads/${id}` });
  }
);

// Mesaj gönder (metin veya medya)
app.post("/api/rooms/:id/messages", (req, res) => {
  const { ciphertext, iv, sender, kind, media_uri } = req.body || {};
  if (!ciphertext || !iv) return res.status(400).json({ error: "ciphertext/iv eksik" });
  const msg = {
    id: crypto.randomUUID(),
    room_id: req.params.id,
    ciphertext,
    iv,
    sender: sender || null,
    kind: kind || "text",
    media_uri: media_uri || null,
    created_at: Date.now(),
  };
  if (!db.messages[msg.room_id]) db.messages[msg.room_id] = [];
  db.messages[msg.room_id].push(msg);
  persist();
  broadcast(msg.room_id, { type: "create", data: msg });
  res.json(msg);
});

const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });
const clients = new Map(); // ws -> roomId

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    try {
      const m = JSON.parse(raw.toString());
      if (m.type === "join" && m.roomId) clients.set(ws, m.roomId);
    } catch {}
  });
  ws.on("close", () => clients.delete(ws));
});

function broadcast(roomId, payload) {
  const data = JSON.stringify(payload);
  for (const [ws, rid] of clients) {
    if (rid === roomId) {
      try {
        ws.send(data);
      } catch {}
    }
  }
}

server.listen(PORT, HOST, () => console.log(`Veil Chat → ${HOST}:${PORT} (data: ${DATA_DIR})`));

function shutdown() {
  persist();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);