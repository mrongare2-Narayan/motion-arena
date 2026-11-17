// Motion Arena – Dance Studio: YouTube reference + recorded steps + live scoring.
import { W, H, clamp, lerp, txt, rrect, bg, sfx } from './engine.js';

const IDX = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
const J = (lm) => IDX.indexOf(lm);
const SEGS = [
  { a: 11, b: 13, w: 1.5, n: 'Left upper arm', hi: 'बायाँ बाज़ू' }, { a: 13, b: 15, w: 1.5, n: 'Left forearm', hi: 'बायाँ हाथ' },
  { a: 12, b: 14, w: 1.5, n: 'Right upper arm', hi: 'दायाँ बाज़ू' }, { a: 14, b: 16, w: 1.5, n: 'Right forearm', hi: 'दायाँ हाथ' },
  { a: 23, b: 25, w: 1, n: 'Left thigh', hi: 'बायाँ पैर' }, { a: 25, b: 27, w: 1, n: 'Left leg', hi: 'बायाँ पैर' },
  { a: 24, b: 26, w: 1, n: 'Right thigh', hi: 'दायाँ पैर' }, { a: 26, b: 28, w: 1, n: 'Right leg', hi: 'दायाँ पैर' },
  { a: 11, b: 23, w: 0.6, n: 'Body lean', hi: 'कमर' }, { a: 12, b: 24, w: 0.6, n: 'Body lean', hi: 'कमर' },
].map(s => ({ ...s, ja: J(s.a), jb: J(s.b) }));
const BONES = [[11, 13], [13, 15], [12, 14], [14, 16], [11, 12], [23, 24], [11, 23], [12, 24], [23, 25], [25, 27], [24, 26], [26, 28]].map(([a, b]) => [J(a), J(b)]);
const MOVE = 2; // seconds per scored "move"
const SPEEDS = [0.5, 0.75, 1];

// body points relative to hip centre, in torso units ×100
function rel(p) {
  const f = p.f, out = [];
  for (const k of IDX) { const q = p.lm[k]; out.push(Math.round((q.x - f.hm.x) / f.T * 100), Math.round((q.y - f.hm.y) / f.T * 100), q.v > 0.4 ? 1 : 0); }
  return out;
}
function compare(ref, live) {
  let sum = 0, wsum = 0, worst = null, ws = 2;
  for (const s of SEGS) {
    if (!ref[s.ja * 3 + 2] || !ref[s.jb * 3 + 2] || !live[s.ja * 3 + 2] || !live[s.jb * 3 + 2]) continue;
    const rx = ref[s.jb * 3] - ref[s.ja * 3], ry = ref[s.jb * 3 + 1] - ref[s.ja * 3 + 1];
    const lx = live[s.jb * 3] - live[s.ja * 3], ly = live[s.jb * 3 + 1] - live[s.ja * 3 + 1];
    const d = (rx * lx + ry * ly) / (Math.hypot(rx, ry) * Math.hypot(lx, ly) || 1);
    const v = clamp((d - 0.5) / 0.45, 0, 1);
    sum += v * s.w; wsum += s.w;
    if (s.w >= 1 && v < ws) { ws = v; worst = s; }
  }
  return wsum ? { score: sum / wsum * 100, worst: ws < 0.6 ? worst : null } : null;
}
function drawRel(g, a, cx, footY, h, color, lw, alpha = 1, head = true) {
  const s = h / 340, hy = footY - 175 * s, P = (j) => [cx + a[j * 3] * s, hy + a[j * 3 + 1] * s];
  g.save(); g.globalAlpha = alpha; g.strokeStyle = color; g.lineWidth = lw; g.lineCap = 'round';
  for (const [i, j] of BONES) { const [x1, y1] = P(i), [x2, y2] = P(j); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
  if (head) { const [x, y] = P(0); g.fillStyle = color; g.beginPath(); g.arc(x, y, 30 * s * 1.0 + lw * 0.3, 0, 7); g.fill(); }
  g.restore();
}
export function youtubeId(u) {
  u = (u || '').trim();
  const m = u.match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([\w-]{11})/) || u.match(/^([\w-]{11})$/);
  return m ? m[1] : null;
}
function loadYT() {
  if (window.YT && window.YT.Player) return Promise.resolve(true);
  return new Promise((res) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev && prev(); res(true); };
    if (!document.getElementById('yt-api')) { const s = document.createElement('script'); s.id = 'yt-api'; s.src = 'https://www.youtube.com/iframe_api'; s.onerror = () => res(false); document.head.appendChild(s); }
    setTimeout(() => res(!!(window.YT && window.YT.Player)), 6000);
  });
}

export class Dance {
  constructor(o) {
    Object.assign(this, o); // players, fx, cursor, doDwell, drawCursor, canvas, tellPhones
    this.songs = this.load(); this.view = 'list'; this.row = 0; this.col = 0; this.msg = ''; this.delArm = -1;
    this.speed = 2; this.yp = null; this.ytState = -1; this.ytErr = '';
    this.box = document.createElement('div');
    this.box.style.cssText = 'position:fixed;display:none;background:#000;z-index:5;border-radius:12px;overflow:hidden';
    document.body.appendChild(this.box);
    this.form = document.createElement('div');
    this.form.style.cssText = 'position:fixed;display:none;z-index:6;left:50%;top:50%;transform:translate(-50%,-50%);background:#171a3d;color:#fff;padding:20px;border-radius:16px;width:min(560px,90vw);font:18px system-ui,sans-serif;box-shadow:0 10px 40px #000';
    this.form.innerHTML = '<b style="font-size:22px">🎵 Add a dance song</b><p style="color:#aab;margin:6px 0 12px">Paste a YouTube link (TV remote keyboard, or send it from the phone page)</p>' +
      '<input id="dz-url" placeholder="https://youtu.be/…" style="width:100%;font-size:20px;padding:10px;border-radius:10px;border:1px solid #445;background:#0a0c22;color:#fff;margin-bottom:10px">' +
      '<input id="dz-title" placeholder="Song name / गाने का नाम" style="width:100%;font-size:20px;padding:10px;border-radius:10px;border:1px solid #445;background:#0a0c22;color:#fff;margin-bottom:12px">' +
      '<button id="dz-save" style="font-size:20px;font-weight:700;padding:10px 18px;border-radius:10px;border:0;background:#22e3ff">Save</button> <button id="dz-cancel" style="font-size:20px;padding:10px 18px;border-radius:10px;border:0;background:#2a2f63;color:#fff">Cancel</button><div id="dz-err" style="color:#ff7b7b;margin-top:8px"></div>';
    document.body.appendChild(this.form);
    this.form.querySelector('#dz-save').onclick = () => {
      const ok = this.addSong(this.form.querySelector('#dz-url').value, this.form.querySelector('#dz-title').value);
      if (ok) this.closeForm(); else this.form.querySelector('#dz-err').textContent = 'That does not look like a YouTube link.';
    };
    this.form.querySelector('#dz-cancel').onclick = () => this.closeForm();
    this.form.addEventListener('keydown', (e) => e.stopPropagation());
  }
  load() { try { return JSON.parse(localStorage.getItem('ma_songs') || '[]'); } catch (e) { return []; } }
  save() {
    try { localStorage.setItem('ma_songs', JSON.stringify(this.songs)); return true; }
    catch (e) { this.msg = 'TV storage full – delete an old song. स्टोरेज भर गई।'; return false; }
  }
  addSong(url, title) {
    const vid = youtubeId(url); if (!vid) return false;
    const s = this.songs.find(x => x.vid === vid);
    if (s) { if (title) s.title = title; } else this.songs.push({ id: Date.now().toString(36), vid, title: (title || '').trim() || 'Song ' + (this.songs.length + 1), best: 0, rec: null });
    this.save(); sfx('good'); this.msg = '✓ Song added: ' + (title || vid); this.row = this.songs.findIndex(x => x.vid === vid); this.col = 1;
    return true;
  }
  openForm() { this.view = 'form'; this.form.style.display = 'block'; this.form.querySelector('#dz-err').textContent = ''; setTimeout(() => this.form.querySelector('#dz-url').focus(), 50); }
  closeForm() { this.form.style.display = 'none'; this.view = 'list'; this.canvas.focus && this.canvas.focus(); }
  enter() { this.view = 'list'; this.msg = ''; this.listT = 0; loadYT(); }
  exit() { this.stopVideo(); this.form.style.display = 'none'; }

  // ---------- video ----------
  place(x, y, w, h) {
    const r = this.canvas.getBoundingClientRect(), s = r.width / W;
    Object.assign(this.box.style, { display: 'block', left: r.left + x * s + 'px', top: r.top + y * s + 'px', width: w * s + 'px', height: h * s + 'px' });
  }
  async startVideo() {
    this.stopVideo(); this.ytState = -1; this.ytErr = ''; this.clock0 = null;
    const token = this.runToken = (this.runToken || 0) + 1;
    const ok = await loadYT();
    if (token !== this.runToken || (this.view !== 'rec' && this.view !== 'play')) return; // user left while YouTube was loading
    if (!ok || !(window.YT && window.YT.Player)) { this.ytErr = 'YouTube not reachable – using a timer.\nवीडियो नहीं चला, टाइमर से चलेगा।'; return; }
    const div = document.createElement('div'); this.box.innerHTML = ''; this.box.appendChild(div);
    this.yp = new window.YT.Player(div, {
      width: '100%', height: '100%', videoId: this.song.vid,
      playerVars: { autoplay: 1, controls: 0, rel: 0, playsinline: 1, modestbranding: 1, disablekb: 1, fs: 0, iv_load_policy: 3 },
      events: {
        onReady: (e) => { try { e.target.setPlaybackRate(this.view === 'play' ? SPEEDS[this.speed] : 1); e.target.seekTo(0, true); e.target.playVideo(); } catch (er) { } },
        onStateChange: (e) => { this.ytState = e.data; if (e.data === 0) this.finish(); },
        onError: (e) => { this.ytErr = (e.data === 101 || e.data === 150) ? 'This video blocks playing on other sites.\nTry another upload of the song.\nये वीडियो यहाँ नहीं चलेगा।' : 'Video error ' + e.data; this.yp = null; this.clock0 = null; },
      },
    });
  }
  stopVideo() { this.runToken = (this.runToken || 0) + 1; try { this.yp && this.yp.destroy(); } catch (e) { } this.yp = null; this.box.innerHTML = ''; this.box.style.display = 'none'; }
  playing() { return this.yp ? this.ytState === 1 : !!this.ytErr; }
  time() {
    if (this.yp && this.yp.getCurrentTime) { try { return this.yp.getCurrentTime(); } catch (e) { } }
    if (!this.ytErr) return 0;
    if (this.clock0 == null) this.clock0 = performance.now();
    return (performance.now() - this.clock0) / 1000 * (this.view === 'play' ? SPEEDS[this.speed] : 1);
  }

  // ---------- flow ----------
  begin(mode) {
    if (mode === 'play' && !(this.song.rec && this.song.rec.length > 10)) { this.msg = 'Record the steps first (● Record). पहले स्टेप्स रिकॉर्ड करो।'; sfx('bad'); return; }
    this.mode = mode; this.view = 'count'; this.cd = 0; sfx('select');
  }
  startRun() {
    this.view = this.mode; this.frames = []; this.lastRec = -1; this.results = this.act.map(() => []); this.cur = this.act.map(() => ({ w: 0, sum: 0, n: 0, worst: {} }));
    this.live = this.act.map(() => 0); this.label = this.act.map(() => null); this.endT = this.mode === 'play' ? this.song.rec[this.song.rec.length - 1][0] / 100 + 0.5 : 360;
    this.startVideo(); sfx('go');
  }
  finish() {
    if (this.view === 'rec') {
      if (this.frames.length < 20) { this.msg = 'Recording too short.'; this.stopVideo(); this.view = 'list'; return; }
      this.song.rec = this.frames; this.song.best = 0; this.save() || (this.song.rec = null);
      this.msg = this.song.rec ? `✓ Steps saved (${(this.frames[this.frames.length - 1][0] / 100).toFixed(0)} s). Now press ▶ Practice!` : this.msg;
      this.stopVideo(); this.view = 'list'; this.listT = 0; this.col = 0; sfx('win');
    } else if (this.view === 'play') {
      this.act.forEach((p, i) => this.closeMove(i));
      const tot = this.results.map(r => r.length ? Math.round(r.reduce((a, b) => a + b.score, 0) / r.length) : 0);
      this.final = tot; this.newBest = Math.max(...tot) > (this.song.best || 0);
      if (this.newBest) { this.song.best = Math.max(...tot); this.save(); }
      this.stopVideo(); this.view = 'result'; this.rsel = 0; this.rt = 0; sfx('win');
    }
  }
  closeMove(i) {
    const c = this.cur[i]; if (!c.n) return;
    const score = c.sum / c.n, worst = Object.entries(c.worst).sort((a, b) => b[1] - a[1])[0];
    const seg = worst ? SEGS.find(s => s.n === worst[0]) : null;
    this.results[i].push({ w: c.w, score });
    const L = score >= 85 ? ['PERFECT!', '#7dff7d'] : score >= 70 ? ['GREAT', '#b6ff5a'] : score >= 50 ? ['OK', '#ffe066'] : ['MISS', '#ff6b6b'];
    this.label[i] = { s: L[0], c: L[1], fix: score < 85 && seg ? `Fix: ${seg.n} • ${seg.hi}` : '', t: 1.6 };
    if (score >= 70) sfx('rep');
  }
  refAt(t) { // all recorded frames within ±0.3 s of t
    const r = this.song.rec, tt = t * 100; let lo = 0, hi = r.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (r[m][0] < tt - 30) lo = m + 1; else hi = m; }
    const out = []; for (let k = lo; k < r.length && r[k][0] <= tt + 30; k++) out.push(r[k]);
    return out;
  }

  // ---------- input ----------
  input(a) {
    if (this.view === 'form') { if (a === 'back') this.closeForm(); return; }
    if (this.view === 'list') {
      const rows = this.songs.length + 1;
      if (a === 'back') return 'exit';
      if (a === 'up') { this.row = (this.row + rows - 1) % rows; this.delArm = -1; }
      if (a === 'down') { this.row = (this.row + 1) % rows; this.delArm = -1; }
      if (a === 'left') this.col = Math.max(0, this.col - 1);
      if (a === 'right') this.col = Math.min(2, this.col + 1);
      if (a === 'ok') this.activate(this.row, this.col);
      sfx('tick'); return;
    }
    if (this.view === 'result') {
      if (a === 'left' || a === 'right') this.rsel = 1 - this.rsel;
      if (a === 'ok') { if (this.rsel === 0) this.begin('play'); else { this.view = 'list'; this.listT = 0; } }
      if (a === 'back') { this.view = 'list'; this.listT = 0; }
      return;
    }
    if (a === 'back') { if (this.view === 'rec' && this.frames.length > 20) this.finish(); else { this.stopVideo(); this.view = 'list'; } return; }
    if (a === 'ok') {
      if ((this.view === 'rec' || this.view === 'play') && this.yp && this.ytState !== 1) { try { this.yp.playVideo(); } catch (e) { } return; }
      if (this.view === 'rec') this.finish();
    }
    if (this.view === 'play' && (a === 'up' || a === 'down')) {
      this.speed = clamp(this.speed + (a === 'up' ? 1 : -1), 0, 2);
      try { this.yp && this.yp.setPlaybackRate(SPEEDS[this.speed]); } catch (e) { }
    }
  }
  activate(row, col) {
    if (row >= this.songs.length) { this.openForm(); return; }
    this.song = this.songs[row];
    if (col === 0) this.begin('play');
    else if (col === 1) this.begin('rec');
    else {
      if (this.delArm === row) { this.songs.splice(row, 1); this.save(); this.delArm = -1; this.row = 0; this.msg = 'Deleted.'; }
      else { this.delArm = row; this.msg = 'Press 🗑 again to delete “' + this.song.title + '”'; }
    }
  }

  // ---------- frame ----------
  frame(g, dt) {
    const v = this.view;
    if (v === 'list' || v === 'form') return this.drawList(g, dt);
    if (v === 'count') return this.drawCount(g, dt);
    if (v === 'result') return this.drawResult(g, dt);
    this.drawRun(g, dt);
  }
  rowRect(i) { return { x: 70, y: 150 + i * 78, w: W - 140, h: 66 }; }
  btnRect(i, c) { const r = this.rowRect(i); return { x: r.x + r.w - 520 + c * 175, y: r.y + 8, w: 160, h: r.h - 16 }; }
  drawList(g, dt) {
    bg(g, '#2d0b3a', '#7a1f5c');
    txt(g, '💃 DANCE STUDIO • डांस प्रैक्टिस', W / 2, 50, 46, '#fff');
    txt(g, '1) Add a YouTube song  2) ● Record: dance it once with the video  3) ▶ Practice and get scored', W / 2, 100, 21, '#ffd6f0', 'center', '600');
    const c = this.cursor(); let hov = null;
    const max = 6, first = clamp(this.row - max + 2, 0, Math.max(0, this.songs.length + 1 - max));
    for (let k = 0; k < Math.min(max, this.songs.length + 1 - first); k++) {
      const i = first + k, r = this.rowRect(k), on = i === this.row;
      g.fillStyle = on ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)'; rrect(g, r.x, r.y, r.w, r.h, 16); g.fill();
      if (i >= this.songs.length) {
        txt(g, '+ Add YouTube song  (or send link from phone)', r.x + 24, r.y + r.h / 2, 26, '#ffe066', 'left');
        if (c && c.x > r.x && c.x < r.x + r.w && c.y > r.y && c.y < r.y + r.h) hov = [i, 0];
        continue;
      }
      const s = this.songs[i];
      txt(g, s.title.slice(0, 34), r.x + 24, r.y + 22, 26, '#fff', 'left');
      txt(g, (s.rec ? `✓ steps ${(s.rec[s.rec.length - 1][0] / 100).toFixed(0)}s` : '○ no steps yet') + (s.best ? `  •  best ${s.best}%` : ''), r.x + 24, r.y + 48, 18, s.rec ? '#9dffb0' : '#ffb3b3', 'left', '600');
      ['▶ Practice', '● Record', '🗑'].forEach((l, cc) => {
        const b = this.btnRect(k, cc), sel = on && this.col === cc;
        g.fillStyle = sel ? (cc === 2 ? '#ff6b6b' : '#22e3ff') : 'rgba(0,0,0,0.3)'; rrect(g, b.x, b.y, cc === 2 ? 80 : b.w, b.h, 12); g.fill();
        txt(g, l, b.x + (cc === 2 ? 40 : b.w / 2), b.y + b.h / 2, 22, sel ? '#001' : '#fff');
        if (c && c.x > b.x && c.x < b.x + (cc === 2 ? 80 : b.w) && c.y > b.y && c.y < b.y + b.h) hov = [i, cc];
      });
    }
    if (hov) { this.row = hov[0]; this.col = hov[1]; }
    this.listT = (this.listT || 0) + dt;
    const k = this.view === 'list' ? this.doDwell(hov && this.listT > 1.5 ? 'dz' + hov.join() : null, dt, () => this.activate(hov[0], hov[1])) : 0;
    if (this.msg) txt(g, this.msg, W / 2, H - 120, 24, '#ffe066', 'center', '700');
    txt(g, 'Remote: ↑↓ song • ←→ button • OK • Back = menu    |    Raise hand over a button to pick', W / 2, H - 70, 19, '#e7c6dd', 'center', '600');
    this.players.forEach(p => p.present && this.drawAvatarSmall(p));
    this.drawCursor(c, k);
  }
  drawAvatarSmall(p) { /* live mirror hint in the corner */
    const g = this.canvas.getContext('2d'); if (!p.f) return;
    drawRel(g, rel(p), W - 60 - p.i * 70, H - 20, 120, p.color, 5, 0.8);
  }
  drawCount(g, dt) {
    bg(g, '#2d0b3a', '#4a1a6a');
    const present = this.players.filter(p => p.present);
    txt(g, (this.mode === 'rec' ? '● RECORD STEPS • ' : '▶ PRACTICE • ') + this.song.title, W / 2, 90, 44, '#fff');
    txt(g, this.mode === 'rec' ? 'Dance the routine along with the video. Back/OK = stop & save. वीडियो के साथ डांस करो।' : 'Copy the white shadow dancer. ↑/↓ = speed. सफ़ेद परछाई की नकल करो।', W / 2, 150, 24, '#ffd6f0', 'center', '600');
    present.forEach(p => drawRel(g, rel(p), W / 2 + (p.i ? 200 : present.length > 1 ? -200 : 0), H - 120, 330, p.color, 14));
    if (!present.length) { this.cd = 0; txt(g, 'Step back – full body in view • पूरा शरीर दिखना चाहिए', W / 2, H / 2, 32, '#ffb3b3'); return; }
    this.cd += dt; present.forEach(p => p.calibrate(0.15));
    const left = 3.5 - this.cd; if (Math.ceil(left) !== Math.ceil(left + dt) && left > 0) sfx('tick');
    txt(g, left > 3 ? 'Ready…' : `${Math.ceil(left)}`, W / 2, H / 2 - 40, 120, '#fff');
    if (left <= 0) { this.act = this.mode === 'rec' ? [present.sort((a, b) => a.i - b.i)[0]] : present.sort((a, b) => a.i - b.i); this.startRun(); }
  }
  drawRun(g, dt) {
    const rec = this.view === 'rec';
    bg(g, '#1a0826', '#3d0f4f');
    const vx = 24, vy = 96, vw = 620, vh = 349;
    g.fillStyle = '#000'; rrect(g, vx, vy, vw, vh, 12); g.fill();
    if (this.yp) this.place(vx, vy, vw, vh); else { this.box.style.display = 'none'; (this.ytErr || 'Loading video…').split('\n').forEach((l, k) => txt(g, l, vx + vw / 2, vy + vh / 2 - 30 + k * 32, 20, '#ffb3b3', 'center', '600')); }
    const t = this.time(), on = this.playing();
    if (this.yp && !on) txt(g, 'Press OK on the remote to start the video', vx + vw / 2, vy + vh + 30, 22, '#ffe066');
    if (on && t >= this.endT) this.finish();
    if (this.view !== 'rec' && this.view !== 'play') return;
    const ps = this.act, n = ps.length;
    txt(g, `${rec ? '● REC' : '▶'}  ${this.song.title.slice(0, 26)}`, vx, 50, 32, rec ? '#ff4d6d' : '#fff', 'left');
    txt(g, `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}${rec ? '' : '   speed ' + SPEEDS[this.speed] + 'x'}`, W - 30, 50, 28, '#fff', 'right');
    ps.forEach((p, i) => {
      const cx = n > 1 ? 820 + i * 290 : 960, foot = H - 30, hgt = n > 1 ? 400 : 440;
      if (!p.present || !p.f) { txt(g, 'Come back in view', cx, H / 2, 26, '#ffe066'); return; }
      const live = rel(p);
      if (rec) {
        if (on && t - this.lastRec >= 0.066) { this.frames.push([Math.round(t * 100), ...live]); this.lastRec = t; }
        drawRel(g, live, cx, foot, hgt, p.color, 16);
        return;
      }
      const refs = this.refAt(t);
      let best = null; for (const r of refs) { const c = compare(r.slice(1), live); if (c && (!best || c.score > best.score)) best = c; }
      const near = refs.length ? refs[Math.floor(refs.length / 2)].slice(1) : null;
      if (near) drawRel(g, near, cx, foot, hgt, 'rgba(255,255,255,0.9)', 30, 0.35);
      drawRel(g, live, cx, foot, hgt, p.color, 14);
      if (on && best) {
        const w = Math.floor(t / MOVE), cur = this.cur[i];
        if (w !== cur.w) { this.closeMove(i); this.cur[i] = { w, sum: 0, n: 0, worst: {} }; }
        const c2 = this.cur[i]; c2.sum += best.score; c2.n++; if (best.worst) c2.worst[best.worst.n] = (c2.worst[best.worst.n] || 0) + 1;
        this.live[i] = lerp(this.live[i], best.score, 0.15);
      }
      // meter
      const mx = cx - 130, my = 100; g.fillStyle = 'rgba(255,255,255,0.15)'; rrect(g, mx, my, 260, 18, 9); g.fill();
      g.fillStyle = this.live[i] > 70 ? '#7dff7d' : this.live[i] > 50 ? '#ffe066' : '#ff6b6b'; rrect(g, mx, my, 260 * this.live[i] / 100, 18, 9); g.fill();
      txt(g, `P${p.i + 1}  ${Math.round(this.live[i])}%`, cx, my - 18, 22, p.color);
      const L = this.label[i];
      if (L && L.t > 0) { L.t -= dt; g.globalAlpha = clamp(L.t, 0, 1); txt(g, L.s, cx, 160, 50, L.c); if (L.fix) txt(g, L.fix, cx, 205, 20, '#fff', 'center', '700'); g.globalAlpha = 1; }
    });
    // move timeline
    if (!rec) {
      const tx = vx, ty = vy + vh + 60, tw = vw, total = Math.max(1, Math.ceil(this.endT / MOVE));
      txt(g, 'Moves', tx, ty - 16, 18, '#e7c6dd', 'left', '700');
      ps.forEach((p, i) => {
        const y = ty + i * 26;
        g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(tx, y, tw, 20);
        for (const r of this.results[i]) { g.fillStyle = r.score >= 85 ? '#7dff7d' : r.score >= 70 ? '#b6ff5a' : r.score >= 50 ? '#ffe066' : '#ff6b6b'; g.fillRect(tx + r.w / total * tw, y, Math.max(2, tw / total - 1), 20); }
        g.fillStyle = '#fff'; g.fillRect(tx + clamp(t / this.endT, 0, 1) * tw - 1, y - 2, 3, 24);
      });
      txt(g, '↑/↓ speed  •  Back = stop', tx, H - 30, 18, '#e7c6dd', 'left', '600');
    } else txt(g, 'Dance with the video. Press OK or Back to stop & save. ख़त्म होने पर अपने आप सेव होगा।', vx, vy + vh + 40, 20, '#ffd6f0', 'left', '600');
  }
  drawResult(g, dt) {
    this.rt += dt;
    bg(g, '#2d0b3a', '#7a1f5c');
    txt(g, '💃 ' + this.song.title, W / 2, 70, 40, '#fff');
    this.final.forEach((s, i) => {
      const x = this.final.length > 1 ? W / 2 + (i ? 230 : -230) : W / 2, p = this.act[i];
      txt(g, `P${p.i + 1}`, x, 150, 34, p.color);
      txt(g, `${s}%`, x, 240, 110, '#fff');
      const r = this.results[i], cnt = (lo, hi) => r.filter(m => m.score >= lo && m.score < hi).length;
      txt(g, `Perfect ${cnt(85, 101)} • Great ${cnt(70, 85)} • OK ${cnt(50, 70)} • Miss ${cnt(0, 50)}`, x, 330, 20, '#ffd6f0', 'center', '700');
    });
    txt(g, this.newBest ? '🏆 NEW BEST! नया रिकॉर्ड' : `Best: ${this.song.best}%`, W / 2, 400, 40, '#ffe066');
    const c = this.cursor(); let hov = -1;
    ['▶ Practice again', '☰ Songs'].forEach((l, i) => {
      const r = { x: W / 2 - 330 + i * 360, y: 470, w: 300, h: 90 };
      if (c && c.x > r.x && c.x < r.x + r.w && c.y > r.y && c.y < r.y + r.h) hov = i;
      g.fillStyle = i === this.rsel ? '#22e3ff' : 'rgba(255,255,255,0.15)'; rrect(g, r.x, r.y, r.w, r.h, 20); g.fill();
      txt(g, l, r.x + r.w / 2, r.y + r.h / 2, 30, i === this.rsel ? '#001' : '#fff');
    });
    if (hov >= 0) this.rsel = hov;
    const k = this.doDwell(hov >= 0 && this.rt > 2 ? 'dzr' + hov : null, dt, () => this.input('ok'));
    this.drawCursor(c, k);
  }
}
