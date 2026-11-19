// Small shared helpers: seeded random numbers, dates, JSON responses.

export function rng(seed = 42) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.normal = (mu = 0, sd = 1) => {
    const u = Math.max(next(), 1e-12), v = next();
    return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  next.beta = (a, b) => {
    // Gamma-ratio sampler (Marsaglia-Tsang), enough for Thompson sampling.
    const gamma = (k) => {
      if (k < 1) return gamma(k + 1) * Math.pow(next(), 1 / k);
      const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
      for (;;) {
        let x, v;
        do { x = next.normal(); v = 1 + c * x; } while (v <= 0);
        v = v * v * v;
        const u = next();
        if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
      }
    };
    const x = gamma(a), y = gamma(b);
    return x / (x + y);
  };
  return next;
}

export const DAY = 864e5;
export const isoDate = (t) => new Date(t).toISOString().slice(0, 10);
export const addDays = (iso, n) => isoDate(new Date(iso + "T00:00:00Z").getTime() + n * DAY);
export const yearsBetween = (a, b) => (new Date(b) - new Date(a)) / (365.25 * DAY);
export const round = (x, d = 0) => Math.round(x * 10 ** d) / 10 ** d;
