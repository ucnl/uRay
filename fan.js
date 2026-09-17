// fan.js
import { traceRay } from './raytrace.js';

// Возвращает массив лучей + агрегат (попадание, суммарная энергия в приёмнике).
export function shootFan(level, profile, bottom, theta0Rad) {
  const N = level.fan.count;
  const spreadRad = level.fan.spread * Math.PI / 180;
  const sigma = spreadRad / 2;

  const rays = [];
  let anyHit = false;
  let totalHitEnergy = 0;
  let firstHitTime = Infinity;
  let tMax = 0;

  for (let i = 0; i < N; i++) {
    const f = (N === 1) ? 0 : (i / (N - 1)) * 2 - 1;
    const dTh = f * spreadRad / 2;
    const th = theta0Rad + dTh;
    const w = Math.exp(-(dTh * dTh) / (sigma * sigma));

    const tr = traceRay(level, profile, bottom, level.source.z, th);
    for (const p of tr.points) p.e *= w;
    const hitE = tr.hit ? tr.hitEnergy * w : 0;
    if (tr.hit) {
      anyHit = true;
      totalHitEnergy += hitE;
      if (tr.hitTime < firstHitTime) firstHitTime = tr.hitTime;
    }
    if (tr.tMax > tMax) tMax = tr.tMax;

    rays.push({ theta: th, weight: w, trace: tr, hit: tr.hit, hitEnergy: hitE });
  }

  return { rays, anyHit, totalHitEnergy, firstHitTime, tMax };
}