// raytrace.js
// Трассировка одного луча методом RK4 по длине дуги.
// Уравнения:
//   dx/ds = cos(θ)
//   dz/ds = sin(θ)
//   dθ/ds = -(dc/dz)·cos(θ)/c(z)

export function traceRay(level, profile, bottom, z0, theta0) {
  const P = level.physics;
  const ds = P.ds;
  const sMax = (level.xMax + level.zMax) * 3;

  let x = level.source.x;
  let z = z0;
  let th = theta0;
  let e = P.eSource;
  let s = 0;
  let t = 0;                 // время прихода, сек
  let bounces = 0;
  let hit = false;
  let hitEnergy = 0;
  let hitTime = null;        // время первого касания приёмника
  let hitX = 0, hitZ = 0;

  const pts = [{ x, z, e, t }];

  const r = () => Math.hypot(x - level.source.x, z - z0);

  while (s < sMax && e > P.eMin) {
    const k1 = deriv(x, z, th, profile);
    const k2 = deriv(x + 0.5 * ds * k1.dx, z + 0.5 * ds * k1.dz, th + 0.5 * ds * k1.dth, profile);
    const k3 = deriv(x + 0.5 * ds * k2.dx, z + 0.5 * ds * k2.dz, th + 0.5 * ds * k2.dth, profile);
    const k4 = deriv(x + ds * k3.dx, z + ds * k3.dz, th + ds * k3.dth, profile);

    const nx = x + ds / 6 * (k1.dx + 2 * k2.dx + 2 * k3.dx + k4.dx);
    const nz = z + ds / 6 * (k1.dz + 2 * k2.dz + 2 * k3.dz + k4.dz);
    const nth = th + ds / 6 * (k1.dth + 2 * k2.dth + 2 * k3.dth + k4.dth);

    let reflected = false;

    if (nz <= 0) {
      const tHit = (0 - z) / (nz - z);
      x = x + tHit * (nx - x);
      z = 0;
      th = -th;
      e *= P.etaSurface;
      reflected = true;
      bounces++;
    }

    if (!reflected) {
      const hb = bottom.intersectSegment(x, z, nx, nz);
      if (hb) {
        const dx = Math.cos(th), dz = -Math.sin(th);
        const dot = dx * hb.nx + dz * hb.nz;
        const rx = dx - 2 * dot * hb.nx;
        const rz = dz - 2 * dot * hb.nz;
        th = Math.atan2(-rz, rx);
        const graze = Math.abs(dot);
        e *= P.etaBottom * graze;
        x = hb.x + 1e-3 * hb.nx;
        z = hb.z + 1e-3 * hb.nz;
        reflected = true;
        bounces++;
      }
    }

    if (!reflected) { x = nx; z = nz; th = nth; }

    // --- Затухание ---
    const rr = r();
    e -= (P.alpha + P.kSpread / (1 + rr)) * ds * e;
    s += ds;

    // --- Время прихода: ds / c(z) ---
    const cLocal = profile.c(z);
    t += ds / cLocal;

    // --- Детект попадания ---
    const drx = x - level.receiver.x;
    const drz = z - level.receiver.z;
    if (drx * drx + drz * drz < level.receiver.radius * level.receiver.radius) {
      //if (e > P.eHit && !hit) {
	  if (!hit) {
        hit = true;
        hitEnergy = e;
        hitTime = t;
        hitX = x;
        hitZ = z;
      }
    }

    pts.push({ x, z, e, t });

    if (x > level.xMax * 2 || z > level.zMax * 2) break;
    if (bounces > P.maxBounces) break;
  }

  return {
    points: pts,
    hit, hitEnergy, hitTime, hitX, hitZ,
    bounces,
    pathLength: s,
    tMax: t,
  };
}

function deriv(x, z, th, profile) {
  const c = profile.c(z);
  const dcdz = profile.dcdz(z);
  return {
    dx: Math.cos(th),
    dz: -Math.sin(th),
    dth: dcdz * Math.cos(th) / c,
  };
}