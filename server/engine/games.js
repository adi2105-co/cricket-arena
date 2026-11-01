// Game factories and environment glue (squads -> team objects) for league and tournament games.
import { getLeague } from '../data/leagues.js';
import { NATION_BY_CODE } from '../data/nations.js';
import { TEMPLATE_BY_ID, seriesTemplate, customTemplate } from '../data/tournaments.js';
import { getPlayer, nationSquad, teamStrength } from '../data/players.js';
import { createAuction } from './auction.js';
import { createTournament } from './tournament.js';
import { makeTeam, validateXI } from './xi.js';

export function newLeagueGame(leagueId, teamId, rng) {
  return { kind: 'league', leagueId, userTeam: teamId, auction: createAuction(leagueId, teamId, rng), tour: null, xi: {} };
}

export function startLeagueSeason(g) {
  const L = getLeague(g.leagueId);
  if (g.auction.status !== 'done') throw new Error('Finish the auction first');
  if (g.tour) throw new Error('Season already started');
  const strength = {};
  for (const t of L.teams) strength[t.id] = teamStrength(g.auction.squads[t.id].map((e) => e.pid));
  g.tour = createTournament({
    id: g.leagueId, name: `${L.short} season`, fmt: L.fmt, women: L.women, userTeam: g.userTeam, homeVenues: true,
    teams: L.teams.map((t) => ({ id: t.id, name: t.name, col: t.col, venue: t.venue })), strength,
    stages: [{ k: 'groups', name: 'League stage', groups: 1, adv: L.playoff, legs: L.legs }, { k: 'playoffs', name: 'Playoffs', n: L.playoff }],
  });
  return g;
}

function nationTeams(codes) {
  return codes.map((c) => {
    const n = NATION_BY_CODE[c];
    if (!n) throw new Error('Unknown team ' + c);
    return { id: c, name: n.n, col: n.col, col2: n.col2 };
  });
}

export function newTournamentGame(tpl, userTeam) {
  if (!tpl.teams.includes(userTeam)) throw new Error('Pick one of the competing teams');
  const squads = {}, strength = {};
  for (const c of tpl.teams) { squads[c] = nationSquad(c, tpl.women); strength[c] = teamStrength(squads[c]); }
  const tour = createTournament({
    id: tpl.id, name: tpl.name, fmt: tpl.fmt, women: tpl.women, userTeam, homeVenues: false, venues: tpl.venues,
    teams: nationTeams(tpl.teams), strength, stages: tpl.stages,
  });
  return { kind: 'tournament', templateId: tpl.id, userTeam, squads, xi: {}, tour };
}

export function templateFromRequest(b) {
  if (b.type === 'tournament') {
    const t = TEMPLATE_BY_ID[b.templateId];
    if (!t) throw new Error('Unknown tournament');
    return t;
  }
  if (b.type === 'series') {
    const games = +b.games;
    if (![1, 3, 5].includes(games)) throw new Error('Series must be 1, 3 or 5 matches');
    if (!b.a || !b.b || b.a === b.c || b.a === b.b) throw new Error('Pick two different teams');
    return seriesTemplate({ a: b.a, b: b.b, fmt: b.fmt, games, women: !!b.women });
  }
  if (b.type === 'custom') {
    if (!Array.isArray(b.teams)) throw new Error('Pick teams');
    return customTemplate({ teams: b.teams, fmt: b.fmt, structure: b.structure, women: !!b.women, name: b.name });
  }
  throw new Error('Unknown game type');
}

export function squadIdsOf(g, teamId) {
  if (g.kind === 'league') return (g.auction.squads[teamId] || []).map((e) => e.pid);
  return g.squads[teamId] || [];
}

export function envFor(g, rng) {
  const tour = g.tour;
  return {
    rng,
    team: (id) => {
      const t = tour.teams.find((x) => x.id === id);
      const mine = id === g.userTeam;
      return makeTeam({ id, name: t.name, col: t.col, squad: squadIdsOf(g, id), xiIds: mine ? g.xi[id] : null });
    },
  };
}

export function setXI(g, ids) {
  validateXI(ids, squadIdsOf(g, g.userTeam));
  g.xi[g.userTeam] = ids;
  return g;
}

export const pubPlayer = (p) => ({ id: p.id, name: p.name, c: p.c, role: p.role, ovr: p.ovr, bat: p.bat, bowl: p.bowl, hand: p.hand, style: p.style, arm: p.arm, w: p.w ? 1 : 0, custom: p.custom ? 1 : 0 });

export function refPlayers(g) {
  const ids = new Set();
  if (g.kind === 'league') { g.auction.queue.forEach((i) => ids.add(i)); Object.values(g.auction.squads).forEach((s) => s.forEach((e) => ids.add(e.pid))); }
  else if (g.kind === 'tournament') Object.values(g.squads).forEach((s) => s.forEach((i) => ids.add(i)));
  const out = {};
  for (const id of ids) { const p = getPlayer(id); if (p) out[id] = pubPlayer(p); }
  return out;
}
