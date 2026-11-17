/**
 * 抢词房 · 占领版房间服
 * 玩法（对齐百词斩抢词）：
 *   开局 20 个词格一屏铺开（5x4），每格一个英文单词；
 *   点格子弹出 4 个中文释义选项，答对占领该格（染成自己的颜色），答错该格锁定 4 秒；
 *   全部格子被占领后结算，占格最多者胜。
 * 手感（表现层，不改规则）：顿帧 / 震屏 / 闪白 / 碎片 / 挤压拉伸 / 拖尾飞行 / 连击升调 / 终结慢镜。
 * 联机：WebSocket 心跳 + pid 会话恢复——切出去再回来，原房间原分数，不重建。
 */
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const db = require('./database');
const api = require('./api');

const PORT = Number(process.env.PORT || 7777);
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');
const WORDS_FILE = path.join(__dirname, 'cet6-core.json');

// 启动器可通过 POST /api/config 注入隧道公网地址，让邀请链接用它
let INJECTED_PUBLIC_URL = '';

// ---------- 配置 ----------
const CFG = {
  tiles: 20,          // 棋盘词格数
  cols: 5,            // 每行格数
  missLockMs: 4000,   // 答错后该格对本玩家锁定时长
  scoreTile: 100,     // 占领一格基础分
  comboBonus: 10,     // 连击每级额外加分
  comboBonusCap: 10,  // 连击加成上限级数
  optionCount: 4,     // 释义选项数
  stealAfterMs: Number(process.env.STEAL_AFTER_MS || 15000),// 占领满 15 秒后才能被抢
  stealPenalty: 40,   // 被抢走的一方损失多少分
  stealBonus: 60,     // 抢成功额外奖励
};
// 八套霓虹配色：base 主色 / glow 发光色 / edge 描边高光
const PALETTES = [
  { base: '#22d3ee', glow: '#0891b2', edge: '#a5f3fc', name: '青' },      // 青蓝
  { base: '#f472b6', glow: '#be185d', edge: '#fbcfe8', name: '品红' },    // 品红
  { base: '#4ade80', glow: '#15803d', edge: '#bbf7d0', name: '翠' },      // 翠绿
  { base: '#fbbf24', glow: '#b45309', edge: '#fde68a', name: '琥珀' },    // 琥珀
  { base: '#a78bfa', glow: '#6d28d9', edge: '#ddd6fe', name: '紫' },      // 紫罗兰
  { base: '#fb923c', glow: '#c2410c', edge: '#fed7aa', name: '橙' },      // 活力橙
  { base: '#38bdf8', glow: '#0369a1', edge: '#bae6fd', name: '天蓝' },    // 天空蓝
  { base: '#ec4899', glow: '#9f1239', edge: '#fbcfe8', name: '玫红' },    // 玫瑰红
];

// 根据人数动态调整游戏规则
const GAME_RULES = {
  2: { tiles: 20, cols: 5, rows: 4, name: '1v1 对决' },
  3: { tiles: 30, cols: 6, rows: 5, name: '三人混战' },
  4: { tiles: 40, cols: 8, rows: 5, name: '四人大战' },
  5: { tiles: 50, cols: 10, rows: 5, name: '五人乱斗' },
  6: { tiles: 60, cols: 10, rows: 6, name: '六人激战' },
  7: { tiles: 70, cols: 10, rows: 7, name: '七人厮杀' },
  8: { tiles: 80, cols: 10, rows: 8, name: '八人终极' },
};
const COLORS = PALETTES.map(p => p.base);
const paletteOf = idx => PALETTES[Math.max(0, Math.min(PALETTES.length - 1, idx | 0))];

// ---------- 词库 ----------
function loadWords() {
  const list = JSON.parse(fs.readFileSync(WORDS_FILE, 'utf8'));
  const out = [];
  for (const e of list) {
    if (!e || typeof e.w !== 'string' || typeof e.zh !== 'string') continue;
    const w = e.w.trim(), zh = e.zh.trim();
    if (w && zh) out.push({ w, zh, ipa: (e.ipa || '').trim() });
  }
  if (out.length < 50) throw new Error('word list too small: ' + out.length);
  return out;
}
const WORDS = loadWords();

// ---------- 工具 ----------
const randInt = n => crypto.randomInt(n);
const pick = arr => arr[randInt(arr.length)];
const shuffle = arr => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const roomCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += chars[randInt(chars.length)];
  return s;
};
const now = () => Date.now();
const trunc = (s, n = 16) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

// 每格题目：词 + 4 个中文释义（1 正确 + 3 干扰）
function makeTile(word) {
  const correct = trunc(word.zh);
  const seen = new Set([correct]);
  const opts = [correct];
  let guard = 0;
  while (opts.length < CFG.optionCount && guard < 800) {
    guard++;
    const c = trunc(pick(WORDS).zh);
    if (!seen.has(c)) { seen.add(c); opts.push(c); }
  }
  const arr = opts.map(t => ({ t }));
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return {
    word: word.w,
    ipa: word.ipa,
    options: arr.map(o => o.t),
    answerIdx: arr.findIndex(o => o.t === correct),
  };
}

// ---------- 房间 ----------
const rooms = new Map();

function freeColor(room) {
  const used = new Set([...room.players.values()].map(p => p.colorIdx));
  for (let i = 0; i < COLORS.length; i++) if (!used.has(i)) return i;
  return 0;
}

function createRoom(host, mode, fixedCode) {
  let code = String(fixedCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  if (code.length < 4 || rooms.has(code)) {
    do { code = roomCode(); } while (rooms.has(code));
  }
  const room = {
    code,
    mode: mode === 'duel' ? 'duel' : 'brawl',
    maxPlayers: mode === 'duel' ? 2 : 4,
    hostId: host.id,
    players: new Map(),
    phase: 'lobby',            // lobby | playing | finished
    tiles: [],                 // [{i, q:{word,ipa,options,answerIdx}, owner}]
    createdAt: now(),
  };
  room.players.set(host.id, host);
  rooms.set(code, room);
  return room;
}

function playersSnapshot(room) {
  return [...room.players.values()].map(p => {
    const pal = paletteOf(p.colorIdx);
    return {
      id: p.id,
      name: p.name,
      colorIdx: p.colorIdx,
      color: pal.base,
      glow: pal.glow,
      edge: pal.edge,
      score: p.score,
      combo: p.combo,
      best: p.best,
      stealUsed: p.stealUsed || 0,
      tiles: room.tiles ? room.tiles.filter(t => t.owner === p.id).length : 0,
      connected: !!p.ws,
      isHost: p.id === room.hostId,
    };
  }).sort((a, b) => b.tiles - a.tiles || b.score - a.score);
}

function roomMsg(room) {
  return {
    type: 'room',
    code: room.code,
    mode: room.mode,
    maxPlayers: room.maxPlayers,
    hostId: room.hostId,
    phase: room.phase,
    colors: COLORS,
    players: playersSnapshot(room),
  };
}

function boardMsg(room) {
  const ts = now();
  return {
    type: 'board',
    cols: CFG.cols,
    total: room.tiles.length,
    stealAfterMs: CFG.stealAfterMs,
    serverNow: ts,
    palettes: PALETTES,
    tiles: room.tiles.map(t => {
      // 关键：颜色随格子一起下发，前端不再靠 owner id 反查玩家（反查失败会全染成 0 号色）
      const owner = t.owner ? room.players.get(t.owner) : null;
      const ci = owner ? owner.colorIdx : -1;
      const pal = ci >= 0 ? paletteOf(ci) : null;
      return {
        i: t.i,
        word: t.q.word,
        owner: t.owner,
        ownerColorIdx: ci,
        ownerName: owner ? owner.name : null,
        ownerColor: pal ? pal.base : null,
        ownerGlow: pal ? pal.glow : null,
        ownerEdge: pal ? pal.edge : null,
        claimedAt: t.claimedAt,
        stolenOnce: t.stolenOnce,
        stealIn: t.owner && !t.stolenOnce
          ? Math.max(0, CFG.stealAfterMs - (ts - t.claimedAt))
          : null,
      };
    }),
    players: playersSnapshot(room),
    phase: room.phase,
  };
}

function broadcast(room, payload) {
  const text = JSON.stringify(payload);
  for (const p of room.players.values()) {
    if (p.ws) sendText(p.ws, text);
  }
}

function sendTo(p, payload) {
  if (p && p.ws) sendText(p.ws, JSON.stringify(payload));
}
const pushRoom = room => broadcast(room, roomMsg(room));
const pushBoard = room => broadcast(room, boardMsg(room));

// ---------- 开局 / 结算 ----------
function startGame(room) {
  room.phase = 'playing';
  const words = shuffle(WORDS).slice(0, CFG.tiles);
  room.tiles = words.map((w, i) => ({
    i,
    q: makeTile(w),
    owner: null,
    claimedAt: 0,
    stolenOnce: false,
  }));
  for (const p of room.players.values()) {
    p.score = 0; p.combo = 0; p.best = 0; p.stealUsed = 0;
  }
  pushRoom(room);
  pushBoard(room);
}

function remainingTiles(room) {
  return room.tiles.filter(t => !t.owner).length;
}

function finishGame(room) {
  room.phase = 'finished';
  broadcast(room, {
    type: 'gameover',
    ranking: playersSnapshot(room).map((p, i) => ({ ...p, rank: i + 1 })),
  });
  
  // 保存游戏记录到数据库
  if (db.getDB()) {
    const ranking = playersSnapshot(room).map((p, i) => ({ ...p, position: i + 1 }));
    const duration = room.startedAt ? Math.floor((now() - room.startedAt) / 1000) : 0;
    db.saveGameRecord(room.code, ranking, ranking[0].id, duration, room.tiles)
      .catch(err => console.error('Save game failed:', err));
  }
}

// ---------- 玩家动作 ----------
// 一个格子当前能不能被 player 抢（翻盘）
function canSteal(room, player, t, ts) {
  if (!t.owner) return false;
  if (t.owner === player.id) return false;      // 不能抢自己的
  if (t.stolenOnce) return false;               // 已被抢过一次，永久锁定
  if (ts - t.claimedAt < CFG.stealAfterMs) return false;  // 未满 15 秒
  return true;
}

function pickTile(room, player, tileIndex) {
  if (room.phase !== 'playing') return;
  const t = room.tiles[tileIndex];
  if (!t) return;

  const ts = now();
  const isSteal = canSteal(room, player, t, ts);
  if (t.owner && !isSteal) return;              // 已被占且不可抢 → 忽略

  sendText(player.ws, JSON.stringify({
    type: 'tile_question',
    tile: t.i,
    word: t.q.word,
    ipa: t.q.ipa,
    options: t.q.options,
    steal: isSteal,                              // 前端据此显示「翻盘」样式
    ...(process.env.REVEAL_ANSWER === '1' ? { answerIdx: t.q.answerIdx } : {}),
  }));
}

function answerTile(room, player, tileIndex, optionIdx) {
  if (room.phase !== 'playing') return;
  const t = room.tiles[tileIndex];
  if (!t) return;
  if (typeof optionIdx !== 'number') return;

  const ts = now();
  const isSteal = canSteal(room, player, t, ts);
  if (t.owner && !isSteal) return;

  if (optionIdx === t.q.answerIdx) {
    const prevOwner = t.owner;
    let gain;
    const pal = paletteOf(player.colorIdx);

    if (isSteal) {
      // 翻盘：抢走对方的格子
      const victim = room.players.get(prevOwner);
      const vpal = victim ? paletteOf(victim.colorIdx) : null;
      if (victim) {
        victim.score -= CFG.stealPenalty;
        victim.combo = 0;
      }
      t.owner = player.id;
      t.claimedAt = ts;
      t.stolenOnce = true;                       // 这格以后不能再被抢
      player.combo += 1;
      player.best = Math.max(player.best, player.combo);
      player.stealUsed = (player.stealUsed || 0) + 1;
      gain = CFG.scoreTile + CFG.stealBonus + CFG.comboBonus * Math.min(player.combo - 1, CFG.comboBonusCap);
      player.score += gain;

      broadcast(room, {
        type: 'tile_stolen',
        tile: t.i,
        ownerId: player.id,
        ownerName: player.name,
        ownerColorIdx: player.colorIdx,
        ownerColor: pal.base,
        ownerGlow: pal.glow,
        ownerEdge: pal.edge,
        prevOwnerId: prevOwner,
        prevOwnerName: victim ? victim.name : null,
        prevOwnerColor: vpal ? vpal.base : null,
        combo: player.combo,
        gain,
        penalty: CFG.stealPenalty,
        remaining: remainingTiles(room),
        players: playersSnapshot(room),
      });
    } else {
      t.owner = player.id;
      t.claimedAt = ts;
      player.combo += 1;
      player.best = Math.max(player.best, player.combo);
      gain = CFG.scoreTile + CFG.comboBonus * Math.min(player.combo - 1, CFG.comboBonusCap);
      player.score += gain;

      broadcast(room, {
        type: 'tile_owned',
        tile: t.i,
        ownerId: player.id,
        ownerName: player.name,
        ownerColorIdx: player.colorIdx,
        ownerColor: pal.base,
        ownerGlow: pal.glow,
        ownerEdge: pal.edge,
        combo: player.combo,
        gain,
        remaining: remainingTiles(room),
        players: playersSnapshot(room),
      });
    }

    if (remainingTiles(room) === 0) {
      setTimeout(() => finishGame(room), 1200);
    }
  } else {
    player.combo = 0;
    player.score -= 20;
    sendText(player.ws, JSON.stringify({
      type: 'tile_miss',
      tile: t.i,
      lockMs: CFG.missLockMs,
      score: player.score,
    }));
    broadcast(room, { type: 'scores', players: playersSnapshot(room) });
  }
}

// ---------- WebSocket（RFC6455 最小实现） ----------
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const wsAccept = key => crypto.createHash('sha1').update(key + GUID).digest('base64');

function sendFrame(socket, opcode, payload) {
  if (!socket || socket.destroyed) return;
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2); header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4); header[1] = 126; header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10); header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2);
  }
  header[0] = 0x80 | opcode;
  try { socket.write(Buffer.concat([header, payload])); } catch {}
}
const sendText = (socket, text) => sendFrame(socket, 0x1, Buffer.from(text, 'utf8'));

function decodeFrames(state, chunk, onMessage, onClose) {
  state.buf = Buffer.concat([state.buf, chunk]);
  for (;;) {
    const b = state.buf;
    if (b.length < 2) return;
    const fin = (b[0] & 0x80) !== 0;
    const opcode = b[0] & 0x0f;
    const masked = (b[1] & 0x80) !== 0;
    let len = b[1] & 0x7f;
    let off = 2;
    if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
    else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); off = 10; }
    const maskLen = masked ? 4 : 0;
    if (b.length < off + maskLen + len) return;
    const maskKey = masked ? b.subarray(off, off + 4) : null;
    off += maskLen;
    const data = Buffer.from(b.subarray(off, off + len));
    if (maskKey) for (let i = 0; i < data.length; i++) data[i] ^= maskKey[i & 3];
    state.buf = b.subarray(off + len);

    if (opcode === 0x8) { onClose(); return; }
    if (opcode === 0x9) { sendFrame(state.socket, 0xA, data); continue; }
    if (opcode === 0xA) continue;
    if (opcode === 0x1 || opcode === 0x0) {
      state.frag = state.frag ? Buffer.concat([state.frag, data]) : data;
      if (fin) {
        const text = state.frag.toString('utf8');
        state.frag = null;
        onMessage(text);
      }
    }
    if (state.buf.length === 0) return;
  }
}

// ---------- HTTP ----------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
};

function serveStatic(req, res) {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
  const safe = path.normalize(urlPath).replace(/^([/\\])+/, '');
  const file = path.join(PUBLIC_DIR, safe);
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403).end('forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  // API 路由优先处理
  if (req.url.startsWith('/api/')) {
    return api.handleAPI(req, res);
  }
  
  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, words: WORDS.length }));
    return;
  }
  if (req.url === '/api/config' || req.url === '/config') {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', c => { body += c; if (body.length > 4096) req.destroy(); });
      req.on('end', () => {
        try { INJECTED_PUBLIC_URL = String((JSON.parse(body) || {}).publicUrl || '').trim().replace(/\/+$/, ''); } catch {}
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, publicUrl: INJECTED_PUBLIC_URL }));
      });
      return;
    }
    const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() || 'http';
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
    const injected = (INJECTED_PUBLIC_URL || process.env.PUBLIC_URL || '').trim().replace(/\/+$/, '');
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({
      publicUrl: injected || (host ? proto + '://' + host : ''),
      tunneled: !!injected,
      words: WORDS.length,
    }));
    return;
  }
  serveStatic(req, res);
});

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + wsAccept(key) + '\r\n\r\n'
  );
  socket.setNoDelay(true);

  const state = { socket, buf: Buffer.alloc(0), frag: null };
  const conn = { socket, room: null, player: null };

  const onMessage = text => {
    let msg;
    try { msg = JSON.parse(text); } catch { return; }
    handleClient(conn, msg);
  };
  const onClose = () => {
    const p = conn.player, room = conn.room;
    // 只有当前 socket 才算掉线（重连后旧 socket 关闭不应触发）
    if (p && room && p.ws === conn.socket) {
      p.ws = null;
      p.disconnectedAt = now();
      pushRoom(room);
    }
    try { socket.destroy(); } catch {}
  };

  socket.on('data', chunk => {
    try { decodeFrames(state, chunk, onMessage, onClose); }
    catch { onClose(); }
  });
  socket.on('error', onClose);
  socket.on('close', onClose);
});

// ---------- 消息处理 ----------
function handleClient(conn, msg) {
  const t = msg && msg.type;

  if (t === 'hello') {
    const name = String(msg.name || '').trim().slice(0, 16) || ('玩家' + (1000 + randInt(9000)));
    const pid = String(msg.pid || '');
    const wanted = String(msg.room || '').trim().toUpperCase();

    // 会话恢复：pid + 房间都对得上 → 原玩家原分数接回去
    if (pid && wanted && rooms.has(wanted)) {
      const room = rooms.get(wanted);
      const old = room.players.get(pid);
      if (old) {
        old.name = name;
        old.ws = conn.socket;
        old.disconnectedAt = 0;
        conn.player = old;
        conn.room = room;
        sendText(conn.socket, JSON.stringify({ type: 'restored', you: pid, code: room.code }));
        pushRoom(room);
        if (room.phase === 'playing') pushBoard(room);
        return;
      }
    }

    const player = {
      id: crypto.randomUUID(),
      name,
      colorIdx: 0,
      score: 0,
      combo: 0,
      best: 0,
      ws: conn.socket,
      disconnectedAt: 0,
    };
    conn.player = player;

    if (wanted && rooms.has(wanted)) {
      const room = rooms.get(wanted);
      if (room.players.size >= room.maxPlayers) {
        sendText(conn.socket, JSON.stringify({ type: 'error', message: '房间已满' }));
        return;
      }
      if (room.phase !== 'lobby') {
        sendText(conn.socket, JSON.stringify({ type: 'error', message: '本局已开始，等下一局' }));
        return;
      }
      player.colorIdx = freeColor(room);
      room.players.set(player.id, player);
      conn.room = room;
      sendText(conn.socket, JSON.stringify({ type: 'joined', you: player.id, code: room.code }));
      pushRoom(room);
      return;
    }

    const mode = msg.mode === 'duel' ? 'duel' : 'brawl';
    const room = createRoom(player, mode, msg.code);
    player.colorIdx = 0;
    conn.room = room;
    sendText(conn.socket, JSON.stringify({ type: 'joined', you: player.id, code: room.code }));
    pushRoom(room);
    return;
  }

  if (!conn.room || !conn.player) return;
  const room = conn.room;
  const p = conn.player;

  if (t === 'start') {
    if (p.id !== room.hostId) return;
    if (room.phase === 'playing') return;
    if (room.players.size < 2) {
      sendText(p.ws, JSON.stringify({ type: 'error', message: '至少 2 人才能开局' }));
      return;
    }
    startGame(room);
    return;
  }

  if (t === 'pick_tile') { pickTile(room, p, msg.tile); return; }
  if (t === 'answer') { answerTile(room, p, msg.tile, msg.idx); return; }

  if (t === 'again') {
    if (p.id !== room.hostId) return;
    if (room.phase === 'playing') return;
    room.phase = 'lobby';
    room.tiles = [];
    pushRoom(room);
    return;
  }

  if (t === 'ping') {
    sendText(p.ws, JSON.stringify({ type: 'pong', t: msg.t || 0 }));
    return;
  }
}

// ---------- 掉线清扫 ----------
setInterval(() => {
  const ts = now();
  for (const [code, room] of rooms) {
    // 对局进行中绝不删玩家：删了会让占格数归零、颜色查不到
    if (room.phase === 'lobby') {
      for (const [pid, p] of room.players) {
        if (!p.ws && p.disconnectedAt && ts - p.disconnectedAt > 60000) {
          room.players.delete(pid);
        }
      }
    }
    const live = [...room.players.values()].filter(p => p.ws).length;
    if (live === 0 && room.phase === 'lobby' && ts - room.createdAt > 5 * 60000) {
      rooms.delete(code);
      continue;
    }
    const anyOffline = [...room.players.values()].some(p => !p.ws);
    if (anyOffline) pushRoom(room);
  }
}, 15000);

// ---------- 启动 ----------
const os = require('node:os');
server.listen(PORT, HOST, () => {
  const ips = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const n of list || []) {
      if (n.family === 'IPv4' && !n.internal) ips.push(n.address);
    }
  }
  console.log('抢词房(占领版)已启动');
  console.log('  词库: %d 词 | 棋盘: %d 格', WORDS.length, CFG.tiles);
  console.log('  本机: http://127.0.0.1:%d', PORT);
  for (const ip of ips) console.log('  局域网: http://%s:%d', ip, PORT);
});
