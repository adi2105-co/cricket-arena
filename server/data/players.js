// Player registry. Real star names come from stars.js; everyone else is generated deterministically
// (seeded), so saved games always find the same players again.
import { STARS, STARS_W } from './stars.js';
import { genName, reserveName, SOUTH_ASIAN } from './names.js';
import { mulberry32, hashStr, clamp, pick, rint, slug } from '../util.js';

export const PLAYERS = new Map();
export const getPlayer = (id) => PLAYERS.get(id);

export function derive(role, ovr, flags = '') {
  let bat, bowl;
  if (role === 'BAT') { bat = ovr; bowl = clamp(ovr - 55, 15, 40); }
  else if (role === 'WK') { bat = ovr - 1; bowl = 12; }
  else if (role === 'BOWL') { bowl = ovr; bat = clamp(Math.round(ovr * 0.55 - 10), 18, 50); }
  else if (flags.includes('a')) { bat = ovr + 1; bowl = ovr - 14; }
  else if (flags.includes('b')) { bat = ovr - 14; bowl = ovr + 1; }
  else { bat = ovr - 3; bowl = ovr - 6; }
  return { bat: clamp(Math.round(bat), 10, 99), bowl: clamp(Math.round(bowl), 10, 99) };
}

export function makePlayer({ id, name, c, role, ovr, flags = '', w = false, extra }) {
  const d = derive(role, ovr, flags);
  const p = {
    id, name, c, role, ovr, bat: d.bat, bowl: d.bowl, w,
    hand: flags.includes('L') ? 'L' : 'R',
    style: role === 'BAT' || role === 'WK' ? (flags.includes('S') ? 'S' : flags.includes('P') ? 'P' : null) : (flags.includes('S') ? 'S' : 'P'),
    arm: flags.includes('A') ? 'L' : 'R',
    ...extra,
  };
  PLAYERS.set(id, p);
  return p;
}

// ---- stars ----
const STAR_LISTS = { m: {}, w: {} };
function loadStars(table, women) {
  for (const [c, rows] of Object.entries(table)) {
    const list = [];
    for (const row of rows) {
      const [name, role, ovr, flags] = row.split('|');
      reserveName(name);
      const id = `${women ? 'w-' : ''}${c.toLowerCase()}-${slug(name)}`;
      list.push(makePlayer({ id, name, c, role, ovr: +ovr, flags, w: women }));
    }
    list.sort((a, b) => b.ovr - a.ovr);
    STAR_LISTS[women ? 'w' : 'm'][c] = list;
  }
}
loadStars(STARS, false);
loadStars(STARS_W, true);
export const starsOf = (c, women = false) => STAR_LISTS[women ? 'w' : 'm'][c] || [];

// ---- generation ----
const counters = {};
function gauss(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
export function roleMix(rng) {
  const r = rng();
  return r < 0.3 ? 'BAT' : r < 0.62 ? 'BOWL' : r < 0.84 ? 'AR' : 'WK';
}
export function genPlayer(rng, c, women, role, ovr) {
  const key = `${c}${women ? 'w' : 'm'}`;
  counters[key] = (counters[key] || 0) + 1;
  const id = `g${women ? 'w' : 'm'}-${c.toLowerCase()}-${counters[key]}`;
  let flags = '';
  if (rng() < 0.25) flags += 'L';
  if (role === 'BOWL' || role === 'AR') {
    flags += rng() < (SOUTH_ASIAN.has(c) ? 0.5 : 0.3) ? 'S' : 'P';
    if (rng() < 0.25) flags += 'A';
    if (role === 'AR') flags += rng() < 0.5 ? 'a' : 'b';
  }
  return makePlayer({ id, name: genName(rng, c, women), c, role, ovr, flags, w: women });
}

const BASE = {
  m: { IND: 76, AUS: 76, ENG: 75, RSA: 73, NZ: 73, PAK: 73, WI: 71, SL: 70, AFG: 69, BAN: 68, IRE: 64, ZIM: 64 },
  w: { AUS: 76, IND: 73, ENG: 73, RSA: 71, NZ: 70, WI: 66, PAK: 63, SL: 62, BAN: 58 },
};
const baseOf = (c, women) => (women ? BASE.w : BASE.m)[c] ?? (women ? 54 : 60);

const squadCache = new Map();
export function nationSquad(c, women = false) {
  const key = `${c}:${women ? 'w' : 'm'}`;
  if (squadCache.has(key)) return squadCache.get(key);
  const rng = mulberry32(hashStr('nation-' + key));
  const stars = [...starsOf(c, women)];
  const need = { WK: 2, BAT: 5, AR: 3, BOWL: 5 };
  const squad = [];
  for (const role of ['WK', 'BAT', 'AR', 'BOWL']) {
    const mine = stars.filter((p) => p.role === role).slice(0, need[role]);
    squad.push(...mine);
    for (let i = mine.length; i < need[role]; i++) {
      squad.push(genPlayer(rng, c, women, role, clamp(baseOf(c, women) + rint(rng, -5, 2), 45, 80)));
    }
  }
  const ids = squad.map((p) => p.id);
  squadCache.set(key, ids);
  return ids;
}

// Auction pool for a league: home stars + top overseas stars + generated domestic players.
const poolCache = new Map();
export function buildPool({ id, women = false, loc, ovs = [], size }) {
  if (poolCache.has(id)) return poolCache.get(id);
  const rng = mulberry32(hashStr('pool-' + id));
  const list = [];
  const seen = new Set();
  const add = (p) => { if (!seen.has(p.id)) { seen.add(p.id); list.push(p); } };
  for (const c of loc) starsOf(c, women).slice(0, Math.floor(size * 0.6)).forEach(add);
  for (const [c, n] of ovs) starsOf(c, women).slice(0, n).forEach(add);
  let wk = list.filter((p) => p.role === 'WK').length;
  while (list.length < size) {
    const c = pick(rng, loc);
    let role = roleMix(rng);
    if (wk < size * 0.12 && rng() < 0.3) role = 'WK';
    if (role === 'WK') wk++;
    const ovr = clamp(Math.round(66 + gauss(rng) * 5), 52, 78);
    add(genPlayer(rng, c, women, role, ovr));
  }
  const ids = list.map((p) => p.id);
  poolCache.set(id, ids);
  return ids;
}

export const teamStrength = (ids) => {
  const ps = ids.map(getPlayer).filter(Boolean).sort((a, b) => b.ovr - a.ovr).slice(0, 11);
  return ps.reduce((a, p) => a + p.ovr, 0) / Math.max(1, ps.length);
};
