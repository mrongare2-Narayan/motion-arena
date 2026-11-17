// Motion Arena – TV / big-screen app: connection, sections menu, game runner.
import { W, H, S, saveSettings, nameOf, Player, FX, now, clamp, lerp, txt, ptxt, rrect, emoji, bg, sparkle, drawAvatar, sfx, say, unlockAudio, COLORS } from './engine.js';
import { UI, drawCursor, handCursor } from './ui.js';
import { GAMES } from './games.js';
import { EX, routine, makePlan, yogaPlan, planSeconds, LEVELS, FOCUS, todayFocus, fitLoad, streak } from './exercise.js';
import { Dance } from './dance.js';

const Q = new URLSearchParams(location.search);
const cv = document.getElementById('cv'); cv.width = W; cv.height = H;
const g = cv.getContext('2d');
function fit() { const s = Math.min(innerWidth / W, innerHeight / H); cv.style.width = W * s + 'px'; cv.style.height = H * s + 'px'; }
addEventListener('resize', fit); fit();

const UPI = 'upi://pay?pa=7387302451@ybl&pn=Mohit%20Suryakantsinh%20%20Rongare&mc=0000&mode=02&purpose=00';
const UPI_ID = '7387302451@ybl', MADE_BY = 'Mohit';

const players = [new Player(0), new Player(1)];
const fx = new FX();
const ui = new UI(g);
let state = 'home', stT = 0, def = null, game = null, ctx = null, active = [], readyT = 0, lastFrame = now(), noBodyT = 0, results = null, skipPair = false;
let lastSec = 'arena', pickSlot = 0, resetArm = false;
const best = (() => { try { return JSON.parse(localStorage.getItem('ma_best') || '{}'); } catch (e) { return {}; } })();
const saveBest = () => { try { localStorage.setItem('ma_best', JSON.stringify(best)); } catch (e) { } };
const wk = { level: 'med', mins: 15, focus: 'auto' };
try { Object.assign(wk, JSON.parse(localStorage.getItem('ma_wk') || '{}')); } catch (e) { }
const saveWk = () => { try { localStorage.setItem('ma_wk', JSON.stringify(wk)); } catch (e) { } };

// ---------------- activities ----------------
const ARENA = GAMES.map(x => ({ ...x, sec: 'arena' }));
const EX_LIST = ['squat', 'jacks', 'pushup', 'highKnees', 'crunch', 'punches', 'armRaise', 'toeTouch', 'sideBend', 'plank', 'chair', 'balance'];
const exDef = (id, sec = 'exercise') => {
  const e = EX[id], one = e.kind === 'reps' ? { ex: id, target: null, secs: 60, phase: 'main' } : { ex: id, target: 30, phase: 'main' };
  return { id: 'ex_' + id, sec, name: e.name.split('•')[0].trim(), hi: e.hi, icon: e.icon, how: e.kind === 'reps' ? `${e.cue}. Count as many as you can in 60 s.` : `${e.cue}. Hold for 30 s.`, howHi: e.cueHi, setup: e.setup, make: (c) => routine(c, { steps: [one] }, { count: false, best: true }) };
};
const workoutDef = () => {
  const plan = makePlan(wk.level, wk.mins, wk.focus, fitLoad().done || 0);
  return { id: 'workout', sec: 'exercise', name: "Today's Workout", hi: 'आज का वर्कआउट', icon: '🗓️', how: `${FOCUS[plan.focus].name} • ${LEVELS[wk.level].name} • about ${Math.round(planSeconds(plan.steps) / 60)} min. Warm-up → sets → rest → cool-down.`, howHi: 'वार्म-अप → सेट्स → आराम → कूल-डाउन', make: (c) => routine(c, plan) };
};
const YOGA_ASANAS = ['y_mountain', 'y_raised', 'y_fold', 'y_tree', 'y_chair', 'y_warrior', 'y_triangle', 'y_star', 'y_sideL', 'y_sideR', 'y_prayer', 'balance'];
const YOGA_BIG = [
  { id: 'yogaflow', sec: 'yoga', name: 'Yoga Flow', hi: 'योग सत्र', icon: '🌅', desc: '11 asanas, guided • ~6 min', how: 'Follow the white figure into each asana and hold it. Breathing guide at start and end.', howHi: 'हर आसन करो और रुको। शुरू और आख़िर में साँस का अभ्यास।', make: (c) => routine(c, yogaPlan(15), { yoga: true }) },
  { ...GAMES.find(x => x.id === 'yoga'), sec: 'yoga', desc: 'Hold poses for points' },
  { id: 'breath', sec: 'yoga', name: 'Breathing', hi: 'प्राणायाम', icon: '🌬️', desc: 'Calm breathing • 2 min', how: 'Sit or stand comfortably. Breathe in as the circle grows, out as it shrinks.', howHi: 'गोला बड़ा हो तो साँस लो, छोटा हो तो छोड़ो।', make: (c) => routine(c, { steps: [{ ex: 'breathe', target: 120, phase: 'cool' }] }, { yoga: true, count: false }) },
];

// ---------------- pose input routing ----------------
const sources = new Map(); // id -> {tp}
function onPoses(srcId, poses) {
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
    } else if (p0 || p1) {
      const k = p0 ? 0 : 1, near = Math.abs(players[k].f.cx - hx(ps[0])) <= Math.abs(players[k].f.cx - hx(ps[1])) ? 0 : 1;
      swap = (near !== k);
    }
    players[0].feed(ps[swap ? 1 : 0]); players[1].feed(ps[swap ? 0 : 1]);
  }
}

// ---------------- connection (phone → TV over WebRTC via PeerJS) ----------------
let code = null, peer = null, conns = [], netStatus = 'Connecting to internet…', qrImg = null, phoneUrl = '';
function makeQR(text, ec = 'M') {
  try {
    const q = window.qrcode(0, ec); q.addData(text); q.make();
    const n = q.getModuleCount(), s = 8, c = document.createElement('canvas'); c.width = c.height = (n + 6) * s;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#000';
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) x.fillRect((k + 3) * s, (r + 3) * s, s, s);
    return c;
  } catch (e) { return null; }
}
const upiQR = makeQR(UPI);
let idRetries = 0, restartT = null;
function restartPeer(ms) { clearTimeout(restartT); restartT = setTimeout(() => { try { peer && peer.destroy(); } catch (e) { } startPeer(); }, ms); }
const curName = () => def ? def.name : state === 'dance' ? 'Dance Studio' : 'Menu';
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
      if (++idRetries > 4) { idRetries = 0; code = null; try { localStorage.removeItem('ma_code'); } catch (er) { } }
      netStatus = 'Reserving code…'; restartPeer(3000); return;
    }
    if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(e.type)) { netStatus = 'No internet for pairing – retrying…'; restartPeer(4000); }
  });
  p.on('disconnected', () => { if (p === peer && !p.destroyed) setTimeout(() => { try { if (p === peer && p.disconnected && !p.destroyed) p.reconnect(); } catch (e) { } }, 1000); });
  p.on('connection', (c) => {
    c.on('open', () => { c._last = now(); conns.push(c); sfx('good'); c.send({ t: 'hi', game: curName(), names: [nameOf(0), nameOf(1)] }); });
    c.on('data', (d) => {
      if (!d) return; c._last = now();
      if (d.t === 'pose') onPoses(c.peer, d.p);
      else if (d.t === 'song') { const ok = dance.addSong(d.url, d.title); try { c.send({ t: 'songAck', ok }); } catch (e) { } if (ok && (state === 'home' || state === 'arena')) goDance(); }
      else if (d.t === 'names' && Array.isArray(d.names)) { setNames(d.names); try { c.send({ t: 'namesAck' }); } catch (e) { } }
    });
    c.on('close', () => { conns = conns.filter(x => x !== c); sources.delete(c.peer); });
    c.on('error', () => { conns = conns.filter(x => x !== c); });
  });
}
function setNames(arr) { S.names = [0, 1].map(i => String(arr[i] || '').replace(/[<>]/g, '').trim().slice(0, 14)); saveSettings(); fx.text('✓ Names saved', W / 2, 120, '#7dff7d', 36); }
function peerOpts() { const h = Q.get('peerhost'); return h ? { debug: 1, host: h, port: +(Q.get('peerport') || 9000), path: '/', secure: location.protocol === 'https:' && h !== 'localhost' } : { debug: 1 }; }
const tellPhones = (msg) => conns.forEach(c => { try { c.open && c.send(msg); } catch (e) { } });
setInterval(() => {
  tellPhones({ t: 'hb' });
  for (const c of conns) if (now() - (c._last || 0) > 8) { try { c.close(); } catch (e) { } sources.delete(c.peer); c._gone = true; }
  conns = conns.filter(c => !c._gone);
}, 1000);

// ---------------- local camera / simulator modes ----------------
let localPreview = null, sim = null;
async function startLocalCamera() {
  // One-device mode: try this device's camera. A TV usually has none – then we simply keep phone pairing (always running).
  try {
    const { startCamera, createTracker, pack } = await import('./pose.js');
    const video = document.createElement('video'); video.setAttribute('playsinline', '');
    camStatus = 'Starting camera…';
    await startCamera(video, 'user');
    const tr = await createTracker(2, (s) => camStatus = s);
    camStatus = 'ok'; localPreview = video;
    let lastT = -1;
    const loop = () => {
      if (video.currentTime !== lastT) { lastT = video.currentTime; try { const r = tr.detect(video); if (r) onPoses('local', pack(r)); } catch (e) { console.warn(e); } }
      if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(loop); else setTimeout(loop, 33);
    };
    loop();
  } catch (e) {
    console.warn('local camera failed', e); camStatus = null; localPreview = null;
    fx.text('No camera on this device – connect your phone 📱', W / 2, 640, '#ffe066', 30);
  }
}
let camStatus = null;
async function startSim() {
  const { Sim } = await import('./sim.js'); sim = new Sim(); netStatus = 'sim';
  setInterval(() => { sim.step(1 / 30); onPoses('sim', sim.poses()); }, 33);
}

// ---------------- navigation ----------------
function go(s) { state = s; stT = 0; ui.focus = null; ui.lock = Math.max(ui.lock, 0.5); if (['home', 'arena', 'exercise', 'yoga'].includes(s)) { def = null; game = null; players.forEach(p => p.adapt = false); tellPhones({ t: 'hi', game: 'Menu' }); } }
function startGame(d) {
  def = d; lastSec = d.sec || lastSec; state = 'ready'; stT = 0; readyT = 0; fx.p = []; fx.t = []; ui.focus = null;
  tellPhones({ t: 'hi', game: def.name }); goFull();
}
function goDance() { def = null; lastSec = 'home'; state = 'dance'; dance.enter(); tellPhones({ t: 'hi', game: 'Dance Studio' }); goFull(); }
function back() {
  if (state === 'play') { state = 'pause'; ui.focus = null; sfx('select'); return; }
  if (state === 'pause') { state = 'play'; return; }
  if (state === 'ready' || state === 'over') { go(def && def.sec ? def.sec : 'home'); return; }
  if (state === 'dance') { if (dance.input('back') === 'exit') { dance.exit(); go('home'); } return; }
  if (state !== 'home') { hideNameForm(); go('home'); }
}
function act(a) {
  unlockAudio();
  if (a === 'back') return back();
  if (state === 'dance') { if (dance.input(a) === 'exit') { dance.exit(); go('home'); } return; }
  if (state === 'play') { if (game && game.key) game.key(a); return; }
  if (a === 'ok') { goFull(); ui.press(); } else ui.nav(a);
}
function goFull() { try { if (!document.fullscreenElement && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => { }); } catch (e) { } }
addEventListener('keydown', (e) => {
  if (nameForm.style.display === 'block') return;
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
  const r = cv.getBoundingClientRect(); ui.tap((e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H);
});

// name typing box (TV remote keyboard / laptop)
const nameForm = document.createElement('div');
nameForm.style.cssText = 'position:fixed;display:none;z-index:6;left:50%;top:50%;transform:translate(-50%,-50%);background:#171a3d;color:#fff;padding:20px;border-radius:16px;width:min(520px,90vw);font:18px system-ui,sans-serif;box-shadow:0 10px 40px #000';
nameForm.innerHTML = '<b style="font-size:22px">✏️ Player name / खिलाड़ी का नाम</b><input id="nm-in" maxlength="14" style="display:block;width:100%;box-sizing:border-box;font-size:24px;padding:10px;border-radius:10px;border:1px solid #445;background:#0a0c22;color:#fff;margin:12px 0">' +
  '<button id="nm-ok" style="font-size:20px;font-weight:700;padding:10px 18px;border-radius:10px;border:0;background:#22e3ff">Save</button> <button id="nm-x" style="font-size:20px;padding:10px 18px;border-radius:10px;border:0;background:#2a2f63;color:#fff">Cancel</button>';
document.body.appendChild(nameForm);
const nmIn = nameForm.querySelector('#nm-in');
function showNameForm(i) { pickSlot = i; nmIn.value = S.names[i] && !/^Player \d$/.test(S.names[i]) ? S.names[i] : ''; nameForm.style.display = 'block'; setTimeout(() => nmIn.focus(), 50); }
function hideNameForm() { nameForm.style.display = 'none'; }
function saveNameForm() { const a = [...S.names]; a[pickSlot] = nmIn.value; setNames(a); hideNameForm(); }
nameForm.querySelector('#nm-ok').onclick = saveNameForm; nameForm.querySelector('#nm-x').onclick = hideNameForm;
nmIn.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') saveNameForm(); if (e.key === 'Escape') hideNameForm(); });

// ---------------- shared drawing ----------------
function connected() { return camStatus === 'ok' || netStatus === 'sim' || conns.length > 0; }
function statusChip() {
  const n = players.filter(p => p.present).length;
  let s;
  if (netStatus === 'sim') s = '⌨️ Demo mode';
  else if (camStatus) s = camStatus === 'ok' ? '📷 This device camera ✓' : '📷 ' + camStatus;
  else if (conns.length) s = `📱 ${conns.length} phone${conns.length > 1 ? 's' : ''} ✓`;
  else s = netStatus === 'ready' ? `📱 Code ${code}` : '📡 ' + netStatus;
  ptxt(g, s, W - 28, 30, 19, conns.length || netStatus === 'sim' || camStatus === 'ok' ? '#9dffb0' : '#ffd27d', 'right', '700');
  ptxt(g, n ? players.filter(p => p.present).map(p => '🧍 ' + p.name).join('   ') : '🧍 nobody in view', W - 28, 56, 18, n ? '#fff' : '#ffb3b3', 'right', '700');
}
function header(title, sub, color = '#fff') {
  if (ui.btn('back', 24, 18, 150, 58, { icon: '◀', label: 'Back', size: 24 })) back();
  txt(g, title, W / 2, 42, 40, color);
  if (sub) ptxt(g, sub, W / 2, 80, 19, '#c9d2ff', 'center', '600');
  statusChip();
}
function credit(y = H - 22) {
  ptxt(g, `Made with ❤️ by ${MADE_BY}`, 30, y, 18, '#c9b8ff', 'left', '700');
  ptxt(g, '✋ Raise a hand & hold it on a button  •  or use the TV remote', W / 2, y, 17, '#8f96c8', 'center', '600');
  if (ui.btn('sup2', W - 250, y - 22, 226, 44, { label: '💝 Support', size: 19, r: 14 })) go('support');
}
function drawQR(c, x, y, s) { if (!c) return; g.imageSmoothingEnabled = false; g.drawImage(c, x, y, s, s); g.imageSmoothingEnabled = true; }
function tile(id, d, x, y, w, h, color, note) {
  return ui.btn(id, x, y, w, h, { icon: d.icon, label: d.name, sub: d.hi, size: w < 210 ? 19 : 21, iconSize: Math.min(54, h * 0.5), color, note });
}
function bgMenu(a, b) { bg(g, a, b); sparkle(g, ui.t); players.forEach(p => p.present && drawAvatar(g, p, { alpha: 0.18 })); }

// ---------------- screens ----------------
const SECTIONS = [
  { id: 'arena', icon: '🎮', label: 'Arena', sub: 'खेल', desc: `${ARENA.length} motion games • 1–2 players`, color: '#22e3ff' },
  { id: 'exercise', icon: '💪', label: 'Exercise', sub: 'व्यायाम', desc: 'Rep counter + auto workout plan', color: '#ff9a3b' },
  { id: 'yoga', icon: '🧘', label: 'Yoga', sub: 'योग', desc: 'Asanas, flow & breathing', color: '#7dff9a' },
  { id: 'dance', icon: '💃', label: 'Dance', sub: 'डांस', desc: 'Learn steps from YouTube songs', color: '#ff4fa3' },
];
function drawHome() {
  bgMenu('#0d0f2b', '#2b145a');
  const t = ui.t;
  txt(g, 'MOTION ARENA', W / 2, 50, 58, '#fff');
  if (S.hiQ) { g.save(); g.globalAlpha = 0.5 + 0.3 * Math.sin(t * 2); txt(g, 'MOTION ARENA', W / 2, 50, 58, '#22e3ff'); g.restore(); txt(g, 'MOTION ARENA', W / 2, 48, 58, '#fff'); }
  ptxt(g, 'Your body is the controller • आपका शरीर ही कंट्रोलर है', W / 2, 96, 22, '#c9b8ff', 'center', '600');
  statusChip();
  const cw = 285, gap = 18, x0 = (W - (4 * cw + 3 * gap)) / 2;
  if (!connected() && !skipPair) drawPairing(x0);
  else {
    SECTIONS.forEach((s, i) => {
      if (ui.btn('sec_' + s.id, x0 + i * (cw + gap), 125, cw, 300, { layout: 'card', icon: s.icon, label: s.label, sub: s.sub, desc: s.desc, color: s.color, size: 40, bg: hexBg(s.color, 0.16), bg2: 'rgba(255,255,255,0.03)' })) s.id === 'dance' ? goDance() : go(s.id);
    });
    const small = [['players', '👤', 'Players', 'नाम लिखो'], ['settings', '⚙️', 'Settings', 'सेटिंग'], ['support', '💝', 'Support', 'सहयोग'], ['pair', '📱', 'Phone / Help', 'फ़ोन जोड़ो']];
    small.forEach(([id, ic, l, sb], i) => { if (ui.btn('h_' + id, x0 + i * (cw + gap), 442, cw, 70, { icon: ic, label: l, sub: sb, size: 22, iconSize: 40 })) { if (id === 'pair') { skipPair = false; go('pair'); } else go(id); } });
    if (!players.some(p => p.present)) ptxt(g, 'Stand 2–3 m in front of the phone camera • कैमरे के सामने खड़े हो जाओ', W / 2, 532, 20, '#ffe066', 'center', '700');
  }
  // footer with credit + support QR
  g.fillStyle = 'rgba(0,0,0,0.35)'; rrect(g, x0, 552, W - 2 * x0, 156, 22); g.fill();
  txt(g, `Made with ❤️ by ${MADE_BY}`, x0 + 28, 592, 32, '#fff', 'left');
  ptxt(g, 'Like the game? Contribute for future development 🙏', x0 + 28, 636, 22, '#ffe066', 'left', '700');
  ptxt(g, 'पसंद आया? आगे के विकास के लिए सहयोग करें  •  UPI: ' + UPI_ID, x0 + 28, 670, 19, '#c9d2ff', 'left', '600');
  g.fillStyle = '#fff'; rrect(g, W - x0 - 152, 558, 144, 144, 10); g.fill();
  drawQR(upiQR, W - x0 - 148, 562, 136);
  ptxt(g, 'Scan to pay (UPI)', W - x0 - 170, 690, 15, '#aab', 'right', '600');
}
function hexBg(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
function drawPairing(x0) {
  g.fillStyle = 'rgba(8,10,30,0.92)'; rrect(g, x0, 118, W - 2 * x0, 420, 26); g.fill();
  g.strokeStyle = '#22e3ff'; g.lineWidth = 3; g.stroke();
  txt(g, 'Connect your phone camera', x0 + 360, 160, 36, '#fff');
  txt(g, 'फ़ोन को कैमरा बनाओ', x0 + 360, 202, 30, '#ffe066');
  ['1. Phone & TV on the same Wi‑Fi', '2. Scan this QR with the phone', '   (or open the link on the phone)', '3. Allow camera → place phone at waist', '   height, 2–3 m away, full body visible'].forEach((l, i) => ptxt(g, l, x0 + 40, 252 + i * 36, 24, '#dfe8ff', 'left', '600'));
  txt(g, `CODE  ${code || '…'}`, x0 + 360, 452, 48, '#22e3ff');
  if (qrImg) { g.fillStyle = '#fff'; g.fillRect(W - x0 - 330, 136, 300, 300); drawQR(qrImg, W - x0 - 330, 136, 300); }
  ptxt(g, phoneUrl.replace(/^https?:\/\//, ''), W - x0 - 180, 456, 14, '#9fb3ff', 'center', '600');
  ptxt(g, netStatus === 'ready' ? 'Waiting for phone… फ़ोन का इंतज़ार' : netStatus, W - x0 - 180, 480, 18, '#aaa', 'center', '600');
  if (ui.btn('skip', x0 + 160, 482, 400, 46, { label: 'Continue without phone ▸', size: 20, r: 14 })) skipPair = true;
}
function drawPair() { // pairing/help screen reachable from the home menu
  bgMenu('#0d0f2b', '#1b2a5a');
  header('📱 Phone camera & help', 'Pairing is needed once per session • एक बार जोड़ना है');
  const x0 = 43;
  drawPairing(x0);
  credit();
}
function drawArena() {
  bgMenu('#0d0f2b', '#10304f');
  header('🎮 ARENA • खेल', 'Pick a game • 1 or 2 players (stand side by side)', '#22e3ff');
  const cols = 5, tw = 232, th = 108, gx = 14, gy = 12, x0 = (W - (cols * tw + (cols - 1) * gx)) / 2, y0 = 102;
  ARENA.forEach((d, i) => { if (tile('g_' + d.id, d, x0 + (i % cols) * (tw + gx), y0 + Math.floor(i / cols) * (th + gy), tw, th, '#22e3ff', best[d.id] ? `🏆 ${best[d.id]}` : '')) startGame(d); });
  credit();
}
function drawExercise() {
  bgMenu('#1a0f05', '#3a1a0b');
  const sk = streak(), fl = fitLoad();
  header('💪 EXERCISE • व्यायाम', `🔥 Streak ${sk} day${sk === 1 ? '' : 's'}  •  Workouts done ${fl.done || 0}  •  Minutes ${fl.mins || 0}`, '#ff9a3b');
  // plan builder
  g.fillStyle = 'rgba(255,255,255,0.06)'; rrect(g, 32, 98, 740, 282, 22); g.fill();
  const plan = makePlan(wk.level, wk.mins, wk.focus, fl.done || 0);
  txt(g, `🗓️ Auto workout plan: ${FOCUS[plan.focus].name}`, 52, 126, 26, '#fff', 'left');
  ptxt(g, wk.focus === 'auto' ? `Today's focus changes every day • रोज़ अलग प्लान` : 'Your chosen focus', 52, 156, 17, '#ffd2a6', 'left', '600');
  const row = (y, label, opts, key) => {
    ptxt(g, label, 52, y + 22, 19, '#ffe066', 'left', '800');
    opts.forEach(([v, l], i) => { const on = wk[key] === v; if (ui.btn(`wk_${key}_${v}`, 140 + i * 88, y, 82, 44, { label: l, size: 17, r: 12, solid: on ? '#ff9a3b' : 'rgba(255,255,255,0.1)', color: '#ffbe7a' })) { wk[key] = v; saveWk(); } });
  };
  row(176, 'Level', [['easy', 'Easy'], ['med', 'Medium'], ['hard', 'Hard']], 'level');
  row(230, 'Time', [[10, '10 min'], [15, '15 min'], [20, '20 min'], [30, '30 min']], 'mins');
  row(284, 'Focus', [['auto', 'Auto'], ['full', 'Full'], ['legs', 'Legs'], ['upper', 'Upper'], ['cardio', 'Cardio']], 'focus');
  if (ui.btn('wk_start', 600, 176, 156, 152, { layout: 'card', icon: '▶️', label: 'START', sub: 'शुरू करो', size: 28, color: '#7dff7d', bg: 'rgba(125,255,125,0.2)' })) startGame(workoutDef());
  ptxt(g, `≈ ${Math.round(planSeconds(plan.steps) / 60)} min • ${plan.rounds} round${plan.rounds > 1 ? 's' : ''} • ${LEVELS[wk.level].name}`, 678, 352, 16, '#ffd2a6', 'center', '700');
  // schedule preview
  g.fillStyle = 'rgba(0,0,0,0.3)'; rrect(g, 788, 98, 460, 282, 22); g.fill();
  ptxt(g, 'SCHEDULE • शेड्यूल', 808, 122, 18, '#ffe066', 'left', '800');
  const nm = (s) => EX[s.ex].name.split('•')[0].trim().replace('Standing ', '').replace('Overhead ', '').replace('Wall Sit / ', '');
  const fmt = (s) => `${nm(s)} ${EX[s.ex].kind === 'reps' ? '×' + s.target : s.target + 's'}`;
  const lines = [['🔥 Warm-up', plan.steps.filter(s => s.phase === 'warm' && s.ex).map(fmt).join(', '), '#ffb37a']];
  for (let r = 1; r <= plan.rounds; r++) lines.push([`💪 Round ${r}`, plan.steps.filter(s => s.round === r).map(fmt).join(' → '), '#9fe8ff']);
  lines.push([`⏸ Rest`, `${LEVELS[wk.level].rest}s between sets, ${LEVELS[wk.level].rest * 2}s between rounds`, '#ddd']);
  lines.push(['🧊 Cool-down', plan.steps.filter(s => s.phase === 'cool' && s.ex).map(fmt).join(', '), '#9dffb0']);
  let y = 150;
  for (const [a, b, c] of lines) {
    if (y > 368) break;
    ptxt(g, a, 808, y, 16, c, 'left', '800'); y += 20;
    for (const part of wrap(b, 52)) { if (y > 372) break; ptxt(g, part, 820, y, 15, '#e6e9ff', 'left', '600'); y += 19; }
    y += 4;
  }
  // single exercises
  ptxt(g, 'Single exercise • 60 s rep counter / 30 s hold', 36, 402, 18, '#ffd2a6', 'left', '800');
  const cols = 6, tw = 194, th = 92, gx = 10, x0 = (W - (cols * tw + (cols - 1) * gx)) / 2;
  EX_LIST.forEach((id, i) => { const d = exDef(id); if (tile('ex_' + id, d, x0 + (i % cols) * (tw + gx), 420 + Math.floor(i / cols) * (th + 10), tw, th, '#ff9a3b', best[d.id] ? `🏆 ${best[d.id]}` : '')) startGame(d); });
  credit();
}
function wrap(s, n) { const out = []; let cur = ''; for (const w of s.split(' ')) { if ((cur + ' ' + w).trim().length > n) { out.push(cur.trim()); cur = w; } else cur += ' ' + w; } if (cur.trim()) out.push(cur.trim()); return out; }
function drawYoga() {
  bgMenu('#0b2a22', '#134e5e');
  header('🧘 YOGA • योग', 'Hold each asana steady • शांति से आसन करो', '#7dff9a');
  YOGA_BIG.forEach((d, i) => { if (ui.btn('yb_' + d.id, 32 + i * 412, 102, 392, 196, { layout: 'card', icon: d.icon, label: d.name, sub: d.hi, desc: d.desc, size: 32, color: '#7dff9a', bg: 'rgba(125,255,154,0.14)' })) startGame(d); });
  ptxt(g, 'Practise one asana • 30 s hold', 36, 322, 18, '#bff5cf', 'left', '800');
  const cols = 6, tw = 194, th = 108, gx = 10, x0 = (W - (cols * tw + (cols - 1) * gx)) / 2;
  YOGA_ASANAS.forEach((id, i) => { const d = exDef(id, 'yoga'); d.name = EX[id].short || EX[id].name; if (tile('ya_' + id, d, x0 + (i % cols) * (tw + gx), 340 + Math.floor(i / cols) * (th + 12), tw, th, '#7dff9a')) startGame(d); });
  credit();
}
const CHIPS = ['Papa', 'Mummy', 'Bhaiya', 'Didi', 'Dada', 'Dadi', 'Nana', 'Nani', 'Chachu', 'Bua', 'Friend', 'Guest'];
function drawPlayers() {
  bgMenu('#0d0f2b', '#2b145a');
  header('👤 PLAYERS • खिलाड़ी', 'Choose a player, then pick or type a name');
  [0, 1].forEach(i => {
    const x = 120 + i * 540, on = pickSlot === i;
    if (ui.btn('slot' + i, x, 110, 500, 150, { draw: (gg, b, o, foc) => {
      gg.fillStyle = on ? hexBg(COLORS[i], 0.3) : 'rgba(255,255,255,0.07)'; rrect(gg, b.x, b.y, b.w, b.h, 22); gg.fill();
      gg.lineWidth = foc || on ? 5 : 2; gg.strokeStyle = foc || on ? COLORS[i] : 'rgba(255,255,255,0.2)'; gg.stroke();
      if (b.k > 0) { gg.fillStyle = 'rgba(255,224,102,0.3)'; gg.fillRect(b.x, b.y + b.h - 10, b.w * b.k, 10); }
      ptxt(gg, `PLAYER ${i + 1} ${i ? '(right side)' : '(left side)'}`, b.x + 24, b.y + 30, 18, COLORS[i], 'left', '800');
      txt(gg, nameOf(i), b.x + 24, b.y + 82, 46, '#fff', 'left');
      ptxt(gg, players[i].present ? '🟢 in view' : '⚪ not in view', b.x + b.w - 20, b.y + 30, 17, '#ccd', 'right', '700');
      if (on) ptxt(gg, '◀ selected', b.x + b.w - 20, b.y + 125, 17, '#ffe066', 'right', '800');
    } })) pickSlot = i;
    if (ui.btn('type' + i, x, 270, 240, 52, { label: '⌨️ Type name', size: 20, r: 14 })) showNameForm(i);
    if (ui.btn('clr' + i, x + 260, 270, 240, 52, { label: '↺ Reset', size: 20, r: 14 })) { const a = [...S.names]; a[i] = ''; setNames(a); }
  });
  ptxt(g, `Quick names for ${nameOf(pickSlot)} slot  •  जल्दी से नाम चुनो`, W / 2, 352, 19, '#ffe066', 'center', '800');
  CHIPS.forEach((c, i) => { if (ui.btn('chip' + c, 120 + (i % 6) * 175, 374 + Math.floor(i / 6) * 70, 160, 58, { label: c, size: 22, r: 16, color: COLORS[pickSlot] })) { const a = [...S.names]; a[pickSlot] = c; setNames(a); pickSlot = 1 - pickSlot; } });
  ptxt(g, '📱 Tip: you can also type names on the phone camera page (Players box) • फ़ोन से भी नाम लिख सकते हो', W / 2, 540, 18, '#c9d2ff', 'center', '600');
  credit();
}
function drawSettings() {
  bgMenu('#0d0f2b', '#1d2b4a');
  header('⚙️ SETTINGS • सेटिंग', `Speed: ${fpsShow} fps  •  Graphics now: ${S.hiQ ? 'High' : 'Low (fast)'}`);
  const row = (y, label, hi, opts, cur, set) => {
    ptxt(g, label, 70, y + 18, 22, '#fff', 'left', '800'); ptxt(g, hi, 70, y + 44, 17, '#ffe066', 'left', '600');
    opts.forEach(([v, l], i) => { if (ui.btn(`st_${label}_${i}`, 430 + i * 200, y + 4, 186, 54, { label: l, size: 20, r: 14, solid: cur === v ? '#22e3ff' : 'rgba(255,255,255,0.1)' })) { set(v); saveSettings(); } });
  };
  row(100, 'Motion sensitivity', 'High = छोटी हरकत भी गिनेगा', [[0.8, 'Low'], [1, 'Normal'], [1.25, 'High'], [1.5, 'Max']], S.sens, v => S.sens = v);
  row(180, 'Hand select time', 'हाथ रखकर बटन चुनने का समय', [[2, 'Slow 2 s'], [1.3, 'Normal'], [0.9, 'Fast']], S.dwell, v => S.dwell = v);
  row(260, 'Graphics', 'धीमा टीवी? Low चुनो', [['auto', 'Auto'], ['high', 'High'], ['low', 'Low (fast)']], S.quality, v => { S.quality = v; S.hiQ = v !== 'low'; });
  row(340, 'Sound', 'आवाज़', [[true, 'On'], [false, 'Off']], S.sound, v => S.sound = v);
  row(420, 'Voice coach', 'बोलकर बताएगा (exercise / Raja Bole)', [[true, 'On'], [false, 'Off']], S.voice, v => { S.voice = v; if (v) say('Voice coach on'); });
  if (ui.btn('reset', 430, 510, 386, 54, { label: resetArm ? '⚠️ Press again to clear' : '🗑 Clear best scores', size: 20, r: 14, color: '#ff6b6b' })) {
    if (resetArm) { for (const k in best) delete best[k]; saveBest(); try { localStorage.removeItem('ma_fit'); } catch (e) { } resetArm = false; fx.text('Cleared', W / 2, 600, '#fff', 36); } else resetArm = true;
  }
  credit();
}
function drawSupport() {
  bgMenu('#1a0b2e', '#3b1460');
  header('💝 SUPPORT • सहयोग', '');
  g.fillStyle = '#fff'; rrect(g, 110, 110, 450, 450, 24); g.fill();
  drawQR(upiQR, 125, 125, 420);
  txt(g, 'Like the game?', 620, 170, 44, '#fff', 'left');
  txt(g, 'Contribute for future development 🙏', 620, 225, 30, '#ffe066', 'left');
  ptxt(g, 'पसंद आया? आगे के नए गेम और फ़ीचर के लिए सहयोग करें।', 620, 272, 22, '#e6dcff', 'left', '600');
  ptxt(g, 'Scan with any UPI app: PhonePe, Google Pay, Paytm, BHIM', 620, 330, 21, '#c9d2ff', 'left', '600');
  txt(g, 'UPI ID: ' + UPI_ID, 620, 385, 32, '#7dff9a', 'left');
  txt(g, `Made with ❤️ by ${MADE_BY}`, 620, 470, 34, '#fff', 'left');
  ptxt(g, 'Thank you for playing Motion Arena! • धन्यवाद', 620, 515, 21, '#c9b8ff', 'left', '600');
  credit();
}

function drawReady(dt) {
  bg(g, '#101a3a', '#0c4b6b'); sparkle(g, ui.t);
  const present = players.filter(p => p.present);
  present.forEach(p => drawAvatar(g, p, { alpha: 0.9, label: true }));
  if (ui.btn('back', 24, 18, 150, 58, { icon: '◀', label: 'Back', size: 24 })) { back(); return; }
  emoji(g, def.icon, W / 2, 100, 84);
  txt(g, `${def.name} • ${def.hi}`, W / 2, 186, 50, '#fff');
  wrap(def.how, 78).slice(0, 2).forEach((l, i) => ptxt(g, l, W / 2, 240 + i * 32, 24, '#dfe8ff', 'center', '600'));
  ptxt(g, def.howHi, W / 2, 312, 24, '#ffe066', 'center', '700');
  if (def.setup) ptxt(g, '📱 ' + def.setup, W / 2, 350, 21, '#7dff9a', 'center', '700');
  if (!present.length) { readyT = 0; txt(g, 'Step back so your whole body is visible', W / 2, 440, 34, '#ffb3b3'); txt(g, 'पीछे हटो, पूरा शरीर दिखना चाहिए', W / 2, 490, 32, '#ffb3b3'); }
  else {
    readyT += dt;
    present.forEach(p => p.calibrate(0.15));
    const left = 4 - readyT;
    if (Math.ceil(left) !== Math.ceil(left + dt) && left > 0) sfx('tick');
    if (left > 3) txt(g, 'Stand still… सीधे खड़े रहो', W / 2, 460, 40, '#fff');
    else {
      const k = left - Math.floor(left);
      g.strokeStyle = '#22e3ff'; g.lineWidth = 12; g.beginPath(); g.arc(W / 2, 470, 80, -Math.PI / 2, -Math.PI / 2 + 6.283 * k); g.stroke();
      txt(g, `${Math.ceil(left)}`, W / 2, 470, 110, '#fff');
    }
    txt(g, present.length === 2 ? `2 PLAYERS: ${present[0].name} vs ${present[1].name}` : `1 PLAYER: ${present[0].name}  (2nd person can step in)`, W / 2, 600, 26, '#7dff7d');
    if (left <= 0) {
      active = present.sort((a, b) => a.i - b.i);
      active.forEach(p => p.calibrate(1));
      ctx = { players: active, fx, flash: 0, ui };
      game = def.make(ctx); state = 'play'; sfx('go'); noBodyT = 0;
    }
  }
  ptxt(g, 'Back = menu', W - 30, H - 24, 18, '#99a', 'right', '600');
}
function drawPlay(dt, cur) {
  game.update(Math.min(dt, 0.05)); fx.update(dt);
  game.draw(g); fx.draw(g);
  if (ctx.flash > 0) { g.fillStyle = `rgba(255,60,60,${ctx.flash})`; g.fillRect(0, 0, W, H); ctx.flash -= dt; }
  noBodyT = active.some(p => p.present) ? 0 : noBodyT + dt;
  if (noBodyT > 1.5) { g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, H / 2 - 60, W, 120); txt(g, 'Come back in view • कैमरे के सामने आओ', W / 2, H / 2, 40, '#ffe066'); }
  // pause button (hold hand on it, or Back on the remote); routine also gets a Skip button
  if (ui.btn('pause', 14, 12, 104, 62, { label: '❚❚', size: 26, r: 16, dwell: 1.6, bg: 'rgba(0,0,0,0.35)', bg2: 'rgba(0,0,0,0.35)' })) { state = 'pause'; ui.focus = null; }
  if (game.key && !game.over && ui.btn('skipstep', W - 186, 44, 170, 52, { label: 'Skip ▸', size: 22, r: 16, dwell: 1.6, bg: 'rgba(0,0,0,0.35)', bg2: 'rgba(0,0,0,0.35)' })) game.key('right');
  if (game.over) {
    state = 'over'; stT = 0; ui.focus = null;
    const sc = game.scores.map(s => Math.floor(s)), top = Math.max(...sc);
    const isBest = !game.noBest && top > 0 && top > (best[def.id] || 0);
    if (isBest) { best[def.id] = top; saveBest(); }
    results = { sc, isBest, summary: game.summary }; sfx('win'); fx.confetti(isBest ? 140 : 60);
  }
}
function drawPause() {
  game.draw(g);
  g.fillStyle = 'rgba(5,5,20,0.8)'; g.fillRect(0, 0, W, H);
  txt(g, '⏸ PAUSED • रुका हुआ', W / 2, 150, 56, '#fff');
  ptxt(g, def.name, W / 2, 210, 26, '#c9d2ff', 'center', '700');
  const opts = [['resume', '▶', 'Resume', 'जारी रखो'], ['restart', '↻', 'Restart', 'फिर से'], ['menu', '☰', 'Menu', 'मेन्यू']];
  opts.forEach(([id, ic, l, sb], i) => {
    if (ui.btn('p_' + id, W / 2 - 520 + i * 360, 300, 320, 140, { layout: 'card', icon: ic === '▶' ? '▶️' : ic === '↻' ? '🔁' : '🏠', label: l, sub: sb, size: 32 })) {
      if (id === 'resume') state = 'play'; else if (id === 'restart') startGame(def); else go(def.sec || 'home');
    }
  });
  players.forEach(p => p.present && drawAvatar(g, p, { alpha: 0.3 }));
}
function drawOver(dt) {
  fx.update(dt); game.draw(g);
  g.fillStyle = 'rgba(5,5,20,0.84)'; g.fillRect(0, 0, W, H);
  const r = results;
  if (r.summary) {
    txt(g, def.sec === 'yoga' ? '🙏 NAMASTE • बहुत बढ़िया!' : '🏆 WELL DONE • शाबाश!', W / 2, 80, 50, '#fff');
    r.summary.forEach((l, i) => ptxt(g, l.length > 90 ? l.slice(0, 88) + '…' : l, W / 2, 150 + i * 40, i === 0 ? 30 : 22, i === 0 ? '#ffe066' : '#e6e9ff', 'center', '700'));
    if (r.isBest) txt(g, '🏆 NEW BEST! नया रिकॉर्ड: ' + Math.max(...r.sc), W / 2, 440, 34, '#ffe066');
  } else {
    txt(g, 'GAME OVER • खेल खत्म', W / 2, 90, 54, '#fff');
    r.sc.forEach((s, i) => {
      const x = r.sc.length > 1 ? W / 2 + (i ? 240 : -240) : W / 2;
      txt(g, active[i].name, x, 190, 40, active[i].color);
      txt(g, `${s}`, x, 280, 110, '#fff');
    });
    if (r.sc.length > 1) txt(g, r.sc[0] === r.sc[1] ? 'DRAW! बराबर' : `${active[r.sc[0] > r.sc[1] ? 0 : 1].name} WINS! 🏆`, W / 2, 400, 48, '#ffe066');
    else txt(g, r.isBest ? '🏆 NEW BEST! नया रिकॉर्ड' : `Best: ${best[def.id] || 0}`, W / 2, 400, 42, '#ffe066');
  }
  fx.draw(g);
  players.forEach(p => p.present && drawAvatar(g, p, { alpha: 0.35 }));
  if (stT > 1.2) {
    if (ui.btn('again', W / 2 - 340, 500, 320, 100, { layout: 'card', icon: '🔁', label: 'Play again', size: 28 })) startGame(def);
    if (ui.btn('omenu', W / 2 + 20, 500, 320, 100, { layout: 'card', icon: '☰', label: 'Menu', size: 28 })) go(def.sec || 'home');
  }
}
function drawDanceExtra() {
  // motion-selectable Back / Stop for the Dance Studio
  const v = dance.view;
  if (v === 'list' || v === 'result') { if (ui.btn('dback', 20, 14, 130, 54, { label: '◀ Back', size: 22, r: 14 })) { if (v === 'result') dance.input('back'); else { dance.exit(); go('home'); } } }
  else if (v === 'rec' || v === 'play') { if (ui.btn('dstop', W / 2 - 80, H - 66, 160, 54, { label: '■ Stop', size: 22, r: 14, dwell: 1.8, bg: 'rgba(0,0,0,0.4)' })) dance.input('back'); }
}

// ---------------- main loop ----------------
let emaDt = 1 / 60, slowT = 0, fastT = 0, fpsShow = 60, fpsN = 0, fpsT = 0, errT = 0;
function frame() {
  const t = now(), dt = Math.min(0.1, t - lastFrame); lastFrame = t; stT += dt;
  // adaptive graphics: drop effects if the TV can't keep up
  emaDt = lerp(emaDt, dt, 0.05); fpsN++; if (t - fpsT > 1) { fpsShow = fpsN; fpsN = 0; fpsT = t; }
  if (S.quality === 'auto') {
    if (emaDt > 1 / 38) { slowT += dt; fastT = 0; if (slowT > 3 && S.hiQ) { S.hiQ = false; slowT = 0; } }
    else if (emaDt < 1 / 55) { fastT += dt; slowT = 0; if (fastT > 10 && !S.hiQ) { S.hiQ = true; fastT = 0; } }
  } else S.hiQ = S.quality !== 'low';
  try {
    const raw = handCursor(players, netStatus === 'sim');
    let cur = raw;
    if (state === 'play' && raw && !(raw.y < 210 && (raw.x < 300 || raw.x > W - 300))) cur = null; // during play only the corner buttons react
    if (nameForm.style.display === 'block') cur = null;
    ui.begin(dt, cur);
    switch (state) {
      case 'home': drawHome(); break;
      case 'arena': drawArena(); break;
      case 'exercise': drawExercise(); break;
      case 'yoga': drawYoga(); break;
      case 'players': drawPlayers(); break;
      case 'settings': drawSettings(); break;
      case 'support': drawSupport(); break;
      case 'pair': drawPair(); break;
      case 'ready': drawReady(dt); break;
      case 'play': drawPlay(dt, cur); break;
      case 'pause': drawPause(); break;
      case 'over': drawOver(dt); break;
      case 'dance': dance.frame(g, dt); drawDanceExtra(); break;
    }
    if (state !== 'play' && state !== 'over') { fx.update(dt); fx.draw(g); }
    ui.end({ cursor: state !== 'dance' || !!ui.hov });
    if (localPreview && localPreview.readyState >= 2 && state !== 'play') { g.save(); g.globalAlpha = 0.8; g.translate(W - 20, 90); g.scale(-1, 1); g.drawImage(localPreview, 0, 0, 160, 120); g.restore(); }
  } catch (e) { if (t - errT > 2) { console.error(e); errT = t; } txt(g, 'Error: ' + e.message, W / 2, H / 2, 24, '#f55'); }
  requestAnimationFrame(frame);
}

// Dance Studio keeps its own list UI; give it the shared hand cursor + dwell.
let dw = { key: null, t: 0 };
function doDwell(key, dt, fn) {
  if (key == null) { dw = { key: null, t: 0 }; return 0; }
  if (dw.key !== key) dw = { key, t: 0 };
  dw.t += dt;
  if (dw.t >= S.dwell) { dw = { key: null, t: -0.6 }; fn(); return 0; }
  return Math.max(0, dw.t / S.dwell);
}
const dance = new Dance({ players, fx, cursor: () => ui.cur, doDwell, drawCursor: (c, k) => drawCursor(g, c, k), canvas: cv, tellPhones });
if (Q.get('sim')) startSim();
else { startPeer(); if (Q.get('cam')) startLocalCamera(); }
window.__ma = { get conns() { return conns.length; }, dance, players, get state() { return state; }, go, startGame, act, ARENA, EX, YOGA_BIG, workoutDef, exDef, get game() { return game; }, S, ui };
frame();
