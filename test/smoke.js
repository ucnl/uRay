// test/smoke.js — запуск: node test/smoke.js
import { readFileSync } from 'fs';
import { parseLevel } from '../level.js';
import { SoundProfile } from '../profile.js';
import { Bottom } from '../bottom.js';
import { shootFan } from '../fan.js';

const text = readFileSync(new URL('../levels/demo1.txt', import.meta.url), 'utf8');
const level = parseLevel(text);
const profile = new SoundProfile(level.profile, 0.1);
const bottom = new Bottom(level.bottom);

console.log('c(z=0)   =', profile.c(0).toFixed(2));
console.log('c(z=500) =', profile.c(500).toFixed(2));
console.log('dc/dz(500) =', profile.dcdz(500).toExponential(3));
console.log('zb(2500) =', bottom.zAt(2500).toFixed(2));

// Пробуем разные углы
for (const deg of [-15, -10, -5, 0, 5, 10, 15]) {
  const th = deg * Math.PI / 180;
  const res = shootFan(level, profile, bottom, th);
  const hits = res.rays.filter(r => r.hit).length;
  console.log(`θ₀=${deg.toString().padStart(3)}°  hits=${hits}/${res.rays.length}  ΣE_hit=${res.totalHitEnergy.toFixed(4)}  anyHit=${res.anyHit}`);
}