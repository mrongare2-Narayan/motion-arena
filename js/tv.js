// Motion Arena – TV / big-screen app: connection, menu, game runner.
import { W, H, Player, FX, now, clamp, lerp, dist, txt, rrect, emoji, bg, drawAvatar, sfx, unlockAudio, COLORS } from './engine.js';
import { GAMES } from './games.js';
import { Dance } from './dance.js';

const Q = new URLSearchParams(location.search);
const cv = document.getElementById('cv'); cv.width = W; cv.height = H;
const g = cv.getContext('2d');
function fit() { const s = Math.min(innerWidth / W, innerHeight / H); cv.style.width = W * s + 'px'; cv.style.height = H * s + 'px'; }
addEventListener('resize', fit); fit();

const players = [new Player(0), new Player(1)];
const fx = new FX();
let menuT = 0, overT = 0, state = 'menu', sel = 0, overSel = 0, def = null, game = null, ctx = null, active = [], readyT = 0, dwell = { key: null, t: 0 }, lastFrame = now(), noBodyT = 0, results = null;
const best = (() => { try { return JSON.parse(localStorage.getItem('ma_best') || '{}'); } catch (e) { return {}; } })();
const saveBest = () => { try { localStorage.setItem('ma_best', JSON.stringify(best)); } catch (e) { } };

// ---------------- pose input routing ----------------
const sources = new Map(); // id -> {slot, t}
let lastPoseT = 0;
function onPoses(srcId, poses) {
  lastPoseT = now();
  const src = sources.get(srcId) || { tp: -99 }; sources.set(srcId, src);
  if (!poses || !poses.length) return;
  src.tp = now();
  const live = [...sources.entries()].filter(([, s]) => now() - s.tp < 2);
  if (live.length >= 2) { // two phones each seeing someone → one player per phone
    const slot = live.findIndex(([id]) => id === srcId) % 2; players[slot].feed(poses[0]); return;
  }
  const hx = (a) => (a[23 * 3] + a[24 * 3]) / 2000 * W;
  const ps = poses.slice(0, 2);
  if (ps.length === 1) {
    const x = hx(ps[0]);
    const cand = players.filter(p => p.present);
    let target = players[0];
    if (cand.length) target = cand.reduce((b, p) => Math.abs(p.f.cx - x) < Math.abs(b.f.cx - x) ? p : b);
    target.feed(ps[0]);
  } else {
    ps.sort((a, b) => hx(a) - hx(b));
    let swap = false;
    const p0 = players[0].present, p1 = players[1].present;
    if (p0 && p1) {
      const d0 = Math.abs(players[0].f.cx - hx(ps[0])) + Math.abs(players[1].f.cx - hx(ps[1]));
      const d1 = Math.abs(players[0].f.cx - hx(ps[1])) + Math.abs(players[1].f.cx - hx(ps[0]));
      swap = d1 < d0;
    } else if (p0 || p1) { // keep the person already playing in their slot; the newcomer gets the other one
      const k = p0 ? 0 : 1, near = Math.abs(players[k].f.cx - hx(ps[0])) <= Math.abs(players[k].f.cx - hx(ps[1])) ? 0 : 1;
      swap = (near !== k);
    }
    players[0].feed(ps[swap ? 1 : 0]); players[1].feed(ps[swap ? 0 : 1]);
  }
}

// ---------------- connection (phone → TV over WebRTC via PeerJS) ----------------
let code = null, peer = null, conns = [], netStatus = 'Connecting to internet…', qrImg = null, phoneUrl = '';
function makeQR(text) {
  try {
    const q = window.qrcode(0, 'M'); q.addData(text); q.make();
    const n = q.getModuleCount(), s = 6, c = document.createElement('canvas'); c.width = c.height = (n + 8) * s;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#000';
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) x.fillRect((k + 4) * s, (r + 4) * s, s, s);
    return c;
  } catch (e) { return null; }
}
let idRetries = 0, restartT = null;
function restartPeer(ms) { clearTimeout(restartT); restartT = setTimeout(() => { try { peer && peer.destroy(); } catch (e) { } startPeer(); }, ms); }
function startPeer() {
  if (!window.Peer) { netStatus = 'Network library missing'; return; }
  if (!code) { try { code = localStorage.getItem('ma_code'); } catch (e) { } }
  if (!code) code = String(1000 + Math.floor(Math.random() * 9000));
  const ph = Q.get('peerhost'), pp = Q.get('peerport');
  phoneUrl = new URL('phone.html?code=' + code + (ph ? '&peerhost=' + ph + '&peerport=' + (pp || 9000) : ''), location.href).href;
  qrImg = makeQR(phoneUrl);
  const p = peer = new window.Peer('motionarena-' + code, peerOpts());
  p.on('open', () => { if (p !== peer) return; idRetries = 0; netStatus = 'ready'; try { localStorage.setItem('ma_code', code); } catch (e) { } });
  p.on('error', (e) => {
    if (p !== peer) return;
    console.warn('peer error', e.type, e);
    if (e.type === 'unavailable-id') {
      // after a TV refresh the old id can stay reserved for a few seconds: retry the same code first
      if (++idRetries > 4) { idRetries = 0; code = null; try { localStorage.removeItem('ma_code'); } catch (er) { } }
      netStatus = 'Reserving code…'; restartPeer(3000); return;
    }
    if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(e.type)) { netStatus = 'No internet for pairing – retrying…'; restartPeer(4000); }
  });
  p.on('disconnected', () => { if (p === peer && !p.destroyed) setTimeout(() => { try { if (p === peer && p.disconnected && !p.destroyed) p.reconnect(); } catch (e) { } }, 1000); });
  p.on('connection', (c) => {
    c.on('open', () => { c._last = now(); conns.push(c); sfx('good'); c.send({ t: 'hi', game: def ? def.name : (state === 'dance' ? 'Dance Studio' : 'Menu') }); });
    c.on('data', (d) => { if (!d) return; c._last = now(); if (d.t === 'pose') onPoses(c.peer, d.p); else if (d.t === 'song') { const ok = dance.addSong(d.url, d.title); try { c.send({ t: 'songAck', ok }); } catch (e) { } if (ok && state === 'menu') startGame(12); } });
    c.on('close', () => { conns = conns.filter(x => x !== c); sources.delete(c.peer); });
    c.on('error', () => { conns = conns.filter(x => x !== c); });
  });
}
function peerOpts() { const h = Q.get('peerhost'); return h ? { debug: 1, host: h, port: +(Q.get('peerport') || 9000), path: '/', secure: location.protocol === 'https:' && h !== 'localhost' } : { debug: 1 }; }
const tellPhones = (msg) => conns.forEach(c => { try { c.open && c.send(msg); } catch (e) { } });
// heartbeat to phones + drop phones that went silent (closed tab, Wi‑Fi lost)
setInterval(() => {
  tellPhones({ t: 'hb' });
  for (const c of conns) if (now() - (c._last || 0) > 8) { try { c.close(); } catch (e) { } sources.delete(c.peer); c._gone = true; }
  conns = conns.filter(c => !c._gone);
}, 1000);

// ---------------- local camera / simulator modes ----------------
let localPreview = null, sim = null;
async function startLocalCamera() {
  const { startCamera, createTracker, pack } = await import('./pose.js');
  const video = document.createElement('video'); video.setAttribute('playsinline', '');
  localPreview = video; netStatus = 'local';
  try {
    await startCamera(video, 'user');
    const tr = await createTracker(2, (s) => netStatus = 'local:' + s);
    netStatus = 'local';
    const loop = () => { try { const r = tr.detect(video); if (r) onPoses('local', pack(r)); } catch (e) { console.warn(e); } requestAnimationFrame(loop); };
    loop();
  } catch (e) { netStatus = 'Camera error: ' + e.message; }
}
async function startSim() {
  const { Sim } = await import('./sim.js'); sim = new Sim(); netStatus = 'sim';
  setInterval(() => { sim.step(1 / 30); onPoses('sim', sim.poses()); }, 33);
}

// ---------------- input: TV remote / keyboard / hand hover ----------------
function startGame(i) {
  if (i === 12) { sel = 12; def = null; state = 'dance'; dance.enter(); sfx('select'); tellPhones({ t: 'hi', game: 'Dance Studio' }); return; }
  sel = i; def = GAMES[i]; state = 'ready'; readyT = 0; fx.p = []; fx.t = []; sfx('select');
  tellPhones({ t: 'hi', game: def.name });
}
function toMenu() { menuT = 0; state = 'menu'; def = null; game = null; players.forEach(p => p.adapt = false); tellPhones({ t: 'hi', game: 'Menu' }); }
function act(a) {
  unlockAudio();
  if (state === 'menu') {
    if (sel === 12) { if (a === 'up') sel = 8; }
    else {
      if (a === 'left') sel = (sel + 11) % 12; if (a === 'right') sel = (sel + 1) % 12;
      if (a === 'up') sel = sel < 4 ? 12 : sel - 4; if (a === 'down') sel = sel >= 8 ? 12 : sel + 4;
    }
    if (a === 'ok') { goFull(); startGame(sel); }
    if (a !== 'ok' && a !== 'back') sfx('tick');
  } else if (state === 'over') {
    if (a === 'left' || a === 'right') overSel = 1 - overSel;
    if (a === 'ok') overSel === 0 ? startGame(sel) : toMenu();
    if (a === 'back') toMenu();
  } else if (state === 'dance') { if (dance.input(a) === 'exit') { dance.exit(); toMenu(); } }
  else if (a === 'back') toMenu();
}
function goFull() { try { if (!document.fullscreenElement && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => { }); } catch (e) { } }
addEventListener('keydown', (e) => {
  const k = e.key, kc = e.keyCode;
  const playingSim = sim && (state === 'play' || state === 'ready' || (state === 'dance' && /rec|play|count/.test(dance.view) && k !== 'Enter'));
  let a = null;
  if (k === 'ArrowLeft') a = 'left'; else if (k === 'ArrowRight') a = 'right'; else if (k === 'ArrowUp') a = 'up'; else if (k === 'ArrowDown') a = 'down';
  else if (k === 'Enter' || k === ' ' || kc === 23 || kc === 66) a = 'ok';
  else if (k === 'Escape' || k === 'Backspace' || k === 'GoBack' || k === 'BrowserBack' || kc === 4 || kc === 10009) a = 'back';
  if (!a) return;
  if (playingSim && a !== 'back') return; // arrows drive the fake body in sim mode
  e.preventDefault(); act(a);
});
history.pushState({ ma: 1 }, ''); addEventListener('popstate', () => { act('back'); history.pushState({ ma: 1 }, ''); });
cv.addEventListener('click', (e) => {
  unlockAudio();
  const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
  if (state === 'menu') { const i = tileAt(x, y); if (i >= 0) { goFull(); startGame(i); } }
  else if (state === 'over') { const b = overBtnAt(x, y); if (b >= 0) { overSel = b; act('ok'); } }
});

// hand cursor (player 1's raised hand)
function cursor() {
  const p = players.find(q => q.present); if (!p) return null;
  const f = p.f, h = f.lw.y < f.rw.y ? f.lw : f.rw;
  if (h.y > f.sm.y + 0.4 * f.T) return null;
  return { x: h.x, y: h.y, p };
}
function doDwell(key, dt, fn) {
  if (key == null) { dwell = { key: null, t: 0 }; return 0; }
  if (dwell.key !== key) dwell = { key, t: 0 };
  dwell.t += dt;
  if (dwell.t >= 1.4) { dwell = { key: null, t: -0.6 }; fn(); return 0; }
  return dwell.t / 1.4;
}
function drawCursor(c, k) {
  if (!c) return;
  g.strokeStyle = '#fff'; g.lineWidth = 5; g.beginPath(); g.arc(c.x, c.y, 26, 0, 7); g.stroke();
  if (k > 0) { g.strokeStyle = '#ffe066'; g.lineWidth = 10; g.beginPath(); g.arc(c.x, c.y, 26, -Math.PI / 2, -Math.PI / 2 + 6.283 * k); g.stroke(); }
  g.fillStyle = c.p.color; g.beginPath(); g.arc(c.x, c.y, 10, 0, 7); g.fill();
}

// ---------------- screens ----------------
const TW = 270, TH = 116, GX = 32, GY = 12, OX = (W - (4 * TW + 3 * GX)) / 2, OY = 132;
const tileRect = (i) => ({ x: OX + (i % 4) * (TW + GX), y: OY + Math.floor(i / 4) * (TH + GY), w: TW, h: TH });
const danceRect = () => ({ x: OX, y: OY + 3 * (TH + GY), w: 4 * TW + 3 * GX, h: 54 });
function tileAt(x, y) { { const r = danceRect(); if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return 12; } for (let i = 0; i < 12; i++) { const r = tileRect(i); if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i; } return -1; }

function connected() { return netStatus.startsWith('local') || netStatus === 'sim' || conns.length > 0; }
function drawStatus() {
  const n = players.filter(p => p.present).length;
  const y = H - 60;
  g.fillStyle = 'rgba(0,0,0,0.45)'; rrect(g, 20, y - 30, W - 40, 72, 20); g.fill();
  let s;
  if (netStatus === 'sim') s = '⌨️ Demo: ←→ move ↑ jump ↓ squat 1-4 arms Q/E lean K leg J jacks R run F flap P=P2';
  else if (netStatus.startsWith('local')) s = '📷 This device camera ' + netStatus.replace('local', '');
  else if (conns.length) s = `📱 ${conns.length} phone${conns.length > 1 ? 's' : ''} connected ✓`;
  else s = netStatus === 'ready' ? `📱 Phone par kholo / Open on phone → code ${code}` : '📡 ' + netStatus;
  txt(g, s, 44, y + 6, 24, '#fff', 'left', '700');
  txt(g, `🧍 Players: ${n}`, W - 44, y + 6, 26, n ? '#7dff7d' : '#ffb3b3', 'right');
}
function drawPairing() {
  // big pairing card when no phone is connected
  g.fillStyle = 'rgba(8,10,30,0.92)'; rrect(g, 140, 120, W - 280, 470, 30); g.fill();
  g.strokeStyle = '#22e3ff'; g.lineWidth = 3; g.stroke();
  txt(g, 'Connect your phone camera', 470, 180, 40, '#fff');
  txt(g, 'फ़ोन को कैमरा बनाओ', 470, 228, 34, '#ffe066');
  const lines = ['1. Phone & TV on the same Wi‑Fi', '2. Scan the QR with the phone', '   (or open the link below)', '3. Allow camera → place phone', '   2–3 m away, full body visible'];
  lines.forEach((l, i) => txt(g, l, 200, 290 + i * 42, 27, '#dfe8ff', 'left', '600'));
  txt(g, `CODE  ${code || '…'}`, 470, 520, 54, '#22e3ff');
  if (qrImg) g.drawImage(qrImg, W - 470, 160, 300, 300);
  txt(g, phoneUrl.replace(/^https?:\/\//, ''), W - 320, 490, 15, '#9fb3ff', 'center', '600');
  txt(g, netStatus === 'ready' ? 'Waiting for phone…' : netStatus, W - 320, 540, 22, '#aaa', 'center', '600');
}
function drawMenu(dt) {
  menuT += dt;
  bg(g, '#0d0f2b', '#2b145a');
  players.forEach(p => p.present && drawAvatar(g, p, { alpha: 0.3 }));
  txt(g, 'MOTION ARENA', W / 2, 52, 56, '#fff');
  txt(g, 'Move your body to play • शरीर हिलाओ, खेल खेलो', W / 2, 100, 24, '#c9b8ff', 'center', '600');
  const c = cursor(); let hov = c ? tileAt(c.x, c.y) : -1;
  for (let i = 0; i < 12; i++) {
    const r = tileRect(i), G = GAMES[i], on = i === sel || i === hov;
    g.fillStyle = on ? 'rgba(34,227,255,0.25)' : 'rgba(255,255,255,0.08)'; rrect(g, r.x, r.y, r.w, r.h, 18); g.fill();
    if (on) { g.strokeStyle = '#22e3ff'; g.lineWidth = 4; g.stroke(); }
    emoji(g, G.icon, r.x + 52, r.y + r.h / 2, 60);
    txt(g, G.name, r.x + 100, r.y + 40, 24, '#fff', 'left');
    txt(g, G.hi, r.x + 100, r.y + 74, 20, '#ffe066', 'left', '600');
    txt(g, best[G.id] ? `Best ${best[G.id]}` : `#${i + 1}`, r.x + 100, r.y + 104, 17, '#aab', 'left', '600');
  }
  { const r = danceRect(), on = sel === 12 || hov === 12;
    g.fillStyle = on ? 'rgba(255,79,163,0.35)' : 'rgba(255,79,163,0.15)'; rrect(g, r.x, r.y, r.w, r.h, 18); g.fill();
    if (on) { g.strokeStyle = '#ff4fa3'; g.lineWidth = 4; g.stroke(); }
    txt(g, '💃  DANCE STUDIO  •  गाने के स्टेप्स सीखो  •  YouTube + score', r.x + r.w / 2, r.y + r.h / 2, 26, '#fff'); }
  if (hov >= 0) sel = hov;
  const k = doDwell(hov >= 0 && menuT > 1.5 ? 'tile' + hov : null, dt, () => startGame(hov));
  if (!connected()) drawPairing();
  else if (!players.some(p => p.present)) txt(g, 'Stand in front of the camera • कैमरे के सामने खड़े हो जाओ', W / 2, H - 104, 26, '#ffe066');
  else txt(g, 'Raise a hand over a game to pick it (or use the TV remote)', W / 2, H - 104, 22, '#cfd', 'center', '600');
  drawStatus();
  drawCursor(c, k);
}
function drawReady(dt) {
  bg(g, '#101a3a', '#0c4b6b');
  const present = players.filter(p => p.present);
  present.forEach(p => drawAvatar(g, p, { alpha: 0.9, label: 'P' + (p.i + 1) }));
  emoji(g, def.icon, W / 2, 110, 90);
  txt(g, `${def.name} • ${def.hi}`, W / 2, 200, 56, '#fff');
  txt(g, def.how, W / 2, 262, 26, '#dfe8ff', 'center', '600');
  txt(g, def.howHi, W / 2, 302, 26, '#ffe066', 'center', '600');
  if (!present.length) { readyT = 0; txt(g, 'Step back so your whole body is visible', W / 2, 420, 34, '#ffb3b3'); txt(g, 'पीछे हटो, पूरा शरीर दिखना चाहिए', W / 2, 470, 32, '#ffb3b3'); }
  else {
    readyT += dt;
    present.forEach(p => p.calibrate(0.15));
    const left = 4 - readyT;
    if (Math.ceil(left) !== Math.ceil(left + dt) && left > 0) sfx('tick');
    txt(g, left > 3 ? 'Stand still… सीधे खड़े रहो' : `${Math.ceil(left)}`, W / 2, 470, left > 3 ? 40 : 140, '#fff');
    txt(g, present.length === 2 ? '2 PLAYERS' : '1 PLAYER  (2nd person can step in)', W / 2, 590, 28, '#7dff7d');
    if (left <= 0) {
      active = present.sort((a, b) => a.i - b.i);
      active.forEach(p => p.calibrate(1));
      ctx = { players: active, fx, flash: 0 };
      game = def.make(ctx); state = 'play'; sfx('go'); noBodyT = 0;
    }
  }
  txt(g, 'Back = menu', W - 30, H - 24, 18, '#99a', 'right', '600');
}
function drawPlay(dt) {
  game.update(Math.min(dt, 0.05)); fx.update(dt);
  game.draw(g); fx.draw(g);
  if (ctx.flash > 0) { g.fillStyle = `rgba(255,60,60,${ctx.flash})`; g.fillRect(0, 0, W, H); ctx.flash -= dt; }
  noBodyT = active.some(p => p.present) ? 0 : noBodyT + dt;
  if (noBodyT > 1.5) { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, H / 2 - 60, W, 120); txt(g, 'Come back in view • कैमरे के सामने आओ', W / 2, H / 2, 40, '#ffe066'); }
  if (game.over) {
    state = 'over'; overSel = 0;
    const sc = game.scores.map(s => Math.floor(s)), top = Math.max(...sc);
    const isBest = top > (best[def.id] || 0); if (isBest) { best[def.id] = top; saveBest(); }
    results = { sc, isBest }; sfx('win'); overT = 0;
  }
}
const overBtn = (i) => ({ x: W / 2 - 330 + i * 360, y: 520, w: 300, h: 90 });
function overBtnAt(x, y) { for (const i of [0, 1]) { const r = overBtn(i); if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i; } return -1; }
function drawOver(dt) {
  overT += dt; fx.update(dt); game.draw(g);
  g.fillStyle = 'rgba(5,5,20,0.82)'; g.fillRect(0, 0, W, H);
  txt(g, 'GAME OVER • खेल खत्म', W / 2, 100, 56, '#fff');
  const sc = results.sc;
  sc.forEach((s, i) => {
    const x = sc.length > 1 ? W / 2 + (i ? 220 : -220) : W / 2;
    txt(g, `P${active[i].i + 1}`, x, 210, 40, active[i].color);
    txt(g, `${s}`, x, 300, 110, '#fff');
  });
  if (sc.length > 1) txt(g, sc[0] === sc[1] ? 'DRAW! बराबर' : `P${active[sc[0] > sc[1] ? 0 : 1].i + 1} WINS! 🏆`, W / 2, 420, 50, '#ffe066');
  else txt(g, results.isBest ? '🏆 NEW BEST! नया रिकॉर्ड' : `Best: ${best[def.id] || 0}`, W / 2, 420, 44, '#ffe066');
  const c = cursor(); let hov = c ? overBtnAt(c.x, c.y) : -1; if (hov >= 0) overSel = hov;
  ['▶ Play again', '☰ Menu'].forEach((l, i) => {
    const r = overBtn(i); g.fillStyle = i === overSel ? '#22e3ff' : 'rgba(255,255,255,0.15)'; rrect(g, r.x, r.y, r.w, r.h, 20); g.fill();
    txt(g, l, r.x + r.w / 2, r.y + r.h / 2, 34, i === overSel ? '#001' : '#fff');
  });
  players.forEach(p => p.present && drawAvatar(g, p, { alpha: 0.5 }));
  const k = doDwell(hov >= 0 && overT > 2 ? 'over' + hov : null, dt, () => act('ok'));
  drawCursor(c, k);
}

function frame() {
  const t = now(), dt = Math.min(0.1, t - lastFrame); lastFrame = t;
  try {
    if (state === 'menu') drawMenu(dt);
    else if (state === 'ready') drawReady(dt);
    else if (state === 'dance') dance.frame(g, dt);
    else if (state === 'play') drawPlay(dt);
    else if (state === 'over') drawOver(dt);
    if (localPreview && localPreview.readyState >= 2 && state !== 'play') { g.save(); g.globalAlpha = 0.8; g.translate(W - 20, 20); g.scale(-1, 1); g.drawImage(localPreview, 0, 0, 200, 150); g.restore(); }
  } catch (e) { console.error(e); txt(g, 'Error: ' + e.message, W / 2, H / 2, 24, '#f55'); }
  requestAnimationFrame(frame);
}

const dance = new Dance({ players, fx, cursor, doDwell, drawCursor, canvas: cv, tellPhones });
if (Q.get('sim')) startSim();
else if (Q.get('cam')) startLocalCamera();
else startPeer();
window.__ma = { get conns() { return conns.length; }, dance, players, get state() { return state; }, startGame, act, GAMES, get game() { return game; } };
frame();
