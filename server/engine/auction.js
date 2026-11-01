// Franchise auction engine. State is plain JSON (stored in Postgres JSONB).
// Prices are integers in the league's smallest unit (lakh for INR leagues, thousand otherwise).
import { getLeague, leaguePool, isOverseas } from '../data/leagues.js';
import { getPlayer } from '../data/players.js';
import { shuffle } from '../util.js';

const Lg = (s) => { const L = getLeague(s.leagueId); if (!L) throw new Error('Unknown league'); return L; };

export const baseFor = (p, L) => L.baseTiers.find(([min]) => p.ovr + L.ovrShift >= min)[1];
export function fairValue(p, L) {
  const raw = 20 * Math.pow(1.12, p.ovr + L.ovrShift - 50) * L.scale;
  return Math.min(L.maxPrice, Math.max(Math.round(raw / L.step) * L.step, baseFor(p, L)));
}
export const increment = (bid, L) => L.inc.find(([upTo]) => bid < upTo)[1];
export const nextBid = (c, L) => (c.bidder === null ? c.bid : c.bid + increment(c.bid, L));

export function createAuction(leagueId, userTeam, rng = Math.random) {
  const L = getLeague(leagueId);
  if (!L) throw new Error('Unknown league');
  if (!L.teams.some((t) => t.id === userTeam)) throw new Error('Unknown team');
  const sorted = leaguePool(L).map(getPlayer).sort((a, b) => b.ovr - a.ovr);
  const queue = [];
  for (let i = 0; i < sorted.length; i += 10) queue.push(...shuffle(rng, sorted.slice(i, i + 10)).map((p) => p.id));
  const purse = {}, squads = {}, aggr = {};
  for (const t of L.teams) { purse[t.id] = L.purse; squads[t.id] = []; aggr[t.id] = +(0.85 + rng() * 0.5).toFixed(3); }
  return { leagueId, userTeam, purse, squads, aggr, queue, idx: 0, current: null, last: null, sold: [], unsold: [], log: [], status: 'live' };
}

const nameOf = (L, id) => L.teams.find((t) => t.id === id).name;
const osCount = (s, L, team) => s.squads[team].filter((e) => isOverseas(L, getPlayer(e.pid))).length;
const full = (s, L) => L.teams.every((t) => s.squads[t.id].length >= L.squad);
const note = (s, msg) => { s.log.unshift(msg); if (s.log.length > 40) s.log.length = 40; };

function finalize(s, L) {
  // Teams below 11 sign the best remaining players at base price (or free if short of purse).
  const taken = new Set(s.sold.map((x) => x.pid));
  const left = s.queue.map(getPlayer).filter((p) => !taken.has(p.id)).sort((a, b) => b.ovr - a.ovr);
  for (const t of L.teams) {
    while (s.squads[t.id].length < 11 && left.length) {
      let i = left.findIndex((p) => !isOverseas(L, p) || osCount(s, L, t.id) < L.maxOS);
      if (i < 0) i = 0; // pool short of eligible players: relax the overseas cap rather than field fewer than 11
      const [p] = left.splice(i, 1);
      const base = baseFor(p, L);
      const price = s.purse[t.id] >= base ? base : 0;
      s.purse[t.id] -= price;
      s.squads[t.id].push({ pid: p.id, price });
      s.sold.push({ pid: p.id, team: t.id, price, late: true });
    }
  }
  s.status = 'done'; s.current = null;
}

function startNext(s, L) {
  if (s.idx >= s.queue.length || full(s, L)) return finalize(s, L);
  const pid = s.queue[s.idx++];
  s.current = { pid, bid: baseFor(getPlayer(pid), L), bidder: null, userOut: false };
}

const TARGET = { WK: 2, BAT: 4, AR: 3, BOWL: 5 };
function aiWants(s, L, team, p, amount, rng) {
  const squad = s.squads[team];
  const slotsLeft = L.squad - squad.length;
  if (slotsLeft <= 0) return false;
  if (s.purse[team] - amount < (slotsLeft - 1) * L.reserve) return false;
  if (isOverseas(L, p) && osCount(s, L, team) >= L.maxOS) return false;
  const has = (r) => squad.filter((e) => getPlayer(e.pid).role === r).length;
  const deficit = TARGET[p.role] - has(p.role);
  let need = deficit > 0 ? Math.min(1.3, 1 + 0.12 * deficit) : 0.55;
  if (p.role === 'WK' && has('WK') === 0 && slotsLeft <= 4) need = 1.7;
  if (amount > s.purse[team] * 0.45 && slotsLeft > 3) return false;
  return amount <= Math.min(fairValue(p, L) * s.aggr[team] * need, L.maxPrice) && rng() < 0.8;
}

function hammer(s, L) {
  const c = s.current, p = getPlayer(c.pid);
  if (c.bidder) {
    s.purse[c.bidder] -= c.bid;
    s.squads[c.bidder].push({ pid: c.pid, price: c.bid });
    s.sold.push({ pid: c.pid, team: c.bidder, price: c.bid });
    s.last = { type: 'sold', pid: c.pid, team: c.bidder, price: c.bid };
    note(s, `SOLD: ${p.name} to ${nameOf(L, c.bidder)}`);
  } else {
    s.unsold.push(c.pid);
    s.last = { type: 'unsold', pid: c.pid };
    note(s, `UNSOLD: ${p.name}`);
  }
  s.current = null;
  if (s.idx >= s.queue.length || full(s, L)) finalize(s, L);
}

/** One auction step: start a player, let franchises respond, or bring the hammer down. */
export function advance(s, rng = Math.random) {
  if (s.status === 'done') return s;
  const L = Lg(s);
  if (!s.current) { startNext(s, L); return s; }
  const c = s.current, p = getPlayer(c.pid), amount = nextBid(c, L);
  for (const t of shuffle(rng, L.teams.map((x) => x.id))) {
    if (t === c.bidder || t === s.userTeam) continue;
    if (aiWants(s, L, t, p, amount, rng)) {
      c.bid = amount; c.bidder = t;
      note(s, `${nameOf(L, t)} bid ${amount} for ${p.name}`);
      return s;
    }
  }
  hammer(s, L);
  return s;
}

export function userBid(s) {
  const L = Lg(s), c = s.current;
  if (s.status === 'done' || !c) throw new Error('No player on the block');
  if (c.bidder === s.userTeam) throw new Error('You already hold the top bid');
  const amount = nextBid(c, L), p = getPlayer(c.pid);
  const sq = s.squads[s.userTeam];
  if (sq.length >= L.squad) throw new Error('Your squad is full');
  const slotsLeft = L.squad - sq.length;
  if (s.purse[s.userTeam] - amount < (slotsLeft - 1) * L.reserve) throw new Error('Not enough purse: keep money for the rest of your squad');
  if (isOverseas(L, p) && osCount(s, L, s.userTeam) >= L.maxOS) throw new Error(`Overseas limit reached (${L.maxOS})`);
  c.bid = amount; c.bidder = s.userTeam; c.userOut = false;
  note(s, `You bid ${amount} for ${p.name}`);
  return s;
}

function resolveCurrent(s, rng) {
  for (let i = 0; i < 600 && s.current; i++) advance(s, rng);
}

export function userSkip(s, rng = Math.random) {
  if (!s.current) throw new Error('No player on the block');
  if (s.current.bidder === s.userTeam) throw new Error('You hold the top bid');
  s.current.userOut = true;
  resolveCurrent(s, rng);
  return s;
}

// Skip ahead until the next star player comes up (or the auction ends).
export function ffStar(s, rng = Math.random) {
  const L = Lg(s), thr = L.women ? 82 : 85;
  if (s.current && s.current.bidder !== s.userTeam) { s.current.userOut = true; resolveCurrent(s, rng); }
  else if (s.current) resolveCurrent(s, rng);
  for (let i = 0; i < 4000 && s.status !== 'done'; i++) {
    if (!s.current) startNext(s, L);
    if (s.status === 'done') break;
    if (getPlayer(s.current.pid).ovr >= thr) break;
    if (s.current.bidder !== s.userTeam) s.current.userOut = true;
    resolveCurrent(s, rng);
  }
  return s;
}

export function simAll(s, rng = Math.random) {
  for (let i = 0; i < 80000 && s.status !== 'done'; i++) {
    if (s.current && s.current.bidder !== s.userTeam) s.current.userOut = true;
    advance(s, rng);
  }
  return s;
}

export const spent = (s, team) => s.squads[team].reduce((a, e) => a + e.price, 0);
