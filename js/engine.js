// Motion Arena – shared engine: settings, players, body features, drawing, sound.
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
// angle at b (degrees) formed by a-b-c
export function angle(a, b, c) {
  const x1 = a.x - b.x, y1 = a.y - b.y, x2 = c.x - b.x, y2 = c.y - b.y;
  const d = Math.hypot(x1, y1) * Math.hypot(x2, y2) || 1;
  return Math.acos(clamp((x1 * x2 + y1 * y2) / d, -1, 1)) * 57.2958;
}

// ---------- settings (saved on the TV) ----------
const DEF = { sens: 1, quality: 'auto', dwell: 1.3, sound: true, voice: true, names: ['Player 1', 'Player 2'] };
export const S = (() => { try { return { ...DEF, ...JSON.parse(localStorage.getItem('ma_settings') || '{}') }; } catch (e) { return { ...DEF }; } })();
S.hiQ = S.quality !== 'low';
export function saveSettings() { try { const { hiQ, ...o } = S; localStorage.setItem('ma_settings', JSON.stringify(o)); } catch (e) { } }
export const nameOf = (i) => (S.names[i] || '').trim() || 'Player ' + (i + 1);

// distance from point p to segment ab
export function segDist(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
  let t = l2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

// One-Euro style adaptive smoothing: steady when still (no jitter), fast when moving (no lag).
function oneEuro(st, raw, dt) {
  const fc = (c) => 1 / (1 + 1 / (2 * Math.PI * c * dt));
  const dx = (raw - st.x) / dt; st.d = lerp(st.d, dx, fc(1));
  const cut = 1.4 * S.sens + 0.006 * S.sens * Math.abs(st.d);
  st.x = lerp(st.x, raw, fc(cut));
  return st.x;
}

export class Player {
  constructor(i) {
    this.i = i; this.color = COLORS[i]; this.color2 = COLORS2[i];
    this.lm = null; this.lastSeen = -99; this.f = null; this.flt = null;
    this.vel = {}; this.prevHands = null; this.trail = { l: [], r: [] };
    this.base = null; this.adapt = false;
  }
  get name() { return nameOf(this.i); }
  get present() { return this.lm && now() - this.lastSeen < 0.7; }
  // pts: flat ints [x,y,v]*33, x/y in 0..1000 (already mirrored)
  feed(pts) {
    const t = now();
    const dt = clamp(t - this.lastSeen, 0.016, 1);
    if (!this.lm || dt > 0.7) {
      this.lm = []; this.flt = [];
      for (let k = 0; k < 33; k++) {
        const x = pts[k * 3] / 1000 * W, y = pts[k * 3 + 1] / 1000 * H;
        this.lm.push({ x, y, v: pts[k * 3 + 2] / 100 }); this.flt.push({ x: { x, d: 0 }, y: { x: y, d: 0 } });
      }
    } else {
      for (let k = 0; k < 33; k++) {
        const q = this.lm[k], fl = this.flt[k];
        q.x = oneEuro(fl.x, pts[k * 3] / 1000 * W, dt); q.y = oneEuro(fl.y, pts[k * 3 + 1] / 1000 * H, dt); q.v = pts[k * 3 + 2] / 100;
      }
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
    this.prevHands = { l: { x: hands.l.x, y: hands.l.y }, r: { x: hands.r.x, y: hands.r.y } };
    for (const s of ['l', 'r']) { const tr = this.trail[s]; tr.push({ x: hands[s].x, y: hands[s].y, t }); if (tr.length > 10) tr.shift(); }
    this.lastSeen = t;
    this.compute();
  }
  compute() {
    const m = this.lm, g = (k) => m[k];
    const sm = mid(g(11), g(12)), hm = mid(g(23), g(24));
    const T = Math.max(30, dist(sm, hm));
    const f = this.f = {
      T: this.f ? lerp(this.f.T, T, 0.2) : T, sm, hm, nose: g(0), sw: Math.abs(g(11).x - g(12).x),
      lw: g(15), rw: g(16), le: g(13), re: g(14), ls: g(11), rs: g(12), lh: g(23), rh: g(24), lk: g(25), rk: g(26), la: g(27), ra: g(28),
      cx: (sm.x + hm.x) / 2,
    };
    if (!this.base) this.calibrate(1);
    const b = this.base, s = S.sens;
    f.jump = (b.hipY - hm.y) / f.T * s;      // >0 when higher than baseline
    f.squat = (hm.y - b.hipY) / f.T * s;     // >0 when lower than baseline
    f.duck = Math.max(f.squat, (sm.y - b.shY) / f.T * s);
    f.shift = (f.cx - b.x) / f.T * s;        // sideways step (screen space)
    f.tilt = (sm.x - hm.x) / f.T * s;        // torso lean
    f.horiz = Math.abs(sm.x - hm.x) > 1.4 * Math.abs(sm.y - hm.y); // lying / plank
    if (this.adapt && Math.abs(f.jump) < 0.08) { b.hipY = lerp(b.hipY, hm.y, 0.01); b.shY = lerp(b.shY, sm.y, 0.01); }
  }
  calibrate(a = 0.2) {
    if (!this.f) return;
    const f = this.f;
    if (!this.base || a >= 1) this.base = { hipY: f.hm.y, shY: f.sm.y, x: f.cx, T: f.T };
    else { const b = this.base; b.hipY = lerp(b.hipY, f.hm.y, a); b.shY = lerp(b.shY, f.sm.y, a); b.x = lerp(b.x, f.cx, a); b.T = lerp(b.T || f.T, f.T, a); }
  }
  hands() { return [this.lm[L.lw], this.lm[L.rw]]; }
  handSpeed(s) { const v = this.vel[s]; return v ? Math.hypot(v.x, v.y) * S.sens : 0; }
  vis(...ks) { return ks.every(k => this.lm[k].v > 0.35); }
}

// ---------- pose checks (Shape Gate, Yoga, Exercise) ----------
const up = (f) => f.lw.y < f.sm.y && f.rw.y < f.sm.y;
const legsWide = (p, k = 0.95) => !p.vis(27, 28) || Math.abs(p.f.la.x - p.f.ra.x) > k * p.f.T;
export const POSES = {
  armsUp: { name: 'Arms Up', hi: 'हाथ ऊपर', check: (p) => { const f = p.f; return f.lw.y < f.nose.y - 0.1 * f.T && f.rw.y < f.nose.y - 0.1 * f.T; } },
  tpose: { name: 'T-Pose', hi: 'हाथ फैलाओ', check: (p) => { const f = p.f; return Math.abs(f.lw.y - f.sm.y) < 0.5 * f.T && Math.abs(f.rw.y - f.sm.y) < 0.5 * f.T && Math.abs(f.lw.x - f.rw.x) > 2.2 * f.T; } },
  squat: { name: 'Squat', hi: 'बैठो', check: (p) => p.f.squat > 0.28 },
  leanL: { name: 'Lean Left', hi: 'बाएँ झुको', check: (p) => p.f.tilt < -0.28 },
  leanR: { name: 'Lean Right', hi: 'दाएँ झुको', check: (p) => p.f.tilt > 0.28 },
  oneLeg: { name: 'One Leg', hi: 'एक पैर पर', check: (p) => { const f = p.f; if (!p.vis(25, 26)) return false; return Math.abs(f.lk.y - f.rk.y) > 0.3 * f.T || (p.vis(27, 28) && Math.abs(f.la.y - f.ra.y) > 0.35 * f.T); } },
  star: { name: 'Star', hi: 'तारा बनो', check: (p) => { const f = p.f; return up(f) && Math.abs(f.lw.x - f.rw.x) > 1.6 * f.T && legsWide(p); } },
  warrior: { name: 'Warrior', hi: 'वीरभद्रासन', check: (p) => POSES.tpose.check(p) && legsWide(p) },
  chair: { name: 'Chair', hi: 'उत्कटासन', check: (p) => p.f.squat > 0.18 && up(p.f) },
  handsHead: { name: 'Hands on Head', hi: 'सिर पर हाथ', check: (p) => { const f = p.f; return dist(f.lw, f.nose) < 0.75 * f.T && dist(f.rw, f.nose) < 0.75 * f.T && up(f); } },
  mountain: { name: 'Mountain', hi: 'ताड़ासन', check: (p) => POSES.armsUp.check(p) && Math.abs(p.f.lw.x - p.f.rw.x) < 1.1 * p.f.T },
  tree: { name: 'Tree', hi: 'वृक्षासन', check: (p) => POSES.oneLeg.check(p) && up(p.f) },
  prayer: { name: 'Prayer', hi: 'प्रणामासन', check: (p) => { const f = p.f; return dist(f.lw, f.rw) < 0.4 * f.T && f.lw.y > f.sm.y - 0.3 * f.T && f.lw.y < f.sm.y + 0.9 * f.T; } },
  fold: { name: 'Forward Fold', hi: 'उत्तानासन', check: (p) => { const f = p.f; return f.lw.y > f.hm.y + 0.5 * f.T && f.rw.y > f.hm.y + 0.5 * f.T && f.nose.y > (p.base ? p.base.shY : f.sm.y) + 0.2 * f.T; } },
  triangle: { name: 'Triangle', hi: 'त्रिकोणासन', check: (p) => { const f = p.f; const hiH = Math.min(f.lw.y, f.rw.y), loH = Math.max(f.lw.y, f.rw.y); return legsWide(p, 1.1) && Math.abs(f.tilt) > 0.25 && hiH < f.sm.y && loH > f.hm.y; } },
  plank: { name: 'Plank', hi: 'प्लैंक', check: (p) => p.f.horiz },
};

// ---------- stick-figure templates (unit space: x -1..1, y 0 (head) .. 3.4 (feet)) ----------
const TPL_BASE = { head: [0, 0.25], ls: [-0.4, 0.75], rs: [0.4, 0.75], le: [-0.5, 1.4], re: [0.5, 1.4], lw: [-0.55, 2.0], rw: [0.55, 2.0], lh: [-0.28, 1.8], rh: [0.28, 1.8], lk: [-0.3, 2.6], rk: [0.3, 2.6], la: [-0.3, 3.4], ra: [0.3, 3.4] };
const HORIZ_UP = { head: [-1.6, 2.3], ls: [-1.2, 2.5], rs: [-1.2, 2.5], le: [-1.2, 2.95], re: [-1.2, 2.95], lw: [-1.2, 3.4], rw: [-1.2, 3.4], lh: [0.25, 2.75], rh: [0.25, 2.75], lk: [1.0, 2.95], rk: [1.0, 2.95], la: [1.75, 3.15], ra: [1.75, 3.15] };
export const TEMPLATES = {
  base: {},
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
  mountain: { le: [-0.4, 0.1], re: [0.4, 0.1], lw: [-0.15, -0.5], rw: [0.15, -0.5], lk: [-0.15, 2.6], rk: [0.15, 2.6], la: [-0.12, 3.4], ra: [0.12, 3.4] },
  tree: { le: [-0.45, 0.1], re: [0.45, 0.1], lw: [-0.1, -0.5], rw: [0.1, -0.5], lk: [-0.75, 2.35], la: [-0.05, 2.45] },
  prayer: { le: [-0.6, 1.3], re: [0.6, 1.3], lw: [-0.06, 1.0], rw: [0.06, 1.0] },
  fold: { head: [0, 1.75], ls: [-0.4, 1.55], rs: [0.4, 1.55], le: [-0.45, 2.3], re: [0.45, 2.3], lw: [-0.35, 3.1], rw: [0.35, 3.1] },
  triangle: { la: [-1.1, 3.4], ra: [1.1, 3.4], lk: [-0.7, 2.6], rk: [0.7, 2.6], head: [0.85, 1.15], ls: [0.2, 1.0], rs: [0.8, 1.5], re: [0.95, 2.2], rw: [1.1, 2.95], le: [-0.05, 0.4], lw: [-0.3, -0.25] },
  kneeL: { lk: [-0.3, 1.95], la: [-0.3, 2.65], le: [-0.75, 1.2], lw: [-0.4, 0.85], re: [0.7, 1.35], rw: [0.75, 1.9] },
  kneeR: { rk: [0.3, 1.95], ra: [0.3, 2.65], re: [0.75, 1.2], rw: [0.4, 0.85], le: [-0.7, 1.35], lw: [-0.75, 1.9] },
  crunchL: { le: [-0.15, 1.35], lw: [-0.3, 0.2], re: [0.85, 0.3], rw: [0.3, 0.1], rk: [-0.05, 1.75], ra: [0.25, 2.5], head: [-0.1, 0.35] },
  crunchR: { re: [0.15, 1.35], rw: [0.3, 0.2], le: [-0.85, 0.3], lw: [-0.3, 0.1], lk: [0.05, 1.75], la: [-0.25, 2.5], head: [0.1, 0.35] },
  punchL: { le: [-1.0, 0.75], lw: [-1.65, 0.75], re: [0.6, 1.25], rw: [0.3, 0.85] },
  punchR: { re: [1.0, 0.75], rw: [1.65, 0.75], le: [-0.6, 1.25], lw: [-0.3, 0.85] },
  shrug: { ls: [-0.4, 0.55], rs: [0.4, 0.55], head: [0, 0.2] },
  circle1: { le: [-0.95, 0.5], re: [0.95, 0.5], lw: [-1.5, 0.2], rw: [1.5, 0.2] },
  circle2: { le: [-0.95, 1.0], re: [0.95, 1.0], lw: [-1.5, 1.3], rw: [1.5, 1.3] },
  pushUp: HORIZ_UP,
  pushDown: { ...HORIZ_UP, head: [-1.65, 2.85], ls: [-1.2, 2.95], rs: [-1.2, 2.95], le: [-0.75, 2.9], re: [-0.75, 2.9], lh: [0.25, 3.0], rh: [0.25, 3.0], lk: [1.0, 3.1], rk: [1.0, 3.1], la: [1.75, 3.25], ra: [1.75, 3.25] },
  plank: { ...HORIZ_UP, head: [-1.55, 2.7], ls: [-1.15, 2.85], rs: [-1.15, 2.85], le: [-1.15, 3.4], re: [-1.15, 3.4], lw: [-0.6, 3.4], rw: [-0.6, 3.4], lh: [0.25, 2.95], rh: [0.25, 2.95], lk: [1.0, 3.05], rk: [1.0, 3.05], la: [1.75, 3.2], ra: [1.75, 3.2] },
};
export function tplMix(a, b, t) {
  const A = { ...TPL_BASE, ...(TEMPLATES[a] || {}) }, B = { ...TPL_BASE, ...(TEMPLATES[b] || {}) }, o = {};
  for (const k in A) o[k] = [lerp(A[k][0], B[k][0], t), lerp(A[k][1], B[k][1], t)];
  return o;
}
export function drawTemplate(g, name, cx, top, h, color, lw = 10) {
  const t = typeof name === 'string' ? { ...TPL_BASE, ...(TEMPLATES[name] || {}) } : name, s = h / 3.7;
  const P = (k) => [cx + t[k][0] * s, top + (t[k][1] + 0.3) * s];
  g.save(); g.strokeStyle = color; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
  const line = (...ks) => { g.beginPath(); ks.forEach((k, i) => { const [x, y] = P(k); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); };
  line('lw', 'le', 'ls', 'rs', 're', 'rw'); line('ls', 'lh', 'rh', 'rs'); line('lh', 'lk', 'la'); line('rh', 'rk', 'ra');
  const [hx, hy] = P('head'); g.fillStyle = color; g.beginPath(); g.arc(hx, hy, s * 0.3, 0, 7); g.fill();
  g.restore();
}
// animate between keyframe templates (period in seconds per frame)
export function drawDemo(g, frames, t, cx, top, h, color, lw = 10, per = 0.8) {
  if (frames.length === 1) return drawTemplate(g, frames[0], cx, top, h, color, lw);
  const x = t / per, k = Math.floor(x) % frames.length, e = x - Math.floor(x), s = e < 0.35 ? 0 : (e - 0.35) / 0.65;
  const ease = s * s * (3 - 2 * s);
  drawTemplate(g, tplMix(frames[k], frames[(k + 1) % frames.length], ease), cx, top, h, color, lw);
}

// ---------- avatar drawing ----------
// map: (pt)=>({x,y}); default is screen space.
export function drawAvatar(g, p, opt = {}) {
  if (!p.lm) return;
  const map = opt.map || ((q) => q), m = opt.map ? p.lm.map(map) : p.lm, T = p.f.T * (opt.scale || 1);
  const col = opt.color || p.color, alpha = opt.alpha ?? 1;
  g.save(); g.globalAlpha = alpha; g.lineCap = 'round'; g.lineJoin = 'round';
  // torso fill
  const tg = g.createLinearGradient(0, m[11].y, 0, m[23].y); tg.addColorStop(0, opt.fill || p.color2); tg.addColorStop(1, 'rgba(0,0,0,0.25)');
  g.fillStyle = tg;
  g.beginPath(); [11, 12, 24, 23].forEach((k, i) => i ? g.lineTo(m[k].x, m[k].y) : g.moveTo(m[k].x, m[k].y)); g.closePath(); g.fill();
  const passes = S.hiQ ? [[col, 0.42, 0.18], ['rgba(0,0,0,0.4)', 0.24, 1], [col, 0.16, 1], ['rgba(255,255,255,0.55)', 0.05, 1]] : [['rgba(0,0,0,0.35)', 0.24, 1], [col, 0.16, 1]];
  for (const [c, w, a] of passes) {
    g.strokeStyle = c; g.globalAlpha = alpha * a; g.lineWidth = Math.max(c === col && a === 1 ? 4 : 2, T * w);
    g.beginPath();
    for (const [a1, b1] of BONES) {
      if (p.lm[a1].v < 0.2 || p.lm[b1].v < 0.2) continue;
      g.moveTo(m[a1].x, m[a1].y); g.lineTo(m[b1].x, m[b1].y);
    }
    g.stroke();
  }
  g.globalAlpha = alpha;
  // joints + hands
  g.fillStyle = '#fff';
  for (const k of [15, 16]) { g.beginPath(); g.arc(m[k].x, m[k].y, Math.max(5, T * 0.12), 0, 7); g.fill(); }
  // head
  const hd = m[0], r = Math.max(10, T * 0.3);
  if (S.hiQ) { g.fillStyle = col; g.globalAlpha = alpha * 0.2; g.beginPath(); g.arc(hd.x, hd.y, r * 1.45, 0, 7); g.fill(); g.globalAlpha = alpha; }
  g.fillStyle = col; g.beginPath(); g.arc(hd.x, hd.y, r, 0, 7); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(hd.x - r * 0.3, hd.y - r * 0.35, r * 0.35, 0, 7); g.fill();
  g.fillStyle = '#111'; // eyes + smile
  g.beginPath(); g.arc(hd.x - r * 0.35, hd.y - r * 0.05, r * 0.13, 0, 7); g.arc(hd.x + r * 0.35, hd.y - r * 0.05, r * 0.13, 0, 7); g.fill();
  g.strokeStyle = '#111'; g.lineWidth = Math.max(2, r * 0.1); g.beginPath(); g.arc(hd.x, hd.y + r * 0.15, r * 0.4, 0.3, Math.PI - 0.3); g.stroke();
  if (opt.label) txt(g, opt.label === true ? p.name : opt.label, hd.x, hd.y - r - 16, Math.max(18, r * 0.75), col);
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
const FONT = 'system-ui, "Noto Sans", "Noto Sans Devanagari", sans-serif';
export function txt(g, s, x, y, size = 32, color = '#fff', align = 'center', weight = '800') {
  g.font = `${weight} ${size}px ${FONT}`;
  g.textAlign = align; g.textBaseline = 'middle';
  g.lineWidth = Math.max(3, size / 8); g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineJoin = 'round'; g.strokeText(s, x, y);
  g.fillStyle = color; g.fillText(s, x, y);
}
// plain text without outline (cheaper, for panels)
export function ptxt(g, s, x, y, size = 24, color = '#fff', align = 'left', weight = '600') {
  g.font = `${weight} ${size}px ${FONT}`; g.textAlign = align; g.textBaseline = 'middle'; g.fillStyle = color; g.fillText(s, x, y);
}
export function rrect(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
// Emoji are slow to draw on TV browsers (each new size re-rasterises the glyph). Draw each once, then reuse the bitmap.
const EMO = new Map();
export function emoji(g, e, x, y, size) {
  if (size < 2) return;
  let c = EMO.get(e);
  if (!c) {
    c = document.createElement('canvas'); c.width = c.height = 144;
    const x2 = c.getContext('2d'); x2.font = `112px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    x2.textAlign = 'center'; x2.textBaseline = 'middle'; x2.fillStyle = '#000'; x2.fillText(e, 72, 78);
    EMO.set(e, c);
  }
  const s = size * 144 / 112;
  g.drawImage(c, x - s / 2, y - s / 2, s, s);
}
const GRAD = new Map();
export function bg(g, top, bot) {
  const k = top + bot; let gr = GRAD.get(k);
  if (!gr) { gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, top); gr.addColorStop(1, bot); GRAD.set(k, gr); }
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
}
// soft floating light particles for menu backgrounds
const DOTS = Array.from({ length: 40 }, (_, i) => ({ x: Math.random() * W, y: Math.random() * H, r: 1 + Math.random() * 3, s: 8 + Math.random() * 25, ph: i }));
export function sparkle(g, t, color = '#fff') {
  if (!S.hiQ) return;
  g.fillStyle = color;
  for (const d of DOTS) { const y = (d.y - t * d.s) % H, yy = y < 0 ? y + H : y; g.globalAlpha = 0.15 + 0.15 * Math.sin(t * 1.5 + d.ph); g.fillRect(d.x + Math.sin(t * 0.5 + d.ph) * 10, yy, d.r, d.r); }
  g.globalAlpha = 1;
}

// ---------- particles & floating text ----------
export class FX {
  constructor() { this.p = []; this.t = []; }
  burst(x, y, color, n = 14, sp = 380) {
    if (!S.hiQ) n = Math.ceil(n / 2);
    if (this.p.length > 350) return;
    for (let i = 0; i < n; i++) { const a = rand(0, 6.28), v = rand(sp * 0.3, sp); this.p.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 100, life: rand(0.4, 0.9), c: color, r: rand(3, 8) }); }
  }
  confetti(n = 80) { for (let i = 0; i < (S.hiQ ? n : n / 3); i++) this.p.push({ x: rand(0, W), y: rand(-200, 0), vx: rand(-60, 60), vy: rand(0, 200), life: rand(1.5, 3), c: pick(['#ff4fa3', '#22e3ff', '#ffe066', '#7dff7d', '#ff9a3b']), r: rand(4, 8) }); }
  text(s, x, y, color = '#fff', size = 40) { if (this.t.length < 30) this.t.push({ s, x, y, color, size, life: 1 }); }
  update(dt) {
    for (const q of this.p) { q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 900 * dt; q.life -= dt; }
    if (this.p.length) this.p = this.p.filter(q => q.life > 0);
    for (const q of this.t) { q.y -= 60 * dt; q.life -= dt; }
    if (this.t.length) this.t = this.t.filter(q => q.life > 0);
  }
  draw(g) {
    for (const q of this.p) { g.globalAlpha = clamp(q.life * 2, 0, 1); g.fillStyle = q.c; g.fillRect(q.x - q.r, q.y - q.r, q.r * 2, q.r * 2); }
    g.globalAlpha = 1;
    for (const q of this.t) { g.globalAlpha = clamp(q.life * 1.5, 0, 1); txt(g, q.s, q.x, q.y, q.size, q.color); }
    g.globalAlpha = 1;
  }
}

// ---------- sound + voice coach ----------
let AC = null;
export function unlockAudio() {
  try { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (e) { }
}
function tone(freq, dur, type = 'sine', vol = 0.15, slide = 0, delay = 0) {
  if (!S.sound || !AC || AC.state !== 'running') return;
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
    case 'select': tone(740, 0.08, 'sine', 0.15); tone(1110, 0.1, 'sine', 0.1, 0, 0.06); break;
    case 'hover': tone(520, 0.04, 'sine', 0.05); break;
  }
}
export function say(text) {
  if (!S.voice || !window.speechSynthesis) return;
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 1; u.lang = 'en-IN'; speechSynthesis.speak(u); } catch (e) { }
}
