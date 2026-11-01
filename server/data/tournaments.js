// Tournament templates. Stage kinds:
//  groups   { groups, adv, legs?, regroup?: 'super8' | 'merge' }
//  knockout { size }
//  series   { games }
//  playoffs { n: 3 | 4 }   (IPL-style: qualifiers/eliminator/final)
import { NATIONS, TEST_NATIONS, WOMEN_NATIONS } from './nations.js';
import { venuesOf } from './venues.js';

const allMen = NATIONS.map((n) => n.c);

export const TEMPLATES = [
  { id: 't20wc', name: "ICC Men's T20 World Cup", short: 'T20 World Cup', fmt: 'T20', women: false, teams: allMen, venues: venuesOf('IND', 'SL'), icon: 'trophy',
    blurb: '20 nations, 4 groups, Super 8, semi-finals and the final.',
    stages: [{ k: 'groups', name: 'Group stage', groups: 4, adv: 2 }, { k: 'groups', name: 'Super 8', groups: 2, adv: 2, regroup: 'super8' }, { k: 'knockout', name: 'Knockouts', size: 4 }] },
  { id: 'odiwc', name: "ICC Men's Cricket World Cup", short: 'ODI World Cup', fmt: 'ODI', women: false, teams: ['IND', 'AUS', 'ENG', 'RSA', 'NZ', 'PAK', 'SL', 'BAN', 'AFG', 'NED'], venues: venuesOf('IND'), icon: 'trophy',
    blurb: '10 nations, a full round robin, then semi-finals and the final.',
    stages: [{ k: 'groups', name: 'League stage', groups: 1, adv: 4 }, { k: 'knockout', name: 'Knockouts', size: 4 }] },
  { id: 'ct', name: 'Champions Trophy', short: 'Champions Trophy', fmt: 'ODI', women: false, teams: ['IND', 'AUS', 'ENG', 'RSA', 'NZ', 'PAK', 'AFG', 'BAN'], venues: venuesOf('PAK', 'UAE'), icon: 'cup',
    blurb: '8 teams, two groups of four, semi-finals and the final.',
    stages: [{ k: 'groups', name: 'Group stage', groups: 2, adv: 2 }, { k: 'knockout', name: 'Knockouts', size: 4 }] },
  { id: 'asia', name: 'Asia Cup', short: 'Asia Cup', fmt: 'T20', women: false, teams: ['IND', 'PAK', 'SL', 'BAN', 'AFG', 'UAE'], venues: venuesOf('UAE'), icon: 'cup',
    blurb: '6 teams, two groups, a Super Four stage and the final.',
    stages: [{ k: 'groups', name: 'Group stage', groups: 2, adv: 2 }, { k: 'groups', name: 'Super Four', groups: 1, adv: 2, regroup: 'merge' }, { k: 'knockout', name: 'Final', size: 2 }] },
  { id: 'wt20wc', name: "ICC Women's T20 World Cup", short: "Women's T20 WC", fmt: 'T20', women: true, teams: ['AUS', 'IND', 'ENG', 'RSA', 'NZ', 'WI', 'PAK', 'SL', 'BAN', 'SCO'], venues: venuesOf('ENG'), icon: 'trophy',
    blurb: '10 teams, two groups, semi-finals and the final.',
    stages: [{ k: 'groups', name: 'Group stage', groups: 2, adv: 2 }, { k: 'knockout', name: 'Knockouts', size: 4 }] },
  { id: 'wodiwc', name: "ICC Women's Cricket World Cup", short: "Women's ODI WC", fmt: 'ODI', women: true, teams: ['AUS', 'IND', 'ENG', 'RSA', 'NZ', 'WI', 'PAK', 'SL'], venues: venuesOf('IND'), icon: 'trophy',
    blurb: '8 teams, a round robin, then semi-finals and the final.',
    stages: [{ k: 'groups', name: 'League stage', groups: 1, adv: 4 }, { k: 'knockout', name: 'Knockouts', size: 4 }] },
  { id: 'ashes', name: 'The Ashes', short: 'The Ashes', fmt: 'TEST', women: false, teams: ['AUS', 'ENG'], venues: venuesOf('AUS'), icon: 'urn',
    blurb: 'Five Tests, Australia v England. Win the series, win the urn.',
    stages: [{ k: 'series', name: 'The Ashes', games: 5 }] },
  { id: 'bgt', name: 'Border-Gavaskar Trophy', short: 'Border-Gavaskar', fmt: 'TEST', women: false, teams: ['IND', 'AUS'], venues: venuesOf('IND'), icon: 'urn',
    blurb: 'Five Tests, India v Australia.',
    stages: [{ k: 'series', name: 'Border-Gavaskar Trophy', games: 5 }] },
];
export const TEMPLATE_BY_ID = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]));

export const FORMAT_LABEL = { T20: 'T20', H100: 'The Hundred', ODI: 'ODI', TEST: 'Test' };

// Bilateral series chosen by the player.
export function seriesTemplate({ a, b, fmt, games, women }) {
  const home = a;
  return {
    id: 'series', name: `${a} v ${b} ${fmt === 'TEST' ? 'Test' : fmt === 'ODI' ? 'ODI' : 'T20I'} series`, short: 'Series', fmt, women: !!women, teams: [a, b],
    venues: venuesOf(home).length ? venuesOf(home) : venuesOf('AUS'), icon: 'urn', blurb: '',
    stages: [{ k: 'series', name: 'Series', games }],
  };
}

// Custom competition.
export function customTemplate({ teams, fmt, structure, women, name }) {
  const n = teams.length;
  let stages;
  if (structure === 'rr') stages = [{ k: 'groups', name: 'League', groups: 1, adv: 1 }];
  else if (structure === 'rr_final') stages = [{ k: 'groups', name: 'League', groups: 1, adv: 2 }, { k: 'knockout', name: 'Final', size: 2 }];
  else if (structure === 'rr_semis') stages = [{ k: 'groups', name: 'League', groups: 1, adv: 4 }, { k: 'knockout', name: 'Knockouts', size: 4 }];
  else if (structure === 'groups_ko') {
    const g = n / 4;
    stages = [{ k: 'groups', name: 'Group stage', groups: g, adv: 2 }, { k: 'knockout', name: 'Knockouts', size: g * 2 }];
  } else if (structure === 'knockout') stages = [{ k: 'knockout', name: 'Knockouts', size: n }];
  else throw new Error('Unknown structure');
  const home = teams.map((c) => (women ? WOMEN_NATIONS : TEST_NATIONS).includes(c) ? c : 'AUS');
  const venues = venuesOf(...new Set(home));
  return { id: 'custom', name: name || 'Custom Cup', short: 'Custom Cup', fmt, women: !!women, teams, venues: venues.length ? venues : venuesOf('AUS', 'ENG'), icon: 'cup', blurb: '', stages };
}

export const STRUCTURES = [
  { id: 'rr', name: 'Round robin (table topper wins)', min: 3, max: 12 },
  { id: 'rr_final', name: 'Round robin + Final', min: 3, max: 12 },
  { id: 'rr_semis', name: 'Round robin + Semi-finals + Final', min: 5, max: 12 },
  { id: 'groups_ko', name: 'Groups + Knockouts (8 or 16 teams)', min: 8, max: 16, only: [8, 16] },
  { id: 'knockout', name: 'Straight knockout (4, 8 or 16 teams)', min: 4, max: 16, only: [4, 8, 16] },
];
