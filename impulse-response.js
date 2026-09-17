// impulse-response.js
// Собирает импульсную характеристику канала из веера лучей.
// Учитываются только лучи, попавшие в приёмник.

export function buildIR(fan, level) {
  if (!fan || !fan.rays) return null;

  const spikes = [];
  let tFirst = Infinity;
  let tMax = 0;
  let aMax = 0;

  for (let i = 0; i < fan.rays.length; i++) {
    const ray = fan.rays[i];
    if (!ray.hit) continue;

    // Энергия в момент прихода × вес луча (гауссова ДН)
    const a = ray.hitEnergy * ray.weight;
    const t = ray.trace.hitTime;

    if (a <= 0) continue;
    if (t < tFirst) tFirst = t;
    if (t > tMax)   tMax = t;
    if (a > aMax)   aMax = a;

    spikes.push({
      t,
      a,
      rayIndex: i,
      theta: ray.theta,
    });
  }

  if (spikes.length === 0) {
    return {
      spikes: [],
      tMax: 0,
      tFirst: 0,
      aMax: 0,
      hitCount: 0,
    };
  }

  spikes.sort((s1, s2) => s1.t - s2.t);

  return {
    spikes,
    tMax,
    tFirst,
    aMax,
    hitCount: spikes.length,
  };
}