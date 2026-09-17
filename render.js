// render.js

export function renderProfile(canvas, level, profile) {
  const ctx = canvas.getContext('2d');
  const W = canvas.clientWidth || canvas.width;
  const H = canvas.clientHeight || canvas.height;
  ctx.clearRect(0, 0, W, H);

  const horizontal = W > H * 1.5;   // широкая полоса => горизонтальный режим

  let cmin = Infinity, cmax = -Infinity;
  for (let i = 0; i < profile.n; i++) {
    const c = profile.table[i];
    if (c < cmin) cmin = c;
    if (c > cmax) cmax = c;
  }
  const cRange = Math.max(cmax - cmin, 1);

  const pad = horizontal
    ? { l: 30, r: 30, t: 14, b: 20 }
    : { l: 40, r: 12, t: 20, b: 30 };
  const gw = W - pad.l - pad.r;
  const gh = H - pad.t - pad.b;

  ctx.fillStyle = '#7fb5cc';
  ctx.font = '10px Consolas';

  if (horizontal) {
    // z по X, c по Y
    const zScale = gw / level.zMax;
    const cScale = gh / cRange;
    const Y = c => pad.t + gh - (c - cmin) * cScale;
    const Xz = z => pad.l + z * zScale;

    // Оси
    ctx.strokeStyle = '#1c3a4a';
    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t);
    ctx.lineTo(pad.l, pad.t + gh);
    ctx.lineTo(pad.l + gw, pad.t + gh);
    ctx.stroke();

    // Кривая c(z)
    ctx.strokeStyle = '#6fff9a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < profile.n; i++) {
      const z = profile.z0 + i * profile.dz;
      const c = profile.table[i];
      const x = Xz(z);
      const y = Y(c);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Маркеры источника и приёмника по глубине
    drawDepthMarker(ctx, Xz(level.source.z), pad.t + gh, cmin, cmax, cScale, '#6fe3ff', pad, gh);
    drawDepthMarker(ctx, Xz(level.receiver.z), pad.t + gh, cmin, cmax, cScale, '#ffd24a', pad, gh);

    ctx.fillText(`c: ${cmin.toFixed(0)}–${cmax.toFixed(0)} м/с`, 4, 10);
    ctx.fillText('z, м →', pad.l + gw - 40, pad.t + gh + 14);
  } else {
    // z по Y (вертикально), c по X
    const zScale = gh / level.zMax;
    const cScale = gw / cRange;
    const Xc = c => pad.l + (c - cmin) * cScale;
    const Zz = z => pad.t + z * zScale;

    ctx.strokeStyle = '#1c3a4a';
    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t);
    ctx.lineTo(pad.l, pad.t + gh);
    ctx.lineTo(pad.l + gw, pad.t + gh);
    ctx.stroke();

    ctx.strokeStyle = '#6fff9a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < profile.n; i++) {
      const z = profile.z0 + i * profile.dz;
      const c = profile.table[i];
      const x = Xc(c);
      const y = Zz(z);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Маркеры глубины источника и приёмника
    drawDepthLineH(ctx, pad.l, pad.l + gw, Zz(level.source.z), '#6fe3ff');
    drawDepthLineH(ctx, pad.l, pad.l + gw, Zz(level.receiver.z), '#ffd24a');

    ctx.fillText(`c, м/с (${cmin.toFixed(0)}–${cmax.toFixed(0)})`, 4, 12);
    ctx.fillText('0', 4, pad.t + 10);
    ctx.fillText(String(level.zMax | 0), 4, pad.t + gh);
  }
}

function drawDepthMarker(ctx, x, yBase, cmin, cmax, cScale, color) {
  ctx.strokeStyle = color;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(x, yBase);
  ctx.lineTo(x, yBase - 6);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawDepthLineH(ctx, x1, x2, y, color) {
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.4;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

export function renderScene(canvas, level, profile, bottom, fan, aimAngleRad, elapsed = Infinity, opts = {}) {
  const ctx = canvas.getContext('2d');
  const W = canvas.clientWidth || canvas.width;
  const H = canvas.clientHeight || canvas.height;
  ctx.clearRect(0, 0, W, H);

  const pad = { l: 30, r: 20, t: 20, b: 30 };
  const gw = W - pad.l - pad.r;
  const gh = H - pad.t - pad.b;

  const xScale = gw / level.xMax;
  const zScale = gh / level.zMax;

  const X = x => pad.l + x * xScale;
  const Z = z => pad.t + z * zScale;
  
  const fadeAlpha = (opts.fadeAlpha === undefined) ? 1 : opts.fadeAlpha;

  // Сетка
  ctx.strokeStyle = '#0f2430';
  ctx.lineWidth = 1;
  for (let x = 0; x <= level.xMax; x += 500) {
    ctx.beginPath(); ctx.moveTo(X(x), pad.t); ctx.lineTo(X(x), pad.t + gh); ctx.stroke();
  }
  for (let z = 0; z <= level.zMax; z += 100) {
    ctx.beginPath(); ctx.moveTo(pad.l, Z(z)); ctx.lineTo(pad.l + gw, Z(z)); ctx.stroke();
  }

  ctx.fillStyle = '#7fb5cc';
  ctx.font = '10px Consolas';
  ctx.fillText('X, м', W - 40, pad.t + gh + 20);
  ctx.fillText('Z, м', 4, pad.t + 10);

  // Дно
  ctx.fillStyle = '#2a1f10';
  ctx.beginPath();
  ctx.moveTo(X(level.bottom[0].x), Z(level.bottom[0].z));
  for (const p of level.bottom) ctx.lineTo(X(p.x), Z(p.z));
  ctx.lineTo(X(level.xMax), Z(level.zMax + 100));
  ctx.lineTo(X(0), Z(level.zMax + 100));
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#8a6b3a';
  ctx.beginPath();
  ctx.moveTo(X(level.bottom[0].x), Z(level.bottom[0].z));
  for (const p of level.bottom) ctx.lineTo(X(p.x), Z(p.z));
  ctx.stroke();

  // Приёмник — пульсирует, если opts.nearReceiver
  const pulse = opts.nearReceiver ? (0.5 + 0.5 * Math.sin(performance.now() / 200)) : 0;
  const recColor = opts.hit ? '#6fff9a' : (opts.nearReceiver ? '#ffe680' : '#ffd24a');
  const recLineW = 2 + pulse * 2;
  ctx.strokeStyle = recColor;
  ctx.lineWidth = recLineW;
  ctx.beginPath();
  ctx.arc(X(level.receiver.x), Z(level.receiver.z), level.receiver.radius * xScale, 0, Math.PI * 2);
  ctx.stroke();

  // Источник — с сектором направленности (в МИРОВЫХ координатах)
  const srcX = X(level.source.x);
  const srcZ = Z(level.source.z);
  
  if (typeof aimAngleRad === 'number') {
	  const spreadRad = level.fan.spread * Math.PI / 180;
	  const Rw = 0.15 * level.xMax;   // радиус сектора в метрах
	  const th1 = aimAngleRad + spreadRad / 2;
	  const th2 = aimAngleRad - spreadRad / 2;

      // Точки в мире
	  const worldPts = [];
	  const N = 12;
	  for (let i = 0; i <= N; i++) {
		const th = th1 + (th2 - th1) * (i / N);
		worldPts.push({
			x: level.source.x + Math.cos(th) * Rw,
			z: level.source.z - Math.sin(th) * Rw,
			});
		}

		// Рисуем "пирог"
		ctx.fillStyle = 'rgba(120, 220, 255, 0.12)';
		ctx.beginPath();
		ctx.moveTo(srcX, srcZ);
		for (const p of worldPts) {
			ctx.lineTo(X(p.x), Z(p.z));
		}
		ctx.closePath();
		ctx.fill();

		// Стрелка-вектор (тоже в мире)
		const arrowRw = 0.12 * level.xMax;
		const axWorld = level.source.x + Math.cos(aimAngleRad) * arrowRw;
		const azWorld = level.source.z - Math.sin(aimAngleRad) * arrowRw;
		ctx.strokeStyle = 'rgba(200, 240, 255, 0.7)';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(srcX, srcZ);
		ctx.lineTo(X(axWorld), Z(azWorld));
		ctx.stroke();
	}
  
  
  ctx.fillStyle = '#6fe3ff';
  ctx.beginPath();
  ctx.arc(srcX, srcZ, 6, 0, Math.PI * 2);
  ctx.fill();

	// Лучи
	if (fan && fadeAlpha > 0.001) {
	  for (const ray of fan.rays) {
		const pts = ray.trace.points;
		for (let i = 1; i < pts.length; i++) {
		  const a = pts[i - 1], b = pts[i];
		  if (a.t > elapsed) break;
		  const e = (a.e + b.e) * 0.5;
		  const alpha = Math.min(1, e * ray.weight * 2) * fadeAlpha;
		  if (alpha < 0.005) continue;
		  const width = 0.5 + 2.5 * Math.min(1, e * ray.weight * 2) * fadeAlpha;
		  ctx.strokeStyle = `rgba(120, 220, 255, ${alpha})`;
		  ctx.lineWidth = width;
		  ctx.beginPath();
		  ctx.moveTo(X(a.x), Z(a.z));
		  ctx.lineTo(X(b.x), Z(b.z));
		  ctx.stroke();
		}

		const front = findFront(pts, elapsed);
		if (front && elapsed !== Infinity) {
		  ctx.fillStyle = `rgba(220, 245, 255, ${0.95 * fadeAlpha})`;
		  ctx.beginPath();
		  ctx.arc(X(front.x), Z(front.z), 2.5, 0, Math.PI * 2);
		  ctx.fill();
		}

		if (ray.hit && elapsed >= ray.trace.tMax) {
		  ctx.fillStyle = `rgba(111, 255, 154, ${fadeAlpha})`;
		  ctx.beginPath();
		  ctx.arc(X(ray.trace.hitX), Z(ray.trace.hitZ), 4, 0, Math.PI * 2);
		  ctx.fill();
		}
	  }
	}

  return { X, Z, xScale, zScale, pad, gw, gh };
}

function findFront(pts, elapsed) {
  if (elapsed === Infinity || !pts.length) return null;
  if (pts[0].t > elapsed) return pts[0];
  const last = pts[pts.length - 1];
  if (last.t <= elapsed) return last;
  let lo = 0, hi = pts.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (pts[mid].t <= elapsed) lo = mid; else hi = mid;
  }
  return pts[lo];
}

export function renderIR(canvas, ir, opts = {}) {
  const ctx = canvas.getContext('2d');
  const W = canvas.clientWidth || canvas.width;
  const H = canvas.clientHeight || canvas.height;
  ctx.clearRect(0, 0, W, H);

  const pad = { l: 40, r: 12, t: 16, b: 20 };
  const gw = W - pad.l - pad.r;
  const gh = H - pad.t - pad.b;

  // Оси
  ctx.strokeStyle = '#1c3a4a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.l, pad.t);
  ctx.lineTo(pad.l, pad.t + gh);
  ctx.lineTo(pad.l + gw, pad.t + gh);
  ctx.stroke();

  ctx.fillStyle = '#7fb5cc';
  ctx.font = '10px Consolas';
  ctx.fillText('Импульсная характеристика', 4, 10);

  if (!ir || ir.hitCount === 0) {
    // Нет попаданий — пустая ось + надпись
    ctx.fillStyle = '#3a5a6a';
    ctx.textAlign = 'center';
    ctx.fillText('— нет попаданий —', pad.l + gw / 2, pad.t + gh / 2 + 4);
    ctx.textAlign = 'left';
    return { pad, gw, gh, tScale: 0 };
  }

  // Масштабы
  const tSpan = Math.max(ir.tMax, 0.001);  // чтобы не делить на 0
  const tScale = gw / tSpan;
  const aScale = gh / Math.max(ir.aMax, 0.001);

  // Столбики
  const markerT = (typeof opts.markerT === 'number') ? opts.markerT : null;
  const spikeW = 2.5;

  for (const s of ir.spikes) {
    const x = pad.l + s.t * tScale;
    const h = s.a * aScale;
    const reached = (markerT !== null) && (s.t <= markerT);

    const alpha = 0.35 + 0.65 * (s.a / ir.aMax);
    ctx.fillStyle = reached
      ? `rgba(200, 245, 255, ${Math.min(1, alpha * 1.2)})`
      : `rgba(120, 220, 255, ${alpha})`;

    ctx.fillRect(x - spikeW / 2, pad.t + gh - h, spikeW, h);

    // Пик-маркер
    ctx.fillStyle = reached ? '#ffd24a' : '#6fe3ff';
    ctx.beginPath();
    ctx.arc(x, pad.t + gh - h, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Маркер времени — вертикальная линия
  if (markerT !== null) {
    const xm = pad.l + Math.min(markerT, tSpan) * tScale;
    ctx.strokeStyle = 'rgba(255, 210, 74, 0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xm, pad.t);
    ctx.lineTo(xm, pad.t + gh);
    ctx.stroke();
  }

  // Подписи осей
  ctx.fillStyle = '#7fb5cc';
  ctx.fillText('0', pad.l - 4, pad.t + gh + 12);
  const tLbl = (tSpan * 1000).toFixed(0) + ' мс';
  const tw = ctx.measureText(tLbl).width;
  ctx.fillText(tLbl, pad.l + gw - tw, pad.t + gh + 12);
  ctx.fillText('t', pad.l + gw / 2 - 4, pad.t + gh + 12);

  // Метка "t_first" — показываем первую точку
  if (ir.tFirst > 0.001) {
    const xFirst = pad.l + ir.tFirst * tScale;
    ctx.strokeStyle = 'rgba(111, 255, 154, 0.35)';
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(xFirst, pad.t);
    ctx.lineTo(xFirst, pad.t + gh);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(111, 255, 154, 0.7)';
    const tFirstMs = (ir.tFirst * 1000).toFixed(1) + ' мс';
    ctx.fillText(tFirstMs, xFirst + 3, pad.t + 9);
  }

  return { pad, gw, gh, tScale, aScale };
}