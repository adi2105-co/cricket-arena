// Career mode: create your own player and climb Club -> State -> Franchise -> International.
// State is plain JSON. The player is re-registered into the player map on each request (registerCareer).
import { PLAYERS, genPlayer } from '../data/players.js';
import { VENUES, VENUE_BY_ID } from '../data/venues.js';
import { NATIONS } from '../data/nations.js';
import { clamp, pick, rint } from '../util.js';
import { orderXI } from './xi.js';
import { playMatch } from './match.js';

export const TIERS = [
  { id: 'club', name: 'Club Cricket', fmts: ['T20'], ovr: [48, 60], matches: 10, need: 6.2, fee: 'Local clubs' },
  { id: 'state', name: 'State & County', fmts: ['ODI', 'T20'], ovr: [58, 70], matches: 12, need: 6.5, fee: 'Domestic circuit' },
  { id: 'league', name: 'Franchise League', fmts: ['T20'], ovr: [68, 80], matches: 14, need: 6.9, fee: 'Franchise contract' },
  { id: 'intl', name: 'International', fmts: ['T20', 'ODI', 'TEST'], ovr: [76, 90], matches: 14, need: 99, fee: 'National cap' },
];

export const PRESETS = {
  opener: { label: 'Aggressive opener', role: 'BAT', bat: 44, bowl: 20 },
  anchor: { label: 'Classical anchor', role: 'BAT', bat: 46, bowl: 18 },
  finisher: { label: 'Power finisher', role: 'AR', bat: 42, bowl: 32 },
  keeper: { label: 'Wicketkeeper-batter', role: 'WK', bat: 43, bowl: 12 },
  fast: { label: 'Strike pace bowler', role: 'BOWL', bat: 22, bowl: 45 },
  spin: { label: 'Mystery spinner', role: 'BOWL', bat: 24, bowl: 44 },
  allround: { label: 'All-rounder', role: 'AR', bat: 38, bowl: 38 },
};

const FREE_POINTS = 14;
const ovrOf = (p) => (p.role === 'BAT' || p.role === 'WK' ? p.bat : p.role === 'BOWL' ? p.bowl : Math.round((p.bat + p.bowl) / 2 + 3));

export function createCareer({ name, country, women, preset, role, hand, style, arm, alloc = {}, seed = 1 }) {
  name = String(name || '').trim().slice(0, 28);
  if (name.length < 2) throw new Error('Give your player a name');
  if (!NATIONS.some((n) => n.c === country)) throw new Error('Pick a country');
  const pr = PRESETS[preset] || PRESETS.allround;
  const r = ['BAT', 'BOWL', 'AR', 'WK'].includes(role) ? role : pr.role;
  const b = clamp(+alloc.bat || 0, 0, FREE_POINTS), w = clamp(+alloc.bowl || 0, 0, FREE_POINTS);
  if (b + w > FREE_POINTS) throw new Error(`You have ${FREE_POINTS} points to spend`);
  const bat = pr.bat + b, bowl = pr.bowl + w;
  const p = {
    id: 'career-me', name, c: country, role: r, w: !!women, custom: 1,
    bat, bowl, hand: hand === 'L' ? 'L' : 'R',
    style: r === 'BOWL' || r === 'AR' ? (style === 'S' ? 'S' : 'P') : null, arm: arm === 'L' ? 'L' : 'R',
  };
  p.ovr = ovrOf(p);
  return {
    kind: 'career', seed, player: p, age: 18, season: 1, tier: 0, team: club(country, 0), points: 0, xp: 0,
    ratings: [], matchNo: 0, matches: [], stats: blank(), tierStats: TIERS.map(() => blank()), caps: { T20: 0, ODI: 0, TEST: 0 },
    honours: [], log: [`Career begins: ${name} joins ${club(country, 0)}.`], retired: false, pending: null,
  };
}

const blank = () => ({ m: 0, inn: 0, runs: 0, balls: 0, hs: 0, no: 0, f: 0, h: 0, w: 0, bruns: 0, bballs: 0, bw5: 0, best: '0/0', pom: 0 });

const CLUBS = ['Riverside CC', 'Oakfield CC', 'Harbour CC', 'Lakeside CC', 'Greenfield CC', 'Northgate CC', 'Redstone CC', 'Fairview CC'];
const club = (c, tier) => `${CLUBS[(c.charCodeAt(0) + c.charCodeAt(1) + tier * 3) % CLUBS.length]}`;

export function registerCareer(g) { PLAYERS.set(g.player.id, g.player); return g; }

function teamName(g, rng) {
  const t = g.tier;
  if (t === 0) return g.team;
  if (t === 1) return `${NATIONS.find((n) => n.c === g.player.c).n} State XI`;
  if (t === 2) return pick(rng, ['Royals', 'Titans', 'Strikers', 'Kings', 'Thunder', 'Hurricanes']);
  return NATIONS.find((n) => n.c === g.player.c).n;
}

function genTeam(rng, c, women, tier, id, name, me) {
  const [lo, hi] = TIERS[tier].ovr;
  const roles = ['BAT', 'BAT', 'BAT', 'WK', 'AR', 'AR', 'BOWL', 'BOWL', 'BOWL', 'BOWL', 'AR'];
  const xi = roles.map((role) => genPlayer(rng, c, women, role, rint(rng, lo, hi)));
  if (me) {
    // the player replaces the weakest player of a matching role
    const i = xi.findIndex((p) => p.role === me.role) >= 0 ? xi.findIndex((p) => p.role === me.role) : 4;
    xi[i] = me;
    if (me.role !== 'WK' && !xi.some((p) => p.role === 'WK')) xi[3] = genPlayer(rng, c, women, 'WK', rint(rng, lo, hi));
  }
  return { id, name, col: '#4aa3ff', xi: orderXI(xi) };
}

/** Plan and play the next career match. Returns the updated state and the match record. */
export function playNext(g, rng) {
  if (g.retired) throw new Error('Career is over');
  const T = TIERS[g.tier];
  const fmt = pick(rng, T.fmts);
  const p = g.player;
  const oppC = g.tier === 3 ? pick(rng, NATIONS.filter((n) => n.c !== p.c && (fmt !== 'TEST' || n.test)).map((n) => n.c)) : p.c;
  const mine = genTeam(rng, p.c, p.w, g.tier, 'me', teamName(g, rng), p);
  const opp = genTeam(rng, oppC, p.w, g.tier, 'opp', g.tier === 3 ? NATIONS.find((n) => n.c === oppC).n : pick(rng, ['Rangers', 'Dynamos', 'Falcons', 'Lions', 'Panthers', 'United']), null);
  const venue = pick(rng, VENUES.filter((v) => (g.tier === 3 ? true : v.country === p.c)).concat(VENUES.slice(0, 1)));
  const [a, b] = rng() < 0.5 ? [mine, opp] : [opp, mine];
  const res = playMatch(a, b, { fmt, venue, rng, night: fmt !== 'TEST' && rng() < 0.5, keepComm: false });
  const perf = performance(res, p.id);
  const rec = {
    n: g.matchNo + 1, season: g.season, tier: g.tier, fmt, venue: venue.id, vs: opp.name, team: mine.name,
    result: res.winner === 'me' ? 'W' : res.winner === 'opp' ? 'L' : res.tie ? 'T' : 'D', text: res.text, perf,
    ent: entry(res, p.id),
  };
  return { rec, res };
}

function entry(res, pid) {
  // context the 3D "play my knock" mode needs: the first innings the player bats in, and the target if chasing
  const i = res.inns.findIndex((inn) => inn.bat.some((x) => x.id === pid));
  if (i < 0) return null;
  const chasing = i === 1 && res.fmt !== 'TEST';
  return { innings: i, target: chasing ? res.inns[0].t + 1 : null, balls: res.fmt === 'T20' ? 120 : res.fmt === 'ODI' ? 300 : null };
}

export function performance(res, pid) {
  const o = { runs: 0, balls: 0, out: 0, inn: 0, f: 0, s: 0, wk: 0, bruns: 0, bballs: 0, hs: 0, best: [0, 999] };
  for (const inn of res.inns) {
    const bt = inn.bat.find((x) => x.id === pid);
    if (bt && (bt.b > 0 || bt.o)) { o.inn++; o.runs += bt.r; o.balls += bt.b; o.f += bt.f || 0; o.s += bt.s || 0; if (bt.o) o.out++; o.hs = Math.max(o.hs, bt.r); }
    const bw = inn.bowl.find((x) => x.id === pid);
    if (bw) { o.wk += bw.w; o.bruns += bw.r; o.bballs += bw.b; if (bw.w > o.best[0] || (bw.w === o.best[0] && bw.r < o.best[1])) o.best = [bw.w, bw.r]; }
  }
  o.winner = res.winner;
  return o;
}

const EXP = { T20: 24, ODI: 34, TEST: 38 };
export function rate(perf, fmt) {
  let s = 5.2;
  if (perf.inn) {
    const sr = perf.balls ? (perf.runs / perf.balls) * 100 : 0;
    s += (perf.runs / perf.inn - EXP[fmt] * 0.6) / (EXP[fmt] * 0.6) * 1.6;
    if (fmt !== 'TEST' && perf.balls >= 10) s += clamp((sr - (fmt === 'T20' ? 125 : 82)) / 60, -0.6, 0.9);
  }
  if (perf.bballs) {
    s += perf.wk * 0.85;
    const eco = (perf.bruns / perf.bballs) * 6;
    s += clamp(((fmt === 'T20' ? 8.4 : fmt === 'ODI' ? 5.7 : 3.2) - eco) / 3, -0.7, 0.7);
  }
  if (!perf.inn && !perf.bballs) s = 4.6;
  return clamp(+s.toFixed(1), 3, 10);
}

/** Apply a played match to career state: stats, XP, ratings. */
export function applyMatch(g, rec) {
  const p = rec.perf, st = [g.stats, g.tierStats[g.tier]];
  for (const s of st) {
    s.m++; s.inn += p.inn; s.runs += p.runs; s.balls += p.balls; s.no += p.inn - p.out; s.f += p.f; if (p.hs > s.hs) s.hs = p.hs;
    if (p.hs >= 100) s.h++;
    s.w += p.wk; s.bruns += p.bruns; s.bballs += p.bballs; if (p.wk >= 5) s.bw5++;
    const [bw, br] = String(s.best).split('/').map(Number);
    if (p.best[0] > bw || (p.best[0] === bw && p.best[1] < br)) s.best = `${p.best[0]}/${p.best[1]}`;
  }
  rec.rating = rate(p, rec.fmt);
  if (rec.rating >= 8.5) { g.stats.pom++; g.tierStats[g.tier].pom++; rec.pom = 1; }
  const xp = Math.round(8 + (rec.rating - 5) * 6 + p.runs * 0.5 + p.wk * 7 + (rec.result === 'W' ? 4 : 0));
  rec.xp = Math.max(2, xp);
  g.xp += rec.xp;
  while (g.xp >= 130) { g.xp -= 130; g.points++; }
  g.ratings.push(rec.rating);
  g.matchNo++;
  if (g.tier === 3) g.caps[rec.fmt]++;
  g.matches.unshift(rec);
  if (g.matches.length > 60) g.matches.length = 60;
  if (p.hs >= 100) g.log.unshift(`Century! ${p.hs} in ${rec.fmt} vs ${rec.vs}.`);
  if (p.wk >= 5) g.log.unshift(`Five-wicket haul: ${p.wk} vs ${rec.vs}.`);
  if (g.log.length > 40) g.log.length = 40;
  return g;
}

/** After a played knock replaces the sim's batting numbers, correct the totals by the difference. */
export function adjustKnock(g, rec, runs, balls, out) {
  const o = rec.perf;
  const dRuns = runs - o.runs, dBalls = balls - o.balls;
  for (const s of [g.stats, g.tierStats[rec.tier]]) {
    s.runs += dRuns; s.balls += dBalls;
    if (!o.inn) s.inn++;
    if (runs > s.hs) s.hs = runs;
    if (runs >= 100 && o.hs < 100) s.h++;
    if (!out && o.out) s.no++;
  }
  o.runs = runs; o.balls = balls; o.hs = Math.max(o.hs, runs); o.inn = Math.max(o.inn, 1); o.out = out ? 1 : 0;
  const old = rec.rating;
  rec.rating = rate(o, rec.fmt);
  const dx = Math.round((rec.rating - old) * 6 + dRuns * 0.5);
  rec.xp += dx; g.xp += dx;
  while (g.xp >= 130) { g.xp -= 130; g.points++; }
  if (g.xp < 0) g.xp = 0;
  g.ratings[g.ratings.length - 1] = rec.rating;
  return g;
}

export const upgradeCost = (cur) => 1 + Math.floor(Math.max(0, cur - 55) / 10);

export function upgrade(g, attr, n = 1) {
  if (!['bat', 'bowl'].includes(attr)) throw new Error('Unknown attribute');
  if (g.points < 1) throw new Error('No attribute points to spend');
  n = clamp(Math.floor(+n) || 1, 1, 20);
  let done = 0;
  while (done < n) {
    const cost = upgradeCost(g.player[attr]);
    if (g.points < cost || g.player[attr] >= 95) break;
    g.points -= cost; g.player[attr]++; done++;
  }
  if (!done) throw new Error('Not enough points for the next upgrade');
  g.player.ovr = ovrOf(g.player);
  return g;
}

export const seasonMatches = (g) => g.ratings.length;

/** Close the season: promotion check, ageing, new season. */
export function endSeason(g, rng) {
  const T = TIERS[g.tier];
  const rs = g.ratings;
  const avg = rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : 0;
  const msg = [];
  g.honours.unshift({ season: g.season, age: g.age, tier: T.name, avg: +avg.toFixed(2) });
  if (avg >= T.need && g.tier < TIERS.length - 1) {
    g.tier++;
    g.team = g.tier === 0 ? g.team : '';
    msg.push(`Promoted to ${TIERS[g.tier].name}! (season rating ${avg.toFixed(1)})`);
    g.points += 2;
  } else if (g.tier > 0 && avg < 4.8) {
    g.tier--;
    msg.push(`Dropped back to ${TIERS[g.tier].name} after a poor season (${avg.toFixed(1)}).`);
  } else msg.push(`Season rating ${avg.toFixed(1)}. ${g.tier < 3 ? `You need ${T.need} to move up.` : 'Keep your place in the national side.'}`);
  g.age++; g.season++; g.ratings = [];
  const p = g.player;
  if (g.age <= 24) { p.bat = clamp(p.bat + (rng() < 0.6 ? 1 : 0), 10, 99); p.bowl = clamp(p.bowl + (rng() < 0.6 ? 1 : 0), 10, 99); }
  if (g.age >= 34) { p.bat = clamp(p.bat - (rng() < 0.7 ? 1 : 0), 10, 99); p.bowl = clamp(p.bowl - (rng() < 0.7 ? 1 : 0), 10, 99); msg.push('Age is starting to tell on your skills.'); }
  p.ovr = ovrOf(p);
  if (g.age >= 40) { g.retired = true; msg.push('You retire at 40. What a career.'); }
  g.log.unshift(...msg.reverse());
  if (g.log.length > 40) g.log.length = 40;
  return g;
}

export function retire(g) { g.retired = true; g.log.unshift(`${g.player.name} retires at ${g.age}.`); return g; }

export const careerSummary = (g) => ({
  name: g.player.name, age: g.age, season: g.season, tier: TIERS[g.tier].name, ovr: g.player.ovr, matches: g.stats.m,
  runs: g.stats.runs, wkts: g.stats.w, caps: g.caps, retired: g.retired,
});

export const venueName = (id) => (VENUE_BY_ID[id] ? VENUE_BY_ID[id].name : id);
