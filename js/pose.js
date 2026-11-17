// Camera + MediaPipe pose tracking (runs on the phone, or on the TV/laptop in "this device" mode).
import { FilesetResolver, PoseLandmarker } from '../lib/vision_bundle.mjs';

const base = new URL('../lib/', import.meta.url).href;

export async function startCamera(video, facing = 'user') {
  if (video.srcObject) video.srcObject.getTracks().forEach(t => t.stop());
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Camera needs HTTPS (secure page). कैमरा के लिए https लिंक खोलें।');
  const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } } });
  video.srcObject = stream; video.muted = true; video.playsInline = true;
  await video.play();
  return stream;
}

export async function createTracker(numPoses = 2, onStatus = () => { }) {
  onStatus('Loading AI model… (पहली बार 10–20 सेकंड)');
  const fileset = await FilesetResolver.forVisionTasks(base + 'wasm');
  let lm = null, lastErr;
  for (const delegate of ['GPU', 'CPU']) {
    try {
      lm = await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: base + 'pose_landmarker_lite.task', delegate },
        runningMode: 'VIDEO', numPoses,
        minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5,
      });
      onStatus('AI ready (' + delegate + ')');
      break;
    } catch (e) { lastErr = e; console.warn('delegate failed', delegate, e); }
  }
  if (!lm) throw lastErr || new Error('Pose model failed');
  let lastTs = 0;
  return {
    detect(video) {
      if (video.readyState < 2) return null;
      let ts = performance.now(); if (ts <= lastTs) ts = lastTs + 1; lastTs = ts;
      return lm.detectForVideo(video, ts).landmarks || [];
    },
    setNum(n) { return lm.setOptions({ numPoses: n }); },
  };
}

// Mirror x so the screen acts like a mirror; pack to small ints for sending.
export function pack(landmarks) {
  return landmarks.map(p => {
    const a = new Array(99);
    for (let k = 0; k < 33; k++) {
      const q = p[k];
      a[k * 3] = Math.round((1 - q.x) * 1000); a[k * 3 + 1] = Math.round(q.y * 1000); a[k * 3 + 2] = Math.round((q.visibility ?? 1) * 100);
    }
    return a;
  });
}

const BONES = [[11, 13], [13, 15], [12, 14], [14, 16], [11, 12], [23, 24], [11, 23], [12, 24], [23, 25], [25, 27], [24, 26], [26, 28]];
// Draw mirrored preview with skeleton onto a canvas.
export function drawPreview(cv, video, packed, colors = ['#22e3ff', '#ff4fa3']) {
  const g = cv.getContext('2d');
  const w = cv.width, h = cv.height;
  g.save(); g.translate(w, 0); g.scale(-1, 1);
  if (video.readyState >= 2) g.drawImage(video, 0, 0, w, h); else { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); }
  g.restore();
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, w, h);
  packed.forEach((a, i) => {
    g.strokeStyle = colors[i % 2]; g.lineWidth = Math.max(3, w / 120); g.lineCap = 'round';
    for (const [p, q] of BONES) {
      if (a[p * 3 + 2] < 30 || a[q * 3 + 2] < 30) continue;
      g.beginPath(); g.moveTo(a[p * 3] / 1000 * w, a[p * 3 + 1] / 1000 * h); g.lineTo(a[q * 3] / 1000 * w, a[q * 3 + 1] / 1000 * h); g.stroke();
    }
    g.fillStyle = colors[i % 2]; g.beginPath(); g.arc(a[0] / 1000 * w, a[1] / 1000 * h, w / 40, 0, 7); g.fill();
  });
}
