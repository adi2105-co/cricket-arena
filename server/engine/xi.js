// Playing-XI selection and team objects.
import { getPlayer } from '../data/players.js';

// Pick a balanced XI (batting order) from a squad of players.
export function pickXI(squad) {
  const ps = squad.map((p) => (typeof p === 'string' ? getPlayer(p) : p)).filter(Boolean);
  if (ps.length <= 11) return orderXI(ps);
  const chosen = new Set();
  const byOvr = [...ps].sort((a, b) => b.ovr - a.ovr);
  const add = (p) => { if (p && chosen.size < 11) chosen.add(p); };
  add(byOvr.find((p) => p.role === 'WK'));
  [...ps].filter((p) => p.role === 'BOWL').sort((a, b) => b.bowl - a.bowl).slice(0, 4).forEach(add);
  for (const p of byOvr) add(p);
  const arr = [...chosen];
  const options = () => arr.filter((p) => p.bowl >= 55).length;
  while (options() < 5) {
    const swapOut = [...arr].filter((p) => p.bowl < 55 && p.role !== 'WK').sort((a, b) => a.ovr - b.ovr)[0];
    const swapIn = byOvr.find((p) => !chosen.has(p) && p.bowl >= 55);
    if (!swapOut || !swapIn) break;
    arr.splice(arr.indexOf(swapOut), 1, swapIn);
    chosen.delete(swapOut); chosen.add(swapIn);
  }
  return orderXI(arr);
}

export function orderXI(xi) {
  const arr = [...xi];
  const key = (p) => p.bat + (p.role === 'BAT' ? 1.5 : 0) - (p.role === 'BOWL' ? 8 : 0);
  arr.sort((a, b) => key(b) - key(a));
  // keep the keeper in the top 7
  const k = arr.findIndex((p) => p.role === 'WK');
  if (k > 6) { const [w] = arr.splice(k, 1); arr.splice(6, 0, w); }
  return arr;
}

// Validate a user-chosen XI (ids in batting order) against the squad.
export function validateXI(ids, squadIds) {
  if (!Array.isArray(ids) || ids.length !== 11) throw new Error('Pick exactly 11 players');
  if (new Set(ids).size !== 11) throw new Error('Duplicate player in XI');
  for (const id of ids) if (!squadIds.includes(id)) throw new Error('Player is not in the squad');
  const ps = ids.map(getPlayer);
  if (!ps.some((p) => p.role === 'WK')) throw new Error('Your XI needs a wicketkeeper');
  if (ps.filter((p) => p.bowl >= 45).length < 4) throw new Error('Your XI needs at least 4 bowling options');
  return ids;
}

export function makeTeam({ id, name, col, squad, xiIds }) {
  const xi = xiIds && xiIds.length === 11 ? xiIds.map(getPlayer).filter(Boolean) : null;
  return { id, name, col, xi: xi && xi.length === 11 ? xi : pickXI(squad) };
}

export const strengthOf = (team) => team.xi.reduce((a, p) => a + p.ovr, 0) / team.xi.length;
