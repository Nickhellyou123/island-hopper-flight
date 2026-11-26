// Seeded RNG and value noise: every random choice in the world is reproducible
// from one seed, so a screenshot scene is the same on every run.
/** Mulberry32: a small fast seeded PRNG. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 2D value noise with smooth interpolation, built from a seeded permutation grid. */
export function makeNoise2D(seed) {
  const rand = mulberry32(seed);
  const perm = new Uint8Array(512);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i += 1) base[i] = i;
  for (let i = 255; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const t = base[i]; base[i] = base[j]; base[j] = t;
  }
  for (let i = 0; i < 512; i += 1) perm[i] = base[i & 255];
  const fade = (t) => t * t * (3 - 2 * t);
  const lattice = (ix, iy) => perm[(perm[ix & 255] + iy) & 255] / 255;
  function noise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const a = lattice(ix, iy), b = lattice(ix + 1, iy);
    const c = lattice(ix, iy + 1), d = lattice(ix + 1, iy + 1);
    const u = fade(fx), v = fade(fy);
    return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
  }
  /** Fractal brownian motion, `octaves` layers of noise. */
  function fbm(x, y, octaves) {
    let sum = 0, amp = 0.5, freq = 1, norm = 0;
    for (let o = 0; o < octaves; o += 1) {
      sum += amp * noise(x * freq, y * freq);
      norm += amp; amp *= 0.5; freq *= 2.03;
    }
    return sum / norm;
  }
  return { noise, fbm };
}

/** Smoothstep helper. */
export function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Clamp helper. */
export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

/** Linear interpolation helper. */
export function lerp(a, b, t) { return a + (b - a) * t; }
