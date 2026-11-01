// HTTP API (no framework). Export: createApp(store, opts) -> (req, res) handler.
import { LEAGUES, getLeague } from './data/leagues.js';
import { TEMPLATES } from './data/tournaments.js';
import { NATIONS, WOMEN_NATIONS, TEST_NATIONS } from './data/nations.js';
import { VENUES, VENUE_BY_ID } from './data/venues.js';
import { STRUCTURES, FORMAT_LABEL } from './data/tournaments.js';
import { getPlayer } from './data/players.js';
import { hashPassword, verifyPassword, signToken, verifyToken } from './auth.js';
import { mulberry32, hashStr, uid } from './util.js';
import * as A from './engine/auction.js';
import * as T from './engine/tournament.js';
import * as C from './engine/career.js';
import * as P from './engine/play.js';
import { newLeagueGame, startLeagueSeason, newTournamentGame, templateFromRequest, envFor, setXI, refPlayers, squadIdsOf, pubPlayer } from './engine/games.js';

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const bad = (msg) => new HttpError(400, msg);

const META = (() => {
  const strip = (l) => ({
    id: l.id, name: l.name, short: l.short, women: !!l.women, cur: l.cur, unit: l.unit, fmt: l.fmt, purse: l.purse, squad: l.squad, maxOS: l.maxOS,
    maxPrice: l.maxPrice, inc: l.inc, reserve: l.reserve, accent: l.accent, loc: l.loc, legs: l.legs, playoff: l.playoff, teams: l.teams,
  });
  return {
    leagues: LEAGUES.map(strip),
    tournaments: TEMPLATES.map((t) => ({ id: t.id, name: t.name, short: t.short, fmt: t.fmt, women: !!t.women, teams: t.teams, icon: t.icon, blurb: t.blurb, stages: t.stages.map((s) => s.name) })),
    nations: NATIONS, womenNations: WOMEN_NATIONS, testNations: TEST_NATIONS, structures: STRUCTURES, formats: FORMAT_LABEL,
    venues: VENUES, tiers: C.TIERS, presets: C.PRESETS,
  };
})();

// ---------------------------------------------------------------------------- views
function liteFixture(fx) {
  if (!fx.res) return fx;
  const r = fx.res;
  return { ...fx, res: { fmt: r.fmt, winner: r.winner, tie: r.tie, draw: r.draw, text: r.text, potm: r.potm, toss: r.toss, a: r.a, b: r.b, first: r.first, played3d: r.played3d, inns: r.inns.map((i) => ({ t: i.t, r: i.r, w: i.w, b: i.b, dec: i.dec, n: i.n })), detail: 1 } };
}
function liteTour(t) {
  const rows = {};
  for (const gid of Object.keys(t.tables)) rows[gid] = T.sortRows(t, gid, t.str);
  const nf = T.nextFixture(t), nu = T.nextUserFixture(t);
  return { ...t, fixtures: t.fixtures.map(liteFixture), rows, leaders: T.leaders(t, 8), next: nf ? nf.id : null, nextUser: nu ? nu.id : null, progress: T.progressInfo(t) };
}

function view(g) {
  if (g.kind === 'career') return { ...g, matches: g.matches.map(({ ent, ...m }) => ({ ...m, ent })), upgradeCost: { bat: C.upgradeCost(g.player.bat), bowl: C.upgradeCost(g.player.bowl) } };
  const out = { ...g, tour: g.tour ? liteTour(g.tour) : null, players: refPlayers(g) };
  if (g.kind === 'league' && g.auction) { out.auction = { ...g.auction }; }
  return out;
}

function summarize(g) {
  if (g.kind === 'career') return { label: `${g.player.name} · age ${g.age}`, sub: `${C.TIERS[g.tier].name} · season ${g.season}`, progress: g.retired ? 'Retired' : `${g.ratings.length}/${C.TIERS[g.tier].matches} matches` };
  const t = g.tour;
  if (g.kind === 'league') {
    const L = getLeague(g.leagueId), tm = L.teams.find((x) => x.id === g.userTeam);
    if (!t) return { label: `${L.short} · ${tm.name}`, sub: 'Auction', progress: `${g.auction.idx}/${g.auction.queue.length} lots`, accent: L.accent };
    const pi = T.progressInfo(t);
    return { label: `${L.short} · ${tm.name}`, sub: t.done ? (t.champion === g.userTeam ? 'Champions!' : `Champion: ${t.champion}`) : pi.stage, progress: `${pi.played}/${pi.total} matches`, accent: L.accent };
  }
  const pi = T.progressInfo(t);
  return { label: `${t.name} · ${g.userTeam}`, sub: t.done ? (t.champion === g.userTeam ? 'Champions!' : `Winner: ${t.champion}`) : pi.stage, progress: `${pi.played}/${pi.total} matches` };
}
const titleOf = (g) => summarize(g).label;
const statusOf = (g) => (g.kind === 'career' ? (g.retired ? 'done' : 'active') : g.tour && g.tour.done ? 'done' : 'active');

// ---------------------------------------------------------------------------- game creation
function createGame(b) {
  const rng = mulberry32(hashStr(uid()));
  if (b.type === 'league') {
    const L = getLeague(b.leagueId);
    if (!L) throw bad('Unknown league');
    if (!L.teams.some((t) => t.id === b.team)) throw bad('Pick a franchise');
    return newLeagueGame(L.id, b.team, rng);
  }
  if (b.type === 'career') {
    const g = C.createCareer({ ...b, seed: hashStr(uid()) });
    return g;
  }
  const tpl = templateFromRequest(b);
  validateTemplate(tpl, b);
  return newTournamentGame(tpl, b.team);
}

function validateTemplate(tpl, b) {
  const pool = tpl.women ? WOMEN_NATIONS : tpl.fmt === 'TEST' ? TEST_NATIONS : NATIONS.map((n) => n.c);
  if (b.type === 'tournament') return;
  if (!['T20', 'ODI', 'TEST'].includes(tpl.fmt)) throw bad('Pick T20, ODI or Test');
  if (b.type === 'series' && tpl.fmt === 'TEST' && ![3, 5, 1].includes(+b.games)) throw bad('Bad series length');
  if (new Set(tpl.teams).size !== tpl.teams.length) throw bad('Teams must be different');
  for (const c of tpl.teams) if (!pool.includes(c)) throw bad(`${c} cannot play ${tpl.women ? "women's " : ''}${tpl.fmt} here`);
  if (b.type === 'custom') {
    const s = STRUCTURES.find((x) => x.id === b.structure);
    if (!s) throw bad('Pick a format');
    const n = tpl.teams.length;
    if (n < s.min || n > s.max || (s.only && !s.only.includes(n))) throw bad(`${s.name}: ${s.only ? 'use ' + s.only.join(', ') : s.min + ' to ' + s.max} teams`);
    if (tpl.fmt === 'TEST' && n > 6) throw bad('Test competitions are limited to 6 teams');
  }
  if (!tpl.teams.includes(b.team)) throw bad('Choose your team from the competition');
}

// ---------------------------------------------------------------------------- actions
function tourEnv(g, rng) { return envFor(g, rng); }
const needTour = (g) => { if (!g.tour) throw bad('The season has not started yet'); return g.tour; };

function act(g, body, rng) {
  const a = body.action;
  const out = {};
  if (g.kind === 'career') return careerAct(g, body, rng, out);

  // ---- auction (league games)
  if (g.kind === 'league' && !g.tour) {
    const s = g.auction;
    switch (a) {
      case 'tick': { const n = Math.min(+body.n || 1, 40); for (let i = 0; i < n && s.status !== 'done'; i++) A.advance(s, rng); return out; }
      case 'bid': A.userBid(s); return out;
      case 'skip': A.userSkip(s, rng); return out;
      case 'ff': A.ffStar(s, rng); return out;
      case 'auto': A.simAll(s, rng); return out;
      case 'start_season': startLeagueSeason(g); return out;
      case 'xi': setXI(g, body.ids); return out; // allowed once squad exists
      default: throw bad('Not available during the auction');
    }
  }
  if (g.kind === 'league' && a === 'start_season') throw bad('Season already started');

  const t = needTour(g);
  const env = tourEnv(g, rng);
  switch (a) {
    case 'xi': setXI(g, body.ids); return out;
    case 'play_next': {
      if (T.nextUserFixture(t)) {
        const fx = T.nextUserFixture(t);
        needXI(g, fx);
      }
      const fx = T.playNext(t, env);
      out.fixture = fx.id; return out;
    }
    case 'sim_to_user': T.simToUser(t, env); return out;
    case 'sim_stage': { const si = t.si; T.simStage(t, env); out.stageDone = si; return out; }
    case 'sim_all': T.simAll(t, env); return out;
    case 'play_start': {
      const fx = T.nextUserFixture(t);
      if (!fx) throw bad('Your next match is not up yet: sim to your match first');
      if (g.play) throw bad('A match is already in progress');
      needXI(g, fx);
      g.play = P.startPlay(t, fx, env, rng, typeof body.bat === 'boolean' ? body.bat : undefined);
      out.play = g.play; return out;
    }
    case 'play_cancel': g.play = null; return out;
    case 'play_finish': {
      if (!g.play) throw bad('No match in progress');
      const { res, fx } = P.finishPlay(t, g.play, body.report || {}, env, rng);
      T.recordResult(t, fx, res, true);
      g.play = null; out.fixture = fx.id; return out;
    }
    default: throw bad('Unknown action');
  }
}

function needXI(g, fx) {
  const ids = squadIdsOf(g, g.userTeam);
  const xi = g.xi[g.userTeam];
  if (xi) { for (const id of xi) if (!ids.includes(id)) { delete g.xi[g.userTeam]; break; } }
}

function careerAct(g, body, rng, out) {
  C.registerCareer(g);
  switch (body.action) {
    case 'play_next': {
      if (g.retired) throw bad('Your career is over');
      const T_ = C.TIERS[g.tier];
      if (g.ratings.length >= T_.matches) throw bad('Season complete: start the next season');
      if (g.pending) throw bad('Finish or skip your pending innings first');
      const { rec } = C.playNext(g, rng);
      C.applyMatch(g, rec);
      out.match = rec.n; return out;
    }
    case 'knock': {
      // The client replaced the auto-simulated batting with an innings played in 3D.
      const m = g.matches[0];
      if (!m || m.n !== body.match) throw bad('That match can no longer be changed');
      if (m.knocked) throw bad('Already played');
      const runs = Math.max(0, Math.min(500, body.runs | 0)), balls = Math.max(0, Math.min(600, body.balls | 0));
      if (runs > balls * 6) throw bad('Impossible score');
      C.adjustKnock(g, m, runs, balls, !!body.out);
      m.knocked = 1; return out;
    }
    case 'upgrade': C.upgrade(g, body.attr, body.n); return out;
    case 'end_season': {
      if (g.retired) throw bad('Your career is over');
      if (g.ratings.length < C.TIERS[g.tier].matches) throw bad(`Play all ${C.TIERS[g.tier].matches} matches first`);
      C.endSeason(g, rng); return out;
    }
    case 'retire': C.retire(g); return out;
    default: throw bad('Unknown action');
  }
}

// ---------------------------------------------------------------------------- http
const MAX_BODY = 2_000_000;
function readBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body !== undefined && req.body !== null) { // Vercel pre-parses
      if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return resolve(req.body);
      try { return resolve(JSON.parse(Buffer.isBuffer(req.body) ? req.body.toString() : req.body || '{}')); } catch { return reject(bad('Invalid JSON')); }
    }
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > MAX_BODY) { reject(new HttpError(413, 'Request too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { if (!chunks.length) return resolve({}); try { resolve(JSON.parse(Buffer.concat(chunks).toString())); } catch { reject(bad('Invalid JSON')); } });
    req.on('error', reject);
  });
}
const send = (res, status, data) => {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-length': Buffer.byteLength(body) });
  res.end(body);
};

const SCORE_LIMITS = { net: 600, chase: 400, bowl: 300, knock: 400 };

export function createApp(store, opts = {}) {
  const secret = opts.secret || process.env.JWT_SECRET || 'dev-secret-change-me';
  if (!process.env.JWT_SECRET && !opts.secret && process.env.NODE_ENV === 'production') console.warn('[auth] JWT_SECRET is not set: set it in your environment.');
  const throttle = new Map();
  const tooMany = (key) => {
    const now = Date.now(), e = throttle.get(key) || { n: 0, at: now };
    if (now - e.at > 60_000) { e.n = 0; e.at = now; }
    e.n++; throttle.set(key, e);
    if (throttle.size > 5000) throttle.clear();
    return e.n > 25;
  };
  const cleanName = (s) => String(s || '').trim();

  async function auth(req) {
    const h = req.headers.authorization || '';
    const p = verifyToken(h.startsWith('Bearer ') ? h.slice(7) : '', secret);
    if (!p) throw new HttpError(401, 'Please sign in');
    return p.uid;
  }

  async function loadGame(uidv, id) {
    const row = await store.getGame(uidv, id);
    if (!row) throw new HttpError(404, 'Game not found');
    return row;
  }

  async function route(req, res, url) {
    const m = req.method, path = url.pathname.replace(/^\/api/, '').replace(/\/+$/, '') || '/';
    if (m === 'GET' && path === '/health') { await store.init(); return send(res, 200, { ok: true, store: store.name }); }
    await store.init();
    if (m === 'GET' && path === '/meta') return send(res, 200, META);

    if (m === 'POST' && (path === '/auth/register' || path === '/auth/login')) {
      const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'x';
      if (tooMany(`${ip}:${path}`)) throw new HttpError(429, 'Too many attempts, wait a minute');
      const b = await readBody(req);
      const username = cleanName(b.username), password = String(b.password || '');
      if (path === '/auth/register') {
        if (!/^[A-Za-z0-9_.-]{3,20}$/.test(username)) throw bad('Username: 3-20 letters, numbers, _ . -');
        if (password.length < 6 || password.length > 100) throw bad('Password must be at least 6 characters');
        let u;
        try { u = await store.createUser(username, await hashPassword(password)); }
        catch (e) { if (e.code === '23505') throw new HttpError(409, 'That username is taken'); throw e; }
        return send(res, 201, { token: signToken({ uid: u.id }, secret), user: { id: u.id, username: u.username } });
      }
      const u = await store.findUser(username);
      if (!u || !(await verifyPassword(password, u.pass_hash))) throw new HttpError(401, 'Wrong username or password');
      return send(res, 200, { token: signToken({ uid: u.id }, secret), user: { id: u.id, username: u.username } });
    }

    if (m === 'GET' && path === '/leaderboard') {
      const mode = url.searchParams.get('mode') || 'net';
      if (!SCORE_LIMITS[mode]) throw bad('Unknown mode');
      return send(res, 200, { mode, rows: await store.leaderboard(mode, 25) });
    }

    const uidv = await auth(req);

    if (m === 'GET' && path === '/me') {
      const u = await store.userById(uidv);
      if (!u) throw new HttpError(401, 'Please sign in');
      return send(res, 200, { user: { id: u.id, username: u.username } });
    }
    if (m === 'POST' && path === '/scores') {
      const b = await readBody(req);
      const max = SCORE_LIMITS[b.mode];
      if (!max) throw bad('Unknown mode');
      const score = Math.round(+b.score);
      if (!Number.isFinite(score) || score < 0 || score > max) throw bad('Invalid score');
      await store.addScore(uidv, b.mode, score, typeof b.meta === 'object' && b.meta ? JSON.parse(JSON.stringify(b.meta).slice(0, 500)) : {});
      return send(res, 201, { ok: true });
    }

    if (m === 'GET' && path === '/games') return send(res, 200, { games: await store.listGames(uidv) });
    if (m === 'POST' && path === '/games') {
      const b = await readBody(req);
      const g = createGame(b);
      const id = await store.createGame(uidv, { kind: g.kind, title: titleOf(g), status: statusOf(g), summary: summarize(g), state: g });
      return send(res, 201, { id });
    }

    const gm = path.match(/^\/games\/([^/]+)(?:\/(act|match\/([^/]+)))?$/);
    if (gm) {
      const [, id, sub, fxid] = gm;
      if (!sub && m === 'GET') {
        const row = await loadGame(uidv, id);
        const g = row.state;
        if (g.kind === 'career') C.registerCareer(g);
        return send(res, 200, { id: row.id, kind: g.kind, title: row.title, status: row.status, updated_at: row.updated_at, state: view(g) });
      }
      if (!sub && m === 'DELETE') {
        if (!(await store.deleteGame(uidv, id))) throw new HttpError(404, 'Game not found');
        return send(res, 200, { ok: true });
      }
      if (sub && sub.startsWith('match/') && m === 'GET') {
        const row = await loadGame(uidv, id);
        const fx = row.state.tour && row.state.tour.fixtures.find((f) => f.id === fxid);
        if (fx && fx.res) return send(res, 200, { fixture: fx, players: refPlayers(row.state) });
        const cm = row.state.kind === 'career' && row.state.matches.find((x) => String(x.n) === fxid);
        if (cm) return send(res, 200, { career: cm });
        throw new HttpError(404, 'Match not found');
      }
      if (sub === 'act' && m === 'POST') {
        const row = await loadGame(uidv, id);
        const body = await readBody(req);
        const g = row.state;
        const rng = mulberry32(hashStr(uid()));
        const out = act(g, body, rng) || {};
        const ok = await store.saveGame(uidv, id, { title: titleOf(g), status: statusOf(g), summary: summarize(g), state: g });
        if (!ok) throw new HttpError(404, 'Game not found');
        return send(res, 200, { ...out, state: view(g) });
      }
    }
    throw new HttpError(404, 'Not found');
  }

  return async function handler(req, res) {
    try {
      const url = new URL(req.url, 'http://x');
      res.setHeader('x-content-type-options', 'nosniff');
      if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS', 'access-control-allow-headers': 'content-type,authorization' }); return res.end(); }
      await route(req, res, url);
    } catch (e) {
      const status = e.status || (e.message && !/^(connect|ECONN|timeout|password|relation|getaddrinfo)/i.test(e.message) && e.name === 'Error' ? 400 : 500);
      if (status >= 500) console.error('[api]', e);
      if (!res.headersSent) send(res, status, { error: status >= 500 ? 'Server error: ' + (e.message || 'unknown') : e.message });
    }
  };
}
