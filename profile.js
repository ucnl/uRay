// profile.js
// Принимает массив {z, c}, строит плотную таблицу с шагом dz,
// даёт c(z) и dc/dz через O(1) индексацию.

export class SoundProfile {
  constructor(points, dz = 0.1) {
    if (points.length < 2) throw new Error('SoundProfile: need ≥2 points');
    this.z0 = points[0].z;
    this.z1 = points[points.length - 1].z;
    this.dz = dz;

    const n = Math.max(2, Math.ceil((this.z1 - this.z0) / dz) + 1);
    this.n = n;
    this.table = new Float32Array(n);

    let seg = 0;
    for (let i = 0; i < n; i++) {
      const z = this.z0 + i * dz;
      while (seg < points.length - 2 && points[seg + 1].z < z) seg++;
      const p1 = points[seg];
      const p2 = points[seg + 1];
      const t = (z - p1.z) / (p2.z - p1.z);
      this.table[i] = p1.c + (p2.c - p1.c) * Math.max(0, Math.min(1, t));
    }
  }

  // c(z), м/с. Клампим к границам.
  c(z) {
    let idx = (z - this.z0) / this.dz;
    if (idx <= 0) return this.table[0];
    if (idx >= this.n - 1) return this.table[this.n - 1];
    const i = idx | 0;
    const f = idx - i;
    return this.table[i] * (1 - f) + this.table[i + 1] * f;
  }

  // dc/dz, центральная разность
  dcdz(z) {
    let idx = (z - this.z0) / this.dz;
    if (idx < 1) idx = 1;
    if (idx > this.n - 2) idx = this.n - 2;
    const i = idx | 0;
    return (this.table[i + 1] - this.table[i - 1]) / (2 * this.dz);
  }
}