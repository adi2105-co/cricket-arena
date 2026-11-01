// End-to-end API test. Uses DATABASE_URL if set, else in-memory.
import { createServer } from 'node:http';
import { makeStore } from '../store.js';
import { createApp } from '../app.js';
const store = makeStore();
const srv = createServer(createApp(store, { secret: 'test' }));
await new Promise((r) => srv.listen(0, r));
const base = `http://localhost:${srv.address().port}/api`;
let token = '';
const call = async (method, path, body) => {
  const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json(); return { s: r.status, j };
};
const ok = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok  ', m); };
const uname = 'tester' + Math.floor(Math.random() * 1e6);
let r = await call('POST', '/auth/register', { username: uname, password: 'secret1' }); ok(r.s === 201, 'register'); token = r.j.token;
r = await call('POST', '/auth/register', { username: uname, password: 'secret1' }); ok(r.s === 409, 'duplicate rejected');
r = await call('POST', '/auth/login', { username: uname, password: 'bad' }); ok(r.s === 401, 'bad login rejected');
r = await call('GET', '/me'); ok(r.j.user.username === uname, '/me');
r = await call('GET', '/meta'); ok(r.j.leagues.length === 12 && r.j.tournaments.length === 8, 'meta');

// league
r = await call('POST', '/games', { type: 'league', leagueId: 'ipl', team: 'mi' }); ok(r.s === 201, 'create league'); const lid = r.j.id;
r = await call('POST', `/games/${lid}/act`, { action: 'tick', n: 3 }); ok(r.s === 200 && r.j.state.auction.current, 'auction tick');
r = await call('POST', `/games/${lid}/act`, { action: 'bid' }); ok(r.s === 200 && r.j.state.auction.current.bidder === 'mi', 'user bid');
r = await call('POST', `/games/${lid}/act`, { action: 'auto' }); ok(r.j.state.auction.status === 'done', 'auction auto');
const sq = r.j.state.auction.squads.mi.map((e) => e.pid); ok(sq.length >= 11, 'user squad ' + sq.length);
r = await call('POST', `/games/${lid}/act`, { action: 'start_season' }); ok(r.s === 200 && r.j.state.tour, 'start season');
r = await call('POST', `/games/${lid}/act`, { action: 'sim_to_user' }); ok(r.s === 200, 'sim to user');
r = await call('POST', `/games/${lid}/act`, { action: 'play_start' }); ok(r.s === 200 && r.j.play, 'play_start');
const play = r.j.play;
// fabricate a plausible innings
const target = play.target;
const bat = []; let runs = 0, left = play.maxBalls;
for (const id of play.xi) { if (left <= 0) break; const b = Math.min(left, 12), rr = Math.min(b * 2, 24); bat.push({ id, r: rr, b, f: 1, s: 1, o: 'b X' }); runs += rr; left -= b; }
r = await call('POST', `/games/${lid}/act`, { action: 'play_finish', report: { bat: play.xi.map((id) => ({ id, r: 8, b: 6, f: 1, s: 0, o: 'c Y b Z' })).slice(0, 10).concat([{ id: play.xi[10], r: 2, b: 2, f: 0, s: 0, o: null }]), ex: 4, balls: 70 } });
console.log('   play_finish ->', r.s, r.j.error || r.j.fixture);
r = await call('POST', `/games/${lid}/act`, { action: 'sim_all' }); ok(r.j.state.tour.done, 'season complete, champion ' + r.j.state.tour.champion);
const fxid = r.j.state.tour.fixtures[0].id;
r = await call('GET', `/games/${lid}/match/${fxid}`); ok(r.s === 200 && r.j.fixture.res.inns[0].bat, 'match detail');
r = await call('GET', '/games'); ok(r.j.games.length === 1 && r.j.games[0].summary.label, 'list games');
r = await call('GET', `/games/${lid}`); ok(r.s === 200 && r.j.state.players, 'reload league (resume)');

// tournament / series / custom
r = await call('POST', '/games', { type: 'tournament', templateId: 't20wc', team: 'IND' }); const tid = r.j.id; ok(r.s === 201, 'create t20wc');
r = await call('POST', `/games/${tid}/act`, { action: 'play_next' }); ok(r.s === 200, 'play_next');
r = await call('POST', `/games/${tid}/act`, { action: 'sim_all' }); ok(r.j.state.tour.done, 'wc done ' + r.j.state.tour.champion);
r = await call('POST', '/games', { type: 'series', a: 'AUS', b: 'ENG', fmt: 'TEST', games: 5, team: 'AUS' }); ok(r.s === 201, 'create ashes-style series');
r = await call('POST', `/games/${r.j.id}/act`, { action: 'sim_all' }); ok(r.j.state.tour.done, 'series done: ' + r.j.state.tour.seriesResult);
r = await call('POST', '/games', { type: 'custom', teams: ['IND', 'AUS', 'ENG', 'NZ'], fmt: 'ODI', structure: 'knockout', team: 'NZ' }); ok(r.s === 201, 'custom cup');
r = await call('POST', '/games', { type: 'custom', teams: ['IND', 'AUS', 'ENG'], fmt: 'ODI', structure: 'knockout', team: 'IND' }); ok(r.s === 400, 'bad custom rejected: ' + r.j.error);

// career
r = await call('POST', '/games', { type: 'career', name: 'Aditya Singh', country: 'IND', preset: 'opener', alloc: { bat: 8, bowl: 6 } }); ok(r.s === 201, 'create career'); const cid = r.j.id;
r = await call('POST', `/games/${cid}/act`, { action: 'play_next' }); ok(r.s === 200 && r.j.state.matches.length === 1, 'career match');
const mn = r.j.state.matches[0].n;
r = await call('POST', `/games/${cid}/act`, { action: 'knock', match: mn, runs: 77, balls: 40, out: true }); ok(r.s === 200, 'knock applied');
for (let i = 0; i < 9; i++) r = await call('POST', `/games/${cid}/act`, { action: 'play_next' });
r = await call('POST', `/games/${cid}/act`, { action: 'end_season' }); ok(r.s === 200 && r.j.state.season === 2, 'end season');

// scores
r = await call('POST', '/scores', { mode: 'net', score: 120, meta: { balls: 30 } }); ok(r.s === 201, 'score saved');
r = await call('POST', '/scores', { mode: 'net', score: 99999 }); ok(r.s === 400, 'bad score rejected');
r = await call('GET', '/leaderboard?mode=net'); ok(r.j.rows.length >= 1 && r.j.rows[0].username === uname, 'leaderboard');
r = await call('DELETE', `/games/${cid}`); ok(r.s === 200, 'delete');
token = ''; r = await call('GET', '/games'); ok(r.s === 401, 'auth required');
srv.close(); process.exit(process.exitCode || 0);
