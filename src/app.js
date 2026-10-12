import { Calculator } from './calculator.js';
import { formatNumber, parseDisplay } from './format.js';
import { loadSettings, resolveTarget, saveSettings } from './settings.js';

const $ = (sel) => document.querySelector(sel);
const app = $('#app');
const elMain = $('#main');
const elExpr = $('#expr');
const elClear = $('#key-clear .txt');
const elIndicator = $('#indicator');

let settings = loadSettings();
const calc = new Calculator({ settings, onLog: () => { if (!$('#secret').hidden) renderLog(); } });

// ---------- historik (gemmes lokalt som på iPhone) ----------
const HKEY = 'cp.history.v1';
try { calc.history = JSON.parse(localStorage.getItem(HKEY) || '[]'); } catch { calc.history = []; }
const saveHistory = () => { try { localStorage.setItem(HKEY, JSON.stringify(calc.history.slice(-100))); } catch { /* ok */ } };

// ---------- tegning ----------
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const partsHTML = (parts) => '<span class="inner">' + parts.map((p) => `<span class="${p.kind}">${esc(p.text)}</span>`).join('') + '</span>';

function fit(line, minScale) {
  line.style.fontSize = '';
  line.classList.remove('overflow');
  const inner = line.firstElementChild;
  if (!inner) return;
  const avail = line.clientWidth;
  const w = inner.getBoundingClientRect().width;
  if (w <= avail || !avail) return;
  const base = parseFloat(getComputedStyle(line).fontSize);
  const scale = Math.max(minScale, avail / w);
  line.style.fontSize = base * scale - 0.01 + 'px';
  if (inner.getBoundingClientRect().width > avail + 0.5) line.classList.add('overflow');
}

let lastHistLen = calc.history.length;
function render() {
  const v = calc.getView();
  elMain.innerHTML = partsHTML(v.main);
  elExpr.innerHTML = v.expr ? partsHTML(v.expr) : '';
  fit(elMain, 0.76); // målt i ref/3.webp: 83 px mod 109 px
  if (v.expr) fit(elExpr, 0.6);
  elClear.textContent = v.clearLabel;
  document.querySelectorAll('.key.op').forEach((b) => {
    b.classList.toggle('active', settings.opHighlight && v.activeOp === b.dataset.key);
  });
  elIndicator.classList.toggle('on', !!(settings.indicator && v.armed));
  if (calc.history.length !== lastHistLen) { lastHistLen = calc.history.length; saveHistory(); }
}

// ---------- taster ----------
const pressedEls = new Set();
const drags = new Map(); // pointerId -> { btn, x, y }
function press(el) {
  el.classList.add('pressed');
  pressedEls.add(el);
}
function resetStretch(el) {
  el.classList.remove('drag');
  ['--tx', '--ty', '--s', '--ex', '--ey'].forEach((p) => el.style.removeProperty(p));
}
function releaseAll() {
  pressedEls.forEach((el) => { el.classList.remove('pressed'); resetStretch(el); });
  pressedEls.clear();
  drags.clear();
}
document.addEventListener('pointerup', releaseAll);
document.addEventListener('pointercancel', releaseAll);

$('#keypad').addEventListener('pointerdown', (e) => {
  const btn = e.target.closest('.key');
  if (!btn) return;
  e.preventDefault();
  hideBubble();
  try { btn.setPointerCapture(e.pointerId); } catch { /* ok */ }
  drags.set(e.pointerId, { btn, x: e.clientX, y: e.clientY });
  press(btn);
  calc.press(btn.dataset.key);
  render();
});

// Knappen strækker sig mod fingeren, når man trækker (målt: 8-tallet blev 1,09 × 1,27 og flyttet ned)
$('#keypad').addEventListener('pointermove', (e) => {
  const d = drags.get(e.pointerId);
  if (!d) return;
  const size = d.btn.offsetWidth;
  const lim = (v) => Math.max(-0.6, Math.min(0.6, v / size));
  const nx = lim(e.clientX - d.x);
  const ny = lim(e.clientY - d.y);
  const ax = Math.abs(nx);
  const ay = Math.abs(ny);
  d.btn.classList.add('drag');
  d.btn.style.setProperty('--tx', nx * 0.3 * size + 'px');
  d.btn.style.setProperty('--ty', ny * 0.3 * size + 'px');
  const sx = 1.19 + 0.25 * ax - 0.28 * ay;
  const sy = 1.19 + 0.25 * ay - 0.28 * ax;
  const k = Math.min(sx, sy); // ensartet skalering + længere kasse = kapsel med lige sider
  d.btn.style.setProperty('--s', k.toFixed(3));
  d.btn.style.setProperty('--ex', (sx / k).toFixed(3));
  d.btn.style.setProperty('--ey', (sy / k).toFixed(3));
});
$('#keypad').addEventListener('contextmenu', (e) => e.preventDefault());

// Tastatur (desktop)
const KEYMAP = { '*': '×', x: '×', X: '×', '/': '÷', ':': '÷', '+': '+', '-': '-', Enter: '=', '=': '=', Backspace: 'back', Escape: 'clear', Delete: 'clear', '%': 'pct', ',': ',', '.': ',' };
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, select, textarea')) return;
  if (!$('#secret').hidden || !$('#history').hidden) return;
  const k = /^[0-9]$/.test(e.key) ? e.key : KEYMAP[e.key];
  if (!k) return;
  e.preventDefault();
  const btn = document.querySelector(`.key[data-key="${CSS.escape(k)}"]`);
  if (btn) { press(btn); setTimeout(releaseAll, 90); }
  calc.press(k);
  render();
});

// ---------- display: swipe for at slette, hold for at kopiere ----------
const bubble = $('#copy-bubble');
let dGesture = null;
$('#display').addEventListener('pointerdown', (e) => {
  hideBubble();
  dGesture = { x: e.clientX, y: e.clientY, swiped: false, timer: setTimeout(showBubble, 520) };
});
$('#display').addEventListener('pointermove', (e) => {
  if (!dGesture) return;
  const dx = e.clientX - dGesture.x;
  const dy = e.clientY - dGesture.y;
  if (Math.abs(dx) > 8 || Math.abs(dy) > 8) clearTimeout(dGesture.timer);
  if (!dGesture.swiped && Math.abs(dx) > 34 && Math.abs(dy) < 40) {
    dGesture.swiped = true;
    calc.press('back');
    render();
  }
});
const endDisplay = () => { if (dGesture) clearTimeout(dGesture.timer); dGesture = null; };
$('#display').addEventListener('pointerup', endDisplay);
$('#display').addEventListener('pointercancel', endDisplay);

function showBubble() {
  const r = elMain.firstElementChild.getBoundingClientRect();
  bubble.hidden = false;
  const bw = bubble.offsetWidth;
  const left = Math.max(8, Math.min(window.innerWidth - bw - 8, r.right - r.width / 2 - bw / 2));
  bubble.style.left = left + 'px';
  bubble.style.top = Math.max(8, r.top - bubble.offsetHeight - 6) + 'px';
}
function hideBubble() { bubble.hidden = true; }
bubble.addEventListener('pointerdown', async (e) => {
  e.preventDefault();
  e.stopPropagation();
  const act = e.target.closest('button')?.dataset.act;
  hideBubble();
  if (act === 'copy') {
    const text = calc.displayValue().replace(/\.(?=\d{3})/g, '');
    try { await navigator.clipboard.writeText(text); } catch { /* ingen adgang */ }
  } else if (act === 'paste') {
    try {
      const v = parseDisplay(await navigator.clipboard.readText());
      if (Number.isFinite(v)) { calc.insertValue(v); render(); }
    } catch { /* ingen adgang */ }
  }
});
document.addEventListener('pointerdown', (e) => { if (!bubble.hidden && !bubble.contains(e.target) && !e.target.closest('#display')) hideBubble(); });

// ---------- menu (Almindelig / Videnskabelig …) ----------
const menu = $('#mode-menu');
const scrim = $('#menu-scrim');
function openMenu() { menu.hidden = false; scrim.hidden = false; menu.classList.remove('out'); }
function closeMenu() {
  if (menu.hidden) return;
  menu.classList.add('out');
  scrim.hidden = true;
  setTimeout(() => { menu.hidden = true; menu.classList.remove('out'); }, 160);
}
$('#btn-mode').addEventListener('click', () => (menu.hidden ? openMenu() : closeMenu()));
scrim.addEventListener('pointerdown', (e) => { e.preventDefault(); closeMenu(); });
menu.addEventListener('click', () => closeMenu());

// Tryk-feedback på de runde topknapper
document.querySelectorAll('.round-btn').forEach((b) => b.addEventListener('pointerdown', () => press(b)));

// ---------- historik + panik (hold uret inde) ----------
const hist = $('#history');
let panicTimer = null;
let panicFired = false;
$('#btn-history').addEventListener('pointerdown', () => {
  panicFired = false;
  panicTimer = setTimeout(() => {
    panicFired = true;
    doPanic();
  }, 750);
});
['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => $('#btn-history').addEventListener(ev, () => clearTimeout(panicTimer)));
$('#btn-history').addEventListener('click', () => {
  if (panicFired) { panicFired = false; return; }
  openSheet(hist);
  renderHistory();
});
$('#btn-history').addEventListener('contextmenu', (e) => e.preventDefault());

function doPanic() {
  calc.panic();
  settings = { ...settings, enabled: false };
  saveSettings(settings);
  if (navigator.vibrate) navigator.vibrate(30);
  render();
  if (!$('#secret').hidden) syncPanel();
}

function renderHistory() {
  const list = $('#history-list');
  const items = calc.history.slice().reverse();
  $('#history-empty').hidden = items.length > 0;
  list.innerHTML = items.map((h, i) => `<li data-i="${i}"><div class="h-expr">${esc(h.expr)}</div><div class="h-res">${esc(h.result)}</div></li>`).join('');
}
$('#history-list').addEventListener('click', (e) => {
  const li = e.target.closest('li');
  if (!li) return;
  const h = calc.history.slice().reverse()[Number(li.dataset.i)];
  const v = parseDisplay(h.result);
  if (Number.isFinite(v)) { calc.insertValue(v); render(); }
  closeSheet(hist);
});
$('#history-clear').addEventListener('click', () => { calc.history = []; lastHistLen = -1; render(); renderHistory(); });
$('#history-done').addEventListener('click', () => closeSheet(hist));

function openSheet(el) { el.hidden = false; el.classList.remove('out'); }
function closeSheet(el) {
  el.classList.add('out');
  setTimeout(() => { el.hidden = true; el.classList.remove('out'); }, 220);
}

// ---------- hemmelig gestus: 5 hurtige tryk øverst til højre ----------
let secretTaps = [];
document.addEventListener('pointerdown', (e) => {
  if (!$('#secret').hidden) return;
  const r = app.getBoundingClientRect();
  const top = $('.topbar').getBoundingClientRect();
  const inZone = e.clientX > r.left + r.width * 0.6 && e.clientY < top.bottom + r.width * 0.16;
  if (!inZone) { secretTaps = []; return; }
  const now = performance.now();
  secretTaps = secretTaps.filter((t) => now - t < 2500);
  secretTaps.push(now);
  if (secretTaps.length >= 5) {
    secretTaps = [];
    e.preventDefault();
    e.stopPropagation();
    closeMenu();
    setTimeout(() => { menu.hidden = true; scrim.hidden = true; openSecret(); }, 170);
  }
}, true);

// Manuel trigger: tryk i det tomme felt øverst i midten
$('#arm-zone').addEventListener('pointerdown', () => {
  if (settings.enabled && settings.trigger === 'manual') {
    calc.armManual();
    elIndicator.classList.add('flash');
    setTimeout(() => elIndicator.classList.remove('flash'), 400);
    render();
  }
});

// ---------- hemmeligt panel ----------
const secret = $('#secret');
function openSecret() {
  syncPanel();
  openSheet(secret);
}
$('#secret-done').addEventListener('click', () => { closeSheet(secret); render(); });

function statusText() {
  const s = settings;
  if (!s.enabled) return calc.forceRt.memory.size ? 'Slået fra (husker tidligere ramte)' : 'Slået fra – almindelig lommeregner';
  const used = calc.forceRt.hits;
  if (s.uses > 0 && used >= s.uses) return `Brugt op (${used}/${s.uses}) – gentagelser huskes`;
  const left = s.uses > 0 ? `${s.uses - used} tilbage` : 'ubegrænset';
  if (s.trigger === 'manual') return calc.forceRt.manualArmed ? `Armeret – ${left}` : `Venter på tryk øverst – ${left}`;
  return `Klar – ${left}`;
}

function syncPanel() {
  secret.querySelectorAll('[data-s]').forEach((el) => {
    const v = settings[el.dataset.s];
    if (el.type === 'checkbox') el.checked = !!v;
    else el.value = String(v);
  });
  secret.querySelectorAll('[data-s-seg] button').forEach((b) => {
    b.classList.toggle('on', settings[b.parentElement.dataset.sSeg] === b.dataset.v);
  });
  $('#row-target').hidden = settings.targetMode !== 'fixed';
  $('#row-offset').hidden = settings.targetMode !== 'time';
  $('#row-nth').hidden = settings.trigger !== 'nth';
  $('#s-target').textContent = formatNumber(resolveTarget(settings));
  $('#s-status').textContent = statusText();
  $('#s-screen').textContent = screenInfo();
  renderLog();
}

function renderLog() {
  $('#s-log').textContent = calc.logs.slice(-40).reverse()
    .map((l) => `${l.t.slice(11, 19)}  ${l.msg}`).join('\n') || '(tom)';
}

function update(patch) {
  settings = { ...settings, ...patch };
  saveSettings(settings);
  calc.setSettings(patch);
  if ('vAdjust' in patch) fixHeight();
  syncPanel();
}

secret.addEventListener('change', (e) => {
  const el = e.target.closest('[data-s]');
  if (!el) return;
  const key = el.dataset.s;
  let v = el.type === 'checkbox' ? el.checked : el.value;
  if (['nth', 'uses', 'timeOffset', 'vAdjust'].includes(key)) v = Number(v) || 0;
  update({ [key]: v });
});
secret.addEventListener('input', (e) => {
  const el = e.target.closest('input[data-s="target"]');
  if (el) { settings.target = el.value; calc.setSettings({ target: el.value }); $('#s-target').textContent = formatNumber(resolveTarget(settings)); saveSettings(settings); }
});
secret.querySelectorAll('[data-s-seg] button').forEach((b) => b.addEventListener('click', () => {
  update({ [b.parentElement.dataset.sSeg]: b.dataset.v });
}));
$('#s-reset').addEventListener('click', () => { calc.resetHits(); syncPanel(); });
$('#s-panic').addEventListener('click', () => doPanic());
$('#s-selftest').addEventListener('click', async () => {
  const out = $('#s-selftest-out');
  out.hidden = false;
  out.textContent = 'Kører …';
  await new Promise((r) => setTimeout(r, 30));
  const { runSelfTest, formatReport } = await import('./selftest.js');
  out.textContent = formatReport(runSelfTest({ runs: 2000, seed: Date.now() % 100000, now: new Date() }));
});

// ---------- højde: iOS-fejl i hjemmeskærm-apps ----------
// I standalone-tilstand melder iOS en sidehøjde, der er statuslinjens højde (59 pt) for kort,
// selvom siden tegnes over hele skærmen. Så sad alt 59 pt for højt. Vi bruger skærmens højde.
const isStandalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
let heightFixed = false;
function fixHeight() {
  const portrait = innerHeight > innerWidth;
  heightFixed = isStandalone() && portrait && screen.height > innerHeight + 20;
  app.style.height = heightFixed ? screen.height + 'px' : '';
  app.style.bottom = heightFixed ? 'auto' : '';
  app.style.setProperty('--v-adjust', (Number(settings.vAdjust) || 0) + 'px');
}
fixHeight();
window.addEventListener('resize', fixHeight);
window.addEventListener('orientationchange', () => setTimeout(fixHeight, 300));

function screenInfo() {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:env(safe-area-inset-top);bottom:env(safe-area-inset-bottom)';
  document.body.appendChild(probe);
  const st = getComputedStyle(probe);
  const info = `vindue ${innerWidth}×${innerHeight}, skærm ${screen.width}×${screen.height}, safe ${parseFloat(st.top) || 0}/${parseFloat(st.bottom) || 0}, ${isStandalone() ? 'hjemmeskærm' : 'browser'}${heightFixed ? ', højde rettet' : ''}`;
  probe.remove();
  return info;
}

// ---------- diverse iOS-finesser ----------
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
window.addEventListener('resize', render);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(render);

render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
