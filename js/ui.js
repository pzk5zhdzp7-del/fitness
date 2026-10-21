// Gemeinsame Helfer für alle Ansichten
import { state } from './store.js';

// Flüchtiger UI-Zustand (wird nicht gespeichert)
export const ui = {
  foodDay: (new Date().getDay() + 6) % 7,
  foodTab: 'plan',
  shopFromToday: false,
  pending: null,
  holdStart: null,
  holdBeeped: false,
  wakeLock: null,
  render: () => {},
};

export function rerender() {
  ui.render();
}

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function todayIdx() {
  return (new Date().getDay() + 6) % 7; // Montag = 0
}

export const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function unitOf(x) {
  return x.type === 'hold' ? 's' : 'Wdh.';
}

export function fmtRange(level) {
  return `${level.min}–${level.max} ${unitOf(level)}${level.side ? ' je Seite' : ''}`;
}

export function fmtTarget(level) {
  return `${level.sets} × ${fmtRange(level)}`;
}

export function fmtClock(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtDate(d, opts = { weekday: 'short', day: '2-digit', month: '2-digit' }) {
  return new Date(d).toLocaleDateString('de-DE', opts);
}

export function n0(v) {
  return Math.round(v).toLocaleString('de-DE');
}

export function videoLink(name) {
  const q = encodeURIComponent(`${name} calisthenics tutorial`);
  return `<a class="btn ghost small" href="https://www.youtube.com/results?search_query=${q}" target="_blank" rel="noopener">▶︎ Video-Anleitung</a>`;
}

/* ---------- Sheet (Overlay von unten) ---------- */

const $sheet = document.getElementById('sheet');
let closeTimer = null;

export function openSheet(html) {
  clearTimeout(closeTimer);
  $sheet.classList.remove('closing');
  $sheet.style.removeProperty('--fade');
  $sheet.innerHTML = `<div class="panel"><div class="grab"></div>${html}</div>`;
  $sheet.classList.remove('hidden');
}

export function closeSheet() {
  clearTimeout(closeTimer);
  $sheet.classList.add('hidden');
  $sheet.classList.remove('closing');
  $sheet.style.removeProperty('--fade');
  $sheet.innerHTML = '';
}

// Nach unten herausgleiten lassen, dann schließen
function dismissSheet() {
  const panel = $sheet.querySelector('.panel');
  if (!panel) return closeSheet();
  $sheet.classList.add('closing');
  panel.style.transition = 'transform 0.22s ease-in';
  panel.style.transform = 'translateY(100%)';
  $sheet.style.setProperty('--fade', '0');
  closeTimer = setTimeout(closeSheet, 230);
}

$sheet.addEventListener('click', (e) => {
  if (e.target === $sheet) dismissSheet();
});

/* Zum Schließen nach unten ziehen. Am Griff oder Kopf geht das immer,
   im Inhalt nur, wenn er ganz nach oben gescrollt ist. */

let drag = null;

// Liegt zwischen Finger und Panel etwas, das gerade nicht oben steht oder seitlich scrollt?
function scrolledInside(el, panel) {
  for (; el && el !== panel; el = el.parentElement) {
    if (el.matches('input[type=range]')) return true;
    if (el.scrollTop > 0) return true;
  }
  return panel.scrollTop > 0;
}

$sheet.addEventListener('touchstart', (e) => {
  const panel = $sheet.querySelector('.panel');
  if (!panel || e.touches.length !== 1 || $sheet.classList.contains('closing')) return;
  if (!panel.contains(e.target)) return;
  const t = e.touches[0];
  const top = panel.getBoundingClientRect().top;
  drag = {
    panel,
    x: t.clientX,
    y: t.clientY,
    dy: 0,
    mode: null, // null = noch offen, 'drag' = Sheet zieht, 'scroll' = normal scrollen
    handle: t.clientY - top < 44,
    blocked: scrolledInside(e.target, panel),
    samples: [{ y: t.clientY, t: e.timeStamp }],
  };
}, { passive: true });

$sheet.addEventListener('touchmove', (e) => {
  if (!drag) return;
  const t = e.touches[0];
  const dx = t.clientX - drag.x;
  const dy = t.clientY - drag.y;
  if (!drag.mode) {
    // Die erste Bewegung entscheidet: iOS lässt sich nur hier vom Scrollen abhalten
    if (dx === 0 && dy === 0) return;
    const down = dy > 0 && dy >= Math.abs(dx);
    drag.mode = down && (drag.handle || !drag.blocked) ? 'drag' : 'scroll';
    if (drag.mode === 'drag') {
      drag.y = t.clientY; // ab hier ohne Sprung folgen
      drag.panel.style.transition = 'none';
    }
  }
  if (drag.mode !== 'drag') return;
  e.preventDefault();
  const raw = t.clientY - drag.y;
  // nach oben nur mit Widerstand
  drag.dy = raw >= 0 ? raw : -Math.pow(-raw, 0.7);
  drag.panel.style.transform = `translateY(${drag.dy}px)`;
  const h = drag.panel.offsetHeight || 1;
  $sheet.style.setProperty('--fade', String(Math.max(0, 1 - Math.max(0, drag.dy) / h)));
  drag.samples.push({ y: t.clientY, t: e.timeStamp });
  if (drag.samples.length > 5) drag.samples.shift();
}, { passive: false });

function endDrag() {
  if (!drag) return;
  const d = drag;
  drag = null;
  if (d.mode !== 'drag') return;
  const a = d.samples[0];
  const b = d.samples[d.samples.length - 1];
  const v = b.t > a.t ? (b.y - a.y) / (b.t - a.t) : 0; // px pro ms
  const h = d.panel.offsetHeight;
  if (d.dy > Math.min(140, h * 0.35) || (v > 0.5 && d.dy > 20)) {
    dismissSheet();
  } else {
    d.panel.style.transition = 'transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1.2)';
    d.panel.style.transform = '';
    $sheet.style.removeProperty('--fade');
  }
}

$sheet.addEventListener('touchend', endDrag);
$sheet.addEventListener('touchcancel', endDrag);

/* ---------- Ton, Sprache, Bildschirm ---------- */

let audioCtx = null;
export function unlockAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch { /* kein Audio */ }
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

export function beep(times = 1, freq = 880, gap = 0.25) {
  if (!audioCtx) return;
  for (let i = 0; i < times; i++) {
    const t = audioCtx.currentTime + i * gap;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.2);
  }
}

let voice = null;
function pickVoice() {
  const voices = window.speechSynthesis?.getVoices() || [];
  voice = voices.find((v) => v.lang === 'de-DE') || voices.find((v) => v.lang?.startsWith('de')) || null;
}
if ('speechSynthesis' in window) {
  pickVoice();
  window.speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
}

export function speak(text) {
  if (!state.settings.voice || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'de-DE';
    if (voice) u.voice = voice;
    u.rate = 1.05;
    window.speechSynthesis.speak(u);
  } catch { /* nicht verfügbar */ }
}

export async function keepAwake(on) {
  try {
    if (on && !ui.wakeLock && 'wakeLock' in navigator) {
      ui.wakeLock = await navigator.wakeLock.request('screen');
      ui.wakeLock.addEventListener('release', () => { ui.wakeLock = null; });
    } else if (!on && ui.wakeLock) {
      await ui.wakeLock.release();
      ui.wakeLock = null;
    }
  } catch { /* nicht unterstützt */ }
}

export function isStandalone() {
  return window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
}

/* ---------- Diagramme ---------- */

function fmtNum(v) {
  return v.toLocaleString('de-DE', { maximumFractionDigits: 1 });
}

export function lineChart(points) {
  if (points.length < 2) return '';
  const w = 300, h = 80, pad = 6;
  const max = Math.max(...points), min = Math.min(...points);
  const span = max - min || 1;
  const xy = points.map((v, i) => [
    pad + (i * (w - 2 * pad)) / (points.length - 1),
    h - pad - ((v - min) / span) * (h - 2 * pad),
  ]);
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <polyline points="${xy.map((p) => p.join(',')).join(' ')}"/>
    ${xy.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3"/>`).join('')}</svg>
    <div class="flex between small muted"><span>${fmtNum(min)}</span><span>${fmtNum(max)}</span></div>`;
}

export function barChart(values, labels) {
  const max = Math.max(1, ...values);
  return `<div class="bars">${values.map((v, i) => `
    <div class="bar"><span class="v">${v || ''}</span><div style="height:${(v / max) * 100}%"></div><span class="l">${labels[i]}</span></div>`).join('')}</div>`;
}
