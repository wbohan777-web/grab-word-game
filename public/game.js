/**
 * 抢词房 · 占领战 - 游戏逻辑
 * 重构版：统一粒子引擎 + 性能优化 + 模块化架构
 */
(() => {
  'use strict';

  /* ==========================================
     工具函数
     ========================================== */
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  /* ==========================================
     全局状态
     ========================================== */
  const S = {
    ws: null,
    pid: sessionStorage.getItem('pid') || '',
    code: '',
    room: null,
    board: null,
    me: null,
    publicUrl: '',
    tunneled: false,
    modalTile: -1,
    lockUntil: {},
    modalGuard: 0,
    modalClosed: true,
    palettes: null
  };

  /* ==========================================
     统一粒子引擎 - Canvas 对象池
     ========================================== */
  class ParticleEngine {
    constructor() {
      this.canvas = document.createElement('canvas');
      this.canvas.id = 'particles';
      this.canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:55';
      document.body.appendChild(this.canvas);
      
      this.ctx = this.canvas.getContext('2d');
      this.particles = [];
      this.maxParticles = 500;
      this.raf = 0;
      
      this.resize();
      window.addEventListener('resize', () => this.resize());
    }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = innerWidth * dpr;
      this.canvas.height = innerHeight * dpr;
      this.canvas.style.width = innerWidth + 'px';
      this.canvas.style.height = innerHeight + 'px';
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // 碎片爆发
    burst(x, y, color, count = 16) {
      for (let i = 0; i < count && this.particles.length < this.maxParticles; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 3.5;
        const size = 4 + Math.random() * 5;
        
        this.particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1, // 初始向上
          size,
          color,
          life: 1,
          decay: 0.015 + Math.random() * 0.01,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.3,
          gravity: 0.15
        });
      }
      
      this.start();
    }

    // 光环扩散
    ring(x, y, color, radius = 50, duration = 600) {
      const startTime = performance.now();
      this.particles.push({
        type: 'ring',
        x, y, color,
        radius: 10,
        maxRadius: radius,
        startTime,
        duration,
        life: 1
      });
      this.start();
    }

    // 冲击波
    shockwave(x, y, color, power = 1) {
      const count = Math.floor(20 * power);
      for (let i = 0; i < count && this.particles.length < this.maxParticles; i++) {
        const angle = (i / count) * Math.PI * 2;
        const speed = 5 + power * 3;
        
        this.particles.push({
          type: 'wave',
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 3 + power * 2,
          color,
          life: 1,
          decay: 0.03
        });
      }
      this.start();
    }

    // 星星闪烁（装饰用）
    sparkle(x, y, color, count = 8) {
      for (let i = 0; i < count && this.particles.length < this.maxParticles; i++) {
        const angle = (i / count) * Math.PI * 2;
        const dist = 20 + Math.random() * 30;
        
        this.particles.push({
          type: 'sparkle',
          x: x + Math.cos(angle) * dist,
          y: y + Math.sin(angle) * dist,
          size: 2 + Math.random() * 3,
          color,
          life: 1,
          decay: 0.02 + Math.random() * 0.02
        });
      }
      this.start();
    }

    start() {
      if (!this.raf) {
        this.raf = requestAnimationFrame(() => this.update());
      }
    }

    update() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, innerWidth, innerHeight);

      const now = performance.now();
      
      // 更新并绘制所有粒子
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        
        if (p.type === 'ring') {
          // 光环
          const elapsed = now - p.startTime;
          const progress = Math.min(1, elapsed / p.duration);
          p.radius = p.maxRadius * progress;
          p.life = 1 - progress;
          
          if (p.life <= 0) {
            this.particles.splice(i, 1);
            continue;
          }
          
          ctx.strokeStyle = p.color;
          ctx.globalAlpha = p.life * 0.6;
          ctx.lineWidth = 3 + (1 - progress) * 3;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.stroke();
          
        } else if (p.type === 'wave') {
          // 冲击波粒子
          p.x += p.vx;
          p.y += p.vy;
          p.life -= p.decay;
          
          if (p.life <= 0) {
            this.particles.splice(i, 1);
            continue;
          }
          
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.life * 0.7;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          
        } else if (p.type === 'sparkle') {
          // 闪烁星星
          p.life -= p.decay;
          
          if (p.life <= 0) {
            this.particles.splice(i, 1);
            continue;
          }
          
          const alpha = p.life > 0.5 ? 1 : p.life * 2;
          ctx.fillStyle = p.color;
          ctx.globalAlpha = alpha * 0.8;
          ctx.shadowBlur = 8;
          ctx.shadowColor = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          
        } else {
          // 普通碎片
          p.x += p.vx;
          p.y += p.vy;
          p.vy += p.gravity;
          p.rotation += p.rotationSpeed;
          p.life -= p.decay;
          
          if (p.life <= 0) {
            this.particles.splice(i, 1);
            continue;
          }
          
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.life * 0.85;
          ctx.shadowBlur = 6;
          ctx.shadowColor = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
        }
      }
      
      ctx.globalAlpha = 1;
      
      // 继续动画或停止
      if (this.particles.length > 0) {
        this.raf = requestAnimationFrame(() => this.update());
      } else {
        this.raf = 0;
      }
    }

    clear() {
      this.particles = [];
      if (this.raf) {
        cancelAnimationFrame(this.raf);
        this.raf = 0;
      }
      this.ctx.clearRect(0, 0, innerWidth, innerHeight);
    }
  }

  const particles = new ParticleEngine();

  /* ==========================================
     震屏系统 - 创伤值模型
     ========================================== */
  const SHAKE = { trauma: 0, raf: 0, t0: 0 };

  function shakeAdd(amount) {
    SHAKE.trauma = Math.min(SHAKE.trauma + amount, 1.3);
    if (!SHAKE.raf) {
      SHAKE.t0 = performance.now();
      SHAKE.raf = requestAnimationFrame(shakeTick);
    }
  }

  function shakeTick() {
    const dt = 1 / 60;
    SHAKE.trauma *= Math.exp(-9 * dt);
    
    if (SHAKE.trauma < 0.004) {
      SHAKE.trauma = 0;
      SHAKE.raf = 0;
      document.documentElement.style.setProperty('--sx', '0');
      document.documentElement.style.setProperty('--sy', '0');
      return;
    }
    
    const t = (performance.now() - SHAKE.t0) / 1000;
    const tr = SHAKE.trauma;
    const mag = (tr * tr * 0.45 + tr * 0.12) * 6;
    const sx = Math.sin(t * 47) * mag + Math.sin(t * 71) * mag * 0.4;
    const sy = Math.sin(t * 53 + 1.7) * mag + Math.sin(t * 89) * mag * 0.35;
    
    document.documentElement.style.setProperty('--sx', sx.toFixed(2) + 'px');
    document.documentElement.style.setProperty('--sy', sy.toFixed(2) + 'px');
    
    SHAKE.raf = requestAnimationFrame(shakeTick);
  }

  /* ==========================================
     特效函数
     ========================================== */
  
  // 闪白
  function flash() {
    const f = $('flash');
    f.classList.remove('flash-on');
    void f.offsetWidth;
    f.classList.add('flash-on');
  }

  // 挤压拉伸
  function squash(el) {
    el.animate([
      { transform: 'scale(1,1)' },
      { transform: 'scale(1.35,.7)', offset: 0.35 },
      { transform: 'scale(.85,1.18)', offset: 0.65 },
      { transform: 'scale(1,1)' }
    ], { duration: 300, easing: 'ease-out' });
  }

  // 终结慢镜
  function slowFinish(el) {
    el.animate([
      { transform: 'scale(1)' },
      { transform: 'scale(1.35)' },
      { transform: 'scale(1)' }
    ], { duration: 900, easing: 'ease-out' });
  }

  /* ==========================================
     音效系统 - WebAudio
     ========================================== */
  let ac = null;

  function unlockAudio() {
    try {
      if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      
      // 播放极短静音激活上下文
      const o = ac.createOscillator();
      const g = ac.createGain();
      g.gain.value = 0.0001;
      o.connect(g).connect(ac.destination);
      o.start();
      o.stop(ac.currentTime + 0.01);
    } catch (e) {
      console.warn('Audio unlock failed:', e);
    }
    return ac;
  }

  function audio() {
    if (!ac) return unlockAudio();
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }

  // 基础音调
  function tone(freq, dur, type = 'sine', vol = 0.18, when = 0) {
    try {
      const a = audio();
      const t0 = a.currentTime + when;
      const o = a.createOscillator();
      const g = a.createGain();
      
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.012, dur * 0.3));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      
      o.connect(g).connect(a.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.02);
    } catch (e) {}
  }

  // 噪声爆发
  function noiseBurst(dur = 0.14, vol = 0.12, center = 2400, q = 1.2) {
    try {
      const a = audio();
      const t0 = a.currentTime;
      const len = Math.max(1, Math.floor(a.sampleRate * dur));
      const buf = a.createBuffer(1, len, a.sampleRate);
      const d = buf.getChannelData(0);
      
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      
      const src = a.createBufferSource();
      src.buffer = buf;
      
      const bp = a.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(center, t0);
      bp.frequency.exponentialRampToValueAtTime(Math.max(200, center * 0.35), t0 + dur);
      bp.Q.value = q;
      
      const g = a.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      
      src.connect(bp).connect(g).connect(a.destination);
      src.start(t0);
      src.stop(t0 + dur + 0.02);
    } catch (e) {}
  }

  // 答对音效 - 钟式泛音
  function ding(combo) {
    try {
      const step = Math.min(Math.max(combo - 1, 0), 36);
      const base = 520 * Math.pow(2, step / 24);
      const parts = [1, 2, 2.76, 5.4];
      const vols = [0.16, 0.10, 0.065, 0.04];
      const durs = [0.34, 0.24, 0.18, 0.13];
      
      parts.forEach((r, i) => tone(base * r, durs[i], 'sine', vols[i], i * 0.004));
      tone(base * 8, 0.09, 'triangle', 0.035, 0.006);
    } catch (e) {}
  }

  // 答错音效
  function thud() {
    try {
      const a = audio();
      const t0 = a.currentTime;
      const o = a.createOscillator();
      const g = a.createGain();
      
      o.type = 'square';
      o.frequency.setValueAtTime(210, t0);
      o.frequency.exponentialRampToValueAtTime(72, t0 + 0.16);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.14, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.19);
      
      o.connect(g).connect(a.destination);
      o.start(t0);
      o.stop(t0 + 0.21);
      
      noiseBurst(0.09, 0.05, 900, 0.9);
    } catch (e) {}
  }

  // 占领音效（别人的）
  function blip() {
    try {
      tone(392, 0.12, 'sine', 0.08);
      tone(294, 0.16, 'sine', 0.06, 0.05);
    } catch (e) {}
  }

  // 开局音效
  function startCue() {
    try {
      [523, 659, 784, 1047].forEach((f, i) => 
        tone(f, 0.22, 'triangle', 0.1, i * 0.07)
      );
    } catch (e) {}
  }

  // 结束音效
  function endCue() {
    try {
      [1047, 784, 659, 523].forEach((f, i) => 
        tone(f, 0.3, 'triangle', 0.1, i * 0.09)
      );
    } catch (e) {}
  }

  /* ==========================================
     伤害数字 & 连击显示
     ========================================== */
  let dmgSide = 1;

  function popDamage(el, text, color = '#ffffff', crit = false) {
    if (!el) return;
    
    const r = el.getBoundingClientRect();
    dmgSide *= -1;
    const jitter = (Math.random() * 34 + 8) * dmgSide;
    
    const d = document.createElement('div');
    d.className = 'dmg' + (crit ? ' crit' : '');
    d.textContent = text;
    d.style.left = (r.left + r.width / 2 + Math.random() * 20 - 10) + 'px';
    d.style.top = (r.top + r.height * 0.35) + 'px';
    d.style.color = color;
    d.style.fontSize = (crit ? 26 : 20) + 'px';
    
    document.body.appendChild(d);
    
    const fly = d.animate([
      { transform: `translate(-50%,-50%) translateX(0) scale(.4)`, opacity: 0, offset: 0 },
      { transform: `translate(-50%,-50%) translateX(${jitter * 0.35}px) scale(1.2)`, opacity: 1, offset: 0.14 },
      { transform: `translate(-50%,-50%) translateX(${jitter * 0.7}px) scale(1)`, opacity: 1, offset: 0.28 },
      { transform: `translate(-50%,-50%) translateX(${jitter}px) translateY(-60px) scale(1)`, opacity: 1, offset: 0.65 },
      { transform: `translate(-50%,-50%) translateX(${jitter * 1.1}px) translateY(-72px) scale(.85)`, opacity: 0, offset: 1 }
    ], { duration: 1000, easing: 'cubic-bezier(.2,.9,.3,1)' });
    
    fly.onfinish = () => d.remove();
  }

  function comboBadge(combo, anchorEl) {
    if (!combo || combo < 2 || !anchorEl) return;
    
    const r = anchorEl.getBoundingClientRect();
    const size = Math.min(22 + combo * 5, 54);
    const hue = (190 + combo * 16) % 360;
    
    const d = document.createElement('div');
    d.className = 'combo';
    d.textContent = combo + ' 连击';
    d.style.left = (r.left + r.width / 2) + 'px';
    d.style.top = (r.top - 6) + 'px';
    d.style.fontSize = size + 'px';
    d.style.color = `hsl(${hue} 100% 68%)`;
    
    document.body.appendChild(d);
    
    d.animate([
      { transform: 'translate(-50%,-50%) scale(.3) rotate(-12deg)', opacity: 0 },
      { transform: 'translate(-50%,-50%) scale(1.25) rotate(3deg)', opacity: 1, offset: 0.22 },
      { transform: 'translate(-50%,-50%) scale(1) rotate(0)', opacity: 1, offset: 0.45 },
      { transform: 'translate(-50%,-140%) scale(.9) rotate(0)', opacity: 0 }
    ], { duration: 900, easing: 'cubic-bezier(.2,1.4,.3,1)' }).onfinish = () => d.remove();
  }

  /* ==========================================
     拖尾系统
     ========================================== */
  const TRAIL = { pts: [], raf: 0, ctx: null, cv: null };

  function trailInit() {
    const cv = $('trail');
    if (!cv) return;
    
    TRAIL.cv = cv;
    TRAIL.ctx = cv.getContext('2d');
    
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = innerWidth * dpr;
      cv.height = innerHeight * dpr;
      cv.style.width = innerWidth + 'px';
      cv.style.height = innerHeight + 'px';
      TRAIL.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    
    resize();
    addEventListener('resize', resize);
    
    const push = e => {
      const t = e.touches ? e.touches[0] : e;
      TRAIL.pts.push({ x: t.clientX, y: t.clientY, t: performance.now() });
      if (TRAIL.pts.length > 26) TRAIL.pts.shift();
      if (!TRAIL.raf) TRAIL.raf = requestAnimationFrame(drawTrail);
    };
    
    addEventListener('pointermove', push, { passive: true });
    addEventListener('pointerdown', push, { passive: true });
  }

  function drawTrail() {
    const { ctx, cv } = TRAIL;
    if (!ctx) {
      TRAIL.raf = 0;
      return;
    }
    
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    const now = performance.now();
    
    TRAIL.pts = TRAIL.pts.filter(p => now - p.t < 260);
    
    if (TRAIL.pts.length > 1) {
      for (let i = 1; i < TRAIL.pts.length; i++) {
        const a = TRAIL.pts[i - 1];
        const b = TRAIL.pts[i];
        const age = (now - b.t) / 260;
        const alpha = Math.max(0, 1 - age) * 0.55;
        const w = Math.max(1, (1 - age) * 9);
        
        ctx.strokeStyle = `rgba(120,205,255,${alpha})`;
        ctx.lineWidth = w;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
    
    TRAIL.raf = TRAIL.pts.length ? requestAnimationFrame(drawTrail) : 0;
  }

  /* ==========================================
     UI 工具函数
     ========================================== */
  function toast(m) {
    const t = $('toast');
    t.textContent = m;
    t.classList.add('show');
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove('show'), 1800);
  }

  function show(v) {
    ['v-login', 'v-room', 'v-play', 'v-over'].forEach(x =>
      $(x).classList.toggle('hide', x !== v)
    );
  }

  /* ==========================================
     网络层
     ========================================== */
  function connect() {
    return new Promise((res, rej) => {
      let settled = false;
      const done = (ok, err) => {
        if (settled) return;
        settled = true;
        ok ? res(true) : rej(err || new Error('ws fail'));
      };
      
      let ws;
      try {
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(proto + '//' + location.host);
      } catch (e) {
        rej(e);
        return;
      }
      
      S.ws = ws;
      
      // 8 秒超时
      const guard = setTimeout(() => done(false, new Error('timeout')), 8000);
      
      ws.onopen = () => {
        clearTimeout(guard);
        done(true);
      };
      
      ws.onmessage = e => {
        try {
          handle(JSON.parse(e.data));
        } catch (err) {
          console.error('Message parse error:', err);
        }
      };
      
      ws.onerror = () => {
        clearTimeout(guard);
        done(false, new Error('error'));
      };
      
      ws.onclose = () => {
        clearTimeout(guard);
        done(false, new Error('closed'));
        if (S.code) {
          toast('连接断开，3 秒后重连…');
          setTimeout(reconnect, 3000);
        }
      };
    });
  }

  async function reconnect() {
    if (!S.code) return;
    try {
      await connect();
      send({
        type: 'hello',
        name: sessionStorage.getItem('name') || '',
        pid: S.pid,
        room: S.code
      });
    } catch (e) {
      console.error('Reconnect failed:', e);
    }
  }

  const send = o => {
    if (S.ws && S.ws.readyState === 1) {
      S.ws.send(JSON.stringify(o));
    }
  };

  /* ==========================================
     消息处理
     ========================================== */
  function handle(m) {
    if (m.type === 'joined' || m.type === 'restored') {
      S.pid = m.you;
      S.code = m.code;
      S.me = m.you;
      sessionStorage.setItem('pid', S.pid);
      show('v-room');
      if (m.type === 'restored') toast('已回到原房间');
      return;
    }
    
    if (m.type === 'room') {
      S.room = m;
      renderRoom(m);
      return;
    }
    
    if (m.type === 'board') {
      const wasPlaying = S.board && S.board.phase === 'playing';
      S.board = m;
      renderBoard(m);
      show('v-play');
      if (!wasPlaying) startCue();
      return;
    }
    
    if (m.type === 'tile_question') {
      openModal(m);
      return;
    }
    
    if (m.type === 'tile_owned') {
      onOwned(m);
      return;
    }
    
    if (m.type === 'tile_stolen') {
      onStolen(m);
      return;
    }
    
    if (m.type === 'tile_miss') {
      onMiss(m);
      return;
    }
    
    if (m.type === 'scores') {
      renderScores(m.players);
      return;
    }
    
    if (m.type === 'gameover') {
      endCue();
      renderOver(m.ranking);
      show('v-over');
      return;
    }
    
    if (m.type === 'error') {
      toast(m.message);
      return;
    }
  }

  /* ==========================================
     渲染函数
     ========================================== */
  function renderRoom(r) {
    $('room-code').textContent = r.code;
    const isHost = S.me === r.hostId;
    
    $('players').innerHTML = r.players.map(p => {
      const c = p.color || (r.colors ? r.colors[p.colorIdx] : '#888');
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 4px;border-bottom:1px solid #1e2a55">
        <span style="display:flex;align-items:center;gap:10px">
          <i class="dot" style="background:${c};box-shadow:0 0 12px ${c}"></i>
          <span style="color:${c};font-weight:700;font-size:15px">${esc(p.name)}</span>
          ${p.isHost ? '<span style="font-size:11px;opacity:.7;color:var(--gold)">房主</span>' : ''}
          ${p.id === S.me ? '<span style="font-size:11px;opacity:.7;color:var(--accent)">你</span>' : ''}
        </span>
        <span style="font-size:12px;color:${p.connected ? 'var(--success)' : 'var(--danger)'}">${p.connected ? '在线' : '掉线'}</span>
      </div>`;
    }).join('');
    
    $('btn-start').style.display = isHost ? '' : 'none';
    $('btn-start').disabled = r.players.length < 2;
    $('wait-hint').textContent = isHost ? '人到齐就开' : '等房主开始';
  }

  const SCORE_ROLL = { raf: 0, shown: {} };

  function renderScores(ps) {
    ps = ps || [];
    const me = ps.find(p => p.id === S.me);
    if (!me) return;
    
    $('scores').innerHTML = ps.map(p => {
      const c = p.color || (S.room && S.room.colors ? S.room.colors[p.colorIdx] : '#888');
      return `<span class="chip ${p.id === S.me ? 'me-chip' : ''}" data-pid="${p.id}" style="border-color:${c}66">
        <i class="dot" style="background:${c};box-shadow:0 0 10px ${c}"></i>
        ${esc(p.name)} <b>${p.score}</b>分
        <span style="color:${c};font-weight:800;margin-left:2px">${p.tiles}格</span>
        ${p.combo > 1 ? '<span style="color:#ffd166;margin-left:4px">×' + p.combo + '</span>' : ''}
      </span>`;
    }).join('');
    
    const remain = S.board ? S.board.total - ps.reduce((a, p) => a + p.tiles, 0) : 0;
    $('remain').textContent = '剩 ' + remain + ' 格';
    
    ps.forEach(p => {
      SCORE_ROLL.shown[p.id] = p.score;
    });
  }

  function renderBoard(b) {
    S.board = b;
    if (b.palettes) S.palettes = b.palettes;
    
    const board = $('board');
    board.style.gridTemplateColumns = `repeat(${b.cols},1fr)`;
    board.innerHTML = '';
    
    b.tiles.forEach(t => {
      const d = document.createElement('div');
      d.className = 'tile';
      d.dataset.i = t.i;
      
      if (!t.owner) {
        d.textContent = t.word;
      } else {
        const c = t.ownerColor || '#38bdf8';
        const g = t.ownerGlow || c;
        const e = t.ownerEdge || '#ffffff';
        
        d.classList.add('owned');
        d.style.setProperty('--c', c);
        d.style.setProperty('--g', g);
        d.style.setProperty('--e', e);
        d.innerHTML = `<span class="flag"></span><span class="tw">${esc(t.word)}</span>` +
                      `<span class="who">${esc(t.ownerName || '')}</span>`;
        
        if (t.stolenOnce) {
          d.classList.add('sealed');
        } else if (t.stealIn > 0) {
          d.classList.add('stealable');
          d.dataset.stealIn = t.stealIn;
        } else {
          d.classList.add('stealable', 'ready');
        }
      }
      
      d.onclick = () => onTileClick(d, t.i);
      board.appendChild(d);
    });
    
    renderScores(b.players);
    tickStealTimers();
  }

  let stealTimer = 0;

  function tickStealTimers() {
    clearInterval(stealTimer);
    stealTimer = setInterval(() => {
      const nodes = document.querySelectorAll('.tile[data-steal-in]');
      if (!nodes.length) {
        clearInterval(stealTimer);
        return;
      }
      
      nodes.forEach(n => {
        let v = Number(n.dataset.stealIn) - 500;
        if (v <= 0) {
          n.dataset.stealIn = '0';
          n.classList.add('ready');
          n.querySelectorAll('.cd').forEach(x => x.remove());
        } else {
          n.dataset.stealIn = String(v);
          let cd = n.querySelector('.cd');
          if (!cd) {
            cd = document.createElement('span');
            cd.className = 'cd';
            n.appendChild(cd);
          }
          cd.textContent = Math.ceil(v / 1000);
        }
      });
    }, 500);
  }

  function onTileClick(el, i) {
    if (!S.board || S.board.phase !== 'playing') return;
    
    const t = (S.board.tiles || []).find(x => x.i === i);
    if (!t) return;
    
    if ((S.lockUntil[i] || 0) > Date.now()) {
      el.classList.add('locked');
      return;
    }
    
    if (t.owner) {
      if (t.owner === S.me) return;
      if (t.stolenOnce) {
        toast('这格已经被翻过一次，锁定');
        return;
      }
      if (t.stealIn > 0) {
        toast(Math.ceil(t.stealIn / 1000) + ' 秒后才能翻盘');
        return;
      }
      el.classList.add('stealing');
      setTimeout(() => el.classList.remove('stealing'), 600);
    }
    
    S.modalTile = i;
    squash(el);
    send({ type: 'pick_tile', tile: i });
  }

  function openModal(q) {
    S.modalTile = q.tile;
    S.modalClosed = false;
    $('m-word').textContent = q.word;
    $('m-ipa').textContent = q.ipa ? '/' + q.ipa + '/' : '';
    
    const box = $('m-opts');
    box.innerHTML = '';
    
    const modal = $('modal');
    const theftBadge = $('m-steal');
    if (theftBadge) theftBadge.style.display = q.steal ? '' : 'none';
    modal.classList.toggle('is-steal', !!q.steal);
    
    q.options.forEach((o, idx) => {
      const b = document.createElement('div');
      b.className = 'opt';
      b.textContent = o;
      b.onclick = () => {
        if (b.dataset.sent) return;
        b.dataset.sent = '1';
        [...box.children].forEach(x => {
          if (x !== b) x.style.opacity = '.45';
        });
        b.style.borderColor = 'var(--accent)';
        send({ type: 'answer', tile: q.tile, idx });
        S.pendingCorrect = q.answerIdx;
        
        clearTimeout(S.modalGuard);
        S.modalGuard = setTimeout(() => {
          if (!S.modalClosed && S.modalTile === q.tile) {
            closeModal();
            toast('没等到回执，已关闭');
          }
        }, 2500);
      };
      box.appendChild(b);
    });
    
    modal.classList.remove('hide');
    modal.onclick = e => {
      if (e.target === modal) closeModal();
    };
  }

  function closeModal() {
    $('modal').classList.add('hide');
    $('modal').onclick = null;
    clearTimeout(S.modalGuard);
    S.modalClosed = true;
    S.modalTile = -1;
    S.pendingCorrect = undefined;
  }

  function onOwned(m) {
    const mine = m.ownerId === S.me;
    const iAmAnsweringThis = S.modalTile === m.tile;
    
    if (iAmAnsweringThis) {
      closeModal();
      if (!mine) {
        toast('这格被抢了');
        shakeAdd(0.25);
      }
    }
    
    const col = m.ownerColor || '#38bdf8';
    const glo = m.ownerGlow || col;
    const edg = m.ownerEdge || '#ffffff';
    const el = document.querySelector('.tile[data-i="' + m.tile + '"]');
    const isLast = m.remaining === 0;
    
    if (el) {
      el.classList.add('owned', 'pop');
      el.style.setProperty('--c', col);
      el.style.setProperty('--g', glo);
      el.style.setProperty('--e', edg);
      el.innerHTML = `<span class="flag"></span><span class="tw">${esc(el.textContent)}</span><span class="who">${esc(m.ownerName || '')}</span>`;
      
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      
      if (mine) {
        el.style.animationPlayState = 'paused';
        setTimeout(() => {
          el.style.animationPlayState = '';
          if (isLast) {
            slowFinish(el);
            shakeAdd(0.5);
            particles.ring(cx, cy, col, 80, 800);
          } else {
            flash();
            particles.burst(cx, cy, col, 16);
            particles.sparkle(cx, cy, col, 8);
            shakeAdd(0.14 + Math.min(m.combo, 6) * 0.03);
          }
          popDamage(el, '+' + m.gain, '#ffffff', m.combo >= 3);
          comboBadge(m.combo, el);
          ding(m.combo);
        }, 40);
      } else {
        if (isLast) {
          slowFinish(el);
        } else {
          particles.burst(cx, cy, col, 12);
          shakeAdd(0.06);
        }
        popDamage(el, '+' + m.gain, col, false);
        blip();
      }
      
      if (S.board && S.board.tiles) {
        const t = S.board.tiles.find(x => x.i === m.tile);
        if (t) {
          t.owner = m.ownerId;
          t.claimedAt = Date.now();
          t.ownerColorIdx = m.ownerColorIdx;
          t.ownerColor = col;
          t.ownerGlow = glo;
          t.ownerEdge = edg;
          t.ownerName = m.ownerName;
        }
      }
    }
    
    renderScores(m.players);
  }

  function onMiss(m) {
    thud();
    shakeAdd(0.35);
    S.lockUntil[m.tile] = Date.now() + m.lockMs;
    
    const el = document.querySelector('.tile[data-i="' + m.tile + '"]');
    if (el) {
      el.classList.add('locked');
      popDamage(el, '-20', '#f87171', false);
      setTimeout(() => el.classList.remove('locked'), m.lockMs);
    }
    
    if (typeof S.pendingCorrect === 'number') {
      [...$('m-opts').children].forEach((b, i) => {
        if (i !== S.pendingCorrect) b.classList.add('wrong');
        b.onclick = null;
      });
    }
    
    setTimeout(closeModal, 900);
    toast('答错了，这格锁 ' + Math.round(m.lockMs / 1000) + ' 秒');
  }

  function onStolen(m) {
    const iAmVictim = m.prevOwnerId === S.me;
    const iAmStealer = m.ownerId === S.me;
    const iAmAnsweringThis = S.modalTile === m.tile;
    const col = m.ownerColor || '#fbbf24';
    const glo = m.ownerGlow || col;
    const edg = m.ownerEdge || '#ffffff';
    const el = document.querySelector('.tile[data-i="' + m.tile + '"]');
    
    if (iAmAnsweringThis) closeModal();
    
    if (el) {
      el.classList.add('owned', 'stolen');
      el.style.setProperty('--c', col);
      el.style.setProperty('--g', glo);
      el.style.setProperty('--e', edg);
      
      const word = el.querySelector('.tw') ? el.querySelector('.tw').textContent : el.textContent;
      el.innerHTML = `<span class="flag"></span><span class="tw">${esc(word)}</span><span class="who">${esc(m.ownerName || '')}</span>`;
      
      el.animate([
        { transform: 'scale(1) rotate(0)' },
        { transform: 'scale(1.42) rotate(-7deg)', offset: 0.3 },
        { transform: 'scale(.93) rotate(5deg)', offset: 0.62 },
        { transform: 'scale(1) rotate(0)' }
      ], { duration: 560, easing: 'cubic-bezier(.2,1.5,.4,1)' });
      
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      
      if (iAmStealer) {
        flash();
        particles.burst(cx, cy, '#ffd166', 18);
        particles.burst(cx, cy, col, 16);
        particles.shockwave(cx, cy, '#ffd166', 1.2);
        particles.ring(cx, cy, col, 100, 1000);
        slowFinish(el);
        popDamage(el, '翻盘 +' + m.gain, '#ffd166', true);
        ding(9);
        shakeAdd(0.8);
      } else if (iAmVictim) {
        popDamage(el, '-' + m.penalty, '#f87171', true);
        thud();
        shakeAdd(0.95);
        toast('你的「' + word + '」被翻盘了');
      } else {
        particles.burst(cx, cy, '#ffd166', 12);
        popDamage(el, '翻盘', '#ffd166', false);
        blip();
      }
      
      if (S.board && S.board.tiles) {
        const t = S.board.tiles.find(x => x.i === m.tile);
        if (t) {
          t.owner = m.ownerId;
          t.claimedAt = Date.now();
          t.stolenOnce = true;
          t.ownerColorIdx = m.ownerColorIdx;
          t.ownerColor = col;
          t.ownerGlow = glo;
          t.ownerEdge = edg;
          t.ownerName = m.ownerName;
        }
      }
    }
    
    renderScores(m.players);
  }

  function renderOver(rk) {
    $('podium').innerHTML = rk.map(p => {
      const c = p.color || (S.room && S.room.colors ? S.room.colors[p.colorIdx] : '#888');
      const medal = ['🥇', '🥈', '🥉', '4️⃣'][p.rank - 1] || p.rank;
      return `<div class="rank ${p.rank === 1 ? 'first' : ''}">
        <span style="display:flex;align-items:center;gap:10px">
          <span style="font-size:20px">${medal}</span>
          <i class="dot" style="background:${c};box-shadow:0 0 12px ${c}"></i>
          <span style="color:${c};font-weight:700;font-size:15px">${esc(p.name)}</span>
          ${p.id === S.me ? '<span style="font-size:11px;opacity:.65;color:var(--accent)">你</span>' : ''}
        </span>
        <span style="text-align:right;font-size:13px;line-height:1.6">
          <b style="color:${c};font-size:18px">${p.tiles}</b> 格 · ${p.score} 分
          ${p.stealUsed ? '<br><span style="font-size:11px;color:#ffd166">翻盘 ' + p.stealUsed + ' 次</span>' : ''}
        </span>
      </div>`;
    }).join('');
    
    $('btn-again').style.display = (S.room && S.room.hostId === S.me) ? '' : 'none';
  }

  /* ==========================================
     初始化 & 事件绑定
     ========================================== */
  const urlRoom = new URLSearchParams(location.search).get('room') || '';
  
  if (urlRoom) {
    $('btn-duel').style.display = 'none';
    $('btn-brawl').style.display = 'none';
    const h = $('join-hint');
    h.style.display = 'block';
    h.textContent = '房间码 ' + urlRoom + '，填名字就进';
    $('btn-join').style.display = '';
  }
  
  $('btn-join').onclick = async () => {
    const name = $('nm').value.trim();
    if (!name) {
      toast('先填名字');
      return;
    }
    unlockAudio();
    sessionStorage.setItem('name', name);
    try {
      await connect();
    } catch (e) {
      toast('连不上服务器，刷新页面重试');
      return;
    }
    send({ type: 'hello', name, pid: S.pid, room: urlRoom.toUpperCase() });
  };
  
  const openRoom = async mode => {
    const name = $('nm').value.trim();
    if (!name) {
      toast('先填名字');
      return;
    }
    unlockAudio();
    sessionStorage.setItem('name', name);
    try {
      await connect();
    } catch (e) {
      toast('连不上服务器，刷新页面重试');
      return;
    }
    send({ type: 'hello', name, mode });
  };
  
  $('btn-duel').onclick = () => openRoom('duel');
  $('btn-brawl').onclick = () => openRoom('brawl');
  $('btn-start').onclick = () => send({ type: 'start' });
  $('btn-again').onclick = () => {
    send({ type: 'again' });
    show('v-room');
  };
  
  $('btn-share').onclick = async () => {
    if (!S.code) return;
    const base = S.publicUrl || (location.origin + location.pathname);
    const url = base + (S.publicUrl ? '/' : '') + '?room=' + S.code;
    try {
      await navigator.clipboard.writeText(url);
      toast('已复制，发群里');
    } catch {
      prompt('复制这个链接：', url);
    }
  };
  
  // 获取公网地址
  fetch('/api/config')
    .then(r => r.json())
    .then(j => {
      S.publicUrl = (j.publicUrl || '').replace(/\/+$/, '');
      S.tunneled = !!j.tunneled;
    })
    .catch(() => {});
  
  // 初始化拖尾
  trailInit();
  
  // 音频解锁
  addEventListener('pointerdown', function once() {
    unlockAudio();
    removeEventListener('pointerdown', once);
  }, { passive: true });
  
  // 回车快捷键
  $('nm').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      (urlRoom ? $('btn-join') : $('btn-brawl')).onclick();
    }
  });
})();
