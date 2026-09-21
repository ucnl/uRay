import { parseLevel } from './level.js';
import { SoundProfile } from './profile.js';
import { Bottom } from './bottom.js';
import { shootFan } from './fan.js';
import { buildIR } from './impulse-response.js';
import { SonarAudio } from './audio.js';
import { renderProfile, renderScene, renderIR } from './render.js';
import { evaluateAchievements, loadUnlocked, saveUnlocked } from './achievements.js';

import { attachInput } from './input.js';

const statusEl   = document.getElementById('status');
const resultEl   = document.getElementById('result');
const spreadIn   = document.getElementById('spread');
const countIn    = document.getElementById('count');
const spreadVal  = document.getElementById('spread-val');
const countVal   = document.getElementById('count-val');
const angleInfo  = document.getElementById('angle-info');
const levelSel   = document.getElementById('level-select');
const resetBtn   = document.getElementById('reset-btn');
const sceneCnv   = document.getElementById('scene-canvas');
const profileCnv = document.getElementById('profile-canvas');
const tutorialEl = document.getElementById('tutorial');
const modeExploreBtn = document.getElementById('mode-explore');
const modeGameBtn    = document.getElementById('mode-game');
const grpFan = document.getElementById('grp-fan');
const irCnv = document.getElementById('ir-canvas');
const muteBtn = document.getElementById('mute-btn');

const achiModal      = document.getElementById('achi-modal');
const achiModalTitle = document.getElementById('achi-modal-title');
const achiList       = document.getElementById('achi-list');
const achiModalClose = document.getElementById('achi-modal-close');
const achiResetBtn   = document.getElementById('achi-reset');

const sonar = new SonarAudio();

const TUTORIAL_KEY   = 'uraytracer_tutorial_shown';
const MODE_KEY       = 'uraytracer_mode';
const SPEED_KEY      = 'uraytracer_speed';
const MUTE_KEY       = 'uraytracer_muted';
const SOUND_MODE_KEY = 'uraytracer_sound_mode';

// --- Состояние ---
let level, profile, bottom;
const levelIdByFile = {};
let lastFan = null;
let currentAngle = 0;
let startAngle = 0;
let projection = null;

let animStart = 0;
let animRunning = false;
let animHandle = null;
let currentGameT = 0;
let resultHitFlag = false;

let mode = localStorage.getItem(MODE_KEY) || 'explore';        // 'explore' | 'game'
let speedup = parseInt(localStorage.getItem(SPEED_KEY) || '8', 10);   // 0 = мгновенно
let soundMode = localStorage.getItem(SOUND_MODE_KEY) || 'ping';

let unlocked = loadUnlocked();
const toastCnv = document.getElementById('toast-container');
const achiCounter = document.getElementById('achi-counter');
const levelIntroEl = document.getElementById('level-intro');



// В game-режиме лучи не видны до выстрела
let gameReveal = false;

let inputCtl = null;

let fadeStart = 0;
let fadeRunning = false;
let fadeAlpha = 1;
const FADE_DURATION = 2.0;   // секунд до полного исчезновения

let lastIR = null;
let muted = localStorage.getItem(MUTE_KEY) === '1';
let soundMarkerRAF = null;

function showLevelIntro() {
  if (!level.message) return;
  levelIntroEl.textContent = level.message;
  levelIntroEl.classList.remove('hidden');
  clearTimeout(showLevelIntro._t);
  showLevelIntro._t = setTimeout(() => {
    levelIntroEl.classList.add('hidden');
  }, 3500);
}

function openAchiModal() {
  if (!level || !level.achievements) return;
  achiModalTitle.textContent = `Достижения · ${level.name}`;
  document.getElementById('achi-modal-sub').textContent = level.message || '';
  achiList.innerHTML = '';
  for (const a of level.achievements) {
    const key = `${level.id}:${a.id}`;
    const got = !!unlocked[key];
    const li = document.createElement('li');
    li.className = got ? 'unlocked' : 'locked';
    li.innerHTML = `<span class="mark">${got ? '★' : '☆'}</span><span>${a.text}</span>`;
    achiList.appendChild(li);
  }
  achiModal.classList.remove('hidden');
}

function closeAchiModal() {
  achiModal.classList.add('hidden');
}

achiCounter.addEventListener('click', openAchiModal);
achiModalClose.addEventListener('click', closeAchiModal);
achiModal.addEventListener('click', (e) => {
  if (e.target === achiModal) closeAchiModal();
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !achiModal.classList.contains('hidden')) {
    closeAchiModal();
  }
});

// ---------- Загрузка ----------
async function loadIndex() {
  const idx = await fetch('levels/index.json').then(r => r.json());
  const levelIdByFile = {};
  levelSel.innerHTML = '';
  for (const l of idx.levels) {
    const opt = document.createElement('option');
    opt.value = l.file;
    opt.textContent = l.name;
    levelSel.appendChild(opt);
	levelIdByFile[l.file] = l.id;
  }
}

async function loadLevel(file) {
  statusEl.textContent = 'Загрузка…';
  const text = await fetch('levels/' + file).then(r => r.text());
  level = parseLevel(text);
  profile = new SoundProfile(level.profile, 0.1);
  bottom = new Bottom(level.bottom);
  level.id = levelIdByFile[file] || file;
  
  countIn.value = level.fan.count;
  countVal.textContent = level.fan.count;
  spreadIn.value = level.fan.spread;
  spreadVal.textContent = level.fan.spread + '°';

  statusEl.textContent =
  `${level.name} · c(0)=${profile.c(0).toFixed(1)} м/с · ` +
  `глубина ${level.zMax} м · X до ${level.xMax} м`;

  lastFan = null;
  lastIR = null;
  currentAngle = 0;
  startAngle = 0;
  gameReveal = false;
  resultHitFlag = false;
  updateAngleInfo();

  stopSound();
  resize();
  
  showTutorialIfNeeded();
  showLevelIntro();
  applyMode();
  updateAchiCounter();
  refreshScene();
}

function showTutorialIfNeeded() {
  const shown = localStorage.getItem(TUTORIAL_KEY) === '1';
  tutorialEl.classList.toggle('hidden', shown);
}

function hideTutorial() {
  if (!tutorialEl.classList.contains('hidden')) {
    tutorialEl.classList.add('hidden');
    localStorage.setItem(TUTORIAL_KEY, '1');
  }
}

// ---------- Звук ------------
function startSoundMarkerLoop() {
  cancelAnimationFrame(soundMarkerRAF);
  soundMarkerRAF = null;
  const loop = () => {
    const mt = sonar.currentMarkerT();
    if (mt === null) {
      soundMarkerRAF = null;
      redraw(Infinity);
      return;
    }
    redraw(Infinity, null, mt);
    soundMarkerRAF = requestAnimationFrame(loop);
  };
  soundMarkerRAF = requestAnimationFrame(loop);
}

function stopSound() {
  sonar.stopAll();
  cancelAnimationFrame(soundMarkerRAF);
  soundMarkerRAF = null;
  redraw(Infinity);
}

function applyMute() {
  muteBtn.textContent = muted ? '🔇' : '🔊';
  muteBtn.classList.toggle('muted', muted);
  sonar.setMuted(muted);
}

muteBtn.addEventListener('click', () => {
  sonar.resume();          // user gesture — можно инициализировать
  muted = !muted;
  localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  applyMute();
});



// ---------- Адаптивный размер ----------
function resize() {
  const dpr = window.devicePixelRatio || 1;
  for (const cnv of [sceneCnv, profileCnv, irCnv]) {
    const wrap = cnv.parentElement;
    const r = wrap.getBoundingClientRect();
    cnv.width  = Math.max(1, Math.floor(r.width  * dpr));
    cnv.height = Math.max(1, Math.floor(r.height * dpr));
    cnv.style.width  = r.width + 'px';
    cnv.style.height = r.height + 'px';
    cnv.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}


function checkAchievements() {
  if (!level || !lastFan) return;
  const results = evaluateAchievements(level, lastFan);
  const newly = [];
  for (const a of results) {
    if (a.unlocked) {
      const key = `${level.id || level.name}:${a.id}`;
      if (!unlocked[key]) {
        unlocked[key] = true;
        newly.push(a);
      }
    }
  }
  if (newly.length) {
    saveUnlocked(unlocked);
    for (const a of newly) showToast(a.text);
  }
  updateAchiCounter();
}

function updateAchiCounter() {
  if (!level || !level.achievements || !level.achievements.length) {
    achiCounter.textContent = '★ 0/0';
    achiCounter.disabled = true;
    return;
  }
  achiCounter.disabled = false;
  const total = level.achievements.length;
  let got = 0;
  for (const a of level.achievements) {
    if (unlocked[`${level.id}:${a.id}`]) got++;
  }
  achiCounter.textContent = `★ ${got}/${total}`;
}

function showToast(text) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = '★ ' + text;
  toastCnv.appendChild(el);
  setTimeout(() => el.classList.add('visible'), 10);
  setTimeout(() => {
    el.classList.remove('visible');
    setTimeout(() => el.remove(), 400);
  }, 3200);
}





// ---------- Рендер ----------
function redraw(elapsed = Infinity, fanToDraw = null, irMarkerT = null) {
  if (!level) return;
  const nearReceiver = isAimNearReceiver();
  const fan = (fanToDraw !== null) ? fanToDraw : selectFanToDraw();
  projection = renderScene(
    sceneCnv, level, profile, bottom, fan, currentAngle, elapsed,
    { nearReceiver, hit: resultHitFlag, fadeAlpha: fadeAlpha }
  );
  renderProfile(profileCnv, level, profile);

  let showIR = false;
  let markerT = irMarkerT;

  if (lastIR) {
    if (mode === 'explore') {
      showIR = true;
      markerT = null;                  // в explore маркера нет
    } else if (gameReveal) {
      showIR = true;
    }
  }

  if (showIR) {
    renderIR(irCnv, lastIR, { markerT });
  } else {
    renderIR(irCnv, null, {});
  }
}

function redrawWithIRMarker(markerT) {
  redraw(Infinity, null, markerT);
}

// Какой веер показывать в текущем состоянии
function selectFanToDraw() {
  if (mode === 'explore') return lastFan;          // всегда
  // game-режим:
  if (gameReveal && !animRunning) return lastFan;  // после анимации — оставляем
  if (gameReveal && animRunning)  return lastFan;  // во время анимации — рисуем
  return null;                                     // до выстрела — пусто
}

function isAimNearReceiver() {
  if (mode === 'game' && !gameReveal) {
    // в game-режиме пульсацию приёмника можно оставить как "прицел рядом"
    const dx = level.receiver.x - level.source.x;
    const dz = level.receiver.z - level.source.z;
    const desired = Math.atan2(-dz, dx);
    const diff = Math.abs(normalizeAngle(desired - currentAngle));
    return diff < (level.fan.spread * Math.PI / 180) * 2;
  }
  if (lastFan && lastFan.anyHit) return true;
  const dx = level.receiver.x - level.source.x;
  const dz = level.receiver.z - level.source.z;
  const desired = Math.atan2(-dz, dx);
  const diff = Math.abs(normalizeAngle(desired - currentAngle));
  return diff < (level.fan.spread * Math.PI / 180);
}

function normalizeAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

function updateAngleInfo() {
  const deg = (currentAngle * 180 / Math.PI).toFixed(1);
  angleInfo.textContent = `угол: ${deg}°`;
}

// Мгновенная перерисовка без анимации
function refreshScene() {
  cancelAnimationFrame(animHandle);
  animRunning = false;
  currentGameT = 0;
  resultHitFlag = false;
  if (mode === 'explore' || !gameReveal) {
    resultEl.textContent = '';
    resultEl.className = '';
  }
  redraw(Infinity);
}

// ---------- Анимация ----------
function startAnimation() {
  if (!lastFan) return;
  cancelAnimationFrame(animHandle);

  if (speedup === 0) {
    // мгновенный режим
    animRunning = false;
    currentGameT = lastFan.tMax;
    gameReveal = true;
    resultHitFlag = !!lastFan.anyHit;
    redraw(Infinity);
    showResult();
	checkAchievements();
	startFade();
    return;
  }

  animStart = performance.now();
  animRunning = true;
  currentGameT = 0;
  resultHitFlag = false;
  gameReveal = true;

  resultEl.textContent = '…';
  resultEl.className = 'pending';

  animHandle = requestAnimationFrame(tick);
}

function tick(now) {
  if (!animRunning || !lastFan) return;
  const realT = (now - animStart) / 1000;
  const gameT = realT * speedup;
  currentGameT = gameT;

  if (gameT >= lastFan.tMax) {
    animRunning = false;
    currentGameT = lastFan.tMax;
    resultHitFlag = !!lastFan.anyHit;
    redraw(Infinity);
    showResult();
	checkAchievements();
	startFade();
    return;
  }
  redraw(gameT);
  animHandle = requestAnimationFrame(tick);
}

function showResult() {
  const fan = lastFan;
  if (!fan) return;
  const hits = fan.rays.filter(r => r.hit).length;
  if (fan.anyHit) {
    resultEl.textContent =
      `ПОПАДАНИЕ! лучей: ${hits}/${fan.rays.length}, ΣE=${fan.totalHitEnergy.toFixed(3)}`;
    resultEl.className = 'ok';
  } else {
    resultEl.textContent = `промах (лучей: ${fan.rays.length})`;
    resultEl.className = 'fail';
  }
}


function startFade() {
  if (mode !== 'game') return;   // в explore — не таем
  fadeStart = performance.now();
  fadeRunning = true;
  fadeAlpha = 1;
  requestAnimationFrame(fadeTick);
}

function fadeTick(now) {
  if (!fadeRunning) return;
  const t = (now - fadeStart) / 1000 / FADE_DURATION;
  if (t >= 1) {
    fadeRunning = false;
    fadeAlpha = 0;
    redraw(Infinity);   // перерисуем уже без лучей
    return;
  }
  // Экспоненциальное затухание: мягко в начале, "обвал" в конце
  // можно регулировать показателем
  fadeAlpha = Math.pow(1 - t, 1.7);
  redraw(Infinity);
  requestAnimationFrame(fadeTick);
}

function stopFade() {
  fadeRunning = false;
  fadeAlpha = 1;
}

// ---------- Выстрел ----------
function shoot() {
  if (!level) return;
  stopFade();
  level.fan.count  = parseInt(countIn.value, 10);
  level.fan.spread = parseFloat(spreadIn.value);
  lastFan = shootFan(level, profile, bottom, currentAngle);
  lastIR = buildIR(lastFan, level);
  hideTutorial();

  if (mode === 'game') {
    sonar.resume();
    sonar.stopAll();
    const dur = sonar.playIR(lastIR, soundMode, speedup);
    if (dur > 0) startSoundMarkerLoop();
  }

  startAnimation();
}

// Обновление без выстрела (при drag / смене настроек)
function previewShoot() {
  if (!level) return;
  stopFade();
  stopSound();          // ← прекращаем всё, что могло играть
  level.fan.count  = parseInt(countIn.value, 10);
  level.fan.spread = parseFloat(spreadIn.value);
  lastFan = shootFan(level, profile, bottom, currentAngle);
  lastIR = buildIR(lastFan, level);

  cancelAnimationFrame(animHandle);
  animRunning = false;
  currentGameT = 0;
  resultHitFlag = false;
  gameReveal = (mode === 'explore');

  if (mode === 'explore') {
    resultEl.textContent = '';
    resultEl.className = '';
  }
  redraw(Infinity);
}

// ---------- Режимы ----------
function applyMode() {
  modeExploreBtn.classList.toggle('active', mode === 'explore');
  modeGameBtn.classList.toggle('active', mode === 'game');
  grpFan.classList.toggle('hidden', mode === 'game');

  if (mode === 'explore') {
    gameReveal = true;   // лучи всегда видны
  } else {
    gameReveal = false;  // до выстрела — скрыты
    resultEl.textContent = '';
    resultEl.className = '';
  }
  updateAngleInfo();
}

function setMode(newMode) {
  if (mode === newMode) return;
  stopSound();
  mode = newMode;
  localStorage.setItem(MODE_KEY, mode);
  applyMode();
  previewShoot();    // пересчитаем и отрисуем
}

modeExploreBtn.addEventListener('click', () => setMode('explore'));
modeGameBtn.addEventListener('click', () => setMode('game'));

// ---------- Скорость ----------
function applySpeedButtons() {
  document.querySelectorAll('.speed-btn').forEach(btn => {
    const v = parseInt(btn.dataset.speed, 10);
    btn.classList.toggle('active', v === speedup);
  });
}

document.querySelectorAll('.speed-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    speedup = parseInt(btn.dataset.speed, 10);
    localStorage.setItem(SPEED_KEY, String(speedup));
    applySpeedButtons();
    // если анимация идёт — перезапустим с новой скоростью
    if (animRunning) startAnimation();
  });
});



// ---------- Звук ----------
function applySoundModeButtons() {
  document.querySelectorAll('.sound-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === soundMode);
  });
}

document.querySelectorAll('.sound-mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    soundMode = btn.dataset.mode;
    localStorage.setItem(SOUND_MODE_KEY, soundMode);
    applySoundModeButtons();
  });
});


// ---------- События UI ----------
achiResetBtn.addEventListener('click', () => {
  if (!confirm('Сбросить весь прогресс достижений?')) return;
  unlocked = {};
  saveUnlocked(unlocked);
  updateAchiCounter();
  if (!achiModal.classList.contains('hidden')) openAchiModal();
});
spreadIn.addEventListener('input', () => {
  spreadVal.textContent = spreadIn.value + '°';
  previewShoot();
});
countIn.addEventListener('input', () => {
  countVal.textContent = countIn.value;
  previewShoot();
});
levelSel.addEventListener('change', () => loadLevel(levelSel.value));
resetBtn.addEventListener('click', () => {
  stopSound();
  currentAngle = startAngle;
  gameReveal = (mode === 'explore');
  updateAngleInfo();
  previewShoot();
});

window.addEventListener('resize', () => {
  resize();
  if (animRunning) redraw(currentGameT);
  else redraw(Infinity);
});

// Клавиатура
window.addEventListener('keydown', (evt) => {
  const step = (evt.shiftKey ? 5 : 0.5) * Math.PI / 180;
  if (evt.key === 'ArrowLeft') {
    currentAngle -= step;
    updateAngleInfo();
    previewShoot();
    evt.preventDefault();
  } else if (evt.key === 'ArrowRight') {
    currentAngle += step;
    updateAngleInfo();
    previewShoot();
    evt.preventDefault();
  } else if (evt.key === ' ') {
    if (mode === 'game') shoot();
    evt.preventDefault();
  }
});

// ---------- Инициализация ----------
loadIndex()
  .then(() => {
    resize();
    return loadLevel(levelSel.value);
  })
  .then(() => {
    applySpeedButtons();
	applySoundModeButtons();
	applyMute();
    applyMode();
    inputCtl = attachInput(sceneCnv, {
      getSourceScreen: () => {
        const p = projection;
        if (!p) {
          const rect = sceneCnv.getBoundingClientRect();
          const pad = { l: 30, r: 20, t: 20, b: 30 };
          const gw = rect.width - pad.l - pad.r;
          const gh = rect.height - pad.t - pad.b;
          const xScale = gw / level.xMax;
          const zScale = gh / level.zMax;
          return {
            x: pad.l + level.source.x * xScale,
            y: pad.t + level.source.z * zScale,
          };
        }
        return { x: p.X(level.source.x), y: p.Z(level.source.z) };
      },
      onAngleChange: (ang) => {
		stopFade();
        currentAngle = ang;
        updateAngleInfo();
        previewShoot();
      },
      onRelease: (ang) => {
		sonar.resume(); 
        currentAngle = ang;
        updateAngleInfo();
        if (mode === 'game') {
          shoot();
        } else {
          previewShoot();
        }
      },
      onPrecise: () => {
        updateAngleInfo();
        previewShoot();
      },
    });
  })
  .catch(e => {
    statusEl.textContent = 'Ошибка: ' + e.message;
    console.error(e);
  });
  
  // ---------- PWA ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((e) => {
      console.warn('SW registration failed:', e);
    });
  });
}

// Install prompt
let deferredInstall = null;
const installBtn = document.getElementById('install-btn');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e;
  if (installBtn) installBtn.style.display = '';
});

if (installBtn) {
  installBtn.addEventListener('click', async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    const { outcome } = await deferredInstall.userChoice;
    deferredInstall = null;
    installBtn.style.display = 'none';
    console.log('Install:', outcome);
  });

  window.addEventListener('appinstalled', () => {
    installBtn.style.display = 'none';
    deferredInstall = null;
  });
}