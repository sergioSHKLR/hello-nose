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
const clip = $('hello-audio');

const KEY = 'hello-nose-settings-v1';

let timerId = null;
let runUntil = 0;
let wakeLock = null;
let playCount = 0;
let mode = 'interval';
let ctx;
let audioBuf;
let blobUrl;
let decodeP;

function dataToBytes(src) {
  const raw = String(src || '').replace(/^data:[^,]*,/, '');
  const bin = atob(raw);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function blobSrc() {
  if (blobUrl) return blobUrl;
  if (typeof HELLO_AUDIO_SRC !== 'string') return '';
  const bytes = dataToBytes(HELLO_AUDIO_SRC);
  blobUrl = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
  return blobUrl;
}

function getCtx() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function decodeBuf() {
  if (audioBuf) return Promise.resolve(audioBuf);
  if (decodeP) return decodeP;
  const ac = getCtx();
  if (!ac || typeof HELLO_AUDIO_SRC !== 'string') {
    return Promise.reject(new Error('no decoder'));
  }
  const bytes = dataToBytes(HELLO_AUDIO_SRC);
  decodeP = ac.decodeAudioData(bytes.buffer.slice(0)).then((buf) => {
    audioBuf = buf;
    return buf;
  }).catch((err) => {
    decodeP = null;
    throw err;
  });
  return decodeP;
}

function playBuffer() {
  const ac = getCtx();
  if (!ac || !audioBuf) return false;
  const src = ac.createBufferSource();
  src.buffer = audioBuf;
  src.connect(ac.destination);
  src.onended = () => nose.classList.remove('playing');
  src.start(0);
  return true;
}

function playElement() {
  const url = blobSrc();
  if (url && clip.src !== url) clip.src = url;
  try { clip.muted = false; clip.volume = 1; } catch (_) {}
  try { clip.currentTime = 0; } catch (_) {}
  const p = clip.play();
  if (p && p.catch) p.catch(() => {});
}

function playOnce() {
  getCtx();
  nose.classList.add('playing');
  playCount += 1;
  decodeBuf().then(() => {
    if (!playBuffer()) playElement();
  }).catch(() => playElement());
  if (notifyBox.checked) pingNotify();
}

clip.addEventListener('ended', () => nose.classList.remove('playing'));

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
  } catch (_) {}
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

async function pingNotify() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const opts = {
      body: "You're a clown!",
      icon: 'icons/nose.svg',
      badge: 'icons/nose.svg',
      silent: true,
      tag: 'hello-nose',
      renotify: false,
    };
    if (reg) await reg.showNotification('Red Nose', opts);
    else new Notification('Red Nose', opts);
  } catch (_) {}
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
  const left = runUntil ? ' · stop ' + new Date(runUntil).toLocaleTimeString() : '';
  setStatus('Next ' + when.toLocaleTimeString() + left + ' · ' + playCount + ' played');
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
  } catch (_) {}
}

async function releaseWake() {
  try { if (wakeLock) await wakeLock.release(); } catch (_) {}
  wakeLock = null;
}

async function startTimer() {
  saveSettings();
  getCtx();
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
  setStatus(reason || ('Stopped · ' + playCount + ' played'));
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

let lastTap = 0;
function onNose() {
  const now = Date.now();
  if (now - lastTap < 280) return;
  lastTap = now;
  playOnce();
  if (!timerId) setStatus('Hello');
}

nose.addEventListener('pointerup', onNose);
nose.addEventListener('click', onNose);

startBtn.addEventListener('click', startTimer);
stopBtn.addEventListener('click', () => stopTimer());

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') getCtx();
  if (document.visibilityState === 'visible' && timerId && wakeBox.checked) acquireWake();
});

loadSettings();

if (typeof HELLO_AUDIO_SRC === 'string') {
  try { clip.src = blobSrc(); clip.load(); } catch (_) {}
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
