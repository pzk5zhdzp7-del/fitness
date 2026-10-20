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

export function openSheet(html) {
  $sheet.innerHTML = `<div class="panel"><div class="grab"></div>${html}</div>`;
  $sheet.classList.remove('hidden');
}

export function closeSheet() {
  $sheet.classList.add('hidden');
  $sheet.innerHTML = '';
}

$sheet.addEventListener('click', (e) => {
  if (e.target === $sheet) closeSheet();
});

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
