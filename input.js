// input.js

export function attachInput(canvas, opts) {
  const state = { dragging: false, angleRad: 0 };

  const localPos = (evt) => {
    const r = canvas.getBoundingClientRect();
    const t = evt.touches ? evt.touches[0] : evt;
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  };

  const update = (evt) => {
    const p = localPos(evt);
    const s = opts.getSourceScreen();
    const dx = p.x - s.x;
    const dy = p.y - s.y;
    if (dx * dx + dy * dy < 25) return;
    state.angleRad = Math.atan2(-dy, dx);
    opts.onAngleChange(state.angleRad);
  };

  const start = (evt) => {
    const p = localPos(evt);
    const s = opts.getSourceScreen();
    const dx = p.x - s.x, dy = p.y - s.y;
    if (dx * dx + dy * dy < 40 * 40) {
      state.dragging = true;
      canvas.setPointerCapture?.(evt.pointerId);
      update(evt);
      evt.preventDefault();
    }
  };

  const move = (evt) => {
    if (!state.dragging) return;
    update(evt);
    evt.preventDefault();
  };

  const end = (evt) => {
    if (!state.dragging) return;
    state.dragging = false;
    opts.onRelease(state.angleRad);
    evt.preventDefault();
  };

  canvas.addEventListener('pointerdown', start);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.style.touchAction = 'none';

  // Колесо — точная подстройка угла (или грубая с Shift)
  canvas.addEventListener('wheel', (evt) => {
    evt.preventDefault();
    const step = (evt.shiftKey ? 5 : 0.5) * Math.PI / 180;
    const dir = evt.deltaY > 0 ? -1 : 1;
    state.angleRad += dir * step;
    opts.onAngleChange(state.angleRad);
    // обновим и «прицел» без выстрела
    opts.onPrecise?.(state.angleRad);
  }, { passive: false });

  return {
    get angle() { return state.angleRad; },
    set angle(a) { state.angleRad = a; },
    isDragging() { return state.dragging; },
  };
}