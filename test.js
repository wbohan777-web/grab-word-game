/**
 * 占领版冒烟测试：建房 → 开局 → 点格 → 答题 → 占领 → 结算 → 断线恢复
 * 用法：node test.js
 */
'use strict';
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const PORT = Number(process.env.TEST_PORT || 7799);
const BASE = '127.0.0.1';
const wait = ms => new Promise(r => setTimeout(r, ms));

// ---- 极简 WS 客户端 ----
class WS {
  constructor(socket) { this.s = socket; this.buf = Buffer.alloc(0); this.q = []; this.waiter = null; }
  static connect(port, host) {
    return new Promise((resolve, reject) => {
      const key = crypto.randomBytes(16).toString('base64');
      const sock = net.connect(port, host, () => {
        sock.write(
          `GET / HTTP/1.1\r\nHost: ${host}:${port}\r\nUpgrade: websocket\r\n` +
          `Connection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`
        );
      });
      const ws = new WS(sock);
      let handshook = false;
      sock.on('data', chunk => {
        if (!handshook) {
          ws.buf = Buffer.concat([ws.buf, chunk]);
          const i = ws.buf.indexOf('\r\n\r\n');
          if (i < 0) return;
          ws.buf = ws.buf.subarray(i + 4);
          handshook = true;
          resolve(ws);
        } else {
          ws.buf = Buffer.concat([ws.buf, chunk]);
        }
        ws._drain();
      });
      sock.on('error', reject);
    });
  }
  _drain() {
    for (;;) {
      const b = this.buf;
      if (b.length < 2) return;
      const op = b[0] & 0x0f;
      let len = b[1] & 0x7f, off = 2;
      if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); off = 10; }
      if (b.length < off + len) return;
      const data = b.subarray(off, off + len);
      this.buf = b.subarray(off + len);
      if (op === 0x1) {
        const msg = JSON.parse(data.toString('utf8'));
        this.q.push(msg);
        if (this.waiter) { const w = this.waiter; this.waiter = null; w(); }
      }
    }
  }
  send(obj) {
    const p = Buffer.from(JSON.stringify(obj), 'utf8');
    const mask = crypto.randomBytes(4);
    let header;
    if (p.length < 126) { header = Buffer.alloc(2); header[1] = 0x80 | p.length; }
    else { header = Buffer.alloc(4); header[1] = 0x80 | 126; header.writeUInt16BE(p.length, 2); }
    header[0] = 0x81;
    const masked = Buffer.from(p);
    for (let i = 0; i < masked.length; i++) masked[i] ^= mask[i & 3];
    this.s.write(Buffer.concat([header, mask, masked]));
  }
  async next(type, timeoutMs = 5000) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const i = this.q.findIndex(m => !type || m.type === type);
      if (i >= 0) return this.q.splice(i, 1)[0];
      if (Date.now() > deadline) throw new Error('timeout waiting for ' + (type || 'any'));
      await new Promise(r => { this.waiter = r; setTimeout(r, 100); });
    }
  }
  // 按谓词取消息：避免拿到别人的广播（例如多人都收到同一条 tile_owned）
  async nextWhere(pred, timeoutMs = 5000) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const i = this.q.findIndex(pred);
      if (i >= 0) return this.q.splice(i, 1)[0];
      if (Date.now() > deadline) throw new Error('timeout waiting for predicate');
      await new Promise(r => { this.waiter = r; setTimeout(r, 100); });
    }
  }
  close() { try { this.s.destroy(); } catch {} }
}

(async () => {
  const pass = [], fail = [];
  const ok = (n, c) => (c ? pass : fail).push(n);

  const srv = spawn(process.execPath, ['server.js'], {
    cwd: __dirname,
    env: { ...process.env, PORT: String(PORT), REVEAL_ANSWER: '1', STEAL_AFTER_MS: '400' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let booted = false;
  srv.stdout.on('data', d => { if (String(d).includes('已启动')) booted = true; });
  srv.stderr.on('data', d => process.stderr.write(d));
  for (let i = 0; i < 60 && !booted; i++) await wait(100);
  ok('server boots', booted);

  // A 建房
  const a = await WS.connect(PORT, BASE);
  a.send({ type: 'hello', name: '阿A', mode: 'brawl' });
  const ja = await a.next('joined');
  ok('A joined', /^[A-Z0-9]{4}$/.test(ja.code));
  await a.next('room');

  // 单人开局被拒（此时房里只有 A）
  a.send({ type: 'start' });
  const err1 = await a.next('error');
  ok('reject 1-player start', /2/.test(err1.message));

  // B 加入
  const b = await WS.connect(PORT, BASE);
  b.send({ type: 'hello', name: '阿B', room: ja.code });
  const jb = await b.next('joined');
  ok('B joined same room', jb.code === ja.code);
  await a.next('room'); await b.next('room');

  // 开局
  a.send({ type: 'start' });
  const bd = await a.next('board');
  ok('board 20 tiles', bd.tiles.length === 20);
  ok('board 5 cols', bd.cols === 5);
  ok('all tiles unowned', bd.tiles.every(t => !t.owner));
  const bdB = await b.next('board');
  ok('both see same board', bdB.tiles.length === 20);

  // A 点格 → 拿到私密题目（含答案，测试模式）
  a.send({ type: 'pick_tile', tile: 0 });
  const q = await a.next('tile_question');
  ok('A got tile 0 question', q.tile === 0);
  ok('4 options', q.options.length === 4);
  ok('answerIdx present in test mode', typeof q.answerIdx === 'number');
  ok('has word + ipa', !!q.word);

  // B 不该收到 A 的题目
  const leaked = b.q.find(m => m.type === 'tile_question');
  ok('question is private', !leaked);

  // B 同时点同一格也拿到题目
  b.send({ type: 'pick_tile', tile: 0 });
  const qb = await b.next('tile_question');
  ok('B can also open tile 0 (unowned)', qb.tile === 0);

  // A 答错
  const wrongIdx = (q.answerIdx + 1) % q.options.length;
  a.send({ type: 'answer', tile: 0, idx: wrongIdx });
  const miss = await a.next('tile_miss');
  ok('miss has lockMs', miss.lockMs > 0);

  // B 答对 → 占领
  b.send({ type: 'answer', tile: 0, idx: qb.answerIdx });
  const own = await b.next('tile_owned');
  ok('B owned tile 0', own.tile === 0 && own.ownerId === jb.you);
  ok('gain positive', own.gain > 0);
  ok('remaining 19', own.remaining === 19);

  // A 也收到占领广播
  const ownA = await a.next('tile_owned');
  ok('A sees B ownership', ownA.ownerId === jb.you);

  // ---- 颜色回归：格子颜色必须来自占领者本人 ----
  ok('tile_owned carries ownerColorIdx', typeof own.ownerColorIdx === 'number');
  ok('tile_owned carries ownerColor', /^#[0-9a-f]{6}$/i.test(own.ownerColor || ''));
  ok('tile_owned carries ownerName', own.ownerName === '阿B');
  ok('A sees same color as B', ownA.ownerColor === own.ownerColor);

  // 棋盘快照里也带颜色（开局时无人占格，所以这里验证的是字段结构）
  const bdColor = bdB.tiles.find(t => t.i === 0);
  ok('board tile has color fields', 'ownerColor' in bdColor && 'ownerName' in bdColor);
  ok('unowned tile has null color', bdColor.owner === null && bdColor.ownerColor === null);

  // A 再答已被占领的格 → 无反应（不发 tile_owned / tile_miss）
  a.send({ type: 'answer', tile: 0, idx: q.answerIdx });
  await wait(300);
  ok('owned tile is locked', !a.q.some(m => m.type === 'tile_owned' && m.tile === 0));

  // ---- 翻盘三约束 ----
  // 1) 未满 15 秒（这里 400ms）不能抢
  a.q.length = 0;
  a.send({ type: 'pick_tile', tile: 0 });
  await wait(250);
  ok('steal blocked before cooldown', !a.q.some(m => m.type === 'tile_question'));

  // 2) 过了冷却可以抢
  await wait(400);
  a.send({ type: 'pick_tile', tile: 0 });
  const stealQ = await a.next('tile_question', 3000);
  ok('steal allowed after cooldown', stealQ.tile === 0 && stealQ.steal === true);

  // 3) 抢成功：所有权转移 + 标记 stolenOnce
  a.send({ type: 'answer', tile: 0, idx: stealQ.answerIdx });
  const st = await a.next('tile_stolen');
  ok('steal succeeded', st.tile === 0 && st.ownerId === ja.you && st.prevOwnerId === jb.you);
  ok('steal gives bonus', st.gain > 100);
  ok('victim penalised', st.penalty > 0);

  // 4) 被翻过的格子不能再次被抢
  await wait(700);
  b.send({ type: 'pick_tile', tile: 0 });
  await wait(400);
  ok('sealed tile cannot be stolen again', !b.q.some(m => m.type === 'tile_question' && m.tile === 0));

  // 5) 自己不能抢自己的格子
  await wait(500);
  a.send({ type: 'pick_tile', tile: 0 });
  await wait(300);
  ok('cannot steal own tile', !a.q.some(m => m.type === 'tile_question' && m.tile === 0));

  // 断线恢复：B 断开重连，房间和占领保留
  b.close();
  await wait(400);
  const b2 = await WS.connect(PORT, BASE);
  b2.send({ type: 'hello', name: '阿B', pid: jb.you, room: ja.code });
  const rb = await b2.next('restored');
  ok('B restored with pid', rb.you === jb.you);
  const bd2 = await b2.next('board');
  const t0 = bd2.tiles.find(t => t.i === 0);
  ok('tile 0 now owned by A (stolen)', t0.owner === ja.you);
  ok('tile 0 marked sealed', t0.stolenOnce === true);
  ok('stolen tile keeps owner color', /^#[0-9a-f]{6}$/i.test(t0.ownerColor || ''));
  ok('stolen tile color is A not B', t0.ownerColor !== own.ownerColor);

  // 占完剩下的 19 格 → gameover
  for (let i = 1; i < 20; i++) {
    b2.send({ type: 'pick_tile', tile: i });
    const qq = await b2.next('tile_question', 6000);
    b2.send({ type: 'answer', tile: i, idx: qq.answerIdx });
    await b2.next('tile_owned', 6000);
  }
  const over = await b2.next('gameover', 8000);
  ok('gameover delivered', Array.isArray(over.ranking) && over.ranking.length === 2);
  const winner = over.ranking[0];
  ok('B wins with 19 tiles', winner.id === jb.you && winner.tiles === 19);

  a.close(); b2.close();

  // ---- 三人混战：颜色必须互不相同 ----
  const c1 = await WS.connect(PORT, BASE);
  c1.send({ type: 'hello', name: '甲', mode: 'brawl' });
  const jc1 = await c1.next('joined');
  await c1.next('room');

  const c2 = await WS.connect(PORT, BASE);
  c2.send({ type: 'hello', name: '乙', room: jc1.code });
  const jc2 = await c2.next('joined');
  await c2.next('room');

  const c3 = await WS.connect(PORT, BASE);
  c3.send({ type: 'hello', name: '丙', room: jc1.code });
  const jc3 = await c3.next('joined');
  const room3 = await c3.next('room');

  const idxs = room3.players.map(p => p.colorIdx);
  ok('three players get distinct colors', new Set(idxs).size === 3);
  const hexes = room3.players.map(p => p.color);
  ok('three players get distinct hex colors', new Set(hexes).size === 3);

  c1.send({ type: 'start' });
  const b3 = await c1.next('board');
  ok('3-player board starts clean', b3.tiles.every(t => t.owner === null));

  // 每人各占一格，验证颜色归属正确
  const claim = async (ws, tile, myId) => {
    ws.send({ type: 'pick_tile', tile });
    const q = await ws.nextWhere(m => m.type === 'tile_question' && m.tile === tile, 6000);
    ws.send({ type: 'answer', tile, idx: q.answerIdx });
    return ws.nextWhere(m => m.type === 'tile_owned' && m.ownerId === myId, 6000);
  };
  const o1 = await claim(c1, 0, jc1.you);
  const o2 = await claim(c2, 1, jc2.you);
  const o3 = await claim(c3, 2, jc3.you);
  ok('three claims have three colors',
     new Set([o1.ownerColor, o2.ownerColor, o3.ownerColor]).size === 3);

  c1.close(); c2.close(); c3.close();
  srv.kill();

  console.log('');
  for (const p of pass) console.log('  PASS  ' + p);
  for (const f of fail) console.log('  FAIL  ' + f);
  console.log('');
  console.log(`  ${pass.length} passed, ${fail.length} failed`);
  process.exit(fail.length ? 1 : 0);
})().catch(err => {
  console.error('TEST ERROR:', err.message);
  process.exit(1);
});
