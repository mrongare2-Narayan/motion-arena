// Motion Arena – shared engine: players, body features, drawing, sound.
export const W = 1280, H = 720;
export const COLORS = ['#22e3ff', '#ff4fa3'];
export const COLORS2 = ['#0a6a80', '#80244f'];
export const L = { nose: 0, ls: 11, rs: 12, le: 13, re: 14, lw: 15, rw: 16, li: 19, ri: 20, lh: 23, rh: 24, lk: 25, rk: 26, la: 27, ra: 28 };
const BONES = [[11, 13], [13, 15], [12, 14], [14, 16], [11, 12], [23, 24], [11, 23], [12, 24], [23, 25], [25, 27], [24, 26], [26, 28]];

export const now = () => performance.now() / 1000;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, v: Math.min(a.v, b.v) });

// distance from point p to segment ab
export function segDist(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
  let t = l2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export class Player {
  constructor(i) {
    this.i = i; this.color = COLORS[i]; this.color2 = COLORS2[i];
    this.lm = null; this.lastSeen = -99; this.f = null;
    this.vel = {}; this.prevHands = null; this.trail = { l: [], r: [] };
    this.base = null; this.adapt = false;
  }
  get present() { return this.lm && now() - this.lastSeen < 0.7; }
  // pts: flat ints [x,y,v]*33, x/y in 0..1000 (already mirrored)
  feed(pts) {
    const t = now();
    const raw = [];
    for (let k = 0; k < 33; k++) raw.push({ x: pts[k * 3] / 1000 * W, y: pts[k * 3 + 1] / 1000 * H, v: pts[k * 3 + 2] / 100 });
    const dt = Math.max(0.016, t - this.lastSeen);
    if (!this.lm || dt > 0.7) this.lm = raw;
    else {
      const a = 0.65;
      this.lm = this.lm.map((p, k) => ({ x: lerp(p.x, raw[k].x, a), y: lerp(p.y, raw[k].y, a), v: raw[k].v }));
    }
    // hand velocities
    const hands = { l: this.lm[L.lw], r: this.lm[L.rw] };
    if (this.prevHands && dt < 0.5) {
      for (const s of ['l', 'r']) {
        const vx = (hands[s].x - this.prevHands[s].x) / dt, vy = (hands[s].y - this.prevHands[s].y) / dt;
        const o = this.vel[s] || { x: 0, y: 0 };
        this.vel[s] = { x: lerp(o.x, vx, 0.6), y: lerp(o.y, vy, 0.6) };
      }
    }
    this.prevHands = { l: { ...hands.l }, r: { ...hands.r } };
    for (const s of ['l', 'r']) { this.trail[s].push({ ...hands[s], t }); while (this.trail[s].length > 10) this.trail[s].shift(); }
    this.lastSeen = t;
    this.compute();
  }
  compute() {
    const m = this.lm, g = (k) => m[k];
    const sm = mid(g(11), g(12)), hm = mid(g(23), g(24));
    const T = Math.max(30, dist(sm, hm));
    const f = this.f = {
      T: this.f ? lerp(this.f.T, T, 0.2) : T, sm, hm, nose: g(0), sw: Math.abs(g(11).x - g(12).x),
      lw: g(15), rw: g(16), le: g(13), re: g(14), lk: g(25), rk: g(26), la: g(27), ra: g(28),
      cx: (sm.x + hm.x) / 2,
    };
    if (!this.base) this.calibrate(1);
    const b = this.base;
    f.jump = (b.hipY - hm.y) / f.T;      // >0 when higher than baseline
    f.squat = (hm.y - b.hipY) / f.T;     // >0 when lower than baseline
    f.duck = Math.max(f.squat, (sm.y - b.shY) / f.T);
    f.shift = (f.cx - b.x) / f.T;        // sideways step (screen space)
    f.tilt = (sm.x - hm.x) / f.T;        // torso lean
    if (this.adapt && Math.abs(f.jump) < 0.08) { b.hipY = lerp(b.hipY, hm.y, 0.01); b.shY = lerp(b.shY, sm.y, 0.01); }
  }
  calibrate(a = 0.2) {
    if (!this.f) return;
    const f = this.f;
    if (!this.base || a >= 1) this.base = { hipY: f.hm.y, shY: f.sm.y, x: f.cx };
    else { const b = this.base; b.hipY = lerp(b.hipY, f.hm.y, a); b.shY = lerp(b.shY, f.sm.y, a); b.x = lerp(b.x, f.cx, a); }
  }
  hands() { return [this.lm[L.lw], this.lm[L.rw]]; }
  handSpeed(s) { const v = this.vel[s]; return v ? Math.hypot(v.x, v.y) : 0; }
  vis(...ks) { return ks.every(k => this.lm[k].v > 0.35); }
}

// ---------- pose checks (used by Shape Gate & Yoga) ----------
export const POSES = {
  armsUp: { name: 'Arms Up', hi: 'हाथ ऊपर', check: (p) => { const f = p.f; return f.lw.y < f.nose.y - 0.1 * f.T && f.rw.y < f.nose.y - 0.1 * f.T; } },
  tpose: { name: 'T-Pose', hi: 'हाथ फैलाओ', check: (p) => { const f = p.f; return Math.abs(f.lw.y - f.sm.y) < 0.5 * f.T && Math.abs(f.rw.y - f.sm.y) < 0.5 * f.T && Math.abs(f.lw.x - f.rw.x) > 2.2 * f.T; } },
  squat: { name: 'Squat', hi: 'बैठो', check: (p) => p.f.squat > 0.28 },
  leanL: { name: 'Lean Left', hi: 'बाएँ झुको', check: (p) => p.f.tilt < -0.28 },
  leanR: { name: 'Lean Right', hi: 'दाएँ झुको', check: (p) => p.f.tilt > 0.28 },
  oneLeg: { name: 'One Leg', hi: 'एक पैर पर', check: (p) => { const f = p.f; if (!p.vis(25, 26)) return false; return Math.abs(f.lk.y - f.rk.y) > 0.3 * f.T || (p.vis(27, 28) && Math.abs(f.la.y - f.ra.y) > 0.35 * f.T); } },
  star: { name: 'Star', hi: 'तारा बनो', check: (p) => { const f = p.f; const legs = !p.vis(27, 28) || Math.abs(f.la.x - f.ra.x) > 0.95 * f.T; return f.lw.y < f.sm.y && f.rw.y < f.sm.y && Math.abs(f.lw.x - f.rw.x) > 1.6 * f.T && legs; } },
  warrior: { name: 'Warrior', hi: 'योद्धा', check: (p) => { const f = p.f; const legs = !p.vis(27, 28) || Math.abs(f.la.x - f.ra.x) > 0.95 * f.T; return POSES.tpose.check(p) && legs; } },
  chair: { name: 'Chair', hi: 'कुर्सी आसन', check: (p) => { const f = p.f; return f.squat > 0.18 && f.lw.y < f.sm.y && f.rw.y < f.sm.y; } },
  handsHead: { name: 'Hands on Head', hi: 'सिर पर हाथ', check: (p) => { const f = p.f; return dist(f.lw, f.nose) < 0.75 * f.T && dist(f.rw, f.nose) < 0.75 * f.T && f.lw.y < f.sm.y && f.rw.y < f.sm.y; } },
};
// stick-figure templates (unit space: x -1..1, y 0 (head) .. 3.4 (feet))
const TPL_BASE = { head: [0, 0.25], ls: [-0.4, 0.75], rs: [0.4, 0.75], le: [-0.5, 1.4], re: [0.5, 1.4], lw: [-0.55, 2.0], rw: [0.55, 2.0], lh: [-0.28, 1.8], rh: [0.28, 1.8], lk: [-0.3, 2.6], rk: [0.3, 2.6], la: [-0.3, 3.4], ra: [0.3, 3.4] };
export const TEMPLATES = {
  armsUp: { le: [-0.5, 0.15], re: [0.5, 0.15], lw: [-0.45, -0.45], rw: [0.45, -0.45] },
  tpose: { le: [-1.0, 0.75], re: [1.0, 0.75], lw: [-1.6, 0.75], rw: [1.6, 0.75] },
  squat: { head: [0, 1.0], ls: [-0.4, 1.5], rs: [0.4, 1.5], le: [-0.75, 1.7], re: [0.75, 1.7], lw: [-0.6, 1.4], rw: [0.6, 1.4], lh: [-0.3, 2.5], rh: [0.3, 2.5], lk: [-0.8, 2.6], rk: [0.8, 2.6], la: [-0.45, 3.4], ra: [0.45, 3.4] },
  leanL: { head: [-0.75, 0.4], ls: [-0.9, 0.95], rs: [-0.15, 0.7], le: [-1.2, 0.3], re: [-0.2, 0.0], lw: [-1.35, -0.3], rw: [-0.6, -0.4] },
  leanR: { head: [0.75, 0.4], rs: [0.9, 0.95], ls: [0.15, 0.7], re: [1.2, 0.3], le: [0.2, 0.0], rw: [1.35, -0.3], lw: [0.6, -0.4] },
  oneLeg: { lk: [-0.15, 2.3], la: [0.1, 2.75], le: [-0.9, 0.9], re: [0.9, 0.9], lw: [-1.3, 0.6], rw: [1.3, 0.6] },
  star: { le: [-0.9, 0.2], re: [0.9, 0.2], lw: [-1.4, -0.35], rw: [1.4, -0.35], lk: [-0.7, 2.6], rk: [0.7, 2.6], la: [-1.1, 3.4], ra: [1.1, 3.4] },
  warrior: { le: [-1.0, 0.75], re: [1.0, 0.75], lw: [-1.6, 0.75], rw: [1.6, 0.75], lh: [-0.3, 1.9], rh: [0.3, 1.9], lk: [-0.9, 2.5], rk: [0.8, 2.7], la: [-1.3, 3.4], ra: [1.1, 3.4] },
  chair: { head: [0, 0.8], ls: [-0.4, 1.3], rs: [0.4, 1.3], le: [-0.45, 0.7], re: [0.45, 0.7], lw: [-0.4, 0.1], rw: [0.4, 0.1], lh: [-0.3, 2.3], rh: [0.3, 2.3], lk: [-0.55, 2.5], rk: [0.55, 2.5], la: [-0.35, 3.4], ra: [0.35, 3.4] },
  handsHead: { le: [-0.9, 0.2], re: [0.9, 0.2], lw: [-0.2, -0.1], rw: [0.2, -0.1] },
};
export function drawTemplate(g, name, cx, top, h, color, lw = 10) {
  const t = { ...TPL_BASE, ...(TEMPLATES[name] || {}) }, s = h / 3.7;
  const P = (k) => [cx + t[k][0] * s, top + (t[k][1] + 0.3) * s];
  g.save(); g.strokeStyle = color; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
  const line = (...ks) => { g.beginPath(); ks.forEach((k, i) => { const [x, y] = P(k); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); };
  line('lw', 'le', 'ls', 'rs', 're', 'rw'); line('ls', 'lh', 'rh', 'rs'); line('lh', 'lk', 'la'); line('rh', 'rk', 'ra');
  const [hx, hy] = P('head'); g.fillStyle = color; g.beginPath(); g.arc(hx, hy, s * 0.3, 0, 7); g.fill();
  g.restore();
}

// ---------- avatar drawing ----------
// map: (pt)=>({x,y}); default is screen space.
export function drawAvatar(g, p, opt = {}) {
  if (!p.lm) return;
  const map = opt.map || ((q) => q), m = p.lm.map(map), T = p.f.T * (opt.scale || 1);
  const col = opt.color || p.color, alpha = opt.alpha ?? 1;
  g.save(); g.globalAlpha = alpha; g.lineCap = 'round'; g.lineJoin = 'round';
  // torso fill
  g.fillStyle = opt.fill || p.color2;
  g.beginPath(); [11, 12, 24, 23].forEach((k, i) => i ? g.lineTo(m[k].x, m[k].y) : g.moveTo(m[k].x, m[k].y)); g.closePath(); g.fill();
  for (const pass of [0, 1]) {
    g.strokeStyle = pass ? col : 'rgba(0,0,0,0.35)';
    g.lineWidth = Math.max(4, T * (pass ? 0.16 : 0.24));
    for (const [a, b] of BONES) {
      if (p.lm[a].v < 0.2 || p.lm[b].v < 0.2) continue;
      g.beginPath(); g.moveTo(m[a].x, m[a].y); g.lineTo(m[b].x, m[b].y); g.stroke();
    }
  }
  // hands
  g.fillStyle = '#fff';
  for (const k of [15, 16]) { g.beginPath(); g.arc(m[k].x, m[k].y, Math.max(5, T * 0.12), 0, 7); g.fill(); }
  // head
  const hd = m[0], r = Math.max(10, T * 0.3);
  g.fillStyle = col; g.beginPath(); g.arc(hd.x, hd.y, r, 0, 7); g.fill();
  g.fillStyle = '#111'; // eyes
  g.beginPath(); g.arc(hd.x - r * 0.35, hd.y - r * 0.1, r * 0.13, 0, 7); g.arc(hd.x + r * 0.35, hd.y - r * 0.1, r * 0.13, 0, 7); g.fill();
  if (opt.label) txt(g, opt.label, hd.x, hd.y - r - 14, Math.max(16, r * 0.8), col);
  g.restore();
}
// Draw a player's live pose scaled into a box (for runner / race characters).
export function drawPoseInBox(g, p, cx, footY, height, opt = {}) {
  if (!p.lm || !p.f) return;
  const f = p.f, s = height / (3.4 * f.T), base = p.base || { hipY: f.hm.y };
  const hipY = footY - 1.75 * f.T * s + (f.hm.y - base.hipY) * s * (opt.jumpBoost || 1);
  const map = (q) => ({ x: cx + (q.x - f.hm.x) * s, y: hipY + (q.y - f.hm.y) * s });
  drawAvatar(g, p, { ...opt, map, scale: s });
}

// ---------- drawing helpers ----------
export function txt(g, s, x, y, size = 32, color = '#fff', align = 'center', weight = '800') {
  g.font = `${weight} ${size}px system-ui, "Noto Sans", "Noto Sans Devanagari", sans-serif`;
  g.textAlign = align; g.textBaseline = 'middle';
  g.lineWidth = Math.max(3, size / 8); g.strokeStyle = 'rgba(0,0,0,0.55)'; g.strokeText(s, x, y);
  g.fillStyle = color; g.fillText(s, x, y);
}
export function rrect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
export function emoji(g, e, x, y, size) {
  g.font = `${size}px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000'; g.fillText(e, x, y);
}
export function bg(g, top, bot) {
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, top); gr.addColorStop(1, bot);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
}

// ---------- particles & floating text ----------
export class FX {
  constructor() { this.p = []; this.t = []; }
  burst(x, y, color, n = 14, sp = 380) {
    for (let i = 0; i < n; i++) { const a = rand(0, 6.28), v = rand(sp * 0.3, sp); this.p.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 100, life: rand(0.4, 0.9), c: color, r: rand(3, 8) }); }
  }
  text(s, x, y, color = '#fff', size = 40) { this.t.push({ s, x, y, color, size, life: 1 }); }
  update(dt) {
    for (const q of this.p) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 900 * dt; q.life -= dt; }
    this.p = this.p.filter(q => q.life > 0);
    for (const q of this.t) { q.y -= 60 * dt; q.life -= dt; }
    this.t = this.t.filter(q => q.life > 0);
  }
  draw(g) {
    for (const q of this.p) { g.globalAlpha = clamp(q.life * 2, 0, 1); g.fillStyle = q.c; g.beginPath(); g.arc(q.x, q.y, q.r, 0, 7); g.fill(); }
    g.globalAlpha = 1;
    for (const q of this.t) { g.globalAlpha = clamp(q.life * 1.5, 0, 1); txt(g, q.s, q.x, q.y, q.size, q.color); }
    g.globalAlpha = 1;
  }
}

// ---------- sound ----------
let AC = null;
export function unlockAudio() {
  try { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (e) { }
}
function tone(freq, dur, type = 'sine', vol = 0.15, slide = 0, delay = 0) {
  if (!AC || AC.state !== 'running') return;
  const t0 = AC.currentTime + delay, o = AC.createOscillator(), gn = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  gn.gain.setValueAtTime(vol, t0); gn.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(gn); gn.connect(AC.destination); o.start(t0); o.stop(t0 + dur + 0.02);
}
export function sfx(name) {
  switch (name) {
    case 'coin': tone(880, 0.08, 'square', 0.08); tone(1320, 0.12, 'square', 0.08, 0, 0.07); break;
    case 'hit': tone(200, 0.3, 'sawtooth', 0.18, -150); break;
    case 'pop': tone(600, 0.08, 'sine', 0.2, 500); break;
    case 'slice': tone(1200, 0.12, 'triangle', 0.12, -800); break;
    case 'jump': tone(300, 0.18, 'square', 0.08, 400); break;
    case 'rep': tone(660, 0.1, 'triangle', 0.15); tone(990, 0.12, 'triangle', 0.12, 0, 0.08); break;
    case 'good': [523, 659, 784].forEach((f, i) => tone(f, 0.15, 'triangle', 0.13, 0, i * 0.08)); break;
    case 'bad': tone(180, 0.35, 'square', 0.12, -60); break;
    case 'tick': tone(1000, 0.05, 'square', 0.06); break;
    case 'go': tone(1400, 0.3, 'square', 0.1); break;
    case 'boom': tone(120, 0.5, 'sawtooth', 0.22, -80); break;
    case 'win': [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.14, 0, i * 0.12)); break;
    case 'select': tone(740, 0.08, 'sine', 0.15); break;
  }
}
