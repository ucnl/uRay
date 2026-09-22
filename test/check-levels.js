// test/check-levels.js
// Прогоняет все уровни под всеми углами и печатает МАКСИМУМЫ по каждой метрике.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { parseLevel } from '../level.js';
import { SoundProfile } from '../profile.js';
import { Bottom } from '../bottom.js';
import { shootFan } from '../fan.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const levelsDir = join(__dirname, '..', 'levels');
const index = JSON.parse(readFileSync(join(levelsDir, 'index.json'), 'utf8'));

const ANGLE_STEP = 1;
const ANGLE_MIN  = -40;
const ANGLE_MAX  =  40;

for (const entry of index.levels) {
  const text = readFileSync(join(levelsDir, entry.file), 'utf8');
  const level = parseLevel(text);
  const profile = new SoundProfile(level.profile, 0.1);
  const bottom = new Bottom(level.bottom);

  let anyHit = false;
  let hitAngles = 0;

  // Независимые максимумы по метрикам
  let maxHits = 0, maxHitsAng = null;
  let maxEnergy = 0, maxEnergyAng = null;
  let maxBounce = 0, maxBounceAng = null;
  let maxEchoMs = 0, maxEchoAng = null;
  let maxSpread = 0, maxSpreadAng = null;

  for (let deg = ANGLE_MIN; deg <= ANGLE_MAX; deg += ANGLE_STEP) {
    const lvl = JSON.parse(JSON.stringify(level));
    lvl.fan.count = level.fan.count;
    lvl.fan.spread = level.fan.spread;

    const theta = deg * Math.PI / 180;
    const fan = shootFan(lvl, profile, bottom, theta);

    if (!fan.anyHit) continue;
    anyHit = true;
    hitAngles++;

    const hitRays = fan.rays.filter(r => r.hit);
    const hits = hitRays.length;
    const energy = fan.totalHitEnergy;
    const bounce = Math.max(...hitRays.map(r => r.trace.hitBounces || 0));
    const ts = hitRays.map(r => r.trace.hitTime);
    const echoMs = ts.length > 1
      ? (Math.max(...ts) - Math.min(...ts)) * 1000
      : 0;
    const energies = hitRays.map(r => r.hitEnergy);
    const spread = energies.length > 1
      ? Math.max(...energies) / Math.max(1e-6, Math.min(...energies))
      : 1;

    if (hits > maxHits)       { maxHits = hits;         maxHitsAng = deg; }
    if (energy > maxEnergy)   { maxEnergy = energy;     maxEnergyAng = deg; }
    if (bounce > maxBounce)   { maxBounce = bounce;     maxBounceAng = deg; }
    if (echoMs > maxEchoMs)   { maxEchoMs = echoMs;     maxEchoAng = deg; }
    if (spread > maxSpread)   { maxSpread = spread;     maxSpreadAng = deg; }
  }

  if (!anyHit) {
    console.log(`${entry.name.padEnd(28)} НЕ РЕШАЕМ ✗`);
    continue;
  }

  console.log(
    `${entry.name.padEnd(28)} ` +
    `hits≤${maxHits}(${maxHitsAng}°) ` +
    `ΣE≤${maxEnergy.toFixed(2)}(${maxEnergyAng}°) ` +
    `bounce≤${maxBounce}(${maxBounceAng}°) ` +
    `echo≤${maxEchoMs.toFixed(0)}мс(${maxEchoAng}°) ` +
    `spread≤${maxSpread.toFixed(1)}×(${maxSpreadAng}°) ` +
    `[углов: ${hitAngles}]`
  );
}