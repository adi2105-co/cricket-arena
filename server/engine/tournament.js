// Multi-stage tournament engine: groups, knockouts, series and IPL-style playoffs.
// State is plain JSON so it can live in a Postgres JSONB column.
import { hashStr } from '../util.js';
import { playMatch } from './match.js';
import { FORMATS } from './formats.js';
import { VENUE_BY_ID } from '../data/venues.js';

const bracketOrder = (n) => {
  if (n === 1) return [0];
  const prev = bracketOrder(n / 2);
  return prev.flatMap((x) => [x, n - 1 - x]);
};
const roundName = (n) => (n === 2 ? 'Final' : n === 4 ? 'Semi-final' : n === 8 ? 'Quarter-final' : `Round of ${n}`);
const row = () => ({ p: 0, w: 0, l: 0, nr: 0, pts: 0, rf: 0, bf: 0, ra: 0, bb: 0, nrr: 0 });

export function createTournament(o) {
  const t = {
    id: o.id, name: o.name, fmt: o.fmt, women: !!o.women, userTeam: o.userTeam || null,
    homeVenues: !!o.homeVenues, venues: o.venues || [], teams: o.teams, stages: o.stages,
    str: o.strength || {}, si: 0, groups: [], fixtures: [], tables: {}, hist: [], qual: [], qinfo: {},
    stats: {}, champion: null, done: false, seq: 0, userOut: false, series: null, ko: null, log: [],
  };
  startStage(t, 0);
  return t;
}

const teamById = (t, id) => t.teams.find((x) => x.id === id);
const stageOf = (t) => t.stages[t.si];

function mkFixture(t, extra) {
  const id = `m${++t.seq}`;
  const a = teamById(t, extra.a);
  let venueId;
  if (t.homeVenues && a && a.venue) venueId = a.venue;
  else if (t.venues.length) venueId = t.venues[hashStr(`${t.id}:${id}`) % t.venues.length];
  else venueId = 'dubai';
  const h = hashStr(`${t.id}:n:${id}`) % 10;
  const night = t.fmt === 'TEST' ? false : t.fmt === 'ODI' ? h < 5 : h < 8;
  return { id, si: t.si, played: false, res: null, venue: venueId, night, ...extra };
}

function roundRobin(ids) {
  const a = [...ids];
  if (a.length % 2) a.push(null);
  const n = a.length, rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const m = [];
    for (let i = 0; i < n / 2; i++) {
      const x = a[i], y = a[n - 1 - i];
      if (x && y) m.push(r % 2 ? [y, x] : [x, y]);
    }
    rounds.push(m);
    a.splice(1, 0, a.pop());
  }
  return rounds;
}

function startStage(t, si) {
  t.si = si;
  const st = t.stages[si];
  if (!st) return finishTournament(t);
  t.groups = []; t.tables = {}; t.ko = null;
  if (st.k === 'groups') {
    let pool = si === 0 ? [...t.teams].map((x) => x.id).sort((a, b) => (t.str[b] || 0) - (t.str[a] || 0)) : [...t.qual];
    const g = st.groups;
    let buckets;
    if (st.regroup === 'super8') {
      buckets = Array.from({ length: g }, () => []);
      for (const id of pool) {
        const info = t.qinfo[id] || { g: 'A', pos: 1 };
        const gi = info.g.charCodeAt(0) - 65;
        buckets[(gi + info.pos - 1) % g].push(id);
      }
    } else if (st.regroup === 'merge') buckets = [pool];
    else {
      buckets = Array.from({ length: g }, () => []);
      pool.forEach((id, i) => {
        const row_ = Math.floor(i / g), col = i % g;
        buckets[row_ % 2 === 0 ? col : g - 1 - col].push(id);
      });
    }
    t.groups = buckets.map((ids, i) => ({ id: String.fromCharCode(65 + i), name: g === 1 || buckets.length === 1 ? st.name : `Group ${String.fromCharCode(65 + i)}`, teams: ids }));
    t.qinfo = {};
    const sched = t.groups.map((gr) => {
      const legs = st.legs || (t.teams.length <= 6 && st.groups === 1 && t.homeVenues ? 2 : 1);
      let rounds = roundRobin(gr.teams);
      if (legs === 2) rounds = [...rounds, ...rounds.map((r) => r.map(([x, y]) => [y, x]))];
      return rounds;
    });
    const maxR = Math.max(...sched.map((s) => s.length));
    for (let r = 0; r < maxR; r++) {
      t.groups.forEach((gr, gi) => {
        (sched[gi][r] || []).forEach(([a, b]) => t.fixtures.push(mkFixture(t, { g: gr.id, a, b, n: `${gr.name}`, rd: r + 1 })));
      });
    }
    for (const gr of t.groups) { t.tables[gr.id] = {}; gr.teams.forEach((id) => (t.tables[gr.id][id] = row())); }
  } else if (st.k === 'knockout') {
    let seeds = si === 0 ? [...t.teams].map((x) => x.id).sort((a, b) => (t.str[b] || 0) - (t.str[a] || 0)) : [...t.qual];
    seeds = seeds.slice(0, st.size);
    t.ko = { size: st.size, rd: 0, seeds, alive: null };
    const order = bracketOrder(st.size);
    const slots = order.map((s) => seeds[s]);
    t.ko.alive = slots;
    makeKoRound(t);
  } else if (st.k === 'series') {
    const [a, b] = t.teams.map((x) => x.id);
    for (let i = 0; i < st.games; i++) {
      const home = i % 2 === 0 ? a : b;
      t.fixtures.push(mkFixture(t, { a: home === a ? a : b, b: home === a ? b : a, n: `${t.fmt === 'TEST' ? 'Test' : t.fmt === 'ODI' ? 'ODI' : 'T20I'} ${i + 1}`, rd: i + 1, key: 'g' + (i + 1) }));
    }
    t.series = { a, b, wa: 0, wb: 0, d: 0 };
  } else if (st.k === 'playoffs') {
    const q = t.qual;
    t.ko = { n: st.n };
    if (st.n === 4) {
      t.fixtures.push(mkFixture(t, { a: q[0], b: q[1], n: 'Qualifier 1', key: 'q1' }), mkFixture(t, { a: q[2], b: q[3], n: 'Eliminator', key: 'el' }));
    } else t.fixtures.push(mkFixture(t, { a: q[1], b: q[2], n: 'Eliminator', key: 'el' }));
  }
}

function makeKoRound(t) {
  const alive = t.ko.alive;
  const n = alive.length;
  for (let i = 0; i < n; i += 2) {
    t.fixtures.push(mkFixture(t, { a: alive[i], b: alive[i + 1], n: n === 2 ? 'Final' : `${roundName(n)} ${i / 2 + 1}`, rd: t.ko.rd + 1, key: `k${t.ko.rd}-${i / 2}` }));
  }
}

const stageFixtures = (t) => t.fixtures.filter((f) => f.si === t.si);
export const nextFixture = (t) => (t.done ? null : stageFixtures(t).find((f) => !f.played) || null);
export const nextUserFixture = (t) => { const f = nextFixture(t); return f && (f.a === t.userTeam || f.b === t.userTeam) ? f : null; };

export function sortRows(t, gid, strength = {}) {
  return Object.entries(t.tables[gid] || {}).map(([id, r]) => ({ id, ...r }))
    .sort((x, y) => y.pts - x.pts || y.w - x.w || y.nrr - x.nrr || (strength[y.id] || 0) - (strength[x.id] || 0));
}

function updateTable(t, fx, res) {
  const T = t.tables[fx.g];
  if (!T) return;
  const f = FORMATS[t.fmt];
  const [i1, i2] = res.inns;
  if (f.limited) {
    const faced = (i) => (i.w === 10 ? f.balls : i.b);
    for (const [bat, bowl] of [[i1, i2], [i2, i1]]) {
      T[bat.t].rf += bat.r; T[bat.t].bf += faced(bat);
      T[bowl.t].ra += bat.r; T[bowl.t].bb += faced(bat);
    }
  }
  const ids = [fx.a, fx.b];
  for (const id of ids) T[id].p++;
  if (res.winner) {
    const loser = ids.find((x) => x !== res.winner);
    T[res.winner].w++; T[res.winner].pts += 2; T[loser].l++;
  } else for (const id of ids) { T[id].nr++; T[id].pts += 1; }
  if (f.limited) {
    for (const id of ids) {
      const x = T[id];
      x.nrr = +((x.bf ? x.rf / (x.bf / f.bpo) : 0) - (x.bb ? x.ra / (x.bb / f.bpo) : 0)).toFixed(3);
    }
  }
}

function updateStats(t, res) {
  const S = t.stats;
  const touch = (id, team) => (S[id] ||= { c: team, m: 0, r: 0, b: 0, f: 0, s: 0, hs: 0, w: 0, rg: 0, bb: 0, bw: [0, 0], i: 0, no: 0 });
  const seen = new Set();
  for (const inn of res.inns) {
    const bowlTeam = inn.t === res.a ? res.b : res.a;
    for (const x of inn.bat) {
      const s = touch(x.id, inn.t);
      if (!seen.has(x.id)) { s.m++; seen.add(x.id); }
      s.r += x.r; s.b += x.b; s.f += x.f; s.s += x.s; s.i++; if (!x.o) s.no++;
      if (x.r > s.hs) s.hs = x.r;
    }
    for (const x of inn.bowl) {
      const s = touch(x.id, bowlTeam);
      if (!seen.has(x.id)) { s.m++; seen.add(x.id); }
      s.w += x.w; s.rg += x.r; s.bb += x.b;
      if (x.w > s.bw[0] || (x.w === s.bw[0] && x.r < s.bw[1])) s.bw = [x.w, x.r];
    }
  }
}

export function leaders(t, n = 5) {
  const all = Object.entries(t.stats).map(([id, s]) => ({ id, ...s }));
  return {
    runs: [...all].sort((a, b) => b.r - a.r).slice(0, n),
    wickets: [...all].sort((a, b) => b.w - a.w || a.rg - b.rg).slice(0, n),
    sixes: [...all].sort((a, b) => b.s - a.s).slice(0, n),
  };
}

// ---- progress ----
function ensureProgress(t) {
  for (let guard = 0; guard < 20 && !t.done; guard++) {
    const st = stageOf(t);
    const fx = stageFixtures(t);
    if (fx.some((f) => !f.played)) return;
    if (st.k === 'groups') {
      const per = [];
      const info = {};
      t.groups.forEach((gr) => {
        const rows = sortRows(t, gr.id, t.str);
        per.push({ id: gr.id, name: gr.name, rows });
        rows.slice(0, st.adv).forEach((r, i) => { info[r.id] = { g: gr.id, pos: i + 1, row: r }; });
      });
      t.hist.push({ name: st.name, groups: per });
      const tops = Object.entries(info);
      const seed = [];
      for (let pos = 1; pos <= st.adv; pos++) {
        seed.push(...tops.filter(([, v]) => v.pos === pos).sort((a, b) => b[1].row.pts - a[1].row.pts || b[1].row.nrr - a[1].row.nrr).map(([id]) => id));
      }
      t.qual = seed;
      t.qinfo = Object.fromEntries(Object.entries(info).map(([id, v]) => [id, { g: v.g, pos: v.pos }]));
      if (t.userTeam && !t.qual.includes(t.userTeam) && si_isLast(t) === false) t.userOut = true;
      if (si_isLast(t)) { t.champion = t.qual[0]; return finishTournament(t); }
      startStage(t, t.si + 1);
    } else if (st.k === 'knockout') {
      const last = fx.filter((f) => f.rd === t.ko.rd + 1);
      if (!last.every((f) => f.played)) return;
      const winners = last.map((f) => f.res.winner);
      t.ko.rd++;
      if (winners.length === 1) {
        t.qual = [winners[0]];
        if (si_isLast(t)) { t.champion = winners[0]; return finishTournament(t); }
        startStage(t, t.si + 1);
      } else {
        t.ko.alive = winners;
        makeKoRound(t);
      }
      if (t.userTeam && !t.done && !t.ko.alive.includes(t.userTeam)) t.userOut = true;
    } else if (st.k === 'series') {
      const s = t.series;
      for (const f of fx) { if (f.res.winner === s.a) s.wa++; else if (f.res.winner === s.b) s.wb++; else s.d++; }
      t.champion = s.wa > s.wb ? s.a : s.wb > s.wa ? s.b : null;
      t.seriesResult = `${s.wa > s.wb ? teamById(t, s.a).name + ' won' : s.wb > s.wa ? teamById(t, s.b).name + ' won' : 'Series drawn'} ${Math.max(s.wa, s.wb)}-${Math.min(s.wa, s.wb)}${s.d ? ` (${s.d} drawn)` : ''}`;
      return finishTournament(t);
    } else if (st.k === 'playoffs') {
      const g = (k) => fx.find((f) => f.key === k);
      const W = (f) => f.res.winner, Lo = (f) => (f.a === f.res.winner ? f.b : f.a);
      const q = t.qual;
      if (st.n === 4) {
        if (g('q1')?.played && g('el')?.played && !g('q2')) t.fixtures.push(mkFixture(t, { a: Lo(g('q1')), b: W(g('el')), n: 'Qualifier 2', key: 'q2' }));
        else if (g('q2')?.played && !g('final')) t.fixtures.push(mkFixture(t, { a: W(g('q1')), b: W(g('q2')), n: 'Final', key: 'final' }));
        else if (g('final')?.played) { t.champion = W(g('final')); return finishTournament(t); }
        else return;
      } else if (g('el')?.played && !g('final')) t.fixtures.push(mkFixture(t, { a: q[0], b: W(g('el')), n: 'Final', key: 'final' }));
      else if (g('final')?.played) { t.champion = W(g('final')); return finishTournament(t); }
      else return;
      const alive = new Set(stageFixtures(t).filter((f) => !f.played).flatMap((f) => [f.a, f.b]));
      if (t.userTeam && !alive.has(t.userTeam)) t.userOut = true;
    }
  }
}
const si_isLast = (t) => t.si >= t.stages.length - 1;

function finishTournament(t) {
  t.done = true;
  if (t.userTeam && t.champion !== t.userTeam) t.userOut = t.userOut || !!t.champion;
}

export function recordResult(t, fx, res, keepComm) {
  if (!keepComm) res.inns.forEach((i) => delete i.comm);
  fx.res = res; fx.played = true;
  t.last = fx.id;
  updateStats(t, res);
  if (fx.g) updateTable(t, fx, res);
  ensureProgress(t);
  return fx;
}

export function playFixture(t, fx, env) {
  const fmt = t.fmt;
  const venue = VENUE_BY_ID[fx.venue] || { id: fx.venue, pitch: 'balanced', size: 'M' };
  const A = env.team(fx.a), B = env.team(fx.b);
  const mine = fx.a === t.userTeam || fx.b === t.userTeam;
  const res = playMatch(A, B, { fmt, venue, rng: env.rng, night: fx.night, keepComm: true });
  return recordResult(t, fx, res, mine);
}

export function playNext(t, env) {
  const fx = nextFixture(t);
  if (!fx) throw new Error('Nothing left to play');
  return playFixture(t, fx, env);
}
export function simToUser(t, env, max = 800) {
  for (let i = 0; i < max && !t.done; i++) {
    const fx = nextFixture(t);
    if (!fx || fx.a === t.userTeam || fx.b === t.userTeam) break;
    playFixture(t, fx, env);
  }
  return t;
}
export function simStage(t, env, max = 800) {
  const si = t.si;
  for (let i = 0; i < max && !t.done && t.si === si; i++) playNext(t, env);
  return t;
}
export function simAll(t, env, max = 2000) {
  for (let i = 0; i < max && !t.done; i++) playNext(t, env);
  return t;
}

export const progressInfo = (t) => {
  const fx = t.fixtures;
  return { played: fx.filter((f) => f.played).length, total: fx.length, stage: t.done ? 'Complete' : stageOf(t)?.name };
};
