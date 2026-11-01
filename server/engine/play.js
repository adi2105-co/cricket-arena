// "Play my innings": the client plays the user's batting in 3D, the server simulates the other side
// and records a normal match result. Limited-overs only.
import { FORMATS } from './formats.js';
import { Innings, finishLimited } from './match.js';
import { VENUE_BY_ID } from '../data/venues.js';
import { getPlayer } from '../data/players.js';

const venueOf = (id) => VENUE_BY_ID[id] || { id, pitch: 'balanced', size: 'M' };

function tossFor(fx, mineId, otherId, rng) {
  const mineWon = rng() < 0.5;
  const w = mineWon ? mineId : otherId;
  const bat = rng() < 0.35;
  return { w, d: bat ? 'bat' : 'bowl' };
}

/** Begin a playable innings for the user's next fixture. `env.team(id)` gives team objects. */
export function startPlay(tour, fx, env, rng, userBatsFirstChoice) {
  const f = FORMATS[tour.fmt];
  if (!f || !f.limited) throw new Error('3D play is available for T20, ODI and Hundred matches');
  const me = tour.userTeam, other = fx.a === me ? fx.b : fx.a;
  const A = env.team(fx.a), B = env.team(fx.b), mine = env.team(me), opp = env.team(other);
  const toss = tossFor(fx, me, other, rng);
  // The toss winner decides. If the user wins they choose (default: chase/bowl first in T20, bat in ODI).
  let userBatsFirst;
  if (toss.w === me) userBatsFirst = typeof userBatsFirstChoice === 'boolean' ? userBatsFirstChoice : toss.d === 'bat';
  else userBatsFirst = toss.d === 'bowl';
  toss.d = (toss.w === me ? userBatsFirst : !userBatsFirst) ? 'bat' : 'bowl';
  const play = {
    fx: fx.id, fmt: tour.fmt, venue: fx.venue, night: fx.night, toss, userBatsFirst,
    xi: mine.xi.map((p) => p.id), oppName: opp.name, oppXi: opp.xi.map((p) => p.id), target: null, firstInnings: null, maxBalls: f.balls, bpo: f.bpo,
  };
  if (!userBatsFirst) {
    const i1 = new Innings({ fmt: f, bat: opp, bowl: mine, rng, venue: venueOf(fx.venue) }).run();
    play.firstInnings = { ...i1.toJSON(false), n: 1 };
    play.target = i1.runs + 1;
  }
  return play;
}

function sanitizeBat(play, report) {
  const f = FORMATS[play.fmt];
  const xi = play.xi;
  const rows = Array.isArray(report.bat) ? report.bat : [];
  if (!rows.length || rows.length > 11) throw new Error('Invalid scorecard');
  const seen = new Set();
  let runs = 0, balls = 0, outs = 0;
  const bat = rows.map((x, i) => {
    if (!xi.includes(x.id) || seen.has(x.id)) throw new Error('Invalid batter in scorecard');
    seen.add(x.id);
    const r = Math.max(0, Math.min(400, x.r | 0)), b = Math.max(0, Math.min(f.balls, x.b | 0));
    const fo = Math.max(0, x.f | 0), s = Math.max(0, x.s | 0);
    if (r > b * 6 + (b === 0 ? 0 : 0) && b > 0) throw new Error('Impossible score');
    if (fo * 4 + s * 6 > r) throw new Error('Impossible boundaries');
    runs += r; balls += b;
    const o = x.o ? String(x.o).slice(0, 60) : null;
    if (o) outs++;
    return { id: x.id, r, b, f: fo, s, o };
  });
  const ex = Math.max(0, Math.min(40, report.ex | 0));
  const total = runs + ex;
  const faced = Math.min(f.balls, Math.max(balls, report.balls | 0));
  if (outs > 10) throw new Error('Too many wickets');
  const allOut = outs >= 10;
  const chased = play.target != null && total >= play.target;
  if (!allOut && !chased && faced < f.balls) throw new Error('The innings is not finished');
  if (total > faced * 6 + ex + 6) throw new Error('Impossible total');
  const unused = xi.filter((id) => !seen.has(id));
  return { json: { t: play.userTeamId, r: total, w: outs, b: faced, ex, bat, dnb: unused, bowl: [], fow: [] }, runs: total, wkts: outs, balls: faced };
}

/** Finish a played innings and return the full match result (same shape as an auto-sim). */
export function finishPlay(tour, play, report, env, rng) {
  const f = FORMATS[play.fmt];
  const me = tour.userTeam, other = play.userBatsFirst ? null : null;
  const mine = env.team(me);
  const oppId = tour.fixtures.find((x) => x.id === play.fx);
  const fx = oppId;
  const otherId = fx.a === me ? fx.b : fx.a;
  const opp = env.team(otherId);
  play.userTeamId = me;
  const u = sanitizeBat(play, report);
  const userInn = { runs: u.runs, wkts: u.wkts, balls: u.balls, toJSON: () => u.json };
  const venue = venueOf(play.venue);
  const o = { fmt: play.fmt, venue, rng, night: play.night, keepComm: false };
  let i1, i2, first, second;
  if (play.userBatsFirst) {
    // simulate the chase against the player's score
    const chase = new Innings({ fmt: f, bat: opp, bowl: mine, rng, venue, target: u.runs + 1 }).run();
    first = mine; second = opp; i1 = userInn; i2 = chase;
  } else {
    const was = play.firstInnings;
    i1 = { runs: was.r, wkts: was.w, balls: was.b, toJSON: () => was };
    first = opp; second = mine; i2 = userInn;
  }
  const a = env.team(fx.a), b = env.team(fx.b);
  const res = finishLimited(a, b, f, o, play.toss, first, second, i1, i2, rng);
  res.played3d = 1;
  // opposition bowling figures are not tracked for a played innings; credit the runs to their attack in the card
  return { res, fx };
}

export const playerName = (id) => (getPlayer(id) ? getPlayer(id).name : id);
