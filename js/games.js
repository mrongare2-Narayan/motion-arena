// Motion Arena – 12 original motion games.
import { W, H, L, clamp, lerp, rand, pick, dist, segDist, drawAvatar, drawPoseInBox, txt, rrect, emoji, bg, sfx, POSES, drawTemplate } from './engine.js';

// Shared HUD: scores for each player + timer.
function hud(g, ps, scores, timeLeft, extra) {
  ps.forEach((p, i) => {
    const x = i === 0 ? 30 : W - 30, al = i === 0 ? 'left' : 'right';
    txt(g, `P${p.i + 1}  ${Math.floor(scores[i])}`, x, 40, 40, p.color, al);
    if (extra) txt(g, extra(i), x, 82, 26, '#fff', al, '700');
  });
  if (timeLeft != null) txt(g, `${Math.ceil(Math.max(0, timeLeft))}s`, W / 2, 40, 44, timeLeft < 10 ? '#ff6b6b' : '#fff');
}
const hearts = (n) => '❤'.repeat(Math.max(0, n));
// Ghost avatars behind gameplay
const ghosts = (g, ps, a = 0.35) => ps.forEach(p => p.present && drawAvatar(g, p, { alpha: a }));

// =============================== 1. JUNGLE DASH (runner) ===============================
function jungleDash(ctx) {
  const ps = ctx.players, n = ps.length;
  ps.forEach(p => p.adapt = true);
  const runners = ps.map((p, i) => ({ p, lane: 0, lx: 0, hp: 3, score: 0, coins: 0, inv: 0, air: 0, alive: true, objs: [], spawn: 1, dist: 0, prevJump: false, x0: n === 1 ? 0 : i * W / 2, w: W / n }));
  let t = 0, speed = 0.38;
  const G = { scores: runners.map(() => 0), over: false };
  const HZ = 250, BOT = H + 40;
  const proj = (r, lane, z) => { const s = 1 / (1 + z * 5.5); return { s, x: r.x0 + r.w / 2 + lane * r.w * 0.27 * s, y: HZ + (BOT - HZ) * s }; };
  G.update = (dt) => {
    t += dt; speed = 0.38 + t * 0.006;
    for (const r of runners) {
      if (!r.alive) continue;
      const f = r.p.f; r.dist += speed * dt * 40;
      if (f) {
        const sh = f.shift + f.tilt * 0.5;
        if (sh < -0.42) r.lane = -1; else if (sh > 0.42) r.lane = 1; else if (Math.abs(sh) < 0.22) r.lane = 0;
        const j = f.jump > 0.14;
        if (j && !r.prevJump && r.air <= 0) { r.air = 0.75; sfx('jump'); }
        r.prevJump = j; r.duck = f.duck > 0.26;
      }
      r.air -= dt; r.inv -= dt; r.lx = lerp(r.lx, r.lane, Math.min(1, dt * 12));
      r.spawn -= dt;
      if (r.spawn <= 0) {
        r.spawn = Math.max(0.6, 1.25 - t * 0.008);
        const free = pick([-1, 0, 1]);
        for (const ln of [-1, 0, 1]) {
          if (ln === free) { if (Math.random() < 0.5) r.objs.push({ z: 1, lane: ln, type: 'coin' }); continue; }
          if (Math.random() < 0.55) r.objs.push({ z: 1, lane: ln, type: pick(['log', 'log', 'branch', 'rock']) });
        }
      }
      for (const o of r.objs) {
        const pz = o.z; o.z -= speed * dt;
        if (pz > 0.04 && o.z <= 0.04 && !o.done && Math.round(r.lx) === o.lane) {
          o.done = true;
          if (o.type === 'coin') { r.coins++; sfx('coin'); ctx.fx.text('+10', proj(r, o.lane, 0).x, H - 260, '#ffd84a'); continue; }
          const safe = (o.type === 'log' && r.air > 0) || (o.type === 'branch' && r.duck);
          if (!safe && r.inv <= 0) {
            r.hp--; r.inv = 1.2; sfx('hit'); ctx.fx.burst(proj(r, o.lane, 0).x, H - 200, '#ff5555', 20);
            if (r.hp <= 0) { r.alive = false; sfx('boom'); }
          }
        }
      }
      r.objs = r.objs.filter(o => o.z > -0.1);
      r.score = Math.floor(r.dist) + r.coins * 10;
    }
    G.scores = runners.map(r => r.score);
    if (runners.every(r => !r.alive)) G.over = true;
  };
  G.draw = (g) => {
    for (const r of runners) {
      g.save(); g.beginPath(); g.rect(r.x0, 0, r.w, H); g.clip();
      const sky = g.createLinearGradient(0, 0, 0, HZ); sky.addColorStop(0, '#2b9be0'); sky.addColorStop(1, '#bfe8ff');
      g.fillStyle = sky; g.fillRect(r.x0, 0, r.w, HZ);
      g.fillStyle = '#2f7d32'; g.fillRect(r.x0, HZ, r.w, H - HZ);
      // hills
      g.fillStyle = '#3c9a46'; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(r.x0 + ((k * 260 - r.dist * 0.3) % (r.w + 300) + r.w + 300) % (r.w + 300) - 150, HZ + 20, 120, Math.PI, 0); g.fill(); }
      // road
      const a = proj(r, -1.6, 1), b = proj(r, 1.6, 1), c = proj(r, 1.6, -0.02), d = proj(r, -1.6, -0.02);
      g.fillStyle = '#b07a43'; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(d.x, d.y); g.fill();
      // moving stripes
      for (let k = 0; k < 12; k++) {
        const z = ((k / 12 - (r.dist * 0.02) % (1 / 12)) + 1) % 1;
        const p1 = proj(r, -1.6, z), p2 = proj(r, 1.6, z);
        g.strokeStyle = k % 2 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)'; g.lineWidth = 30 * p1.s; g.beginPath(); g.moveTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); g.stroke();
      }
      for (const ln of [-0.5, 0.5]) { const p1 = proj(r, ln, 1), p2 = proj(r, ln, 0); g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 3; g.beginPath(); g.moveTo(p1.x, p1.y); g.lineTo(p2.x, p2.y); g.stroke(); }
      // trees on sides
      for (let k = 0; k < 8; k++) {
        const z = ((k / 8 - (r.dist * 0.02) % (1 / 8)) + 1) % 1;
        for (const side of [-2.3, 2.3]) { const q = proj(r, side, z); emoji(g, '🌴', q.x, q.y - 70 * q.s, 150 * q.s); }
      }
      // objects (far first)
      const objs = r.objs.filter(o => o.z > -0.05).sort((u, v) => v.z - u.z);
      for (const o of objs) {
        if (o.done && o.type === 'coin') continue;
        const q = proj(r, o.lane, Math.max(0, o.z)), s = q.s * (n === 1 ? 1 : 0.7);
        if (o.type === 'log') { g.fillStyle = '#6b3d16'; rrect(g, q.x - 110 * s, q.y - 50 * s, 220 * s, 50 * s, 20 * s); g.fill(); g.fillStyle = '#c8955b'; g.beginPath(); g.arc(q.x - 100 * s, q.y - 25 * s, 22 * s, 0, 7); g.fill(); }
        else if (o.type === 'branch') { g.fillStyle = '#4b2a10'; g.fillRect(q.x - 120 * s, q.y - 330 * s, 18 * s, 330 * s); g.fillRect(q.x + 102 * s, q.y - 330 * s, 18 * s, 330 * s); g.fillStyle = '#2e8b3a'; rrect(g, q.x - 140 * s, q.y - 360 * s, 280 * s, 110 * s, 30 * s); g.fill(); emoji(g, '🍃', q.x, q.y - 300 * s, 60 * s); }
        else if (o.type === 'rock') { g.fillStyle = '#7d7f86'; g.beginPath(); g.ellipse(q.x, q.y - 100 * s, 110 * s, 120 * s, 0, 0, 7); g.fill(); g.fillStyle = '#9fa2aa'; g.beginPath(); g.ellipse(q.x - 30 * s, q.y - 140 * s, 40 * s, 30 * s, 0, 0, 7); g.fill(); }
        else if (o.type === 'coin') { emoji(g, '🪙', q.x, q.y - 60 * s, 80 * s); }
      }
      // runner (mirrors the real body)
      const me = proj(r, r.lx, 0), hgt = n === 1 ? 300 : 240;
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(me.x, H - 30, 70, 18, 0, 0, 7); g.fill();
      if (!(r.inv > 0 && Math.floor(r.inv * 10) % 2)) drawPoseInBox(g, r.p, me.x, H - 30 - (r.air > 0 ? Math.sin((0.75 - r.air) / 0.75 * Math.PI) * 120 : 0), r.duck ? hgt * 0.75 : hgt, { jumpBoost: 0.4 });
      txt(g, `${hearts(r.hp)}`, r.x0 + r.w / 2, 110, 34, '#ff4d6d');
      txt(g, `🪙 ${r.coins}   ${Math.floor(r.dist)} m`, r.x0 + r.w / 2, 150, 28, '#fff');
      if (!r.alive) { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(r.x0, 0, r.w, H); txt(g, 'OUT!', r.x0 + r.w / 2, H / 2, 90, '#ff5b5b'); }
      g.restore();
      if (n > 1) { g.fillStyle = '#000'; g.fillRect(W / 2 - 3, 0, 6, H); }
    }
    hud(g, ps, G.scores, null);
    if (t < 4) txt(g, 'Step L/R = lane • Jump = log • Squat = branch', W / 2, H / 2 - 120, 30, '#fff');
  };
  return G;
}

// =============================== 2. SLICE STORM ===============================
function sliceStorm(ctx) {
  const ps = ctx.players; let t = 0, spawn = 0.5; const DUR = 60;
  const items = [], halves = [], scores = ps.map(() => 0), combo = ps.map(() => 0);
  const FR = ['🍉', '🍍', '🍊', '🍎', '🥭', '🍌', '🥥', '🍇'];
  const G = { scores, over: false };
  G.update = (dt) => {
    t += dt; spawn -= dt;
    if (spawn <= 0) {
      spawn = rand(0.45, 0.9) * (t > 30 ? 0.75 : 1);
      const k = 1 + (Math.random() < 0.35 ? 1 : 0);
      for (let i = 0; i < k; i++) {
        const x = rand(200, W - 200);
        items.push({ x, y: H + 60, vx: (W / 2 - x) * rand(0.2, 0.6), vy: rand(-980, -820), r: 55, e: Math.random() < 0.13 ? '💣' : pick(FR), rot: 0, vr: rand(-3, 3) });
      }
    }
    for (const o of items) { o.x += o.vx * dt; o.y += o.vy * dt; o.vy += 900 * dt; o.rot += o.vr * dt; }
    for (const o of halves) { o.x += o.vx * dt; o.y += o.vy * dt; o.vy += 1000 * dt; o.rot += o.vr * dt; }
    ps.forEach((p, i) => {
      if (!p.present) return;
      for (const s of ['l', 'r']) {
        const tr = p.trail[s]; if (tr.length < 2 || p.handSpeed(s) < 650) continue;
        const a = tr[tr.length - 2], b = tr[tr.length - 1];
        for (const o of items) {
          if (o.cut || segDist(o, a, b) > o.r + 15) continue;
          o.cut = true;
          if (o.e === '💣') { scores[i] = Math.max(0, scores[i] - 10); combo[i] = 0; sfx('boom'); ctx.fx.burst(o.x, o.y, '#ffae00', 40, 600); ctx.fx.text('-10', o.x, o.y, '#ff5555', 50); ctx.flash = 0.3; }
          else {
            combo[i]++; const pts = combo[i] >= 3 ? 2 : 1; scores[i] += pts; sfx('slice');
            ctx.fx.burst(o.x, o.y, pick(['#ff3b3b', '#ffd23b', '#7dff5a', '#ff9a3b']), 16);
            if (pts > 1) ctx.fx.text(`COMBO x${combo[i]}`, o.x, o.y - 50, p.color, 34);
            for (const d of [-1, 1]) halves.push({ x: o.x + d * 15, y: o.y, vx: o.vx + d * 200, vy: o.vy * 0.3 - 100, e: o.e, rot: o.rot, vr: d * 5, life: 1.5 });
          }
        }
      }
    });
    for (const o of items) if (!o.cut && !o.lost && o.y > H + 80 && o.vy > 0) { o.lost = true; if (o.e !== '💣') combo.fill(0); }
    for (let k = items.length - 1; k >= 0; k--) if (items[k].cut || items[k].lost) items.splice(k, 1);
    for (let k = halves.length - 1; k >= 0; k--) if (halves[k].y > H + 100) halves.splice(k, 1);
    if (t >= DUR) G.over = true;
  };
  G.draw = (g) => {
    bg(g, '#2b1a3d', '#4a2a1f');
    g.fillStyle = 'rgba(255,255,255,0.03)'; for (let i = 0; i < 12; i++) g.fillRect(i * 110, 0, 50, H);
    ghosts(g, ps, 0.45);
    for (const o of items) { g.save(); g.translate(o.x, o.y); g.rotate(o.rot); emoji(g, o.e, 0, 0, 100); g.restore(); }
    for (const o of halves) { g.save(); g.translate(o.x, o.y); g.rotate(o.rot); g.globalAlpha = 0.8; emoji(g, o.e, 0, 0, 70); g.restore(); }
    ps.forEach(p => { for (const s of ['l', 'r']) { const tr = p.trail[s]; if (tr.length < 2) continue; g.strokeStyle = p.color; g.lineCap = 'round'; for (let k = 1; k < tr.length; k++) { g.globalAlpha = k / tr.length; g.lineWidth = k * 2.2; g.beginPath(); g.moveTo(tr[k - 1].x, tr[k - 1].y); g.lineTo(tr[k].x, tr[k].y); g.stroke(); } g.globalAlpha = 1; } });
    hud(g, ps, scores, DUR - t);
    if (t < 4) txt(g, 'Swipe your hands fast through fruits • avoid 💣', W / 2, 130, 30);
  };
  return G;
}

// =============================== 3. SHAPE GATE ===============================
function shapeGate(ctx) {
  const ps = ctx.players, ORDER = ['armsUp', 'tpose', 'squat', 'leanL', 'leanR', 'star', 'oneLeg', 'handsHead', 'tpose', 'squat', 'armsUp', 'star'];
  const seq = ORDER.slice().sort(() => Math.random() - 0.5);
  let idx = 0, wt = 0, dur = 5, result = null, rt = 0;
  const scores = ps.map(() => 0), G = { scores, over: false };
  G.update = (dt) => {
    if (result) { rt -= dt; if (rt <= 0) { result = null; idx++; wt = 0; dur = Math.max(3.2, dur - 0.18); if (idx >= seq.length) G.over = true; } return; }
    wt += dt;
    if (wt >= dur) {
      result = ps.map((p, i) => { const ok = p.present && POSES[seq[idx]].check(p); if (ok) scores[i] += 100; return ok; });
      rt = 1.4; sfx(result.some(Boolean) ? 'good' : 'boom');
      result.forEach((ok, i) => ok ? ctx.fx.text('PERFECT!', ps.length > 1 ? (i ? W * 0.75 : W * 0.25) : W / 2, H / 2, '#7dff7d', 70) : ctx.fx.burst(ps.length > 1 ? (i ? W * 0.75 : W * 0.25) : W / 2, H / 2, '#c96b3a', 50, 700));
    } else if (wt > dur - 3 && Math.floor(wt) !== Math.floor(wt - dt)) sfx('tick');
  };
  G.draw = (g) => {
    bg(g, '#121a33', '#283a66');
    g.fillStyle = '#1b2547'; for (let i = 0; i < 10; i++) { g.beginPath(); g.moveTo(W / 2, H / 2 - 40); g.lineTo(i * W / 9, H); g.stroke(); }
    const pose = seq[Math.min(idx, seq.length - 1)], k = result ? 1 : clamp(wt / dur, 0, 1), s = lerp(0.12, 1.0, k * k);
    // wall
    const ww = W * 1.05 * s, wh = H * 1.05 * s, wx = W / 2 - ww / 2, wy = H / 2 - wh / 2 + 20 * (1 - s);
    g.save(); g.globalAlpha = result ? 0.35 : lerp(0.5, 0.88, k);
    g.fillStyle = '#b4532a'; g.fillRect(wx, wy, ww, wh);
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = Math.max(1, 3 * s);
    for (let y = 0; y < 12; y++) { g.beginPath(); g.moveTo(wx, wy + y * wh / 12); g.lineTo(wx + ww, wy + y * wh / 12); g.stroke(); for (let x = 0; x < 16; x++) { const xx = wx + (x + (y % 2) * 0.5) * ww / 16; g.beginPath(); g.moveTo(xx, wy + y * wh / 12); g.lineTo(xx, wy + (y + 1) * wh / 12); g.stroke(); } }
    const holes = ps.length > 1 ? [W * 0.27, W * 0.73] : [W / 2];
    for (const hx of holes) drawTemplate(g, pose, W / 2 + (hx - W / 2) * s, wy + wh * 0.06, wh * 0.85, '#0c1226', 46 * s);
    g.restore();
    ghosts(g, ps, 0.95);
    // panel
    txt(g, `${idx + 1}/${seq.length}  ${POSES[pose].name}`, W / 2, 105, 52, '#ffe066');
    txt(g, POSES[pose].hi, W / 2, 160, 38, '#fff');
    if (!result) { g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(W / 2 - 200, 190, 400, 12); g.fillStyle = '#ffe066'; g.fillRect(W / 2 - 200, 190, 400 * (1 - k), 12); }
    drawTemplate(g, pose, 90, 140, 170, '#ffe066', 8);
    ps.forEach((p, i) => { if (!result && p.present && POSES[pose].check(p)) txt(g, '✔ OK', ps.length > 1 ? (i ? W - 120 : 120) : W - 140, H - 60, 44, '#7dff7d'); });
    hud(g, ps, scores, null);
  };
  return G;
}

// =============================== 4. JACK ATTACK (jumping jacks) ===============================
function repGame(ctx, opt) {
  const ps = ctx.players, DUR = opt.dur; let t = 0;
  const st = ps.map(() => ({ state: 'closed', reps: 0, pop: 0, blocks: [] }));
  const scores = ps.map(() => 0), G = { scores, over: false };
  G.update = (dt) => {
    t += dt;
    ps.forEach((p, i) => {
      const s = st[i]; s.pop = Math.max(0, s.pop - dt * 3);
      if (!p.present) return;
      const r = opt.detect(p, s);
      if (r === 'rep') { s.reps++; scores[i] = s.reps; s.pop = 1; sfx('rep'); if (opt.onRep) opt.onRep(s, i); }
    });
    if (t >= DUR) G.over = true;
  };
  G.draw = (g) => {
    bg(g, opt.bg[0], opt.bg[1]);
    if (opt.drawBack) opt.drawBack(g, st, ps, t);
    ghosts(g, ps, 0.95);
    ps.forEach((p, i) => {
      const cx = ps.length > 1 ? (i ? W - 160 : 160) : W - 180, s = st[i];
      g.fillStyle = 'rgba(0,0,0,0.35)'; rrect(g, cx - 130, 150, 260, 240, 30); g.fill();
      txt(g, `${s.reps}`, cx, 250, 130 + s.pop * 40, p.color);
      txt(g, opt.unit, cx, 345, 30, '#fff');
      if (s.hint) txt(g, s.hint, cx, 430, 26, '#ffe066');
    });
    txt(g, opt.title, W / 2, 105, 44, '#fff');
    hud(g, ps, scores, DUR - t, (i) => `🔥 ${(st[i].reps * opt.kcal).toFixed(1)} kcal`);
  };
  return G;
}
function jackAttack(ctx) {
  return repGame(ctx, {
    dur: 45, unit: 'JACKS', title: 'Jumping Jacks! हाथ ऊपर + पैर खोलो', kcal: 0.2, bg: ['#ff7e5f', '#feb47b'],
    detect(p, s) {
      const f = p.f, legsVis = p.vis(27, 28);
      const open = f.lw.y < f.nose.y && f.rw.y < f.nose.y && (!legsVis || Math.abs(f.la.x - f.ra.x) > 0.75 * f.T);
      const closed = f.lw.y > f.sm.y + 0.2 * f.T && f.rw.y > f.sm.y + 0.2 * f.T;
      s.hint = legsVis ? '' : 'Show your feet!';
      if (s.state === 'closed' && open) { s.state = 'open'; return 'rep'; }
      if (s.state === 'open' && closed) s.state = 'closed';
    },
  });
}
// =============================== 5. SQUAT TOWER ===============================
function squatTower(ctx) {
  const COLS = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ff924c'];
  return repGame(ctx, {
    dur: 60, unit: 'SQUATS', title: 'Squat to build your tower! बैठो-उठो', kcal: 0.35, bg: ['#1d2b64', '#45a2c9'],
    detect(p, s) {
      const q = p.f.squat;
      s.hint = s.state === 'up' && q > 0.12 && q < 0.26 ? 'Lower! और नीचे' : '';
      if (s.state !== 'down' && q > 0.27) s.state = 'down';
      else if (s.state === 'down' && q < 0.08) { s.state = 'up'; return 'rep'; }
    },
    onRep(s) { s.blocks.push({ c: pick(COLS), y: -200, w: rand(110, 150) }); },
    drawBack(g, st, ps) {
      st.forEach((s, i) => {
        const cx = ps.length > 1 ? (i ? W - 380 : 380) : 300;
        const top = H - 30 - s.blocks.length * 40, shift = Math.max(0, H * 0.45 - top);
        g.fillStyle = '#3b2f2f'; g.fillRect(cx - 100, H - 30 + shift, 200, 30);
        s.blocks.forEach((b, k) => {
          const ty = H - 30 - (k + 1) * 40 + shift; b.y = b.y < ty ? Math.min(ty, b.y + 40) : ty;
          g.fillStyle = b.c; rrect(g, cx - b.w / 2, b.y, b.w, 38, 6); g.fill(); g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(cx - b.w / 2 + 6, b.y + 5, b.w - 12, 6);
        });
        txt(g, `${s.blocks.length * 2} m`, cx, Math.max(60, H - 60 - s.blocks.length * 40 + shift - 20), 30, ps[i].color);
      });
    },
  });
}

// =============================== 6. BUBBLE POP ===============================
function bubblePop(ctx) {
  const ps = ctx.players, DUR = 60; let t = 0, spawn = 0;
  const bs = [], scores = ps.map(() => 0), G = { scores, over: false };
  G.update = (dt) => {
    t += dt; spawn -= dt;
    if (spawn <= 0) { spawn = rand(0.25, 0.55); const r = Math.random(); bs.push({ x: rand(80, W - 80), y: H + 60, r: rand(38, 62), vy: rand(-170, -110) * (1 + t / 80), ph: rand(0, 6), kind: r < 0.1 ? 'gold' : r < 0.22 ? 'spike' : 'n' }); }
    for (const b of bs) { b.y += b.vy * dt; b.ph += dt * 2; b.x += Math.sin(b.ph) * 40 * dt; }
    ps.forEach((p, i) => {
      if (!p.present) return;
      for (const h of [p.lm[L.lw], p.lm[L.rw], p.lm[L.li], p.lm[L.ri]]) for (const b of bs) {
        if (b.dead || dist(h, b) > b.r + 18) continue;
        b.dead = true;
        const pts = b.kind === 'gold' ? 5 : b.kind === 'spike' ? -3 : 1; scores[i] = Math.max(0, scores[i] + pts);
        sfx(b.kind === 'spike' ? 'bad' : 'pop'); ctx.fx.burst(b.x, b.y, b.kind === 'gold' ? '#ffd84a' : b.kind === 'spike' ? '#ff4040' : '#bff3ff', 14);
        ctx.fx.text(pts > 0 ? `+${pts}` : `${pts}`, b.x, b.y, pts > 0 ? p.color : '#ff5555', 38);
      }
    });
    for (let k = bs.length - 1; k >= 0; k--) if (bs[k].dead || bs[k].y < -80) bs.splice(k, 1);
    if (t >= DUR) G.over = true;
  };
  G.draw = (g) => {
    bg(g, '#0b4f6c', '#01baef');
    ghosts(g, ps, 0.9);
    for (const b of bs) {
      const gr = g.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.1, b.x, b.y, b.r);
      const c = b.kind === 'gold' ? ['#fff6c2', '#ffc400'] : b.kind === 'spike' ? ['#ffb3b3', '#d10000'] : ['rgba(255,255,255,0.85)', 'rgba(120,220,255,0.35)'];
      gr.addColorStop(0, c[0]); gr.addColorStop(1, c[1]); g.fillStyle = gr; g.beginPath(); g.arc(b.x, b.y, b.r, 0, 7); g.fill();
      if (b.kind === 'spike') { g.strokeStyle = '#7a0000'; g.lineWidth = 4; for (let a = 0; a < 6.28; a += 0.785) { g.beginPath(); g.moveTo(b.x + Math.cos(a) * b.r, b.y + Math.sin(a) * b.r); g.lineTo(b.x + Math.cos(a) * (b.r + 14), b.y + Math.sin(a) * (b.r + 14)); g.stroke(); } }
    }
    hud(g, ps, scores, DUR - t);
    if (t < 4) txt(g, 'Pop bubbles with your hands • gold = +5 • red spiky = -3', W / 2, 130, 28);
  };
  return G;
}

// =============================== 7. GOAL GUARD ===============================
function goalGuard(ctx) {
  const ps = ctx.players, n = ps.length, SHOTS = n === 1 ? 20 : 30;
  let shot = null, count = 0, wait = 1.2, flight = 1.7;
  const scores = ps.map(() => 0), G = { scores, over: false };
  const fire = () => {
    const pi = count % n, p = ps[pi], f = p.f;
    const cx = f ? f.sm.x : W / 2, cy = f ? f.sm.y : H / 2, T = f ? f.T : 150;
    const a = rand(-Math.PI, 0.3), rr = rand(0.6, 1.7) * T;
    shot = { pi, tx: clamp(cx + Math.cos(a) * rr * 1.4, 80, W - 80), ty: clamp(cy + Math.sin(a) * rr, 80, H - 60), t: 0, sx: W / 2 + rand(-100, 100), sy: H * 0.32 };
    count++;
  };
  G.update = (dt) => {
    if (!shot) { wait -= dt; if (wait <= 0) { if (count >= SHOTS) { G.over = true; return; } fire(); } return; }
    shot.t += dt / flight;
    if (shot.t >= 1) {
      const p = ps[shot.pi], tgt = { x: shot.tx, y: shot.ty };
      const parts = p.present ? [L.lw, L.rw, L.li, L.ri, 0, L.le, L.re].map(k => p.lm[k]) : [];
      const saved = parts.some(q => dist(q, tgt) < 95) || (p.present && segDist(tgt, p.f.sm, p.f.hm) < 60);
      if (saved) { scores[shot.pi]++; sfx('good'); ctx.fx.burst(tgt.x, tgt.y, '#fff', 25, 500); ctx.fx.text('SAVED!', tgt.x, tgt.y - 60, p.color, 50); }
      else { sfx('bad'); ctx.fx.text('GOAL…', tgt.x, tgt.y - 60, '#ff6b6b', 50); ctx.flash = 0.25; }
      shot = null; wait = 0.9; flight = Math.max(0.95, flight - 0.035);
    }
  };
  G.draw = (g) => {
    bg(g, '#0f3d1e', '#1f7a3a');
    g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 2; for (let x = 0; x < W; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = 0; y < H; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.strokeStyle = '#fff'; g.lineWidth = 18; g.beginPath(); g.moveTo(20, H); g.lineTo(20, 20); g.lineTo(W - 20, 20); g.lineTo(W - 20, H); g.stroke();
    ghosts(g, ps, 0.95);
    if (shot) {
      const k = shot.t, x = lerp(shot.sx, shot.tx, k), y = lerp(shot.sy, shot.ty, k) - Math.sin(k * Math.PI) * 60, r = lerp(10, 60, k * k);
      g.strokeStyle = ps[shot.pi].color; g.globalAlpha = 0.3 + 0.5 * k; g.lineWidth = 5; g.beginPath(); g.arc(shot.tx, shot.ty, 70, 0, 7); g.stroke(); g.globalAlpha = 1;
      emoji(g, '⚽', x, y, r * 2);
    }
    hud(g, ps, scores, null, () => `Shot ${Math.min(count, SHOTS)}/${SHOTS}`);
  };
  return G;
}

// =============================== 8. PUNCH PADS ===============================
function punchPads(ctx) {
  const ps = ctx.players, DUR = 45; let t = 0;
  const pads = ps.map(() => null), wait = ps.map(() => 0.8), combo = ps.map(() => 0);
  const scores = ps.map(() => 0), G = { scores, over: false };
  const SPOTS = [[-1.3, -0.7], [1.3, -0.7], [-1.5, 0.1], [1.5, 0.1], [0, -1.4], [-0.9, -1.3], [0.9, -1.3]];
  G.update = (dt) => {
    t += dt;
    ps.forEach((p, i) => {
      if (!p.present) return;
      const f = p.f;
      if (!pads[i]) { wait[i] -= dt; if (wait[i] <= 0) { const sp = pick(SPOTS); pads[i] = { dx: sp[0], dy: sp[1], life: Math.max(0.9, 1.8 - t / 50), max: Math.max(0.9, 1.8 - t / 50) }; } return; }
      const pd = pads[i]; pd.life -= dt;
      pd.x = clamp(f.sm.x + pd.dx * f.T, 50, W - 50); pd.y = clamp(f.sm.y + pd.dy * f.T, 50, H - 50);
      for (const s of ['l', 'r']) {
        const h = s === 'l' ? p.lm[L.lw] : p.lm[L.rw];
        if (dist(h, pd) < 0.42 * f.T + 25 && p.handSpeed(s) > 350) {
          combo[i]++; const pts = 10 * Math.min(5, combo[i]); scores[i] += pts; sfx('hit');
          ctx.fx.burst(pd.x, pd.y, '#ffe066', 22, 500); ctx.fx.text(`+${pts}`, pd.x, pd.y - 40, p.color, 44);
          pads[i] = null; wait[i] = 0.15; return;
        }
      }
      if (pd.life <= 0) { combo[i] = 0; pads[i] = null; wait[i] = 0.3; sfx('bad'); }
    });
    if (t >= DUR) G.over = true;
  };
  G.draw = (g) => {
    bg(g, '#2a0845', '#6441a5');
    g.strokeStyle = 'rgba(255,255,255,0.15)'; g.lineWidth = 10; for (const y of [H * 0.35, H * 0.55, H * 0.75]) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    ghosts(g, ps, 0.95);
    ps.forEach((p, i) => {
      const pd = pads[i]; if (!pd || !p.f) return;
      const r = 0.42 * p.f.T + 10;
      g.fillStyle = '#e63946'; g.beginPath(); g.arc(pd.x, pd.y, r, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(pd.x, pd.y, r * 0.55, 0, 7); g.fill();
      g.fillStyle = '#e63946'; g.beginPath(); g.arc(pd.x, pd.y, r * 0.25, 0, 7); g.fill();
      g.strokeStyle = p.color; g.lineWidth = 8; g.beginPath(); g.arc(pd.x, pd.y, r + 10, -Math.PI / 2, -Math.PI / 2 + 6.283 * (pd.life / pd.max)); g.stroke();
    });
    hud(g, ps, scores, DUR - t, (i) => combo[i] > 1 ? `Combo x${Math.min(5, combo[i])}` : '');
    if (t < 4) txt(g, 'Punch the targets fast! तेज़ मुक्का मारो 🥊', W / 2, 130, 30);
  };
  return G;
}

// =============================== 9. SKY GLIDER (flap arms) ===============================
function skyGlider(ctx) {
  const ps = ctx.players; let t = 0, spawn = 1.5, scroll = 0;
  const birds = ps.map((p, i) => ({ p, x: 330 + i * 90, y: H / 2, vy: 0, alive: true, state: 'low', score: 0, wing: 0 }));
  const gates = [], G = { scores: birds.map(() => 0), over: false };
  G.update = (dt) => {
    t += dt; scroll += dt * 210; spawn -= dt;
    if (spawn <= 0) { spawn = 2.2; gates.push({ x: W + 60, gy: rand(200, H - 200), gap: Math.max(230, 300 - t * 1.5), passed: [] }); }
    for (const gt of gates) gt.x -= 210 * dt;
    while (gates.length && gates[0].x < -100) gates.shift();
    birds.forEach((b, i) => {
      if (!b.alive) { b.y = Math.min(H + 100, b.y + 400 * dt); return; }
      const f = b.p.f;
      if (f && b.p.present) {
        const wy = (f.lw.y + f.rw.y) / 2;
        if (wy < f.sm.y - 0.15 * f.T) b.state = 'high';
        else if (b.state === 'high' && wy > f.sm.y + 0.25 * f.T) { b.state = 'low'; b.vy = -360; b.wing = 1; sfx('jump'); }
      }
      if (t < 2.5) { b.vy = 0; b.y = lerp(b.y, H / 2, dt * 3); return; }
      b.vy += 620 * dt; b.vy = Math.min(b.vy, 420); b.y += b.vy * dt; b.wing = Math.max(0, b.wing - dt * 3);
      if (b.y < 20) { b.y = 20; b.vy = Math.max(0, b.vy); }
      if (b.y > H - 40) { b.alive = false; sfx('boom'); ctx.fx.burst(b.x, b.y, b.p.color, 30); }
      for (const gt of gates) {
        if (Math.abs(gt.x - b.x) < 60 && Math.abs(b.y - gt.gy) > gt.gap / 2 - 22) { b.alive = false; sfx('boom'); ctx.fx.burst(b.x, b.y, b.p.color, 30); }
        if (!gt.passed[i] && gt.x < b.x - 60 && b.alive) { gt.passed[i] = true; b.score++; sfx('coin'); }
      }
    });
    G.scores = birds.map(b => b.score);
    if (birds.every(b => !b.alive)) G.over = true;
  };
  G.draw = (g) => {
    bg(g, '#5ec5f2', '#d9f4ff');
    for (let k = 0; k < 6; k++) emoji(g, '☁️', ((k * 260 - scroll * 0.3) % (W + 300) + W + 300) % (W + 300) - 150, 90 + (k % 3) * 120, 110);
    ghosts(g, ps, 0.25);
    for (const gt of gates) {
      g.fillStyle = '#7b5ea7'; const top = gt.gy - gt.gap / 2, bot = gt.gy + gt.gap / 2;
      rrect(g, gt.x - 55, -20, 110, top + 20, 18); g.fill(); rrect(g, gt.x - 55, bot, 110, H - bot + 20, 18); g.fill();
      g.fillStyle = '#c9b6ef'; g.fillRect(gt.x - 55, top - 22, 110, 22); g.fillRect(gt.x - 55, bot, 110, 22);
    }
    g.fillStyle = '#3c8d2f'; g.fillRect(0, H - 40, W, 40);
    birds.forEach(b => {
      g.save(); g.translate(b.x, b.y); g.rotate(clamp(b.vy / 900, -0.5, 0.8));
      g.fillStyle = b.p.color; g.beginPath(); g.ellipse(0, 0, 38, 28, 0, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(-8, b.wing > 0 ? -30 : 8, 24, 12, b.wing > 0 ? -0.6 : 0.3, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(16, -8, 9, 0, 7); g.fill(); g.fillStyle = '#000'; g.beginPath(); g.arc(19, -8, 4, 0, 7); g.fill();
      g.fillStyle = '#ffb703'; g.beginPath(); g.moveTo(34, 0); g.lineTo(52, 6); g.lineTo(34, 12); g.fill();
      g.restore();
      if (!b.alive) txt(g, 'CRASH', b.x, b.y - 60, 34, '#ff5555');
    });
    hud(g, ps, G.scores, null);
    if (t < 4) txt(g, 'Flap arms: raise both hands, then pull down = fly up!', W / 2, 140, 30, '#123');
  };
  return G;
}

// =============================== 10. METEOR DODGE ===============================
function meteorDodge(ctx) {
  const ps = ctx.players, DUR = 75; let t = 0, spawn = 1;
  const ms = [], lives = ps.map(() => 3), inv = ps.map(() => 0), scores = ps.map(() => 0), G = { scores, over: false };
  const stars = Array.from({ length: 80 }, () => ({ x: rand(0, W), y: rand(0, H), s: rand(1, 3) }));
  G.update = (dt) => {
    t += dt; spawn -= dt;
    if (spawn <= 0) { spawn = Math.max(0.28, 0.9 - t / 90); const star = Math.random() < 0.22; ms.push({ x: rand(40, W - 40), y: -60, vy: rand(260, 380) * (1 + t / 70), vx: rand(-60, 60), r: star ? 30 : rand(30, 55), star, rot: 0 }); }
    for (const m of ms) { m.y += m.vy * dt; m.x += m.vx * dt; m.rot += dt * 2; }
    for (const s of stars) { s.y += s.s * 40 * dt; if (s.y > H) s.y = 0; }
    ps.forEach((p, i) => {
      inv[i] -= dt; if (lives[i] <= 0) return;
      scores[i] += dt * 10;
      if (!p.present) return;
      const body = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26].map(k => p.lm[k]);
      for (const m of ms) {
        if (m.dead) continue;
        if (m.star) { if ([p.lm[L.lw], p.lm[L.rw], p.lm[0]].some(q => dist(q, m) < m.r + 30)) { m.dead = true; scores[i] += 50; sfx('coin'); ctx.fx.text('+50', m.x, m.y, '#ffd84a', 40); } continue; }
        if (inv[i] <= 0 && body.some(q => dist(q, m) < m.r + 8)) {
          m.dead = true; lives[i]--; inv[i] = 1.5; sfx('boom'); ctx.fx.burst(m.x, m.y, '#ff7b00', 40, 600); ctx.flash = 0.3;
        }
      }
    });
    for (let k = ms.length - 1; k >= 0; k--) if (ms[k].dead || ms[k].y > H + 80) ms.splice(k, 1);
    if (t >= DUR || lives.every(l => l <= 0)) G.over = true;
  };
  G.draw = (g) => {
    bg(g, '#050816', '#1a1446');
    g.fillStyle = '#fff'; for (const s of stars) g.fillRect(s.x, s.y, s.s, s.s);
    ps.forEach((p, i) => p.present && lives[i] > 0 && !(inv[i] > 0 && Math.floor(inv[i] * 10) % 2) && drawAvatar(g, p, { alpha: 0.95 }));
    for (const m of ms) {
      if (m.star) { emoji(g, '⭐', m.x, m.y, m.r * 2.2); continue; }
      g.fillStyle = 'rgba(255,120,0,0.35)'; g.beginPath(); g.moveTo(m.x - m.r * 0.7, m.y); g.lineTo(m.x - m.vx * 0.3, m.y - m.r * 3.5); g.lineTo(m.x + m.r * 0.7, m.y); g.fill();
      g.save(); g.translate(m.x, m.y); g.rotate(m.rot); g.fillStyle = '#8a5a44'; g.beginPath();
      for (let a = 0; a < 6.28; a += 0.9) g.lineTo(Math.cos(a) * m.r * (0.85 + 0.15 * Math.sin(a * 3)), Math.sin(a) * m.r); g.fill();
      g.fillStyle = '#5e3c2e'; g.beginPath(); g.arc(m.r * 0.25, -m.r * 0.2, m.r * 0.25, 0, 7); g.fill(); g.restore();
    }
    hud(g, ps, scores, DUR - t, (i) => lives[i] > 0 ? hearts(lives[i]) : 'OUT');
    if (t < 4) txt(g, 'Dodge meteors with your whole body • catch ⭐ with hands', W / 2, 130, 28);
  };
  return G;
}

// =============================== 11. YOGA FREEZE ===============================
function yogaFreeze(ctx) {
  const ps = ctx.players, LIST = ['armsUp', 'tpose', 'oneLeg', 'warrior', 'chair', 'star', 'leanL', 'leanR'], HOLD = 3, WIN = 12;
  let idx = 0, wt = 0, gap = 0;
  const hold = ps.map(() => 0), done = ps.map(() => false), scores = ps.map(() => 0), G = { scores, over: false };
  G.update = (dt) => {
    if (gap > 0) { gap -= dt; if (gap <= 0) { idx++; wt = 0; hold.fill(0); done.fill(false); if (idx >= LIST.length) G.over = true; } return; }
    wt += dt;
    const pose = POSES[LIST[idx]];
    ps.forEach((p, i) => {
      if (done[i] || !p.present) return;
      if (pose.check(p)) { hold[i] += dt; scores[i] += dt * 10; if (hold[i] >= HOLD) { done[i] = true; scores[i] += 50; sfx('good'); ctx.fx.text('NAMASTE 🙏', ps.length > 1 ? (i ? W * 0.75 : W * 0.25) : W / 2, H / 2, p.color, 56); } }
      else hold[i] = Math.max(0, hold[i] - dt * 0.5);
    });
    if (done.every(Boolean) || wt > WIN) gap = 1.2;
  };
  G.draw = (g) => {
    bg(g, '#134e5e', '#71b280');
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.arc(W / 2, H + 300, 700, 0, 7); g.fill();
    const name = LIST[Math.min(idx, LIST.length - 1)];
    g.fillStyle = 'rgba(0,0,0,0.25)'; rrect(g, 30, 120, 260, 360, 30); g.fill();
    drawTemplate(g, name, 160, 150, 280, '#fff', 10);
    ghosts(g, ps, 0.95);
    txt(g, `${POSES[name].name} • ${POSES[name].hi}`, W / 2, 105, 48, '#fff');
    txt(g, `Hold ${HOLD}s   (${idx + 1}/${LIST.length})`, W / 2, 155, 28, '#e0ffe0');
    ps.forEach((p, i) => {
      const cx = ps.length > 1 ? (i ? W - 150 : 380) : W - 150, cy = H - 140;
      g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 16; g.beginPath(); g.arc(cx, cy, 70, 0, 7); g.stroke();
      g.strokeStyle = done[i] ? '#7dff7d' : p.color; g.beginPath(); g.arc(cx, cy, 70, -Math.PI / 2, -Math.PI / 2 + 6.283 * Math.min(1, hold[i] / HOLD)); g.stroke();
      txt(g, done[i] ? '✔' : `${Math.max(0, HOLD - hold[i]).toFixed(1)}`, cx, cy, 44, '#fff');
    });
    g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(W / 2 - 200, 180, 400, 8); g.fillStyle = '#fff'; g.fillRect(W / 2 - 200, 180, 400 * (1 - Math.min(1, wt / WIN)), 8);
    hud(g, ps, scores, null);
  };
  return G;
}

// =============================== 12. SPRINT RACE (run in place) ===============================
function sprintRace(ctx) {
  const ps = ctx.players, GOAL = 60; let t = 0;
  const rs = ps.map(p => ({ p, d: 0, steps: [], side: null, fin: null, spd: 0 }));
  if (ps.length === 1) rs.push({ cpu: true, d: 0, fin: null, spd: 0 });
  const scores = ps.map(() => 0), G = { scores, over: false };
  G.update = (dt) => {
    t += dt; if (t < 1) return;
    for (const r of rs) {
      if (r.fin != null) continue;
      if (r.cpu) { r.spd = 2.6 + Math.sin(t) * 0.3; r.d += r.spd * dt; }
      else if (r.p.present) {
        const f = r.p.f, lift = (k) => (k.y - f.hm.y) / f.T;
        const L1 = r.p.vis(25) ? lift(f.lk) : 9, R1 = r.p.vis(26) ? lift(f.rk) : 9;
        let side = null; if (L1 < 0.68 && L1 < R1 - 0.1) side = 'l'; else if (R1 < 0.68 && R1 < L1 - 0.1) side = 'r';
        // fallback: hip bounce if knees not visible
        if (L1 === 9 && R1 === 9) side = f.jump > 0.06 ? 'u' : f.jump < 0.02 ? 'd' : r.side;
        if (side && side !== r.side) { if (side !== 'd') { r.d += 1; r.steps.push(t); sfx('tick'); } r.side = side; }
        r.steps = r.steps.filter(s => t - s < 1.5); r.spd = r.steps.length / 1.5;
      }
      if (r.d >= GOAL) { r.d = GOAL; r.fin = t - 1; sfx(r.cpu ? 'bad' : 'win'); }
    }
    rs.forEach((r, i) => { if (!r.cpu) scores[i] = r.fin != null ? Math.round(1000 * 30 / Math.max(5, r.fin)) : Math.round(r.d * 5); });
    if (rs.filter(r => !r.cpu).every(r => r.fin != null) || t > 80) G.over = true;
  };
  G.draw = (g) => {
    bg(g, '#87ceeb', '#f4e1c1');
    g.fillStyle = '#5aa02c'; g.fillRect(0, 230, W, 50);
    const lanes = rs.length, top = 280, lh = (H - top - 20) / lanes, x0 = 150, x1 = W - 120;
    for (let k = 0; k < lanes; k++) { g.fillStyle = k % 2 ? '#c8553d' : '#d9643f'; g.fillRect(0, top + k * lh, W, lh); g.fillStyle = '#fff'; g.fillRect(0, top + k * lh, W, 3); }
    g.fillStyle = '#fff'; g.fillRect(x1, top, 10, H - top); for (let y = top; y < H; y += 20) { g.fillStyle = (y / 20) % 2 ? '#000' : '#fff'; g.fillRect(x1 + 10, y, 10, 20); }
    for (let m = 0; m <= GOAL; m += 10) txt(g, `${m}m`, lerp(x0, x1, m / GOAL), top - 14, 18, '#123', 'center', '700');
    rs.forEach((r, k) => {
      const x = lerp(x0, x1, r.d / GOAL), fy = top + (k + 1) * lh - 10;
      if (r.cpu) { emoji(g, '🤖', x, fy - lh * 0.4, lh * 0.7); txt(g, 'CPU', 60, fy - lh / 2, 26, '#fff'); }
      else { drawPoseInBox(g, r.p, x, fy, lh * 0.95); txt(g, `P${k + 1}`, 60, fy - lh / 2, 30, r.p.color); }
      txt(g, r.fin != null ? `${r.fin.toFixed(1)}s` : `${r.spd.toFixed(1)} steps/s`, W - 240, fy - lh / 2, 24, '#fff', 'right', '700');
    });
    txt(g, 'Run in place! घुटने ऊपर उठाओ 🏃', W / 2, 140, 40, '#123');
    hud(g, ps, scores, null);
    if (t < 1) txt(g, 'READY…', W / 2, 190, 40, '#c00');
  };
  return G;
}

export const GAMES = [
  { id: 'dash', name: 'Jungle Dash', hi: 'जंगल दौड़', icon: '🏃', make: jungleDash, how: 'Step left/right to change lane, JUMP over logs, SQUAT under branches. Collect coins!', howHi: 'बाएँ-दाएँ हटो, लकड़ी पर कूदो, डाली के नीचे बैठो।' },
  { id: 'slice', name: 'Slice Storm', hi: 'फल काटो', icon: '🍉', make: sliceStorm, how: 'Swing your hands fast through flying fruit. Avoid bombs.', howHi: 'हाथ तेज़ी से घुमाकर फल काटो, बम से बचो।' },
  { id: 'gate', name: 'Shape Gate', hi: 'दीवार का छेद', icon: '🧱', make: shapeGate, how: 'Make the pose shown in the wall before it reaches you.', howHi: 'दीवार आने से पहले वही पोज़ बनाओ।' },
  { id: 'jacks', name: 'Jack Attack', hi: 'जंपिंग जैक', icon: '🤸', make: jackAttack, how: 'Do as many jumping jacks as you can in 45 seconds.', howHi: '45 सेकंड में ज़्यादा से ज़्यादा जंपिंग जैक करो।' },
  { id: 'squat', name: 'Squat Tower', hi: 'स्क्वाट टावर', icon: '🏗️', make: squatTower, how: 'Every full squat adds a block. Build the tallest tower in 60s.', howHi: 'हर स्क्वाट से टावर ऊँचा होगा।' },
  { id: 'bubble', name: 'Bubble Pop', hi: 'बुलबुले फोड़ो', icon: '🫧', make: bubblePop, how: 'Touch bubbles to pop them. Gold = +5, red spiky = -3.', howHi: 'हाथ से बुलबुले फोड़ो, लाल काँटे वाले से बचो।' },
  { id: 'goal', name: 'Goal Guard', hi: 'गोलकीपर', icon: '🧤', make: goalGuard, how: 'Block the ball with your hands where the ring shows.', howHi: 'जहाँ गोला दिखे वहाँ हाथ लगाकर गेंद रोको।' },
  { id: 'punch', name: 'Punch Pads', hi: 'मुक्का पैड', icon: '🥊', make: punchPads, how: 'Punch the targets around you fast to build combos.', howHi: 'अपने आसपास के निशानों पर तेज़ मुक्का मारो।' },
  { id: 'glide', name: 'Sky Glider', hi: 'उड़ती चिड़िया', icon: '🐦', make: skyGlider, how: 'Raise both arms and pull them down to flap. Fly through the gaps.', howHi: 'दोनों हाथ ऊपर से नीचे करो = चिड़िया उड़ेगी।' },
  { id: 'meteor', name: 'Meteor Dodge', hi: 'उल्का से बचो', icon: '☄️', make: meteorDodge, how: 'Move and duck to dodge meteors. Grab stars with your hands.', howHi: 'हिलकर उल्का से बचो, हाथ से तारे पकड़ो।' },
  { id: 'yoga', name: 'Yoga Freeze', hi: 'योग फ्रीज़', icon: '🧘', make: yogaFreeze, how: 'Copy each yoga pose and hold it still for 3 seconds.', howHi: 'हर योग पोज़ 3 सेकंड तक रोको।' },
  { id: 'race', name: 'Sprint Race', hi: 'दौड़ रेस', icon: '🏁', make: sprintRace, how: 'Run in place with high knees to race to 60 m.', howHi: 'एक जगह खड़े होकर तेज़ दौड़ो, घुटने ऊपर।' },
];
