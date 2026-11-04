export type Rng = () => number;

/** Small deterministic PRNG so the seeded dashboard looks identical on every load. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const randInt = (rng: Rng, min: number, max: number) =>
  Math.floor(rng() * (max - min + 1)) + min;

export const randFloat = (rng: Rng, min: number, max: number) => rng() * (max - min) + min;

export const pick = <T,>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)];

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export const round1 = (v: number) => Math.round(v * 10) / 10;
