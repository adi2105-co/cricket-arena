// Match formats and ball-outcome tables.
export const FORMATS = {
  T20: { id: 'T20', name: 'T20', balls: 120, bpo: 6, maxBowl: 24, exp: 1.37, ppEnd: 36, deathStart: 90, limited: true },
  H100: { id: 'H100', name: 'The Hundred', balls: 100, bpo: 5, maxBowl: 20, exp: 1.52, ppEnd: 25, deathStart: 75, limited: true },
  ODI: { id: 'ODI', name: 'ODI', balls: 300, bpo: 6, maxBowl: 60, exp: 0.93, ppEnd: 60, deathStart: 240, limited: true },
  TEST: { id: 'TEST', name: 'Test', balls: null, bpo: 6, maxBowl: null, exp: 0.55, limited: false },
};

// Base outcome weights per legal ball at average skill and normal intent.
export const BASE = {
  T20: { 0: 0.345, 1: 0.32, 2: 0.07, 3: 0.008, 4: 0.108, 6: 0.064, W: 0.037 },
  H100: { 0: 0.315, 1: 0.32, 2: 0.075, 3: 0.008, 4: 0.118, 6: 0.08, W: 0.042 },
  ODI: { 0: 0.435, 1: 0.335, 2: 0.058, 3: 0.006, 4: 0.078, 6: 0.029, W: 0.021 },
  TEST: { 0: 0.655, 1: 0.215, 2: 0.034, 3: 0.004, 4: 0.058, 6: 0.007, W: 0.0135 },
};
export const EXTRAS = {
  T20: { wd: 0.045, nb: 0.01 }, H100: { wd: 0.035, nb: 0.01 }, ODI: { wd: 0.035, nb: 0.008 }, TEST: { wd: 0.012, nb: 0.006 },
};

// Phase multipliers: pp (powerplay), mid, death.
export const PHASE = {
  T20: { pp: { 0: 1.05, 4: 1.15, 6: 1.05, W: 0.97 }, mid: { 1: 1.08, 4: 0.9, 6: 0.88, W: 0.97 }, death: { 0: 0.85, 4: 1.1, 6: 1.45, W: 1.35 } },
  H100: { pp: { 0: 1.05, 4: 1.12, 6: 1.05, W: 0.97 }, mid: { 1: 1.06, 4: 0.92, 6: 0.9, W: 0.97 }, death: { 0: 0.85, 4: 1.1, 6: 1.4, W: 1.3 } },
  ODI: { pp: { 4: 1.2, 6: 1.1, W: 1.05 }, mid: { 0: 1.04, 1: 1.12, 4: 0.8, 6: 0.65, W: 0.9 }, death: { 0: 0.75, 4: 1.3, 6: 2.1, W: 1.55 } },
};

export const oversStr = (balls, bpo = 6) => (bpo === 5 ? `${balls}` : `${Math.floor(balls / bpo)}.${balls % bpo}`);
