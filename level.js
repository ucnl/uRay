// level.js
// Формат уровня: текстовый, секционный. Секции в квадратных скобках.
// Всё, что начинается с '#' — комментарий.

export function parseLevel(text) {
  const lines = text.split(/\r?\n/);
  const level = {
    name: 'Unnamed',
    description: '',
    xMax: 5000,
    zMax: 1000,
    source: { x: 0, z: 100 },
    receiver: { x: 4500, z: 500, radius: 30 },
    profile: [],   // [{z, c}]
    bottom: [],    // [{x, z}]
	achievements: [],
	message: '',
    // параметры физики (можно переопределить в уровне)
    physics: {
      ds: 2.0,            // шаг интегрирования, м
      eMin: 0.02,         // порог "живого" луча
      eSource: 1.0,       // начальная энергия
      eHit: 0.05,         // порог попадания
      etaBottom: 0.5,     // потери при отражении от дна
      etaSurface: 0.7,    // потери при отражении от поверхности
      alpha: 1e-4,        // поглощение, 1/м
      kSpread: 1e-3,      // упрощённое расхождение, 1/м
      maxBounces: 50,     // предохранитель
    },
    fan: {
      count: 9,           // число лучей
      spread: 6.0,        // полный угол веера, градусы
    },
  };

  let section = null;
  for (let raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    if (line.startsWith('[') && line.endsWith(']')) {
      section = line.slice(1, -1).toLowerCase();
      continue;
    }

    if (section === 'profile') {
      const [z, c] = line.split(',').map(s => parseFloat(s.trim()));
      if (Number.isFinite(z) && Number.isFinite(c)) level.profile.push({ z, c });
      continue;
    }
    if (section === 'bottom') {
      const [x, z] = line.split(',').map(s => parseFloat(s.trim()));
      if (Number.isFinite(x) && Number.isFinite(z)) level.bottom.push({ x, z });
      continue;
    }
	if (section === 'achievements') {
	  const parts = line.split(',').map(s => s.trim());
	  if (parts.length >= 3) {
		const [id, text, check, valStr] = parts;
		const value = valStr !== undefined ? parseFloat(valStr) : undefined;
		level.achievements.push({ id, text, check, value });
	  }
	  continue;
	}

    // Вне секции — key, value
    const idx = line.indexOf(',');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const val = line.slice(idx + 1).trim().replace(/^"|"$/g, '');

    switch (key) {
      case 'name':         level.name = val; break;
      case 'description':  level.description = val; break;
      case 'x_max':        level.xMax = parseFloat(val); break;
      case 'z_max':        level.zMax = parseFloat(val); break;
      case 'source_x':     level.source.x = parseFloat(val); break;
      case 'source_z':     level.source.z = parseFloat(val); break;
      case 'receiver_x':   level.receiver.x = parseFloat(val); break;
      case 'receiver_z':   level.receiver.z = parseFloat(val); break;
      case 'receiver_radius': level.receiver.radius = parseFloat(val); break;
      case 'ds':           level.physics.ds = parseFloat(val); break;
      case 'alpha':        level.physics.alpha = parseFloat(val); break;
      case 'eta_bottom':   level.physics.etaBottom = parseFloat(val); break;
      case 'eta_surface':  level.physics.etaSurface = parseFloat(val); break;
      case 'fan_count':    level.fan.count = parseInt(val, 10); break;
      case 'fan_spread':   level.fan.spread = parseFloat(val); break;
	  case 'message':      level.message = val; break;
    }
  }

  // Сортировка и валидация
  level.profile.sort((a, b) => a.z - b.z);
  level.bottom.sort((a, b) => a.x - b.x);

  if (level.profile.length < 2) throw new Error('Level: profile must have ≥2 points');
  if (level.bottom.length < 2)  throw new Error('Level: bottom must have ≥2 points');

  return level;
}