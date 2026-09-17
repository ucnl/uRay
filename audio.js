// audio.js
// Синтез импульсного отклика через WebAudio.
// Один примитив: "импульс" заданной формы, повторённый в моменты t_i
// с амплитудами A_i. Отклик = свёртка исходного импульса с ИХ канала.

// Пресеты импульсов
export const IMPULSE_PRESETS = {
  impulse: {
    duration: 0.010,      // 10 мс
    f0: 2500,             // 2500 Гц
    sweepDown: 1.0,       // без свипа
    attack: 0.001,        // 1 мс
    release: 0.009,       // 9 мс
    peakGain: 1.0,
  },
  ping: {
    duration: 0.150,      // 150 мс
    f0: 1100,             // 1100 Гц
    sweepDown: 0.85,      // свип вниз на 15%
    attack: 0.010,        // 10 мс
    release: 0.140,       // 140 мс экспоненциального спада
    peakGain: 0.7,        // общий уровень чуть ниже, чем у импульса
  },
};

const TAIL = 0.010;       // хвост до нуля, чтобы не было щелчка

export class SonarAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.volume = 0.6;

    this._nodes = [];             // активные осцилляторы
    this._markerStart = 0;        // ctx.currentTime, когда стартовал отклик
    this._tMaxShot = 0;           // абсолютное время конца последнего пика
    this._markerActive = false;
  }

  ensure() {
    if (this.ctx) return;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(this.ctx.destination);
  }

  resume() {
    this.ensure();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
  }

  setMuted(m) {
    this.muted = !!m;
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
  }

  // Единая функция: воспроизвести отклик как сумму импульсов в точках t_i.
  // ir = { spikes: [{t, a}], tFirst, tMax, aMax, hitCount }
  // presetName: 'impulse' | 'ping'
  // Возвращает длительность звука в секундах (или 0).
	playIR(ir, presetName = 'ping', timeScale = 1) {
	  this.ensure();
	  if (!this.ctx || !ir || ir.hitCount === 0) return 0;

	  const preset = IMPULSE_PRESETS[presetName] || IMPULSE_PRESETS.ping;
	  this.stopAll();

	  const now = this.ctx.currentTime + 0.02;
	  this._markerStart = now;
	  this._timeScale = timeScale;
	  this._tMaxTOF = ir.tMax;

	  this._tMaxShot = (ir.tMax / timeScale) + preset.duration + TAIL;

	  const norm = 1 / Math.sqrt(Math.max(1, ir.hitCount));
	  const aMax = Math.max(ir.aMax, 1e-9);

	  for (const s of ir.spikes) {
		const rel = s.a / aMax;
		const gainPeak = rel * norm * preset.peakGain;
		const scaledT = s.t / timeScale;
		const when = now + scaledT;

		const osc = this.ctx.createOscillator();
		osc.type = 'sine';
		osc.frequency.setValueAtTime(preset.f0, when);
		if (preset.sweepDown !== 1.0) {
		  osc.frequency.exponentialRampToValueAtTime(
			Math.max(20, preset.f0 * preset.sweepDown),
			when + preset.duration
		  );
		}

		const g = this.ctx.createGain();
		g.gain.setValueAtTime(0, when);
		g.gain.linearRampToValueAtTime(gainPeak, when + preset.attack);
		g.gain.exponentialRampToValueAtTime(
		  Math.max(1e-5, gainPeak * 0.001),
		  when + preset.attack + preset.release
		);
		g.gain.linearRampToValueAtTime(0, when + preset.duration + TAIL);

		osc.connect(g);
		g.connect(this.master);
		osc.start(when);
		osc.stop(when + preset.duration + TAIL + 0.005);
		this._nodes.push(osc);
	  }

	  this._markerActive = true;
	  return this._tMaxShot;
	}



  stopAll() {
    for (const n of this._nodes) {
      try { n.stop(0); } catch (e) { /* ignore */ }
    }
    this._nodes.length = 0;
    this._markerActive = false;
  }

  // Текущее "время внутри отклика" в секундах от tFirst.
  // null — если звук отыграл.
	currentMarkerT() {
	  if (!this.ctx || !this._markerActive) return null;
	  const realDt = this.ctx.currentTime - this._markerStart;
	  if (realDt < 0) return 0;
	  const tofDt = realDt * this._timeScale;
	  if (tofDt > this._tMaxTOF + 0.15) {
		this._markerActive = false;
		return null;
	  }
	  return tofDt;
	}
}