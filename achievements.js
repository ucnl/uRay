// achievements.js
// Реестр проверок достижений и оценка результата выстрела.

export const CHECKS = {
  anyHit: (fan) => fan.anyHit,

  hitsCount: (fan, v) => fan.rays.filter(r => r.hit).length >= v,

  totalEnergy: (fan, v) => fan.totalHitEnergy >= v,

  maxHitBounces: (fan, v) => {
    const bs = fan.rays.filter(r => r.hit).map(r => r.trace.hitBounces || 0);
    if (!bs.length) return false;
    return Math.max(...bs) >= v;
  },

  echoSpanMs: (fan, v) => {
    const ts = fan.rays.filter(r => r.hit).map(r => r.trace.hitTime);
    if (ts.length < 2) return false;
    return (Math.max(...ts) - Math.min(...ts)) * 1000 >= v;
  },

  energySpread: (fan, v) => {
    const es = fan.rays.filter(r => r.hit).map(r => r.hitEnergy);
    if (es.length < 2) return false;
    return (Math.max(...es) / Math.max(1e-6, Math.min(...es))) >= v;
  },

  noBounces: (fan) => {
    const hitRays = fan.rays.filter(r => r.hit);
    if (!hitRays.length) return false;
    return hitRays.some(r => (r.trace.hitBounces || 0) === 0);
  },
  
  echoLessMs: (fan, v) => {
  const ts = fan.rays.filter(r => r.hit).map(r => r.trace.hitTime);
  if (ts.length < 2) return true;   // одиночный луч — «эха нет»
  return (Math.max(...ts) - Math.min(...ts)) * 1000 <= v;
},
};

// Оценка: возвращает массив { id, text, unlocked }
export function evaluateAchievements(level, fan) {
  if (!level.achievements || !level.achievements.length || !fan) return [];
  return level.achievements.map(a => {
    const fn = CHECKS[a.check];
    const unlocked = fn ? !!fn(fan, a.value) : false;
    return { id: a.id, text: a.text, unlocked };
  });
}

// Хранилище
const KEY = 'uraytracer_achievements';

export function loadUnlocked() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch { return {}; }
}

export function saveUnlocked(obj) {
  localStorage.setItem(KEY, JSON.stringify(obj));
}