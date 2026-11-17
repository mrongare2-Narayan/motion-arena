// Motion Arena – buttons that work with the TV remote (arrows + OK), mouse/touch, AND hand hover (dwell).
import { W, H, S, txt, ptxt, rrect, emoji, clamp, sfx } from './engine.js';

export class UI {
  constructor(g) {
    this.g = g; this.btns = []; this.prev = []; this.focus = null; this.ok = false; this.click = null;
    this.dw = { id: null, t: 0 }; this.lock = 0; this.cur = null; this.hov = null; this.t = 0; this.k = 0; this.lastHov = null;
  }
  begin(dt, cur) { this.dt = dt; this.t += dt; this.prev = this.btns; this.btns = []; this.cur = cur; this.hov = null; this.k = 0; this.lock = Math.max(0, this.lock - dt); }
  // Draws a button; returns true on the frame it is chosen.
  btn(id, x, y, w, h, o = {}) {
    const b = { id, x, y, w, h }; this.btns.push(b);
    const c = this.cur, over = !!c && !o.noHand && c.x >= x && c.x <= x + w && c.y >= y && c.y <= y + h;
    let hit = false, k = 0;
    if (over) {
      this.hov = id; if (this.focus !== id && this.lastHov !== id) sfx('hover'); this.focus = id;
      if (this.lock <= 0) {
        if (this.dw.id !== id) this.dw = { id, t: 0 };
        this.dw.t += this.dt; k = this.dw.t / (o.dwell || S.dwell);
        if (k >= 1) { hit = true; k = 0; }
      }
    }
    if (this.ok && this.focus === id) { hit = true; this.ok = false; }
    if (this.click && this.click.x >= x && this.click.x <= x + w && this.click.y >= y && this.click.y <= y + h) { hit = true; this.focus = id; this.click = null; }
    b.k = k; this.k = Math.max(this.k, k);
    (o.draw || drawBtn)(this.g, b, o, this.focus === id, this.t);
    if (hit) { sfx('select'); this.lock = 0.9; this.dw = { id: null, t: 0 }; }
    return hit;
  }
  end(opt = {}) {
    if (!this.hov) this.dw = { id: null, t: 0 };
    this.lastHov = this.hov;
    if (this.btns.length && !this.btns.some(b => b.id === this.focus)) this.focus = (this.btns.find(b => b.id === opt.def) || this.btns[0]).id;
    this.ok = false; this.click = null;
    if (opt.cursor !== false) drawCursor(this.g, this.cur, this.k);
  }
  press() { this.ok = true; }
  tap(x, y) { this.click = { x, y }; }
  // Remote arrow keys: move focus to the nearest button in that direction.
  nav(dir) {
    const bs = this.btns; if (!bs.length) return false;
    const cur = bs.find(b => b.id === this.focus);
    if (!cur) { this.focus = bs[0].id; return true; }
    const cx = cur.x + cur.w / 2, cy = cur.y + cur.h / 2;
    let best = null, bs2 = 1e9;
    for (const b of bs) {
      if (b === cur) continue;
      const dx = b.x + b.w / 2 - cx, dy = b.y + b.h / 2 - cy;
      const main = dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy;
      const side = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
      if (main <= 4) continue;
      const sc = main + side * 2.2;
      if (sc < bs2) { bs2 = sc; best = b; }
    }
    if (best) { this.focus = best.id; sfx('tick'); return true; }
    return false;
  }
}

export function drawCursor(g, c, k) {
  if (!c) return;
  g.save();
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.arc(c.x, c.y, 34, 0, 7); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 5; g.beginPath(); g.arc(c.x, c.y, 30, 0, 7); g.stroke();
  if (k > 0) { g.strokeStyle = '#ffe066'; g.lineWidth = 10; g.lineCap = 'round'; g.beginPath(); g.arc(c.x, c.y, 30, -Math.PI / 2, -Math.PI / 2 + 6.283 * clamp(k, 0, 1)); g.stroke(); }
  emoji(g, '✋', c.x, c.y, 34);
  g.restore();
}

// Default button look: rounded card, glow when focused, icon + title + subtitle, fill bar while hand hovers.
export function drawBtn(g, b, o, focus, t) {
  const { x, y, w, h } = b, r = o.r ?? Math.min(22, h / 3), col = o.color || '#22e3ff', on = focus || b.k > 0;
  g.save();
  if (on && S.hiQ) { g.fillStyle = col; g.globalAlpha = 0.18 + 0.08 * Math.sin(t * 5); rrect(g, x - 8, y - 8, w + 16, h + 16, r + 8); g.fill(); g.globalAlpha = 1; }
  if (o.solid) { g.fillStyle = on ? col : o.solid; }
  else {
    const gr = g.createLinearGradient(x, y, x, y + h);
    gr.addColorStop(0, on ? hexA(col, 0.55) : (o.bg || 'rgba(255,255,255,0.13)')); gr.addColorStop(1, on ? hexA(col, 0.25) : (o.bg2 || 'rgba(255,255,255,0.05)'));
    g.fillStyle = gr;
  }
  rrect(g, x, y, w, h, r); g.fill();
  g.lineWidth = on ? 4 : 2; g.strokeStyle = on ? col : 'rgba(255,255,255,0.14)'; g.stroke();
  if (b.k > 0) { g.save(); rrect(g, x, y, w, h, r); g.clip(); g.fillStyle = 'rgba(255,224,102,0.35)'; g.fillRect(x, y, w * clamp(b.k, 0, 1), h); g.restore(); }
  const dark = o.solid && on;
  if (o.layout === 'card') { // big section card: icon on top
    const sz = fit(g, o.label, o.size || 34, w - 20), ly = y + h * 0.58;
    if (o.icon) emoji(g, o.icon, x + w / 2, y + h * 0.27 + (on ? Math.sin(t * 4) * 4 : 0), Math.min(w, h) * 0.32);
    txt(g, o.label, x + w / 2, ly, sz, '#fff');
    if (o.sub) txt(g, o.sub, x + w / 2, ly + sz * 0.85, sz * 0.6, o.subColor || '#ffe066', 'center', '700');
    if (o.desc) ptxt(g, o.desc, x + w / 2, y + h - 22, 17, '#c9d2ff', 'center', '600');
  } else if (o.icon && o.label) {
    const is = o.iconSize || Math.min(h * 0.6, 64);
    emoji(g, o.icon, x + 14 + is / 2, y + h / 2, is);
    const tx = x + 26 + is, fs = fit(g, o.label, o.size || 22, x + w - tx - 10);
    if (o.sub) { txt(g, o.label, tx, y + h * 0.36, fs, dark ? '#001' : '#fff', 'left'); ptxt(g, o.sub, tx, y + h * 0.68, (o.size || 22) * 0.78, dark ? '#001' : (o.subColor || '#ffe066'), 'left', '700'); }
    else txt(g, o.label, tx, y + h / 2, fs, dark ? '#001' : '#fff', 'left');
    if (o.note) ptxt(g, o.note, x + w - 12, y + h - 14, 15, '#aab', 'right', '600');
  } else {
    const lbl = (o.icon ? o.icon + ' ' : '') + (o.label || '');
    if (dark) ptxt(g, lbl, x + w / 2, y + h / 2 + 1, o.size || 26, '#001', 'center', '800');
    else txt(g, lbl, x + w / 2, y + h / 2 + 1, o.size || 26, '#fff');
  }
  g.restore();
}
function fit(g, s, size, maxW) {
  for (; size > 12; size -= 1) { g.font = `800 ${size}px system-ui, "Noto Sans", sans-serif`; if (g.measureText(s).width <= maxW) break; }
  return size;
}
function hexA(hex, a) {
  if (hex[0] !== '#' || hex.length !== 7) return hex;
  const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

// Map the raised hand into a comfortable box around the body so the whole screen is reachable without stretching.
let curS = null, curHand = null;
export function handCursor(players, direct) {
  const p = players.find(q => q.present); if (!p) { curS = null; return null; }
  const f = p.f, T = f.T;
  const lUp = f.lw.y < f.hm.y - 0.25 * T, rUp = f.rw.y < f.hm.y - 0.25 * T;
  if (!lUp && !rUp) { curS = null; curHand = null; return null; }
  let hand = curHand;
  if (!hand || (hand === 'l' && !lUp) || (hand === 'r' && !rUp)) hand = lUp && rUp ? (f.lw.y < f.rw.y ? 'l' : 'r') : lUp ? 'l' : 'r';
  else if (lUp && rUp) { const other = hand === 'l' ? 'r' : 'l'; if (f[other + 'w'].y < f[hand + 'w'].y - 0.5 * T) hand = other; }
  if (hand !== curHand) curS = null;
  curHand = hand;
  const w = f[hand + 'w'];
  let x, y;
  if (direct) { x = w.x; y = w.y; }
  else {
    const sh = hand === 'l' ? f.ls : f.rs, cx = sh.x + (hand === 'l' ? -0.55 : 0.55) * T, cy = f.sm.y - 0.25 * T, bw = 2.8 * T / S.sens ** 0.5, bh = 2.0 * T / S.sens ** 0.5;
    x = clamp((w.x - cx) / bw + 0.5, 0, 1) * W; y = clamp((w.y - cy) / bh + 0.5, 0, 1) * H;
  }
  curS = curS ? { x: curS.x + (x - curS.x) * 0.45, y: curS.y + (y - curS.y) * 0.45 } : { x, y };
  return { x: curS.x, y: curS.y, p };
}
