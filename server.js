// Skyrift Brawl online server.
// A tiny "presence relay": every connected player has one small JSON object per room,
// and the server shares it with everyone else in that room. The game does its own
// matchmaking and netcode on top of this, the same way it does on claude.ai.
const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
// Comma-separated list of allowed page origins, e.g. "https://www.crazygames.com,https://games.crazygames.com".
// Leave empty to allow any origin.
const ALLOWED = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const ROOM_RE = /^[a-z0-9][a-z0-9_.-]{0,47}$/;
const MAX_PRESENCE = 4096, MAX_MSG = 8192, MAX_ROOMS_PER_CLIENT = 4, MAX_MATCH_ROOM = 4;

const rooms = new Map(); // room name -> Map(clientId -> presence)
const clients = new Map(); // clientId -> { ws, rooms:Set, budget }
let nextId = 1;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end(`Skyrift Brawl server is running. ${clients.size} players connected.\n`);
});
const wss = new WebSocketServer({ server, maxPayload: MAX_MSG });

function send(c, msg) { if (c.ws.readyState === 1) c.ws.send(JSON.stringify(msg)); }
function broadcast(room, msg, exceptId) {
  const r = rooms.get(room); if (!r) return;
  const text = JSON.stringify(msg);
  for (const id of r.keys()) { if (id === exceptId) continue; const c = clients.get(id); if (c && c.ws.readyState === 1) c.ws.send(text); }
}
function join(id, room) {
  const c = clients.get(id); if (!c || !ROOM_RE.test(room)) return send(c, { t: 'err', room, code: 'invalid_argument' });
  if (c.rooms.has(room)) return send(c, { t: 'joined', room, peers: peersOf(room, id) });
  if (c.rooms.size >= MAX_ROOMS_PER_CLIENT) return send(c, { t: 'err', room, code: 'limit_reached' });
  let r = rooms.get(room); if (!r) { r = new Map(); rooms.set(room, r); }
  if (room !== 'lobby' && r.size >= MAX_MATCH_ROOM) return send(c, { t: 'err', room, code: 'limit_reached' });
  r.set(id, {}); c.rooms.add(room);
  send(c, { t: 'joined', room, peers: peersOf(room, id) });
  broadcast(room, { t: 'p', room, peer: String(id), presence: {} }, id);
}
function leave(id, room) {
  const c = clients.get(id), r = rooms.get(room); if (!r || !r.has(id)) return;
  r.delete(id); if (c) c.rooms.delete(room); if (!r.size) rooms.delete(room);
  broadcast(room, { t: 'left', room, peer: String(id) });
}
function peersOf(room, exceptId) {
  const r = rooms.get(room), out = []; if (!r) return out;
  for (const [id, p] of r) if (id !== exceptId) out.push({ peer: String(id), presence: p });
  return out;
}

wss.on('connection', (ws, req) => {
  const origin = req.headers.origin || '';
  if (ALLOWED.length && !ALLOWED.some(a => origin === a || origin.endsWith('.' + a.replace(/^https?:\/\//, '')))) { ws.close(1008, 'origin not allowed'); return; }
  const id = nextId++;
  const c = { ws, rooms: new Set(), budget: 120, alive: true };
  clients.set(id, c);
  send(c, { t: 'hello', id: String(id) });
  join(id, 'lobby');
  ws.on('pong', () => { c.alive = true; });
  ws.on('message', (data) => {
    if (--c.budget < 0) return; // simple rate limit, refilled every second
    let m; try { m = JSON.parse(data); } catch { return; }
    if (!m || typeof m.room !== 'string') return;
    if (m.t === 'join') join(id, m.room);
    else if (m.t === 'leave') leave(id, m.room);
    else if (m.t === 'p') {
      const r = rooms.get(m.room); if (!r || !r.has(id) || typeof m.presence !== 'object' || !m.presence) return;
      const text = JSON.stringify(m.presence); if (text.length > MAX_PRESENCE) return;
      r.set(id, m.presence);
      broadcast(m.room, { t: 'p', room: m.room, peer: String(id), presence: m.presence }, id);
    }
  });
  ws.on('close', () => { for (const room of [...c.rooms]) leave(id, room); clients.delete(id); });
});

setInterval(() => { for (const c of clients.values()) c.budget = 120; }, 1000);
setInterval(() => { for (const c of clients.values()) { if (!c.alive) { c.ws.terminate(); continue; } c.alive = false; try { c.ws.ping(); } catch {} } }, 20000);
server.listen(PORT, () => console.log(`Skyrift Brawl server listening on port ${PORT}`));
