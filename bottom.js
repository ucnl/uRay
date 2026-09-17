// bottom.js
// Дно как ломаная. Умеет: zb(x), пересечение отрезка с ломаной,
// нормаль сегмента, отражение вектора.

export class Bottom {
  constructor(points) {
    if (points.length < 2) throw new Error('Bottom: need ≥2 points');
    this.pts = points;
  }

  // Глубина дна в точке x (линейная интерполяция, кламп по краям)
  zAt(x) {
    const p = this.pts;
    if (x <= p[0].x) return p[0].z;
    if (x >= p[p.length - 1].x) return p[p.length - 1].z;
    let lo = 0, hi = p.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (p[mid].x <= x) lo = mid; else hi = mid;
    }
    const a = p[lo], b = p[hi];
    const t = (x - a.x) / (b.x - a.x);
    return a.z + (b.z - a.z) * t;
  }

  // Пересечение отрезка (x1,z1)-(x2,z2) с ломаной.
  // Возвращает {x, z, nx, nz, t} — точку, нормаль сегмента, параметр на отрезке,
  // или null.
  intersectSegment(x1, z1, x2, z2) {
    const p = this.pts;
    let best = null;
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i], b = p[i + 1];
      const hit = segSeg(x1, z1, x2, z2, a.x, a.z, b.x, b.z);
      if (hit && (!best || hit.t < best.t)) {
        // нормаль к сегменту дна, направленная "вверх" (в сторону воды)
        let dx = b.x - a.x, dz = b.z - a.z;
        const len = Math.hypot(dx, dz);
        dx /= len; dz /= len;
        // нормаль: (-dz, dx) или (dz, -dx). Берём ту, что смотрит вверх (-z).
        let nx = -dz, nz = dx;
        if (nz > 0) { nx = -nx; nz = -nz; }
        best = { x: hit.x, z: hit.z, nx, nz, t: hit.t };
      }
    }
    return best;
  }
}

// Пересечение двух отрезков. Возвращает {x, z, t} (t — параметр на первом),
// или null.
function segSeg(x1, z1, x2, z2, x3, z3, x4, z4) {
  const d1x = x2 - x1, d1z = z2 - z1;
  const d2x = x4 - x3, d2z = z4 - z3;
  const denom = d1x * d2z - d1z * d2x;
  if (Math.abs(denom) < 1e-12) return null;
  const t = ((x3 - x1) * d2z - (z3 - z1) * d2x) / denom;
  const u = ((x3 - x1) * d1z - (z3 - z1) * d1x) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: x1 + t * d1x, z: z1 + t * d1z, t };
}