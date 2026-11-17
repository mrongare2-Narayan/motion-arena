// Motion Arena – Exercise & Yoga: rep counting, holds, auto-generated workout schedule, guided runner.
import { W, H, S, clamp, lerp, dist, angle, txt, ptxt, rrect, emoji, bg, sfx, say, POSES, drawDemo, drawAvatar } from './engine.js';

const bT = (p) => (p.base && p.base.T) || p.f.T;
// ---------------- exercise library ----------------
// kind: reps (count with detect) · hold (time while check() is true) · time (follow along) · breath (guided breathing)
export const EX = {
  squat: {
    name: 'Squats', hi: 'स्क्वाट', icon: '🏋️', kind: 'reps', demo: ['base', 'squat'], per: 1.1, kcal: 0.32, spr: 2.4,
    cue: 'Feet shoulder-width, hips back and down, then stand tall', cueHi: 'कुर्सी पर बैठने जैसा नीचे जाओ, फिर सीधे खड़े हो',
    detect(p, s) {
      const f = p.f; let ka = 180;
      if (p.vis(23, 25, 27) && p.vis(24, 26, 28)) ka = (angle(f.lh, f.lk, f.la) + angle(f.rh, f.rk, f.ra)) / 2;
      const down = f.squat > 0.27 || ka < 112 + (S.sens - 1) * 40, upp = f.squat < 0.1 && ka > 150;
      s.hint = s.st !== 'down' && f.squat > 0.12 && !down ? 'Lower! थोड़ा और नीचे' : '';
      if (s.st !== 'down' && down) s.st = 'down';
      else if (s.st === 'down' && upp) { s.st = 'up'; return 'rep'; }
    },
  },
  jacks: {
    name: 'Jumping Jacks', hi: 'जंपिंग जैक', icon: '🤸', kind: 'reps', demo: ['base', 'star'], per: 0.45, kcal: 0.2, spr: 1.1,
    cue: 'Jump feet apart and hands over head, then back', cueHi: 'हाथ ऊपर और पैर खोलो, फिर बंद करो',
    detect(p, s) {
      const f = p.f, legsVis = p.vis(27, 28), T = bT(p);
      const open = f.lw.y < f.nose.y && f.rw.y < f.nose.y && (!legsVis || Math.abs(f.la.x - f.ra.x) > 0.75 * T / S.sens);
      const closed = f.lw.y > f.sm.y + 0.2 * T && f.rw.y > f.sm.y + 0.2 * T;
      s.hint = legsVis ? '' : 'Show your feet! पैर दिखने चाहिए';
      if (s.st !== 'open' && open) { s.st = 'open'; return 'rep'; }
      if (s.st === 'open' && closed) s.st = 'closed';
    },
  },
  pushup: {
    name: 'Push-ups', hi: 'पुश-अप', icon: '💪', kind: 'reps', demo: ['pushUp', 'pushDown'], per: 1.0, kcal: 0.4, spr: 2.6,
    cue: 'Turn SIDEWAYS to the camera. Knees down is fine for beginners', cueHi: 'कैमरे की तरफ़ बगल (साइड) से रहो। घुटने टेककर भी कर सकते हो',
    setup: 'Phone ko neeche (floor ke paas) side me rakho • Place phone low, to your side',
    detect(p, s) {
      const f = p.f, m = p.lm;
      const lv = m[11].v + m[13].v + m[15].v, rv = m[12].v + m[14].v + m[16].v;
      const [a, b, c] = lv > rv ? [m[11], m[13], m[15]] : [m[12], m[14], m[16]];
      if (!f.horiz) { s.hint = 'Get into push-up position, side-on • साइड से'; return; }
      s.hint = '';
      const ang = angle(a, b, c);
      if (s.st !== 'down' && ang < 100 + (S.sens - 1) * 30) s.st = 'down';
      else if (s.st === 'down' && ang > 145) { s.st = 'up'; return 'rep'; }
    },
  },
  highKnees: {
    name: 'High Knees', hi: 'घुटने ऊपर', icon: '🏃', kind: 'reps', demo: ['kneeL', 'kneeR'], per: 0.35, kcal: 0.08, spr: 0.5,
    cue: 'Run in place, knees up to hip height', cueHi: 'एक जगह दौड़ो, घुटने कमर तक',
    detect(p, s) { return knees(p, s, 0.55); },
  },
  march: {
    name: 'March in Place', hi: 'कदमताल', icon: '🚶', kind: 'time', demo: ['kneeL', 'base', 'kneeR', 'base'], per: 0.4, kcal: 0.05,
    cue: 'Easy marching, swing your arms', cueHi: 'आराम से कदमताल करो, हाथ हिलाओ',
    detect(p, s) { return knees(p, s, 0.75); },
  },
  armRaise: {
    name: 'Overhead Reach', hi: 'हाथ ऊपर-नीचे', icon: '🙌', kind: 'reps', demo: ['base', 'armsUp'], per: 0.7, kcal: 0.12, spr: 1.4,
    cue: 'Both hands from your sides to above your head', cueHi: 'दोनों हाथ नीचे से सिर के ऊपर',
    detect(p, s) {
      const f = p.f, T = bT(p);
      const upp = f.lw.y < f.nose.y - 0.05 * T && f.rw.y < f.nose.y - 0.05 * T, dn = f.lw.y > f.sm.y + 0.1 * T && f.rw.y > f.sm.y + 0.1 * T;
      if (s.st !== 'up' && upp) { s.st = 'up'; return 'rep'; }
      if (s.st === 'up' && dn) s.st = 'down';
    },
  },
  sideBend: {
    name: 'Side Bends', hi: 'साइड झुकना', icon: '↔️', kind: 'reps', demo: ['leanL', 'base', 'leanR', 'base'], per: 0.8, kcal: 0.08, spr: 1.6,
    cue: 'Bend left, come back, bend right', cueHi: 'बाएँ झुको, सीधे, फिर दाएँ',
    detect(p, s) {
      const t = p.f.tilt; let side = null;
      if (t < -0.25) side = 'l'; else if (t > 0.25) side = 'r'; else if (Math.abs(t) < 0.12) s.c = true;
      if (side && s.c !== false) { s.c = false; return 'rep'; }
    },
  },
  toeTouch: {
    name: 'Toe Touches', hi: 'पैर छुओ', icon: '🙇', kind: 'reps', demo: ['armsUp', 'fold'], per: 1.1, kcal: 0.15, spr: 2.4,
    cue: 'Reach down towards your toes, then stand up tall', cueHi: 'नीचे झुककर पैर छुओ, फिर सीधे खड़े हो',
    detect(p, s) {
      const f = p.f, T = bT(p), b = p.base || { shY: f.sm.y };
      const dn = f.lw.y > f.hm.y + 0.6 * T / S.sens && f.rw.y > f.hm.y + 0.6 * T / S.sens, upp = f.sm.y < b.shY + 0.2 * T;
      if (s.st !== 'down' && dn) s.st = 'down';
      else if (s.st === 'down' && upp) { s.st = 'up'; return 'rep'; }
    },
  },
  crunch: {
    name: 'Standing Crunch', hi: 'खड़े होकर क्रंच', icon: '🦵', kind: 'reps', demo: ['handsHead', 'crunchL', 'handsHead', 'crunchR'], per: 0.6, kcal: 0.15, spr: 1.5,
    cue: 'Hands at head, bring knee up to the opposite elbow', cueHi: 'घुटना ऊपर उठाकर कोहनी से मिलाओ',
    detect(p, s) {
      const f = p.f, T = bT(p);
      if (!p.vis(25, 26)) { s.hint = 'Show your knees • घुटने दिखाओ'; return; } s.hint = '';
      const d = Math.min(dist(f.le, f.rk), dist(f.re, f.lk), dist(f.le, f.lk), dist(f.re, f.rk));
      const close = d < 0.75 * T * S.sens || Math.min(f.lk.y, f.rk.y) < f.hm.y + 0.25 * T;
      const apart = f.lk.y > f.hm.y + 0.6 * T && f.rk.y > f.hm.y + 0.6 * T;
      if (s.st !== 'in' && close) { s.st = 'in'; return 'rep'; }
      if (s.st === 'in' && apart) s.st = 'out';
    },
  },
  punches: {
    name: 'Side Punches', hi: 'साइड मुक्के', icon: '🥊', kind: 'reps', demo: ['punchL', 'punchR'], per: 0.4, kcal: 0.06, spr: 0.6,
    cue: 'Punch out to the left and right sides, fast', cueHi: 'बाएँ और दाएँ तेज़ मुक्के मारो',
    detect(p, s) {
      const f = p.f, T = bT(p); let r;
      for (const [w, sh, k] of [[f.lw, f.ls, 'l'], [f.rw, f.rs, 'r']]) {
        const d = dist(w, sh);
        if (s[k] !== 'out' && d > 1.0 * T / Math.sqrt(S.sens) && Math.abs(w.y - sh.y) < 0.7 * T) { s[k] = 'out'; r = 'rep'; }
        else if (s[k] === 'out' && d < 0.7 * T) s[k] = 'in';
      }
      return r;
    },
  },
  plank: {
    name: 'Plank', hi: 'प्लैंक', icon: '🧱', kind: 'hold', demo: ['plank'], kcal: 0.08,
    cue: 'Forearms on the floor, body straight like a plank, side-on', cueHi: 'कोहनी ज़मीन पर, शरीर सीधा रखो',
    setup: 'Phone ko neeche side me rakho • Place phone low, to your side',
    check: (p) => p.f.horiz,
  },
  chair: {
    name: 'Wall Sit / Chair Hold', hi: 'कुर्सी होल्ड', icon: '🪑', kind: 'hold', demo: ['squat'], kcal: 0.08,
    cue: 'Sit in the air like on a chair and hold', cueHi: 'हवा में कुर्सी जैसे बैठो और रुको',
    check: (p) => p.f.squat > 0.2,
  },
  armCircles: {
    name: 'Arm Circles', hi: 'हाथ घुमाओ', icon: '🔄', kind: 'time', demo: ['tpose', 'circle1', 'tpose', 'circle2'], per: 0.35, kcal: 0.04,
    cue: 'Arms out wide, make small circles', cueHi: 'हाथ फैलाकर छोटे गोले बनाओ',
  },
  shoulderRoll: {
    name: 'Shoulder Rolls', hi: 'कंधे घुमाओ', icon: '🤷', kind: 'time', demo: ['base', 'shrug'], per: 0.6, kcal: 0.03,
    cue: 'Roll your shoulders up, back and down', cueHi: 'कंधे ऊपर-पीछे-नीचे घुमाओ',
  },
  stretchUp: { name: 'Overhead Stretch', hi: 'ऊपर खिंचाव', icon: '🙆', kind: 'hold', demo: ['mountain'], kcal: 0.03, cue: 'Reach both hands up high and stretch', cueHi: 'दोनों हाथ ऊपर खींचो', check: (p) => POSES.armsUp.check(p) },
  stretchL: { name: 'Side Stretch Left', hi: 'बाएँ खिंचाव', icon: '↖️', kind: 'hold', demo: ['leanL'], kcal: 0.03, cue: 'Lean to one side and hold', cueHi: 'एक तरफ़ झुककर रुको', check: (p) => p.f.tilt < -0.22 },
  stretchR: { name: 'Side Stretch Right', hi: 'दाएँ खिंचाव', icon: '↗️', kind: 'hold', demo: ['leanR'], kcal: 0.03, cue: 'Lean to the other side and hold', cueHi: 'दूसरी तरफ़ झुककर रुको', check: (p) => p.f.tilt > 0.22 },
  fold: { name: 'Forward Fold', hi: 'आगे झुको', icon: '🙇', kind: 'hold', demo: ['fold'], kcal: 0.03, cue: 'Bend forward, let your hands hang down', cueHi: 'आगे झुककर हाथ नीचे लटकाओ', check: (p) => POSES.fold.check(p) },
  balance: { name: 'Balance', hi: 'एक पैर संतुलन', icon: '🦩', kind: 'hold', demo: ['oneLeg'], kcal: 0.03, cue: 'Stand on one leg, arms out', cueHi: 'एक पैर पर खड़े रहो', check: (p) => POSES.oneLeg.check(p) },
  breathe: { name: 'Deep Breathing', hi: 'गहरी साँस', icon: '🌬️', kind: 'breath', demo: ['base', 'armsUp'], per: 4, kcal: 0.02, cue: 'Breathe in as the circle grows, out as it shrinks', cueHi: 'गोला बड़ा हो तो साँस लो, छोटा हो तो छोड़ो' },
};
function knees(p, s, th0) {
  const f = p.f, T = bT(p);
  if (!p.vis(25, 26)) { s.hint = 'Show your knees • घुटने दिखाओ'; return; } s.hint = '';
  const th = th0 + 0.25 * (S.sens - 1), l = (f.lk.y - f.hm.y) / T, r = (f.rk.y - f.hm.y) / T;
  let side = null; if (l < th && l < r - 0.12) side = 'l'; else if (r < th && r < l - 0.12) side = 'r';
  if (side && side !== s.side) { s.side = side; return 'rep'; }
}

// ---------------- yoga asanas (holds) ----------------
const Y = (id, pose, name, hi, icon, cue, cueHi, short) => (EX[id] = { name, short, hi, icon, kind: 'hold', demo: [pose], kcal: 0.04, cue, cueHi, check: (p) => POSES[pose].check(p), yoga: true });
Y('y_mountain', 'mountain', 'Tadasana • Mountain', 'ताड़ासन', '🏔️', 'Stand tall, join hands above your head, stretch up', 'हाथ ऊपर जोड़ो, एड़ियाँ उठाकर खिंचो', 'Mountain');
Y('y_raised', 'armsUp', 'Hasta Uttanasana', 'हस्त उत्तानासन', '🙌', 'Raise both arms up and gently lean back', 'दोनों हाथ ऊपर, हल्का पीछे झुको', 'Raised Arms');
Y('y_fold', 'fold', 'Uttanasana • Forward Bend', 'उत्तानासन', '🙇', 'Bend forward from the hips, hands towards the floor', 'कमर से आगे झुको, हाथ ज़मीन की ओर', 'Forward Bend');
Y('y_tree', 'tree', 'Vrikshasana • Tree', 'वृक्षासन', '🌳', 'Foot on the other leg, hands up together', 'एक पैर दूसरे पैर पर, हाथ ऊपर जोड़ो', 'Tree');
Y('y_chair', 'chair', 'Utkatasana • Chair', 'उत्कटासन', '🪑', 'Bend knees like sitting, arms up', 'घुटने मोड़कर बैठने जैसा, हाथ ऊपर', 'Chair');
Y('y_warrior', 'warrior', 'Virabhadrasana II • Warrior', 'वीरभद्रासन', '⚔️', 'Legs wide, arms stretched out to the sides', 'पैर चौड़े, हाथ दोनों तरफ़ फैलाओ', 'Warrior');
Y('y_triangle', 'triangle', 'Trikonasana • Triangle', 'त्रिकोणासन', '📐', 'Legs wide, one hand down to the leg, other hand up', 'पैर चौड़े, एक हाथ नीचे, दूसरा ऊपर', 'Triangle');
Y('y_star', 'star', 'Five-Point Star', 'तारा आसन', '⭐', 'Arms and legs wide like a star', 'हाथ-पैर तारे जैसे फैलाओ', 'Star');
Y('y_sideL', 'leanL', 'Ardha Chakrasana (side)', 'अर्ध चक्रासन', '🌙', 'Arms up, bend to the side', 'हाथ ऊपर, एक तरफ़ झुको', 'Side Bend L');
Y('y_sideR', 'leanR', 'Ardha Chakrasana (other side)', 'अर्ध चक्रासन', '🌙', 'Now bend to the other side', 'अब दूसरी तरफ़ झुको', 'Side Bend R');
Y('y_prayer', 'prayer', 'Pranamasana • Prayer', 'प्रणामासन', '🙏', 'Palms together at the chest, breathe slowly', 'हथेलियाँ छाती पर जोड़ो, धीरे साँस लो', 'Prayer');

// ---------------- auto workout schedule ----------------
export const LEVELS = { easy: { name: 'Easy', hi: 'आसान', m: 0.6, rest: 30, hold: 20 }, med: { name: 'Medium', hi: 'मध्यम', m: 1, rest: 20, hold: 30 }, hard: { name: 'Hard', hi: 'कठिन', m: 1.5, rest: 15, hold: 45 } };
const BASE = { squat: 12, jacks: 20, pushup: 8, highKnees: 30, armRaise: 14, sideBend: 12, toeTouch: 10, crunch: 16, punches: 30 };
export const FOCUS = {
  full: { name: 'Full body', hi: 'पूरा शरीर', list: ['squat', 'pushup', 'jacks', 'crunch', 'plank', 'punches'] },
  legs: { name: 'Legs & core', hi: 'पैर और पेट', list: ['squat', 'highKnees', 'chair', 'toeTouch', 'crunch'] },
  upper: { name: 'Arms & chest', hi: 'हाथ और छाती', list: ['pushup', 'punches', 'armRaise', 'sideBend', 'plank'] },
  cardio: { name: 'Cardio burn', hi: 'कार्डियो', list: ['jacks', 'highKnees', 'punches', 'crunch', 'squat'] },
};
export function todayFocus() { return ['full', 'legs', 'upper', 'cardio', 'legs', 'full', 'cardio'][new Date().getDay()]; }
export function makePlan(level = 'med', mins = 15, focus = 'auto', done = 0) {
  const lv = LEVELS[level], fk = focus === 'auto' ? todayFocus() : focus, prog = 1 + Math.min(0.3, done * 0.02);
  const warm = [{ ex: 'march', target: 40, phase: 'warm' }, { ex: 'armCircles', target: 30, phase: 'warm' }, { ex: 'shoulderRoll', target: 20, phase: 'warm' }];
  if (mins >= 20) warm.push({ ex: 'sideBend', target: 10, phase: 'warm' });
  const cool = [{ ex: 'stretchUp', target: 20, phase: 'cool' }, { ex: 'stretchL', target: 15, phase: 'cool' }, { ex: 'stretchR', target: 15, phase: 'cool' }, { ex: 'fold', target: 20, phase: 'cool' }, { ex: 'breathe', target: 40, phase: 'cool' }];
  const est = (s) => { const e = EX[s.ex]; return (e.kind === 'reps' ? s.target * e.spr : s.target) + 6; };
  let budget = mins * 60 - warm.reduce((a, s) => a + est(s), 0) - cool.reduce((a, s) => a + est(s), 0);
  const main = []; let round = 1;
  while (round <= 6) {
    let added = 0;
    for (const id of FOCUS[fk].list) {
      const e = EX[id], target = e.kind === 'hold' ? Math.round(lv.hold * prog / 5) * 5 : Math.max(4, Math.round(BASE[id] * lv.m * prog));
      const st = { ex: id, target, phase: 'main', round }, need = est(st) + lv.rest;
      if (need > budget && (round > 1 || added > 2)) break;
      if (main.length && !main[main.length - 1].rest) main.push({ rest: lv.rest, phase: 'main' });
      main.push(st); budget -= need; added++;
    }
    if (budget < 60 || added === 0) break;
    main.push({ rest: lv.rest * 2, phase: 'main', roundBreak: true }); budget -= lv.rest * 2; round++;
  }
  while (main.length && main[main.length - 1].rest) main.pop();
  const steps = [...warm, { rest: 10, phase: 'warm' }, ...main, { rest: 10, phase: 'cool' }, ...cool];
  return { steps, focus: fk, level, mins, rounds: Math.max(...main.filter(s => s.round).map(s => s.round), 1) };
}
export function planSeconds(steps) { return steps.reduce((a, s) => a + (s.rest || (EX[s.ex].kind === 'reps' ? s.target * EX[s.ex].spr : s.target) + 5), 0); }
export const YOGA_FLOW = ['y_mountain', 'y_raised', 'y_fold', 'y_tree', 'y_chair', 'y_warrior', 'y_triangle', 'y_sideL', 'y_sideR', 'y_star', 'y_prayer'];
export function yogaPlan(hold = 15) {
  const steps = [{ ex: 'breathe', target: 24, phase: 'warm' }];
  YOGA_FLOW.forEach((id, i) => { steps.push({ ex: id, target: hold, phase: 'main' }); if (i % 3 === 2) steps.push({ rest: 8, phase: 'main', calm: true }); });
  steps.push({ ex: 'breathe', target: 40, phase: 'cool' });
  return { steps };
}

// ---------------- fitness history ----------------
export function fitLoad() { try { return JSON.parse(localStorage.getItem('ma_fit') || '{}'); } catch (e) { return {}; } }
function fitSave(o) { try { localStorage.setItem('ma_fit', JSON.stringify(o)); } catch (e) { } }
const day = (d) => d.toISOString().slice(0, 10);
export function streak() {
  const f = fitLoad(), ds = f.days || {}; let n = 0; const d = new Date();
  if (!ds[day(d)]) d.setDate(d.getDate() - 1);
  while (ds[day(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// ---------------- guided runner (used for workouts, single exercises and yoga) ----------------
const PH = { warm: ['Warm-up', 'वार्म-अप', '#ff8a3d', '#5a1f0b'], main: ['Workout', 'वर्कआउट', '#22e3ff', '#0b2a4a'], cool: ['Cool-down', 'कूल-डाउन', '#7dff9a', '#0b3a2a'] };
export function routine(ctx, plan, opt = {}) {
  const ps = ctx.players, steps = plan.steps, n = ps.length;
  let idx = -1, st = 0, intro = 0, total = 0, breathT = 0;
  const per = ps.map(() => ({})), tally = ps.map(() => ({})), kcal = ps.map(() => 0);
  const G = { scores: ps.map(() => 0), over: false, noBest: !opt.best };
  const cur = () => steps[idx];
  const begin = (i) => {
    idx = i; st = 0;
    if (idx >= steps.length) { finish(); return; }
    const s = cur(); per.forEach((_, k) => per[k] = { n: 0, hold: 0, s: {}, done: false });
    if (s.rest) { intro = 0; const nx = steps.slice(idx + 1).find(q => q.ex); say(s.calm ? 'Relax' : nx ? `Rest. Next, ${EX[nx.ex].name.split('•')[0]}` : 'Rest'); }
    else { const e = EX[s.ex]; intro = (steps[idx - 1] && steps[idx - 1].rest) ? 2 : 4; say(e.name.split('•')[0] + (e.kind === 'reps' && s.target ? `, ${s.target}` : '')); }
  };
  const finish = () => {
    G.over = true; sfx('win'); say(opt.yoga ? 'Namaste. Well done' : 'Workout complete. Well done!');
    const f = fitLoad(); f.done = (f.done || 0) + (opt.count === false ? 0 : 1); f.days = f.days || {}; f.days[day(new Date())] = true; f.mins = (f.mins || 0) + Math.round(total / 60); fitSave(f);
    const lines = [`⏱ ${Math.floor(total / 60)} min ${Math.round(total % 60)} s`];
    ps.forEach((p, i) => {
      const parts = Object.entries(tally[i]).map(([id, v]) => `${EX[id].name.split('•')[0].trim()} ${EX[id].kind === 'reps' ? v : Math.round(v) + 's'}`);
      lines.push(`${p.name}: 🔥 ${kcal[i].toFixed(0)} kcal`); if (parts.length) lines.push(parts.slice(0, 6).join(' • '));
    });
    lines.push(`🔥 Streak: ${streak()} day${streak() === 1 ? '' : 's'}  •  Workouts done: ${f.done}`);
    G.summary = lines;
  };
  G.key = (a) => { if (a === 'right' || a === 'ok') { skip(); return true; } return false; };
  const skip = () => { if (!G.over) { sfx('select'); begin(idx + 1); } };
  begin(0);
  G.update = (dt) => {
    if (G.over) return;
    total += dt; breathT += dt;
    const s = cur();
    if (intro > 0) { intro -= dt; if (intro <= 0) sfx('go'); return; }
    st += dt;
    if (s.rest) { const left = s.rest - st; if (left < 3 && Math.ceil(left) !== Math.ceil(left + dt)) sfx('tick'); if (st >= s.rest) begin(idx + 1); return; }
    const e = EX[s.ex];
    ps.forEach((p, i) => {
      const c = per[i]; if (!p.present || !p.f) return;
      if (e.kind === 'reps' || (e.kind === 'time' && e.detect)) {
        const r = e.detect(p, c.s);
        if (r === 'rep') { c.n++; if (e.kind === 'reps') { tally[i][s.ex] = (tally[i][s.ex] || 0) + 1; kcal[i] += e.kcal; G.scores[i]++; sfx('rep'); } }
        if (e.kind === 'reps' && s.target && c.n >= s.target && !c.done) { c.done = true; sfx('good'); ctx.fx.text('DONE! 👍', p.f.nose.x, p.f.nose.y - 90, p.color, 50); }
      } else if (e.kind === 'hold') {
        if (e.check(p)) { c.hold += dt; G.scores[i] += dt; tally[i][s.ex] = (tally[i][s.ex] || 0) + dt; kcal[i] += e.kcal * dt; c.ok = true; if (c.hold >= s.target && !c.done) { c.done = true; sfx('good'); } }
        else c.ok = false;
      } else { kcal[i] += e.kcal * dt; }
    });
    const live = ps.filter(p => p.present);
    let fin = false;
    if (e.kind === 'reps') fin = (s.target && live.length && live.every(p => per[ps.indexOf(p)].done)) || st > (s.target ? s.target * e.spr * 2.5 + 20 : s.secs || 60);
    else if (e.kind === 'hold') fin = (live.length && live.every(p => per[ps.indexOf(p)].done)) || st > s.target * 2 + 15;
    else fin = st >= s.target;
    if (e.kind !== 'reps' && e.kind !== 'hold') { const left = s.target - st; if (left < 3 && Math.ceil(left) !== Math.ceil(left + dt)) sfx('tick'); }
    if (fin) begin(idx + 1);
  };
  G.draw = (g) => {
    if (G.over) { bg(g, '#0b3a2a', '#134e5e'); return; }
    const s = cur(), ph0 = PH[s.phase] || PH.main, ph = opt.yoga && s.phase === 'main' ? ['Yoga', 'योग', '#7dff9a', '#0b3a2a'] : ph0;
    bg(g, ph[3], s.rest ? '#05060f' : '#0d0f2b');
    // progress strip
    const x0 = 140, x1 = W - 200, wseg = (x1 - x0) / steps.length;
    steps.forEach((q, k) => { g.fillStyle = k < idx ? PH[q.phase][2] : k === idx ? '#fff' : 'rgba(255,255,255,0.15)'; g.globalAlpha = q.rest ? 0.35 : 1; g.fillRect(x0 + k * wseg + 1, 22, wseg - 2, 10); });
    g.globalAlpha = 1;
    ptxt(g, `${ph[0]} • ${ph[1]}${s.round ? `  •  Round ${s.round}/${plan.rounds}` : ''}`, x0, 52, 20, ph[2], 'left', '800');
    ptxt(g, `Step ${idx + 1}/${steps.length}`, x1, 52, 18, '#aab', 'right', '700');
    if (s.rest) return drawRest(g, s, ph);
    const e = EX[s.ex];
    // left: demo card
    g.fillStyle = 'rgba(0,0,0,0.35)'; rrect(g, 24, 80, 330, 470, 26); g.fill();
    drawDemo(g, e.demo, breathT, 189, 110, e.demo[0].startsWith('push') || e.demo[0] === 'plank' ? 260 : 330, ph[2], 9, e.per || 1);
    txt(g, e.name.split('•')[0].trim(), 189, 470, e.name.length > 18 ? 26 : 32, '#fff');
    txt(g, e.hi, 189, 510, 26, '#ffe066', 'center', '700');
    // live players
    ps.forEach(p => p.present && drawAvatar(g, p, { alpha: 0.95, label: n > 1 }));
    // cue
    g.fillStyle = 'rgba(0,0,0,0.4)'; rrect(g, 24, 570, W - 48, 70, 18); g.fill();
    ptxt(g, e.cue, 44, 592, 21, '#fff', 'left', '700'); ptxt(g, e.cueHi + (e.setup ? '   📱 ' + e.setup : ''), 44, 620, 19, '#ffe066', 'left', '600');
    // counters
    ps.forEach((p, i) => {
      const c = per[i], cx = n > 1 ? (i ? W - 150 : W - 410) : W - 170, cy = 230, R = 95;
      g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.arc(cx, cy, R + 22, 0, 7); g.fill();
      let k, big, small;
      if (e.kind === 'reps') { k = s.target ? c.n / s.target : (st / (s.secs || 60)); big = `${c.n}`; small = s.target ? `/ ${s.target} reps` : 'reps'; }
      else if (e.kind === 'hold') { k = c.hold / s.target; big = `${Math.max(0, Math.ceil(s.target - c.hold))}`; small = c.ok ? 'HOLD ✓ रुको' : 'get in pose'; }
      else { k = st / s.target; big = `${Math.max(0, Math.ceil(s.target - st))}`; small = e.kind === 'breath' ? '' : 'seconds'; }
      g.strokeStyle = 'rgba(255,255,255,0.15)'; g.lineWidth = 18; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke();
      g.strokeStyle = c.done ? '#7dff7d' : (e.kind === 'hold' && !c.ok ? '#ff9a6b' : p.color); g.lineCap = 'round'; g.beginPath(); g.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + 6.283 * clamp(k, 0, 1)); g.stroke(); g.lineCap = 'butt';
      txt(g, c.done ? '✔' : big, cx, cy - 8, 74, '#fff');
      ptxt(g, small, cx, cy + 50, 20, '#dfe8ff', 'center', '700');
      if (n > 1) txt(g, p.name.slice(0, 10), cx, cy - R - 38, 24, p.color);
      if (c.s && c.s.hint && !c.done) txt(g, c.s.hint, cx, cy + R + 50, 20, '#ffe066', 'center', '700');
      if (!p.present) txt(g, 'Come in view', cx, cy + R + 50, 22, '#ffb3b3');
      if (e.kind === 'reps' && !s.target) ptxt(g, `${Math.max(0, Math.ceil((s.secs || 60) - st))} s left`, cx, cy + R + 80, 20, '#aab', 'center', '700');
    });
    if (e.kind === 'breath') drawBreath(g, W / 2 + 80, 330, breathT);
    if (intro > 0) {
      g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(360, 250, W - 380, 200);
      txt(g, `Get ready: ${e.name.split('•')[0].trim()}`, W / 2 + 170, 310, 44, '#fff');
      txt(g, s.target && e.kind === 'reps' ? `${s.target} reps` : `${s.target} seconds`, W / 2 + 170, 370, 36, ph[2]);
      txt(g, `${Math.ceil(intro)}`, W / 2 + 170, 420, 40, '#ffe066');
    }
    nextLine(g);
  };
  function nextLine(g) {
    const nx = steps.slice(idx + 1).find(q => !q.rest);
    if (nx) ptxt(g, `Next ▸ ${EX[nx.ex].name.split('•')[0].trim()} ${EX[nx.ex].kind === 'reps' ? '×' + nx.target : nx.target + 's'}`, W - 30, H - 50, 20, '#c9d2ff', 'right', '700');
    ptxt(g, '→ / OK = skip', 30, H - 50, 18, '#889', 'left', '600');
  }
  function drawRest(g, s, ph) {
    const left = Math.max(0, s.rest - st), nx = steps.slice(idx + 1).find(q => q.ex);
    txt(g, s.roundBreak ? 'ROUND BREAK • थोड़ा आराम' : s.calm ? 'Relax • आराम' : 'REST • आराम', W / 2, 130, 56, '#fff');
    g.strokeStyle = 'rgba(255,255,255,0.15)'; g.lineWidth = 20; g.beginPath(); g.arc(W / 2, 330, 120, 0, 7); g.stroke();
    g.strokeStyle = ph[2]; g.beginPath(); g.arc(W / 2, 330, 120, -Math.PI / 2, -Math.PI / 2 + 6.283 * (left / s.rest)); g.stroke();
    txt(g, `${Math.ceil(left)}`, W / 2, 330, 96, '#fff');
    ptxt(g, '💧 Paani pi lo, gehri saans lo • Sip water, breathe', W / 2, 500, 24, '#cfe', 'center', '700');
    if (nx && nx.ex) {
      const e = EX[nx.ex];
      g.fillStyle = 'rgba(255,255,255,0.08)'; rrect(g, W - 380, 170, 330, 380, 24); g.fill();
      ptxt(g, 'NEXT ▸', W - 215, 200, 22, ph[2], 'center', '800');
      drawDemo(g, e.demo, breathT, W - 215, 215, e.demo[0].startsWith('push') || e.demo[0] === 'plank' ? 200 : 250, '#fff', 7, e.per || 1);
      txt(g, e.name.split('•')[0].trim(), W - 215, 490, 26, '#fff');
      ptxt(g, e.kind === 'reps' ? `${nx.target} reps` : `${nx.target} sec`, W - 215, 525, 22, '#ffe066', 'center', '700');
      if (e.setup) ptxt(g, '📱 ' + e.setup, W / 2, 545, 19, '#ffe066', 'center', '700');
    }
    ps.forEach(p => p.present && drawAvatar(g, p, { alpha: 0.35 }));
    nextLine(g);
  }
  return G;
}
function drawBreath(g, cx, cy, t) {
  const c = (t % 10), inhale = c < 4, hold = c >= 4 && c < 5, k = inhale ? c / 4 : hold ? 1 : 1 - (c - 5) / 5;
  const r = 50 + 90 * (k * k * (3 - 2 * k));
  g.fillStyle = 'rgba(125,255,154,0.18)'; g.beginPath(); g.arc(cx, cy, r + 20, 0, 7); g.fill();
  g.fillStyle = 'rgba(125,255,154,0.35)'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
  txt(g, inhale ? 'Breathe in • साँस लो' : hold ? 'Hold • रोको' : 'Breathe out • साँस छोड़ो', cx, cy, 30, '#fff');
}
