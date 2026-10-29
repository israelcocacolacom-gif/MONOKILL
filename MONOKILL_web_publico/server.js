const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const WebSocket = require('ws');
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const players = new Map();

const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent((req.url || '/').split('?')[0]);
  if (pathname !== '/' && pathname !== '/index.html') {
    res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}); res.end('No encontrado'); return;
  }
  fs.readFile(path.join(ROOT, 'index.html'), (err, data) => {
    if (err) { res.writeHead(500); res.end('No se pudo leer index.html'); return; }
    res.writeHead(200, {'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store'}); res.end(data);
  });
});
const wss = new WebSocket.Server({server, maxPayload: 8192});
function send(ws, obj) { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)); }
function broadcast(obj, except) { for (const client of wss.clients) if (client !== except && client.readyState === WebSocket.OPEN) send(client, obj); }
wss.on('connection', ws => {
  const id = Math.random().toString(36).slice(2, 10);
  ws.playerId = id; ws.joined = false;
  ws.on('message', raw => {
    let msg; try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (!msg || typeof msg.type !== 'string') return;
    if (msg.type === 'join' && !ws.joined) {
      ws.joined = true;
      const player = {id, name: String(msg.name || 'Jugador').replace(/[<>]/g,'').slice(0,18), color: Number(msg.color) || 0x55aaff, x:0,y:0,z:0,yaw:0};
      players.set(id, player);
      send(ws, {type:'welcome', id, players:[...players.values()].filter(p => p.id !== id)});
      broadcast({type:'state', ...player}, ws);
      return;
    }
    if (msg.type === 'state' && ws.joined) {
      const p = players.get(id); if (!p) return;
      p.name = String(msg.name || p.name).replace(/[<>]/g,'').slice(0,18);
      p.color = Number(msg.color) || p.color;
      for (const key of ['x','y','z','yaw']) { const n = Number(msg[key]); if (Number.isFinite(n)) p[key] = Math.max(-10000, Math.min(10000, n)); }
      broadcast({type:'state', ...p}, ws);
    }
  });
  ws.on('close', () => { if (ws.joined) { players.delete(id); broadcast({type:'leave', id}); } });
});
server.listen(PORT, '0.0.0.0', () => {
  console.log('\nMONOKILL servidor local activo:');
  console.log(`  En este PC: http://localhost:${PORT}`);
  const nets = os.networkInterfaces();
  for (const [name, list] of Object.entries(nets)) for (const net of list || []) {
    if (net.family === 'IPv4' && !net.internal) console.log(`  Otros dispositivos en la misma Wi-Fi: http://${net.address}:${PORT}  (${name})`);
  }
  console.log('\nDeja esta ventana abierta mientras jugáis. Para parar el servidor: Ctrl+C.\n');
});
