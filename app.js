import { HELLO_AUDIO_B64, HELLO_AUDIO_MIME } from './hello-audio.js';

const $ = (id) => document.getElementById(id);

const nose = $('nose');
const statusEl = $('status');
const startBtn = $('start');
const stopBtn = $('stop');
const everySec = $('every-sec');
const minSec = $('min-sec');
const maxSec = $('max-sec');
const runMin = $('run-min');
const notifyBox = $('notify');
const wakeBox = $('wakelock');
const intervalFields = $('interval-fields');
const randomFields = $('random-fields');

const KEY = 'hello-nose-settings-v1';

let audio;
let timerId = null;
let runUntil = 0;
let wakeLock = null;
let playCount = 0;
let mode = 'interval';

function b64ToUrl() {
  const bin = atob(HELLO_AUDIO_B64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: HELLO_AUDIO_MIME });
  return URL.createObjectURL(blob);
}

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (s.mode) mode = s.mode;
    if (s.every) everySec.value = s.every;
    if (s.min) minSec.value = s.min;
    if (s.max) maxSec.value = s.max;
    if (s.run != null) runMin.value = s.run;
    if (s.notify != null) notifyBox.checked = s.notify;
    if (s.wake != null) wakeBox.checked = s.wake;
  } catch (_) { /* ignore */ }
  document.querySelectorAll('input[name="mode"]').forEach((el) => {
    el.checked = el.value === mode;
  });
  syncModeUi();
}

function saveSettings() {
  localStorage.setItem(KEY, JSON.stringify({
    mode,
    every: Number(everySec.value),
    min: Number(minSec.value),
    max: Number(maxSec.value),
    run: Number(runMin.value),
    notify: notifyBox.checked,
    wake: wakeBox.checked,
  }));
}

function syncModeUi() {
  intervalFields.classList.toggle('hidden', mode !== 'interval');
  randomFields.classList.toggle('hidden', mode !== 'random');
}

function setStatus(text) {
  statusEl.textContent = text;
}

function ensureAudio() {
  if (!audio) {
    audio = new Audio(b64ToUrl());
    audio.preload = 'auto';
    audio.addEventListener('ended', () => nose.classList.remove('playing'));
  }
  return audio;
}

function playOnce() {
  const a = ensureAudio();
  a.currentTime = 0;
  const p = a.play();
  nose.classList.add('playing');
  if (p && p.catch) p.catch(() => setStatus('Playback blocked until you tap the nose.'));
  playCount += 1;
  if (notifyBox.checked) pingNotify();
}

async function pingNotify() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const opts = {
      body: 'Hello',
      icon: 'icons/nose.svg',
      badge: 'icons/nose.svg',
      silent: true,
      tag: 'hello-nose',
      renotify: false,
    };
    if (reg) await reg.showNotification('Hello', opts);
    else new Notification('Hello', opts);
  } catch (_) { /* ignore */ }
}

function nextDelayMs() {
  if (mode === 'interval') {
    const s = Math.max(1, Number(everySec.value) || 30);
    return s * 1000;
  }
  const min = Math.max(1, Number(minSec.value) || 15);
  const max = Math.max(min, Number(maxSec.value) || 90);
  return (min + Math.random() * (max - min)) * 1000;
}

function scheduleNext() {
  if (runUntil && Date.now() >= runUntil) {
    stopTimer('Window ended.');
    return;
  }
  const delay = nextDelayMs();
  const when = new Date(Date.now() + delay);
  const left = runUntil ? ` · stop ${new Date(runUntil).toLocaleTimeString()}` : '';
  setStatus(`Next ${when.toLocaleTimeString()}${left} · ${playCount} played`);
  timerId = setTimeout(() => {
    playOnce();
    scheduleNext();
  }, delay);
}

async function acquireWake() {
  if (!wakeBox.checked || !('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch (_) { /* denied / unsupported */ }
}

async function releaseWake() {
  try { await wakeLock?.release(); } catch (_) { /* ignore */ }
  wakeLock = null;
}

async function startTimer() {
  saveSettings();
  if (mode === 'random' && Number(maxSec.value) < Number(minSec.value)) {
    setStatus('Max must be ≥ min.');
    return;
  }
  const minutes = Math.max(0, Number(runMin.value) || 0);
  runUntil = minutes > 0 ? Date.now() + minutes * 60 * 1000 : 0;
  playCount = 0;
  startBtn.disabled = true;
  stopBtn.disabled = false;
  nose.classList.add('armed');
  if (notifyBox.checked && 'Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
  await acquireWake();
  playOnce();
  scheduleNext();
}

function stopTimer(reason) {
  if (timerId) clearTimeout(timerId);
  timerId = null;
  runUntil = 0;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  nose.classList.remove('armed');
  releaseWake();
  setStatus(reason || `Stopped · ${playCount} played`);
}

document.querySelectorAll('input[name="mode"]').forEach((el) => {
  el.addEventListener('change', () => {
    mode = el.value;
    syncModeUi();
    saveSettings();
  });
});

[everySec, minSec, maxSec, runMin, notifyBox, wakeBox].forEach((el) => {
  el.addEventListener('change', saveSettings);
});

nose.addEventListener('click', () => {
  ensureAudio();
  playOnce();
  if (!timerId) setStatus('Hello');
});

startBtn.addEventListener('click', startTimer);
stopBtn.addEventListener('click', () => stopTimer());

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && timerId && wakeBox.checked) acquireWake();
});

loadSettings();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* offline first not required */ });
}
