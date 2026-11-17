// Keyboard/mouse "fake body" so the arena can be tried without a camera.
// ←/→ move · ↑ jump · ↓ squat (hold) · 1 arms down · 2 arms up · 3 T-pose · Q/E lean · K one leg
// J jumping-jacks · R run in place · F flap · P add/remove player 2 · mouse = right hand
export class Sim {
  constructor() {
    this.x = 0.5; this.jumpT = -1; this.squat = 0; this.arms = 'down'; this.lean = 0; this.leg = false;
    this.anim = null; this.two = false; this.mouse = null; this.mouseT = 0; this.held = {};
    addEventListener('keydown', (e) => this.key(e, true));
    addEventListener('keyup', (e) => this.key(e, false));
    addEventListener('mousemove', (e) => { const r = document.querySelector('canvas').getBoundingClientRect(); this.mouse = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; this.mouseT = performance.now(); });
  }
  key(e, down) {
    const k = e.key.toLowerCase(); this.held[k] = down;
    if (!down) { if (k === 'q' || k === 'e') this.lean = 0; if (k === 'k') this.leg = false; return; }
    if (k === 'arrowup') this.jumpT = performance.now();
    if (k === '1') this.arms = 'down'; if (k === '2') this.arms = 'up'; if (k === '3') this.arms = 't'; if (k === '4') this.arms = 'head';
    if (k === 'q') this.lean = -1; if (k === 'e') this.lean = 1; if (k === 'k') this.leg = true;
    if (k === 'j' || k === 'r' || k === 'f') this.anim = this.anim === k ? null : k;
    if (k === 'p') this.two = !this.two;
  }
  step(dt) {
    if (this.held['arrowleft']) this.x = Math.max(0.15, this.x - dt * 0.6);
    if (this.held['arrowright']) this.x = Math.min(0.85, this.x + dt * 0.6);
    this.squat += ((this.held['arrowdown'] ? 1 : 0) - this.squat) * Math.min(1, dt * 10);
  }
  poses() {
    const t = performance.now() / 1000, out = [this.body(this.x, t, true)];
    if (this.two) out.push(this.body(Math.min(0.9, this.x + 0.35), t + 0.2, false));
    return out;
  }
  body(cx, t, main) {
    const u = 0.2, ax = 9 / 16, P = new Array(33).fill(null);
    let jump = 0; const jt = (performance.now() - this.jumpT) / 1000; if (jt >= 0 && jt < 0.5) jump = Math.sin(jt / 0.5 * Math.PI) * 0.09;
    let arms = this.arms, legsOpen = 0, kneeL = 0, kneeR = 0, squat = this.squat;
    const ph = Math.floor(t / 0.4) % 2;
    if (this.anim === 'j') { arms = ph ? 'up' : 'down'; legsOpen = ph; }
    if (this.anim === 'r') { kneeL = ph ? 1 : 0; kneeR = ph ? 0 : 1; }
    if (this.anim === 'f') arms = Math.floor(t / 0.35) % 2 ? 'up' : 'down';
    if (this.leg) kneeL = 1;
    const hipY = 0.62 + squat * 0.1 - jump, shY = hipY - u, lean = this.lean * 0.45 * u * ax;
    const X = (dx) => cx + dx * ax;
    const set = (i, x, y) => P[i] = [x, y];
    set(23, X(-0.3 * u), hipY); set(24, X(0.3 * u), hipY);
    set(11, X(-0.42 * u) + lean, shY); set(12, X(0.42 * u) + lean, shY);
    set(0, X(0) + lean * 1.3, shY - 0.4 * u);
    for (let k = 1; k <= 10; k++) set(k, P[0][0] + (k % 2 ? -1 : 1) * 0.02, P[0][1] - 0.01);
    const sides = [[11, 13, 15, 17, 19, 21, -1], [12, 14, 16, 18, 20, 22, 1]];
    for (const [s, e, w, a, b, c, d] of sides) {
      const sx = P[s][0], sy = P[s][1];
      let ex, ey, wx, wy;
      if (arms === 'up') { ex = sx + d * 0.25 * u * ax; ey = sy - 0.5 * u; wx = sx + d * 0.3 * u * ax; wy = sy - 1.05 * u; }
      else if (arms === 't') { ex = sx + d * 0.6 * u * ax; ey = sy; wx = sx + d * 1.25 * u * ax; wy = sy; }
      else if (arms === 'head') { ex = sx + d * 0.55 * u * ax; ey = sy - 0.35 * u; wx = P[0][0] + d * 0.15 * u * ax; wy = P[0][1] - 0.1 * u; }
      else { ex = sx + d * 0.15 * u * ax; ey = sy + 0.55 * u; wx = sx + d * 0.2 * u * ax; wy = sy + 1.05 * u; }
      if (main && d === 1 && this.mouse && performance.now() - this.mouseT < 3000) { wx = this.mouse.x; wy = this.mouse.y; ex = (sx + wx) / 2; ey = (sy + wy) / 2 + 0.05; }
      set(e, ex, ey); set(w, wx, wy); set(a, wx, wy + 0.01); set(b, wx, wy - 0.015); set(c, wx, wy);
    }
    const ground = 0.62 + 1.85 * u - jump;
    for (const [h, k, an, he, ft, d, lift] of [[23, 25, 27, 29, 31, -1, kneeL], [24, 26, 28, 30, 32, 1, kneeR]]) {
      const hx = P[h][0], open = legsOpen * 0.5 * u * ax * d + d * squat * 0.25 * u * ax;
      const ky = lift ? hipY + 0.3 * u : hipY + (0.9 - 0.45 * squat) * u, ay = lift ? hipY + 0.8 * u : ground;
      set(k, hx + open, ky); set(an, hx + open * 1.3, ay); set(he, hx + open * 1.3, ay + 0.01); set(ft, hx + open * 1.3 + 0.01, ay + 0.02);
    }
    const a = [];
    for (const [x, y] of P) a.push(Math.round(x * 1000), Math.round(y * 1000), 99);
    return a;
  }
}
