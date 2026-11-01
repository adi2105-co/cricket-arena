// Pure gameplay maths for the 3D match: deliveries, timing, shot results. No rendering here, so it is unit-testable.
// World: metres. x = off side (+) for a right-hander, y up, z along the pitch.
// Batter's stumps at z = +PITCH/2 (camera sits behind them), bowler's at z = -PITCH/2. Balls travel in +z.

export const PITCH = 20.12;
export const HALF = PITCH / 2;
export const G = 9.81;
export const RELEASE_Z = -HALF + 1.0;
export const DEG = Math.PI / 180;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gauss = (rng) => { let u = 0, v = 0; while (!u) u = rng(); while (!v) v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

export const LENGTHS = { yorker: 1.2, full: 3.2, good: 5.6, short: 8.2 }; // metres in front of the batter's stumps where it pitches
export const BOUNDARY = { S: 62, M: 70, L: 78 };

/** Fielding positions (x, z) around the ground. `style`: 'pp' | 'mid' | 'death' */
export function fieldFor(style, R = 70) {
  const ring = (deg, frac) => { const a = deg * DEG, r = R * frac; return { x: Math.sin(a) * r, z: HALF - Math.cos(a) * r }; };
  // angles measured from straight down the ground (0) towards off (+) / leg (-); 180 is directly behind
  const slip = (x) => ({ x, z: HALF + 5 });
  if (style === 'pp') return [ring(40, 0.28), ring(-40, 0.28), ring(70, 0.3), ring(-85, 0.3), ring(15, 0.3), ring(100, 0.9), ring(-110, 0.92), ring(150, 0.9), slip(1.6)];
  if (style === 'death') return [ring(0, 0.95), ring(35, 0.92), ring(-35, 0.92), ring(70, 0.9), ring(-70, 0.9), ring(110, 0.88), ring(-110, 0.88), ring(160, 0.9), ring(20, 0.55)];
  return [ring(30, 0.55), ring(-30, 0.55), ring(65, 0.62), ring(-70, 0.62), ring(0, 0.9), ring(105, 0.85), ring(-105, 0.85), ring(145, 0.9), ring(-155, 0.9)];
}

/** Generate a delivery. `bowler`: {pace 0..100 (higher = faster), skill 0..100, style 'P'|'S'}. */
export function makeDelivery(rng, bowler, aim) {
  const spin = bowler.style === 'S';
  const speed = spin ? lerp(20, 27, bowler.pace / 100) : lerp(27, 38, bowler.pace / 100); // m/s as bowled
  const slow = spin ? 1.0 : 1.12; // game-time stretch so the ball is hittable on touch screens
  const err = (100 - bowler.skill) / 100;
  let length, lineX;
  if (aim) { length = aim.length; lineX = aim.lineX; }
  else {
    const r = rng();
    length = r < 0.12 ? LENGTHS.yorker : r < 0.42 ? LENGTHS.full : r < 0.85 ? LENGTHS.good : LENGTHS.short;
    lineX = gauss(rng) * (0.28 + err * 0.35) + (rng() < 0.5 ? 0.25 : 0);
  }
  // execution error: the better the bowler, the nearer he gets to what he aimed at
  length += gauss(rng) * (0.25 + err * 1.1);
  lineX += gauss(rng) * (0.05 + err * 0.28);
  length = clamp(length, 0.4, 9.2);
  const dur = ((HALF - RELEASE_Z) / speed) * slow * 1.35 + (spin ? 0.12 : 0);
  const turn = spin ? gauss(rng) * 0.2 + (rng() < 0.5 ? -0.18 : 0.18) : gauss(rng) * 0.05; // lateral movement after pitching (m/s equivalent)
  return { speed, length, lineX, dur, spin, turn, x0: clamp(-0.5 + rng() * 0.9, -1.5, 1.5), kind: lengthName(length) };
}
export const lengthName = (l) => (l < 2 ? 'yorker' : l < 4.3 ? 'full' : l < 7 ? 'good' : 'short');

/** Ball position at time t (0 = release). Returns {x,y,z,bounced}. */
export function deliveryAt(d, t) {
  const u = clamp(t / d.dur, 0, 1.4);
  const zPitch = HALF - d.length;
  const zEnd = HALF;
  const z = RELEASE_Z + (zEnd - RELEASE_Z) * u;
  const x = lerp(d.x0, d.lineX - d.turn * 0.0, u) + (z > zPitch ? d.turn * (z - zPitch) * 0.12 : 0);
  let y;
  const yEnd = lerp(0.12, 1.55, clamp((d.length - 1) / 7.5, 0, 1));
  if (z <= zPitch) { const k = (z - RELEASE_Z) / (zPitch - RELEASE_Z); y = 2.05 * (1 - k * k) + 0.02; }
  else { const k = (z - zPitch) / (zEnd - zPitch); y = lerp(0.05, yEnd, 1 - (1 - k) * (1 - k)); }
  return { x, y: Math.max(0.04, y), z, bounced: z > zPitch };
}
/** Line and height the ball has at the batter's crease. */
export function arrival(d) { const p = deliveryAt(d, d.dur); return { t: d.dur, x: p.x, y: p.y }; }

const natYaw = (lineX) => clamp(lineX * 38, -45, 45); // sensible direction for a ball on that line (degrees, off +)

/**
 * Resolve a swing. All timing in seconds on the delivery clock.
 * p: { d, pressT, aim (deg, off side positive in batter-facing frame), loft (bool), bat:{skill 0..100, power 0..100, hand 'R'|'L'},
 *      field:[{x,z}], R: boundary radius, rng, overs?: ..., difficulty?: 0.7..1.3 }
 * Returns { kind, runs, out, how, q, yaw, traj:[{t,x,y,z}], fieldMoves:[{i,to:{x,z},t}], desc, shot }
 */
export function resolveShot(p) {
  const { d, rng, field, R } = p;
  const hand = p.bat.hand === 'L' ? -1 : 1;
  const arr = arrival(d);
  const SWING = 0.13;
  const diff = p.difficulty || 1;
  const win = (0.075 + (p.bat.skill - 50) * 0.0009) / diff; // seconds of "good contact" either side
  const dt = p.pressT == null ? 9 : p.pressT + SWING - arr.t;
  const aimYaw = (p.aim || 0) * hand;
  const base = { aimYaw: p.aim || 0 };
  const stumpHit = Math.abs(arr.x) < 0.14 && arr.y < 0.72;
  const idle = p.pressT == null;

  // --- no shot or a complete miss
  if (idle || Math.abs(dt) > win * 2.3) {
    const hits = stumpHit && !(d.kind === 'short' && arr.y > 0.9);
    if (hits) {
      const lbw = idle ? false : arr.y < 0.5 && rng() < 0.3 && d.turn !== undefined && Math.abs(arr.x) < 0.1;
      return { ...base, kind: 'wicket', runs: 0, out: true, how: lbw ? 'lbw' : 'bowled', q: 0, traj: stumpsTraj(arr), fieldMoves: [], desc: idle ? 'Left it - and it hit the stumps!' : lbw ? 'Hit on the pad, plumb. LBW!' : 'Missed it and clean bowled!' };
    }
    const wide = Math.abs(arr.x) > 0.85 && idle;
    const runs = 0;
    return { ...base, kind: wide ? 'wide' : 'dot', runs, out: false, how: null, q: 0, traj: passTraj(arr, d), fieldMoves: [], desc: wide ? 'Wide ball' : idle ? 'Left alone' : 'Swing and a miss' };
  }

  // --- contact
  const early = dt < 0;
  let q = 1 - Math.pow(Math.abs(dt) / (win * 2.3), 1.15);
  const nat = natYaw(arr.x);
  const against = clamp(Math.abs(aimYaw - nat) / 80, 0, 1);
  q *= 1 - 0.38 * against;
  // length vs shot choice
  if (p.loft) { if (d.length < 2) q *= 0.7; if (d.length > 7) q *= 0.92; } else { if (d.length > 7 && arr.y > 1.1) q *= 0.9; }
  q = clamp(q + gauss(rng) * 0.03, 0, 1);
  // timing nudges the direction: early goes square-leg side, late goes toward third man / cover
  const yaw = aimYaw + clamp(-dt * 150 * hand * -1, -28, 28) * -1;
  const powerK = lerp(0.72, 1.08, p.bat.power / 100);
  const ang = yaw * DEG;
  const dir = { x: Math.sin(ang), z: -Math.cos(ang) }; // from the batter, forward is -z
  const here = { x: 0, z: HALF - 0.4 };
  let v = (11 + 22 * q * q + (d.spin ? 0 : (d.speed - 27) * 0.2)) * powerK;
  let elev = p.loft ? (30 + (1 - q) * 28) : (2 + (1 - q) * 14);
  if (p.loft && q < 0.35) { elev = 55 + rng() * 18; v *= 0.62; }
  if (!p.loft && q < 0.18) { elev = 22 + rng() * 20; v *= 0.5; }
  // edges: very poor contact behind square
  const edge = q < 0.16 && (rng() < 0.55);
  let yawDeg = yaw;
  if (edge) { yawDeg = (rng() < 0.6 ? 1 : -1) * (120 + rng() * 50); }
  const a2 = yawDeg * DEG, dir2 = { x: Math.sin(a2), z: -Math.cos(a2) };
  if (p.loft) v *= 0.93;
  const el = elev * DEG;
  const vh = v * Math.cos(el), vy = v * Math.sin(el);
  const y0 = 0.9;
  const tFlight = (vy + Math.sqrt(vy * vy + 2 * G * y0)) / G;
  const land = { x: here.x + dir2.x * vh * tFlight, z: here.z + dir2.z * vh * tFlight };
  const landDist = vh * tFlight;
  const rd = (pt) => Math.hypot(pt.x, pt.z - HALF); // distance from the batter
  const air = elev > 14;
  const traj = [];
  const shot = { q, yaw: yawDeg, elev, v, edge, early, air };

  // Fielder routines
  const FSPEED = 7.2;
  const nearest = (pt, t) => {
    let best = null;
    field.forEach((f, i) => { const dd = Math.hypot(f.x - pt.x, f.z - pt.z); const reach = FSPEED * Math.max(0, t - 0.25) + 0.9; const need = dd - reach; if (!best || need < best.need) best = { i, dd, need, f }; });
    return best;
  };

  // sample the flight
  const flight = (T, fn) => { for (let t = 0; t <= T + 1e-6; t += 1 / 30) traj.push(fn(t)); };
  if (air) {
    flight(tFlight, (t) => ({ t, x: here.x + dir2.x * vh * t, y: Math.max(0.05, y0 + vy * t - 0.5 * G * t * t), z: here.z + dir2.z * vh * t }));
    // six?
    if (landDist >= R - 1 && !edge) {
      return { ...base, kind: 'six', runs: 6, out: false, how: null, q, yaw: yawDeg, traj, fieldMoves: [], desc: q > 0.8 ? 'MAXIMUM! Struck right out of the middle' : 'Gets enough on it... SIX!', shot, landing: land };
    }
    // catch chance
    const nf = nearest(land, tFlight);
    const reachable = nf && nf.need < 1.6;
    if (reachable) {
      const pCatch = clamp(0.3 - Math.max(0, nf.need) * 0.2 - (elev < 22 ? 0.2 : 0) - (q > 0.65 ? 0.12 : 0) + (q < 0.4 ? 0.4 : 0), 0.03, 0.8);
      if (rng() < pCatch) {
        const lastPt = traj[traj.length - 1];
        return { ...base, kind: 'wicket', runs: 0, out: true, how: edge ? 'caught behind' : 'caught', q, yaw: yawDeg, traj, fieldMoves: [{ i: nf.i, to: { x: land.x, z: land.z }, t: tFlight }], desc: edge ? 'Edged and taken!' : 'Skied it... and CAUGHT!', shot, landing: land, catcher: nf.i };
      }
    }
    // lands safe and rolls on
    const roll = Math.max(0, v * 0.45);
    const dist = landDist + roll * roll / 5.2;
    if (dist >= R) {
      const t2 = tFlight + 1.4;
      for (let t = tFlight; t <= t2; t += 1 / 30) { const s = Math.min(roll * (t - tFlight) - 1.3 * (t - tFlight) ** 2, dist - landDist); traj.push({ t, x: here.x + dir2.x * (landDist + s), y: 0.08, z: here.z + dir2.z * (landDist + s) }); }
      return { ...base, kind: 'four', runs: 4, out: false, how: null, q, yaw: yawDeg, traj, fieldMoves: [], desc: 'In the air... and just safe! FOUR', shot, landing: land };
    }
    const runs = dist > 55 ? 3 : dist > 32 ? 2 : dist > 14 ? 1 : 0;
    const moves = nf ? [{ i: nf.i, to: land, t: tFlight + 0.4 }] : [];
    return { ...base, kind: runs ? 'run' : 'dot', runs, out: false, how: null, q, yaw: yawDeg, traj, fieldMoves: moves, desc: runs ? `Lofted into the gap, ${runs}` : 'Mistimed, falls short', shot, landing: land };
  }

  // ground shot: roll with deceleration
  const a = 2.7;
  const stop = v * v / (2 * a);
  const ptAt = (s) => ({ x: here.x + dir2.x * s, z: here.z + dir2.z * s });
  // interception
  let hit = null;
  for (let s = 6; s < stop && s < R + 8; s += 1.5) {
    const t = (v - Math.sqrt(Math.max(0, v * v - 2 * a * s))) / a;
    const pt = ptAt(s);
    for (let i = 0; i < field.length; i++) {
      const f = field[i];
      const dd = Math.hypot(f.x - pt.x, f.z - pt.z);
      if (dd <= FSPEED * Math.max(0, t - 0.2) + 1.0) { hit = { s, t, i, pt }; break; }
    }
    if (hit) break;
    if (s >= R) break;
  }
  const sEnd = hit ? hit.s : Math.min(stop, R + 2);
  const tEnd = (v - Math.sqrt(Math.max(0, v * v - 2 * a * sEnd))) / a;
  for (let t = 0; t <= tEnd + 1e-6; t += 1 / 30) { const s = v * t - 0.5 * a * t * t; const pt = ptAt(s); traj.push({ t, x: pt.x, y: 0.1, z: pt.z }); }
  if (!hit && stop >= R - 1) return { ...base, kind: 'four', runs: 4, out: false, how: null, q, yaw: yawDeg, traj, fieldMoves: [], desc: q > 0.8 ? 'Pierces the gap! FOUR' : 'Races away to the rope, FOUR', shot };
  const s = hit ? hit.s : stop;
  // edge to the keeper/slips can also be caught
  if (edge && rng() < 0.45) {
    const f = nearest(ptAt(Math.min(s, 6)), 0.6);
    return { ...base, kind: 'wicket', runs: 0, out: true, how: 'caught behind', q, yaw: yawDeg, traj, fieldMoves: f ? [{ i: f.i, to: ptAt(Math.min(s, 6)), t: 0.6 }] : [], desc: 'Thin edge, and the keeper takes it', shot };
  }
  const runs = s < 17 ? (q > 0.7 && rng() < 0.22 ? 1 : 0) : s < 36 ? 1 : s < 55 ? 2 : 3;
  const moves = hit ? [{ i: hit.i, to: hit.pt, t: hit.t }] : [];
  return { ...base, kind: runs ? 'run' : 'dot', runs, out: false, how: null, q, yaw: yawDeg, traj, fieldMoves: moves, desc: runs ? (runs === 1 ? 'Worked into the gap for one' : `Placed well, ${runs} runs`) : q > 0.6 ? 'Straight to the fielder' : 'Defended', shot };
}

function stumpsTraj(arr) { const t = []; for (let i = 0; i <= 8; i++) t.push({ t: i / 30, x: arr.x * (1 - i / 8), y: Math.max(0.1, arr.y - i * 0.02), z: HALF + i * 0.12 }); return t; }
function passTraj(arr, d) { const t = []; for (let i = 0; i <= 24; i++) t.push({ t: i / 30, x: arr.x + d.turn * 0.02 * i, y: Math.max(0.1, arr.y - i * 0.03), z: HALF + i * 0.4 }); return t; }

/** A computer-controlled batter: used when the user bowls. */
export function botSwing(rng, d, bat, difficulty = 1) {
  const arr = arrival(d);
  const sd = (0.1 - (bat.skill - 50) * 0.0006) * difficulty * (d.kind === 'yorker' ? 1.5 : d.kind === 'short' ? 1.15 : 1);
  const lineHard = Math.abs(arr.x) > 0.6 ? 0.07 : 0;
  const pressT = arr.t - 0.13 + gauss(rng) * (sd + lineHard);
  const wantLoft = rng() < 0.28 + (bat.power - 50) / 200;
  const leave = Math.abs(arr.x) > 0.95 && rng() < 0.7;
  return { pressT: leave ? null : pressT, aim: natYaw(arr.x) + gauss(rng) * 24, loft: wantLoft && d.length > 2 };
}

/** Pick a shot direction for a scripted replay of a simulator event. */
export function scriptedShot(ev, rng, field, R) {
  const hand = 1;
  const make = (kind, runs, how, yaw, elev, v, desc) => ({ kind, runs, how, yaw, elev, v, desc });
  const yaw = (rng() * 2 - 1) * 130;
  if (ev.w) {
    const how = ev.how || 'b';
    if (how === 'b') return make('wicket', 0, 'bowled', 0, 0, 0, 'Bowled!');
    if (how === 'lbw') return make('wicket', 0, 'lbw', 0, 0, 0, 'LBW!');
    if (how === 'st') return make('wicket', 0, 'stumped', 0, 0, 0, 'Stumped!');
    if (how === 'ro') return make('wicket', 0, 'run out', yaw, 6, 20, 'Run out!');
    return make('wicket', 0, 'caught', yaw, 48, 20, 'Caught!');
  }
  const r = ev.r || 0;
  if (r >= 6) return make('six', 6, null, yaw, 36, 34, 'SIX!');
  if (r === 4) return make('four', 4, null, yaw, 4, 31, 'FOUR!');
  if (r === 0) return make('dot', 0, null, yaw, 3, 6, 'Dot ball');
  return make('run', r, null, yaw, 3, r === 1 ? 17 : r === 2 ? 24 : 28, `${r} run${r > 1 ? 's' : ''}`);
}

/** Build a full result (same shape as resolveShot) for a simulator event, for the 3D highlights/replay mode. */
export function scriptedResult(ev, rng, field, R) {
  const sc = scriptedShot(ev, rng, field, R);
  const here = { x: 0, z: HALF - 0.4 };
  const traj = [];
  const out = { kind: sc.kind, runs: sc.runs, out: sc.kind === 'wicket', how: sc.how, q: 0.8, yaw: sc.yaw, traj, fieldMoves: [], desc: sc.desc, shot: { air: sc.elev > 14, q: 0.8, yaw: sc.yaw, elev: sc.elev } };
  const a = sc.yaw * DEG, dir = { x: Math.sin(a), z: -Math.cos(a) };
  const ground = (D) => { const acc = 2.7, v = Math.sqrt(2 * acc * D), T = v / acc; for (let t = 0; t <= T + 1e-6; t += 1 / 30) { const s = v * t - 0.5 * acc * t * t; traj.push({ t, x: here.x + dir.x * s, y: 0.1, z: here.z + dir.z * s }); } return { x: here.x + dir.x * D, z: here.z + dir.z * D, T }; };
  const arc = (range, elevDeg) => { const el = elevDeg * DEG, v = Math.sqrt((range * G) / Math.sin(2 * el)), vh = v * Math.cos(el), vy = v * Math.sin(el), T = (2 * vy) / G; for (let t = 0; t <= T + 1e-6; t += 1 / 30) traj.push({ t, x: here.x + dir.x * vh * t, y: Math.max(0.05, 0.9 + vy * t - 0.5 * G * t * t), z: here.z + dir.z * vh * t }); return { x: here.x + dir.x * range, z: here.z + dir.z * range, T }; };
  const nearestIdx = (pt) => { let b = 0, bd = 1e9; field.forEach((f, i) => { const d = Math.hypot(f.x - pt.x, f.z - pt.z); if (d < bd) { bd = d; b = i; } }); return b; };
  if (sc.kind === 'six') { const e = arc(R + 8, 38); out.landing = e; }
  else if (sc.kind === 'four') { ground(R + 3); }
  else if (sc.kind === 'dot') { ground(7); }
  else if (sc.kind === 'run') { const e = ground(sc.runs === 1 ? 24 : sc.runs === 2 ? 42 : 58); out.fieldMoves = [{ i: nearestIdx(e), to: e, t: e.T }]; }
  else if (sc.how === 'bowled' || sc.how === 'lbw') { const arr = { x: 0.02, y: 0.4 }; stumpsTraj(arr).forEach((p) => traj.push(p)); }
  else if (sc.how === 'stumped') { const arr = { x: 0.3, y: 0.7 }; passTraj(arr, { turn: 0 }).forEach((p) => traj.push(p)); }
  else if (sc.how === 'run out') { const e = ground(30); out.fieldMoves = [{ i: nearestIdx(e), to: e, t: e.T }]; }
  else { // caught
    const idx = Math.floor(rng() * field.length), f = field[idx];
    const d = Math.max(18, Math.hypot(f.x - here.x, f.z - here.z));
    const ang = Math.atan2(f.x - here.x, -(f.z - here.z));
    dir.x = Math.sin(ang); dir.z = -Math.cos(ang);
    const e = arc(d, 48);
    out.fieldMoves = [{ i: idx, to: { x: f.x, z: f.z }, t: e.T }]; out.catcher = idx; out.how = 'caught'; out.landing = e;
  }
  if (!traj.length) traj.push({ t: 0, x: 0, y: 0.5, z: HALF });
  return out;
}
