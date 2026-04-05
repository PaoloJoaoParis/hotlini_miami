export class RNG {
  constructor(seed) {
    if (!Number.isFinite(seed)) {
      throw new Error("RNG seed must be a finite number");
    }

    this.state = seed >>> 0;

    if (this.state === 0) {
      this.state = 0x6d2b79f5;
    }
  }

  next() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  between(min, max) {
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      throw new Error("RNG between(min, max) expects finite numbers");
    }

    if (max < min) {
      throw new Error("RNG between(min, max) expects max >= min");
    }

    return min + (max - min) * this.next();
  }
}
