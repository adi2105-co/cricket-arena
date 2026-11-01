// Franchise leagues. Team names/colours are editable data; swap them if you ever publish commercially.
import { buildPool, getPlayer } from './players.js';

const T = (id, name, col, venue) => ({ id, name, col, venue, short: id.toUpperCase().slice(0, 4) });

function mk(o) {
  const s = o.scale, step = o.step;
  const r = (x) => Math.max(step, Math.round(x / step) * step);
  const tiers = o.women ? [[84, 200], [78, 150], [72, 100], [66, 50], [0, 30]] : [[88, 200], [82, 150], [76, 100], [70, 50], [0, 30]];
  const L = {
    legs: 1, playoff: 4, fmt: 'T20', squad: 14, maxOS: 6, women: false, ...o,
    purse: Math.round((9000 * s) / 50) * 50,
    maxPrice: r(2750 * s),
    baseTiers: tiers.map(([m, b]) => [m, r(b * s)]),
    inc: [[200 * s, r(10 * s)], [500 * s, r(20 * s)], [1e12, r(25 * s)]],
    ovrShift: o.women ? 4 : 0,
  };
  L.reserve = L.baseTiers[L.baseTiers.length - 1][1];
  return L;
}

export const LEAGUES = [
  mk({ id: 'ipl', name: 'Indian Premier League', short: 'IPL', cur: '₹', unit: 'lakh', scale: 1, step: 5, squad: 14, maxOS: 6, loc: ['IND'], size: 170,
    ovs: [['AUS', 12], ['ENG', 9], ['RSA', 8], ['NZ', 7], ['WI', 6], ['AFG', 5], ['SL', 5], ['BAN', 3]], accent: '#2f6bff',
    teams: [T('mi', 'Mumbai Indians', '#1d6fd1', 'wankhede'), T('csk', 'Chennai Super Kings', '#f5c518', 'chepauk'), T('rcb', 'Royal Challengers Bengaluru', '#d11a2a', 'chinnaswamy'),
      T('kkr', 'Kolkata Knight Riders', '#5b2c83', 'eden'), T('srh', 'Sunrisers Hyderabad', '#ff7a00', 'uppal'), T('dc', 'Delhi Capitals', '#2a5db0', 'kotla'),
      T('rr', 'Rajasthan Royals', '#e8409a', 'jaipur'), T('pbks', 'Punjab Kings', '#c8102e', 'mohali'), T('gt', 'Gujarat Titans', '#1c2c4c', 'motera'), T('lsg', 'Lucknow Super Giants', '#2fb5c9', 'ekana')] }),
  mk({ id: 'wpl', name: "Women's Premier League", short: 'WPL', women: true, cur: '₹', unit: 'lakh', scale: 0.2, step: 5, squad: 13, maxOS: 4, legs: 2, playoff: 3, loc: ['IND'], size: 110,
    ovs: [['AUS', 14], ['ENG', 10], ['RSA', 8], ['NZ', 7], ['WI', 6], ['SL', 3]], accent: '#e8409a',
    teams: [T('mi', 'Mumbai Indians', '#1d6fd1', 'dypatil'), T('dc', 'Delhi Capitals', '#2a5db0', 'brabourne'), T('rcb', 'Royal Challengers Bengaluru', '#d11a2a', 'chinnaswamy'),
      T('upw', 'UP Warriorz', '#f2a900', 'ekana'), T('gg', 'Gujarat Giants', '#e07b00', 'motera')] }),
  mk({ id: 'bbl', name: 'Big Bash League', short: 'BBL', cur: 'A$', unit: 'k', scale: 0.4, step: 5, maxOS: 5, loc: ['AUS'], size: 140,
    ovs: [['ENG', 10], ['NZ', 8], ['RSA', 8], ['WI', 6], ['AFG', 5], ['PAK', 8], ['SL', 3]], accent: '#00b4d8',
    teams: [T('six', 'Sydney Sixers', '#e6007e', 'scg'), T('thu', 'Sydney Thunder', '#a8d400', 'sydneyshow'), T('stars', 'Melbourne Stars', '#3bb54a', 'mcg'),
      T('ren', 'Melbourne Renegades', '#e2231a', 'mcg'), T('scor', 'Perth Scorchers', '#f58220', 'optus'), T('heat', 'Brisbane Heat', '#00a3b4', 'gabba'),
      T('str', 'Adelaide Strikers', '#0072ce', 'adelaide'), T('hur', 'Hobart Hurricanes', '#6a2c91', 'bellerive')] }),
  mk({ id: 'wbbl', name: "Women's Big Bash League", short: 'WBBL', women: true, cur: 'A$', unit: 'k', scale: 0.12, step: 5, squad: 13, maxOS: 4, loc: ['AUS'], size: 125,
    ovs: [['ENG', 10], ['IND', 12], ['NZ', 8], ['RSA', 8], ['WI', 7], ['SL', 3], ['PAK', 3]], accent: '#e6007e',
    teams: [T('six', 'Sydney Sixers', '#e6007e', 'scg'), T('thu', 'Sydney Thunder', '#a8d400', 'sydneyshow'), T('stars', 'Melbourne Stars', '#3bb54a', 'mcg'),
      T('ren', 'Melbourne Renegades', '#e2231a', 'mcg'), T('scor', 'Perth Scorchers', '#f58220', 'optus'), T('heat', 'Brisbane Heat', '#00a3b4', 'gabba'),
      T('str', 'Adelaide Strikers', '#0072ce', 'adelaide'), T('hur', 'Hobart Hurricanes', '#6a2c91', 'bellerive')] }),
  mk({ id: 'psl', name: 'Pakistan Super League', short: 'PSL', cur: '$', unit: 'k', scale: 0.35, step: 5, maxOS: 5, legs: 2, loc: ['PAK'], size: 105,
    ovs: [['AUS', 8], ['ENG', 10], ['WI', 8], ['NZ', 8], ['RSA', 6], ['AFG', 5], ['SL', 5], ['BAN', 3]], accent: '#2fb55a',
    teams: [T('kar', 'Karachi Kings', '#1f6fe0', 'nationalstd'), T('lah', 'Lahore Qalandars', '#2fb55a', 'gaddafi'), T('isl', 'Islamabad United', '#e23b3b', 'pindi'),
      T('pes', 'Peshawar Zalmi', '#f2c200', 'pindi'), T('que', 'Quetta Gladiators', '#7b3fb8', 'nationalstd'), T('mul', 'Multan Sultans', '#2fb5c9', 'multan')] }),
  mk({ id: 'cpl', name: 'Caribbean Premier League', short: 'CPL', cur: '$', unit: 'k', scale: 0.35, step: 5, maxOS: 6, legs: 2, loc: ['WI'], size: 100,
    ovs: [['AUS', 8], ['ENG', 8], ['RSA', 8], ['NZ', 6], ['PAK', 8], ['AFG', 6], ['SL', 4], ['BAN', 3]], accent: '#f2a900',
    teams: [T('tkr', 'Trinbago Knight Riders', '#5b2c83', 'brianlara'), T('bar', 'Barbados Royals', '#e8409a', 'kensington'), T('gaw', 'Guyana Amazon Warriors', '#2fb55a', 'providence'),
      T('jam', 'Jamaica Tallawahs', '#f2c200', 'sabina'), T('skn', 'St Kitts & Nevis Patriots', '#d11a2a', 'warnerpark'), T('slk', 'Saint Lucia Kings', '#2f6bff', 'darensammy')] }),
  mk({ id: 'hun', name: 'The Hundred', short: 'HUN', fmt: 'H100', cur: '£', unit: 'k', scale: 0.35, step: 5, maxOS: 5, playoff: 3, loc: ['ENG'], size: 140,
    ovs: [['AUS', 10], ['NZ', 8], ['RSA', 8], ['WI', 6], ['PAK', 6], ['AFG', 5], ['SL', 4]], accent: '#ff5a1f',
    teams: [T('lon', 'London Spirit', '#1b3a8a', 'lords'), T('ovl', 'Oval Invincibles', '#2fb55a', 'oval'), T('sou', 'Southern Brave', '#2fb5c9', 'rosebowl'),
      T('wel', 'Welsh Fire', '#e23b3b', 'sophia'), T('man', 'Manchester Originals', '#d11a2a', 'oldtrafford'), T('nor', 'Northern Superchargers', '#7b3fb8', 'headingley'),
      T('bir', 'Birmingham Phoenix', '#f58220', 'edgbaston'), T('tre', 'Trent Rockets', '#f2c200', 'trentbridge')] }),
  mk({ id: 'sa20', name: 'SA20', short: 'SA20', cur: 'R', unit: 'k', scale: 0.4, step: 5, maxOS: 5, legs: 2, loc: ['RSA'], size: 105,
    ovs: [['ENG', 9], ['AUS', 7], ['NZ', 6], ['WI', 6], ['AFG', 6], ['PAK', 4], ['SL', 4], ['BAN', 2]], accent: '#00a86b',
    teams: [T('mict', 'MI Cape Town', '#1d6fd1', 'newlands'), T('jsk', 'Joburg Super Kings', '#f5c518', 'wanderers'), T('sec', 'Sunrisers Eastern Cape', '#ff7a00', 'stgeorges'),
      T('dsg', "Durban's Super Giants", '#2fb5c9', 'kingsmead'), T('par', 'Paarl Royals', '#e8409a', 'boland'), T('pc', 'Pretoria Capitals', '#2a5db0', 'centurion')] }),
  mk({ id: 'ilt20', name: 'International League T20', short: 'ILT20', cur: '$', unit: 'k', scale: 0.4, step: 5, maxOS: 10, legs: 2, loc: ['UAE'], size: 105,
    ovs: [['PAK', 12], ['SL', 8], ['WI', 8], ['ENG', 8], ['AFG', 6], ['BAN', 4], ['AUS', 4], ['NZ', 4], ['RSA', 5]], accent: '#c8a24a',
    teams: [T('dv', 'Desert Vipers', '#d11a2a', 'dubai'), T('dcp', 'Dubai Capitals', '#2a5db0', 'dubai'), T('gg', 'Gulf Giants', '#e07b00', 'sharjah'),
      T('mie', 'MI Emirates', '#1d6fd1', 'dubai'), T('akr', 'Abu Dhabi Knight Riders', '#5b2c83', 'zayed'), T('sw', 'Sharjah Warriorz', '#2fb55a', 'sharjah')] }),
  mk({ id: 'mlc', name: 'Major League Cricket', short: 'MLC', cur: '$', unit: 'k', scale: 0.35, step: 5, maxOS: 9, legs: 2, loc: ['USA'], size: 105,
    ovs: [['AUS', 8], ['NZ', 6], ['RSA', 8], ['WI', 8], ['ENG', 6], ['AFG', 3], ['PAK', 6], ['SL', 4]], accent: '#3b82f6',
    teams: [T('mny', 'MI New York', '#1d6fd1', 'nassau'), T('tsk', 'Texas Super Kings', '#f5c518', 'prairie'), T('sfu', 'San Francisco Unicorns', '#e23b3b', 'lauderhill'),
      T('sea', 'Seattle Orcas', '#2fb5c9', 'prairie'), T('wsh', 'Washington Freedom', '#7b3fb8', 'lauderhill'), T('lak', 'Los Angeles Knight Riders', '#5b2c83', 'prairie')] }),
  mk({ id: 'lpl', name: 'Lanka Premier League', short: 'LPL', cur: '$', unit: 'k', scale: 0.2, step: 5, maxOS: 6, legs: 2, playoff: 3, loc: ['SL'], size: 90,
    ovs: [['PAK', 8], ['AFG', 6], ['BAN', 6], ['WI', 6], ['ENG', 4], ['AUS', 4], ['NZ', 4]], accent: '#2a7de1',
    teams: [T('col', 'Colombo Strikers', '#2a7de1', 'premadasa'), T('dam', 'Dambulla Thunders', '#f2c200', 'dambulla'), T('gal', 'Galle Marvels', '#e23b3b', 'galle'),
      T('jaf', 'Jaffna Kings', '#2fb55a', 'dambulla'), T('kan', 'Kandy Falcons', '#7b3fb8', 'pallekele')] }),
  mk({ id: 'bpl', name: 'Bangladesh Premier League', short: 'BPL', cur: '$', unit: 'k', scale: 0.2, step: 5, maxOS: 6, legs: 2, loc: ['BAN'], size: 120,
    ovs: [['PAK', 10], ['AFG', 8], ['SL', 8], ['WI', 8], ['ENG', 5], ['NZ', 4], ['AUS', 4], ['RSA', 4]], accent: '#0b9d6a',
    teams: [T('rang', 'Rangpur Riders', '#d11a2a', 'mirpur'), T('comi', 'Comilla Victorians', '#2fb5c9', 'chattogram'), T('chat', 'Chattogram Challengers', '#2f6bff', 'chattogram'),
      T('syl', 'Sylhet Strikers', '#f2c200', 'sylhet'), T('khul', 'Khulna Tigers', '#f58220', 'mirpur'), T('bar', 'Fortune Barishal', '#e8409a', 'mirpur'), T('dha', 'Dhaka Capitals', '#7b3fb8', 'mirpur')] }),
];

export const LEAGUE_BY_ID = Object.fromEntries(LEAGUES.map((l) => [l.id, l]));
export const getLeague = (id) => LEAGUE_BY_ID[id];

export function leaguePool(L) {
  return buildPool({ id: L.id, women: L.women, loc: L.loc, ovs: L.ovs, size: L.size });
}
export const isOverseas = (L, p) => !L.loc.includes(p.c);
export { getPlayer };
