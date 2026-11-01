// Small shared helpers: seeded RNG, picking, shuffling, clamping.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const pick = (rng, a) => a[Math.floor(rng() * a.length)];
export const rint = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
export const rnum = (rng, a, b) => a + rng() * (b - a);
export function shuffle(rng, arr) {
  const r = [...arr];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}
export function weightedPick(rng, items, wf) {
  const ws = items.map(wf);
  const tot = ws.reduce((a, b) => a + b, 0);
  if (!(tot > 0)) return items[Math.floor(rng() * items.length)];
  let r = rng() * tot;
  for (let i = 0; i < items.length; i++) if ((r -= ws[i]) <= 0) return items[i];
  return items[items.length - 1];
}
export const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const uid = (rng = Math.random) => Math.floor(rng() * 36 ** 6).toString(36).padStart(6, '0');
