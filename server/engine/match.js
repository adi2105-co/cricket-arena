// Ball-by-ball match engine for T20, The Hundred, ODI and Test cricket.
// Everything takes an rng so tests can be deterministic. State is plain data.
import { clamp, weightedPick, rint } from '../util.js';
import { FORMATS, BASE, EXTRAS, PHASE, oversStr } from './formats.js';
import { strengthOf } from './xi.js';

const LAST = (p) => p.name.split(' ').slice(-1)[0];

// ---------------------------------------------------------------- innings
export class Innings {
  /**
   * @param {object} o { fmt, bat, bowl, rng, venue, target?, maxBalls?, test? }
   * test: { oversBefore, timeLeft, mode, declare(inn)->bool, lead }
   */
  constructor(o) {
    this.fmt = o.fmt;
    this.bat = o.bat;
    this.bowl = o.bowl;
    this.rng = o.rng;
    this.venue = o.venue || { pitch: 'balanced', size: 'M' };
    this.target = o.target ?? null;
    this.test = o.test || null;
    this.maxBalls = o.maxBalls ?? (this.fmt.limited ? this.fmt.balls : 99999);
    this.B = this.bat.xi.map((p) => ({ p, r: 0, b: 0, f: 0, s: 0, out: null, did: false }));
    this.B[0].did = this.B[1].did = true;
    this.striker = 0; this.non = 1; this.next = 2;
    const opts = this.bowl.xi.filter((p) => p.bowl >= 45).sort((a, b) => b.bowl - a.bowl);
    const need = this.fmt.limited ? 5 : 5;
    if (opts.length < need) {
      for (const p of [...this.bowl.xi].sort((a, b) => b.bowl - a.bowl)) { if (!opts.includes(p)) opts.push(p); if (opts.length >= need) break; }
    }
    this.bowlers = opts.slice(0, this.fmt.limited ? 7 : 6).map((p) => ({ p, balls: 0, r: 0, w: 0, m: 0, ov: 0, spell: 0 }));
    this.keeper = this.bowl.xi.find((p) => p.role === 'WK') || this.bowl.xi[0];
    this.runs = 0; this.wkts = 0; this.balls = 0; this.extras = 0;
    this.over = 0; this.bio = 0; // legal balls in current over
    this.ends = [null, null]; this.endIdx = 0; this.cur = null; this.prev = null;
    this.freeHit = false; this.fow = []; this.comm = []; this.done = false; this.reason = null; this.declared = false;
    this.ovRuns = 0; this.guard = 0; this.mode = null;
  }

  get phaseName() {
    const f = this.fmt;
    if (!f.limited) return this.over % 80 < 10 ? 'new' : 'mid';
    return this.balls < f.ppEnd ? 'pp' : this.balls >= f.deathStart ? 'death' : 'mid';
  }
  get day() { return this.test ? Math.floor((this.test.oversBefore + this.over) / 90) + 1 : 1; }

  startOver() {
    const f = this.fmt;
    const idx = this.endIdx;
    const otherEnd = this.ends[1 - idx];
    let b = this.ends[idx];
    const quota = (x) => (f.limited ? f.maxBowl - x.balls : 999);
    const spellMax = (x) => (f.limited ? (f.id === 'ODI' ? 6 : 2) + (x.p.style === 'S' ? 1 : 0) : (x.p.style === 'S' ? 10 : 7));
    if (!b || quota(b) <= 0 || b.spell >= spellMax(b)) {
      let elig = this.bowlers.filter((x) => quota(x) > 0 && x !== otherEnd && x !== b);
      if (!elig.length) elig = this.bowlers.filter((x) => quota(x) > 0 && x !== otherEnd);
      if (!elig.length) elig = this.bowlers.filter((x) => quota(x) > 0);
      if (!elig.length) elig = this.bowlers;
      const ph = this.phaseName;
      b = weightedPick(this.rng, elig, (x) => {
        let w = Math.pow(Math.max(5, x.p.bowl), f.limited ? 4 : 5);
        if (ph === 'pp' && x.p.style === 'P') w *= 1.5;
        if (ph === 'mid' && x.p.style === 'S') w *= 1.35;
        if (ph === 'death' && x.p.style === 'P') w *= 1.5;
        if (f.limited) w *= 0.4 + quota(x) / f.maxBowl;
        if (!f.limited && this.venue.pitch === 'green' && x.p.style === 'P') w *= 1.2;
        if (!f.limited && this.venue.pitch === 'dusty' && x.p.style === 'S') w *= 1.4;
        return w;
      });
      b.spell = 0;
      this.ends[idx] = b;
    }
    this.cur = b; b.spell++; this.ovRuns = 0;
  }

  bowlEff(b) {
    let s = b.p.bowl;
    const pc = this.venue.pitch, st = b.p.style;
    if (pc === 'dusty') s += st === 'S' ? 4 : -2;
    else if (pc === 'green') s += st === 'P' ? 4 : -2;
    else if (pc === 'bouncy') s += st === 'P' ? 3 : -1;
    else if (pc === 'flat') s -= 2;
    if (!this.fmt.limited && st === 'S') s += 1.6 * (this.day - 1);
    return s;
  }

  intent(bt) {
    const f = this.fmt;
    if (f.limited) {
      const ph = this.phaseName;
      let i = f.id === 'ODI' ? (ph === 'pp' ? 1.0 : ph === 'death' ? 1.3 : 0.88) : ph === 'pp' ? 1.08 : ph === 'death' ? 1.28 : 0.93;
      if (ph !== 'death') i *= 1 - 0.025 * Math.max(0, this.wkts - 2);
      else i *= 1 + 0.03 * clamp(7 - this.wkts, -3, 4);
      if (this.target != null) {
        const left = Math.max(1, f.balls - this.balls);
        const ratio = (this.target - this.runs) / left / f.exp;
        i *= ratio >= 1 ? clamp(1 + 0.45 * (ratio - 1), 1, 1.7) : clamp(1 + 0.2 * (ratio - 1), 0.9, 1);
      }
      return { i, wm: 1 };
    }
    // Test
    const t = this.test;
    let i = 0.8 + 0.02 * (this.day - 1), wm = 1;
    const timeLeft = t.timeLeft - this.over;
    if (this.target != null) {
      const need = this.target - this.runs;
      const req = need / Math.max(timeLeft, 1);
      const wl = 10 - this.wkts;
      if (req > 4.3 + 0.1 * wl || (timeLeft < 22 && req > 3.6)) { i = 0.5; wm = 0.6; this.mode = 'defend'; }
      else { i = clamp(req / 3.3, 0.9, 1.7); this.mode = 'chase'; }
    } else if (t.lead != null && t.lead + this.runs > 0 && t.bat2) i = 0.98;
    if (bt.b < 25) i *= 0.85;
    return { i, wm };
  }

  weights(bt, bw) {
    const f = this.fmt, id = f.id;
    const w = { ...BASE[id] };
    const bat = bt.p.bat, bowl = this.bowlEff(bw);
    const sf = clamp(1 + ((bat - bowl) / 100) * (f.limited ? 1.5 : 1.25), 0.35, 2.0);
    const { i, wm } = this.intent(bt);
    const ph = this.phaseName;
    const pm = (PHASE[id] && PHASE[id][ph]) || {};
    w[0] *= Math.pow(sf, -0.55) / Math.pow(i, 0.9) * (pm[0] || 1);
    w[1] *= Math.pow(sf, 0.15) * (i < 1 ? 1.1 : 0.93) * (pm[1] || 1);
    w[2] *= Math.pow(sf, 0.3) * (pm[2] || 1);
    w[3] *= (pm[3] || 1);
    w[4] *= Math.pow(sf, 0.9) * Math.pow(i, 0.9) * (pm[4] || 1);
    w[6] *= Math.pow(sf, 1.25) * Math.pow(i, 1.5) * (pm[6] || 1);
    let W = w.W * Math.pow(sf, -0.9) * Math.pow(i, 1.1) * (pm.W || 1) * wm;
    // new batter is vulnerable
    const settle = f.limited ? 6 : 22;
    if (bt.b < settle) W *= 1 + (f.limited ? 0.3 : 0.4) * (1 - bt.b / settle);
    // venue
    const sz = this.venue.size;
    if (sz === 'S') { w[4] *= 1.08; w[6] *= 1.22; } else if (sz === 'L') { w[4] *= 0.93; w[6] *= 0.8; }
    const pc = this.venue.pitch;
    if (pc === 'flat') { W *= 0.92; w[6] *= 1.08; } else if (pc === 'green') W *= 1.1; else if (pc === 'dusty') W *= 1.04; else if (pc === 'bouncy') W *= 1.06;
    if (!f.limited) {
      W *= 1 + 0.05 * (this.day - 1);
      if (this.phaseName === 'new') W *= 1.25;
      if (this.mode === 'defend') { w[4] *= 0.5; w[6] *= 0.3; }
    }
    if (this.freeHit) { W = 0; w[6] *= 1.25; w[4] *= 1.15; }
    w.W = clamp(W, 0, 0.22);
    return w;
  }

  sample(w) {
    let tot = 0;
    for (const k in w) tot += w[k];
    let r = this.rng() * tot;
    for (const k in w) if ((r -= w[k]) <= 0) return k;
    return '0';
  }

  dismissal(bw, bt) {
    const r = this.rng();
    const style = bw.p.style;
    const f = this.bowl.xi.filter((p) => p !== bw.p && p !== this.keeper);
    const fld = f[Math.floor(this.rng() * f.length)] || this.keeper;
    const pr = style === 'S' ? [0.16, 0.13, 0.46, 0.06, 0.15, 0.04] : [0.21, 0.12, 0.52, 0.11, 0, 0.04];
    // bowled, lbw, caught, caught behind, stumped, run out
    let acc = 0, k = 0;
    for (; k < pr.length; k++) { acc += pr[k]; if (r <= acc) break; }
    const bn = bw.p.name, tn = bt.p.name;
    switch (k) {
      case 0: return { out: `b ${bn}`, t: `${tn} is BOWLED by ${bn}!`, credit: true, bowled: true };
      case 1: return { out: `lbw b ${bn}`, t: `${tn} is trapped LBW by ${bn}!`, credit: true, lbw: true };
      case 2: {
        if (this.rng() < 0.09) return { out: `c & b ${bn}`, t: `${tn} offers a return catch to ${bn}!`, credit: true, fielder: bw.p };
        return { out: `c ${fld.name} b ${bn}`, t: `${tn} is caught by ${fld.name} off ${bn}!`, credit: true, fielder: fld };
      }
      case 3: return { out: `c †${this.keeper.name} b ${bn}`, t: `${tn} edges it and ${this.keeper.name} takes the catch!`, credit: true, fielder: this.keeper };
      case 4: return { out: `st †${this.keeper.name} b ${bn}`, t: `${tn} is STUMPED by ${this.keeper.name}!`, credit: true, fielder: this.keeper };
      default: return { out: `run out (${fld.name})`, t: `${tn} is RUN OUT by ${fld.name}!`, credit: false, fielder: fld };
    }
  }

  log(k, t, bt, bw, extra) {
    const e = { o: `${this.over}.${this.bio}`, k, t, r: this.runs, w: this.wkts, bi: bt.p.id, vi: bw.p.id, ...extra };
    if (k === '4' || k === '6' || k === 'W' || (extra && extra.ms)) e.hl = 1;
    this.comm.push(e);
    return e;
  }

  stepBall() {
    if (this.done) return null;
    if (this.bio === 0 && !this.cur) this.startOver();
    const f = this.fmt, bw = this.cur, bt = this.B[this.striker];
    const ex = EXTRAS[f.id];
    const r = this.rng();
    const bn = LAST(bw.p), tn = LAST(bt.p);
    // wide
    if (r < ex.wd) {
      this.runs++; this.extras++; bw.r++; this.ovRuns++;
      const e = this.log('wd', `${bn} to ${tn}, wide ball`, bt, bw);
      return this.afterBall(e);
    }
    const noBall = r < ex.wd + ex.nb;
    const w = this.weights(bt, bw);
    if (noBall) w.W = 0;
    const k = this.sample(w);
    if (noBall) { this.runs++; this.extras++; bw.r++; this.ovRuns++; }
    let ev;
    if (k === 'W') {
      this.balls++; bw.balls++; bt.b++; this.bio++;
      const d = this.dismissal(bw, bt);
      this.wkts++; bt.out = d.out;
      if (d.credit) bw.w++;
      this.fow.push([this.runs, this.wkts, bt.p.id, `${this.over}.${this.bio}`]);
      ev = this.log('W', `WICKET! ${d.t}`, bt, bw, { how: d.bowled ? 'b' : d.lbw ? 'lbw' : d.out.startsWith('run') ? 'ro' : d.out.startsWith('st') ? 'st' : 'c', fi: d.fielder && d.fielder.id });
      if (this.wkts >= 10) { this.done = true; this.reason = 'allout'; }
      else { this.striker = this.next++; this.B[this.striker].did = true; }
      this.freeHit = false;
    } else {
      const rr = +k;
      this.runs += rr; bt.r += rr; bw.r += rr; this.ovRuns += rr;
      if (!noBall) { this.balls++; bw.balls++; this.bio++; }
      bt.b++;
      if (rr === 4) bt.f++;
      if (rr === 6) bt.s++;
      const lines = {
        0: ['dot ball, defended', 'beaten outside off', 'played back to the bowler', 'good length, kept out', 'solid forward defence'],
        1: ['worked away for a single', 'pushed into the gap for one', 'tapped and run', 'nudged for one'],
        2: ['two runs, good running', 'placed in the gap for a couple'],
        3: ['three runs, superb running!'],
        4: ['FOUR! cracked through the covers', 'FOUR! races away to the rope', 'FOUR! timed to perfection', 'FOUR! pierces the field', 'FOUR! flicked off the pads'],
        6: ['SIX! launched over long-on', 'SIX! smashed into the stands', 'SIX! cleared the rope with ease', 'SIX! picked up over midwicket', 'SIX! what a strike'],
      };
      const arr = lines[rr];
      let txt = `${bn} to ${tn}, ${arr[Math.floor(this.rng() * arr.length)]}`;
      let ms;
      const wasFifty = bt.r - rr < 50 && bt.r >= 50, wasTon = bt.r - rr < 100 && bt.r >= 100;
      if (wasTon) { txt += ` ${tn} reaches a magnificent HUNDRED!`; ms = 100; } else if (wasFifty) { txt += ` FIFTY for ${tn}!`; ms = 50; }
      if (noBall) txt = `NO BALL! ${txt}`;
      ev = this.log(String(rr), txt, bt, bw, { ...(noBall ? { nb: 1 } : {}), ...(ms ? { ms } : {}) });
      if (rr % 2 === 1) [this.striker, this.non] = [this.non, this.striker];
      if (!noBall) this.freeHit = false; else this.freeHit = true;
    }
    return this.afterBall(ev, k === 'W' ? 'W' : 'x');
  }

  afterBall(ev) {
    const f = this.fmt;
    if (this.target != null && this.runs >= this.target) { this.done = true; this.reason = 'target'; }
    if (!this.done && this.balls >= this.maxBalls) { this.done = true; this.reason = this.test ? 'time' : 'overs'; }
    if (!this.done && this.bio >= f.bpo) this.endOver();
    return ev;
  }

  endOver() {
    const bw = this.cur;
    if (this.ovRuns === 0) bw.m++;
    this.over++; this.bio = 0;
    [this.striker, this.non] = [this.non, this.striker];
    this.endIdx = 1 - this.endIdx;
    this.cur = null;
    if (!this.fmt.limited && this.test && this.test.declare && this.test.declare(this)) { this.done = true; this.declared = true; this.reason = 'declared'; }
  }

  run() {
    while (!this.done && this.guard++ < 8000) this.stepBall();
    return this;
  }

  get oversUsed() { return this.over + (this.bio > 0 ? 1 : 0); }

  toJSON(keepComm = true) {
    const hlOnly = !this.fmt.limited;
    return {
      t: this.bat.id, r: this.runs, w: this.wkts, b: this.balls, ex: this.extras, dec: this.declared || undefined,
      bat: this.B.filter((x) => x.did).map((x) => ({ id: x.p.id, r: x.r, b: x.b, f: x.f, s: x.s, o: x.out })),
      dnb: this.B.filter((x) => !x.did).map((x) => x.p.id),
      bowl: this.bowlers.filter((x) => x.balls > 0).map((x) => ({ id: x.p.id, b: x.balls, r: x.r, w: x.w, m: x.m })),
      fow: this.fow,
      comm: keepComm ? (hlOnly ? this.comm.filter((e) => e.hl) : this.comm) : undefined,
    };
  }
}

// ---------------------------------------------------------------- matches
function tossFor(a, b, fmtId, venue, rng) {
  const win = rng() < 0.5 ? a : b;
  let bat;
  if (fmtId === 'TEST') bat = venue.pitch === 'green' ? rng() < 0.45 : rng() < 0.72;
  else if (fmtId === 'ODI') bat = rng() < 0.4;
  else bat = rng() < 0.3;
  return { w: win.id, d: bat ? 'bat' : 'bowl' };
}

function impact(inns, winnerId) {
  const sc = new Map();
  const add = (id, v, team) => { const c = sc.get(id) || { v: 0, team }; c.v += v; sc.set(id, c); };
  for (const inn of inns) {
    const bowlTeam = inn.bowlTeam;
    for (const x of inn.bat) add(x.id, x.r + x.s * 1.5 + x.f * 0.5, inn.t);
    for (const x of inn.bowl) add(x.id, x.w * 24 + Math.max(0, (inn.t === bowlTeam ? 0 : 0)) + Math.max(0, 10 - x.r / Math.max(1, x.b / 6)), bowlTeam);
  }
  const all = [...sc.entries()];
  const pool = winnerId ? all.filter(([, c]) => c.team === winnerId) : all;
  const best = (pool.length ? pool : all).sort((p, q) => q[1].v - p[1].v)[0];
  return best ? { id: best[0], t: best[1].team } : null;
}

export function superOverWinner(a, b, rng) {
  const sa = strengthOf(a), sb = strengthOf(b);
  return rng() < sa / (sa + sb) ? a : b;
}

function limitedMatch(a, b, o) {
  const f = FORMATS[o.fmt];
  const rng = o.rng;
  const toss = o.toss || tossFor(a, b, f.id, o.venue, rng);
  const tw = toss.w === a.id ? a : b, tl = tw === a ? b : a;
  const first = toss.d === 'bat' ? tw : tl, second = first === a ? b : a;
  const i1 = new Innings({ fmt: f, bat: first, bowl: second, rng, venue: o.venue }).run();
  const i2 = new Innings({ fmt: f, bat: second, bowl: first, rng, venue: o.venue, target: i1.runs + 1 }).run();
  return finishLimited(a, b, f, o, toss, first, second, i1, i2);
}

export function finishLimited(a, b, f, o, toss, first, second, i1, i2, rng = o.rng) {
  let winner, text, tie = false;
  if (i2.runs > i1.runs) {
    winner = second;
    const left = f.balls - i2.balls;
    text = `${second.name} won by ${10 - i2.wkts} wicket${10 - i2.wkts === 1 ? '' : 's'}${left > 0 ? ` (${left} ball${left === 1 ? '' : 's'} left)` : ''}`;
  } else if (i2.runs < i1.runs) {
    winner = first;
    text = `${first.name} won by ${i1.runs - i2.runs} run${i1.runs - i2.runs === 1 ? '' : 's'}`;
  } else {
    winner = superOverWinner(first, second, rng); tie = true;
    text = `Match tied. ${winner.name} won the Super Over`;
  }
  const inns = [i1, i2];
  const json = inns.map((i, idx) => ({ ...i.toJSON(o.keepComm !== false), n: idx + 1 }));
  const imp = impact([{ ...json[0], bowlTeam: second.id }, { ...json[1], bowlTeam: first.id }], winner.id);
  return { fmt: f.id, venue: o.venue.id, night: !!o.night, toss, inns: json, winner: winner.id, tie, text, potm: imp, a: a.id, b: b.id, first: first.id };
}

function testMatch(a, b, o) {
  const f = FORMATS.TEST, rng = o.rng, venue = o.venue;
  const lost = rint(rng, 0, 45) + (venue.pitch === 'green' ? 6 : 0);
  const total = 450 - lost;
  const toss = o.toss || tossFor(a, b, 'TEST', venue, rng);
  const tw = toss.w === a.id ? a : b, tl = tw === a ? b : a;
  const t1 = toss.d === 'bat' ? tw : tl, t2 = t1 === a ? b : a;
  let used = 0;
  const res = [];
  const play = (bat, bowl, opts = {}) => {
    const timeLeft = total - used;
    const inn = new Innings({ fmt: f, bat, bowl, rng, venue, target: opts.target ?? null, maxBalls: Math.max(0, timeLeft) * 6,
      test: { oversBefore: used, timeLeft, lead: opts.lead ?? null, bat2: opts.bat2 || false, declare: opts.declare || null } }).run();
    used = Math.min(total, used + inn.oversUsed);
    res.push(inn);
    return inn;
  };
  const decl1 = (inn) => (inn.runs >= 650) || (inn.runs >= 480 && inn.day >= 2 && rng() < 0.03);
  const i1 = play(t1, t2, { declare: decl1 });
  const i2 = play(t2, t1);
  const lead1 = i1.runs - i2.runs;
  const follow = lead1 >= 200 && total - used > 100 && rng() < 0.38;
  const mkDecl = (leadBefore) => (inn) => {
    const lead = leadBefore + inn.runs;
    const rem = total - used - inn.over;
    if (rem <= 0) return false;
    const rpo = (lead + 1) / Math.max(rem - 8, 1);
    return (lead >= 250 && rpo >= 3.6) || (lead >= 450 && rem <= 240) || (lead >= 380 && rem <= 170) || (rem <= 85 && lead >= 130);
  };
  let result;
  const ret = (winner, text, kind) => {
    const json = res.map((i, idx) => ({ ...i.toJSON(o.keepComm !== false), n: idx + 1 }));
    const bowlTeams = res.map((i) => (i.bat === a ? b.id : a.id));
    const imp = impact(json.map((j, idx) => ({ ...j, bowlTeam: bowlTeams[idx] })), winner ? winner.id : null);
    return { fmt: 'TEST', venue: venue.id, night: false, toss, inns: json, winner: winner ? winner.id : null, draw: kind === 'draw', tie: kind === 'tie', text, potm: imp, a: a.id, b: b.id, first: t1.id, overs: used, lost };
  };
  if (follow) {
    const i3 = play(t2, t1, { bat2: false });
    const deficit = i1.runs - i2.runs;
    if (i3.done && i3.reason === 'allout' && i3.runs <= deficit) {
      return ret(t1, `${t1.name} won by an innings and ${deficit - i3.runs} runs`, 'win');
    }
    if (i3.reason === 'time' || total - used <= 0) return ret(null, 'Match drawn', 'draw');
    const target = i2.runs + i3.runs - i1.runs + 1;
    const i4 = play(t1, t2, { target });
    if (i4.runs >= target) return ret(t1, `${t1.name} won by ${10 - i4.wkts} wicket${10 - i4.wkts === 1 ? '' : 's'}`, 'win');
    if (i4.reason === 'allout') {
      if (i4.runs === target - 1) return ret(null, 'Match tied', 'tie');
      return ret(t2, `${t2.name} won by ${target - 1 - i4.runs} runs`, 'win');
    }
    return ret(null, 'Match drawn', 'draw');
  }
  if (total - used <= 0) return ret(null, 'Match drawn', 'draw');
  const i3 = play(t1, t2, { lead: lead1, bat2: true, declare: mkDecl(lead1) });
  if (total - used <= 0) return ret(null, 'Match drawn', 'draw');
  const target = i1.runs + i3.runs - i2.runs + 1;
  const i4 = play(t2, t1, { target });
  if (i4.runs >= target) return ret(t2, `${t2.name} won by ${10 - i4.wkts} wicket${10 - i4.wkts === 1 ? '' : 's'}`, 'win');
  if (i4.reason === 'allout') {
    if (i4.runs === target - 1) return ret(null, 'Match tied', 'tie');
    return ret(t1, `${t1.name} won by ${target - 1 - i4.runs} runs`, 'win');
  }
  return ret(null, 'Match drawn', 'draw');
}

/** Play a full match. a, b: team objects {id,name,col,xi}. o: { fmt, venue, rng, night?, toss?, keepComm? } */
export function playMatch(a, b, o) {
  const f = FORMATS[o.fmt];
  if (!f) throw new Error('Unknown format ' + o.fmt);
  return f.id === 'TEST' ? testMatch(a, b, o) : limitedMatch(a, b, o);
}

export { oversStr };
