import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../ui.jsx';
import { go } from '../App.jsx';
import Play3D from './Play3D.jsx';

const TEAM = [
  ['Arena Opener', 82, 'R'], ['Arena Anchor', 80, 'R'], ['Arena Finisher', 78, 'L'], ['Arena Keeper', 75, 'R'], ['Arena AR', 72, 'R'], ['Arena AR 2', 70, 'L'],
  ['Arena Bowler', 50, 'R'], ['Arena Bowler 2', 45, 'R'], ['Arena Bowler 3', 40, 'R'], ['Arena Bowler 4', 38, 'R'], ['Arena Bowler 5', 35, 'R'],
].map(([name, bat, hand], i) => ({ id: 'a' + i, name, bat, ovr: bat, hand }));

const MODES = {
  net: { name: 'Net Session', icon: '🏏', blurb: '24 balls, 3 lives. Score as many as you can.', balls: 24, wickets: 3, desc: 'Practice your timing against pace and spin.' },
  chase: { name: 'Run Chase', icon: '🎯', blurb: 'Chase 62 off 30 balls with 5 wickets in hand.', balls: 30, wickets: 5, target: 62, desc: 'Beat the clock.' },
  bowl: { name: 'Bowling Challenge', icon: '🎳', blurb: '12 balls. Hit the spot, take wickets, stay tight.', desc: 'Aim with the mouse or finger.' },
};

export default function Arcade({ mode }) {
  const { say } = useApp();
  const [result, setResult] = useState(null);
  const [night, setNight] = useState(true);
  const m = MODES[mode];
  const submit = async (score, meta) => {
    try { await api.post('/scores', { mode, score, meta }); say('Score saved to the leaderboard'); } catch (e) { say(e.message, true); }
  };
  if (!m) return (
    <div className="col" style={{ gap: 20 }}>
      <div><span className="eyebrow">3D Arcade</span><h2>Quick games in the stadium</h2></div>
      <div className="grid g3">{Object.entries(MODES).map(([k, v]) => <button key={k} className="tile" onClick={() => go('/arcade/' + k)}><div className="ic">{v.icon}</div><h3 style={{ marginTop: 8 }}>{v.name}</h3><div className="small mute">{v.blurb}</div></button>)}</div>
      <div className="card small mute">Controls: <span className="kbd">A</span>/<span className="kbd">D</span> aim, <span className="kbd">W</span> loft, <span className="kbd">Space</span> shot. On phones use the slider and the big button. Timing matters most: press as the ball reaches the bat.</div>
    </div>
  );
  if (result) return (
    <div className="card center col" style={{ gap: 14, maxWidth: 480, margin: '40px auto' }}>
      <h2>{m.name}</h2><div className="score">{result.score}</div><div className="mute">{result.line}</div>
      <div className="row" style={{ justifyContent: 'center' }}><button className="btn pri" onClick={() => setResult(null)}>Play again</button><button className="btn" onClick={() => go('/leaderboard')}>Leaderboard</button><button className="btn" onClick={() => go('/arcade')}>Modes</button></div>
    </div>
  );
  const venue = { night, size: 'M', pitch: 'flat' };
  return (
    <div className="col">
      <div className="row sp"><h3 style={{ margin: 0 }}>{m.icon} {m.name}</h3><label style={{ margin: 0 }}><input type="checkbox" style={{ width: 'auto' }} checked={night} onChange={(e) => setNight(e.target.checked)} /> Floodlit night game</label></div>
      {mode === 'bowl'
        ? <Bowl3D venue={venue} onDone={(r) => { setResult(r); submit(r.score, r.meta); }} onQuit={() => go('/arcade')} />
        : <Play3D key={night} xi={TEAM} balls={m.balls} wickets={m.wickets} target={m.target || null} venue={venue} bowl={{ pace: mode === 'chase' ? 70 : 55, skill: 72 }} title={m.name} free
            onQuit={() => go('/arcade')}
            onFinish={(r) => {
              const score = mode === 'net' ? r.runs : Math.min(399, (r.won ? 150 + (m.balls - r.balls) * 6 : 0) + r.runs);
              const line = mode === 'net' ? `${r.runs} runs from ${r.balls} balls` : r.won ? `Chased with ${m.balls - r.balls} balls to spare!` : `Fell ${m.target - r.runs} short`;
              setResult({ score, line }); submit(score, { balls: r.balls, runs: r.runs });
            }} />}
    </div>
  );
}

function Bowl3D({ venue, onDone, onQuit }) {
  const box = useRef(null), m3 = useRef(null), S = useRef({ balls: 0, runs: 0, wkts: 0, dots: 0, busy: false, over: false });
  const [hud, setHud] = useState({ balls: 0, runs: 0, wkts: 0, msg: 'Move to aim, click or tap to bowl', spin: false });
  const [call, setCall] = useState(null), [err, setErr] = useState(''), [spin, setSpin] = useState(false);
  const spinRef = useRef(false); spinRef.current = spin;
  const TOTAL = 12;
  useEffect(() => {
    let dead = false, mm;
    import('../three/match3d.js').then(({ Match3D }) => {
      if (dead || !box.current) return;
      try {
        mm = new Match3D(box.current, { ...venue, accent: '#4ade80' }, {
          onContact: (r) => setCall({ t: r.kind === 'six' ? 'SIX!' : r.kind === 'four' ? 'FOUR' : r.out ? 'WICKET!' : r.runs ? String(r.runs) : 'DOT', k: Math.random(), c: r.out ? '#4ade80' : r.kind === 'six' || r.kind === 'four' ? '#ff5d6c' : '#e8fff1' }),
          onSettled: (r) => {
            const s = S.current; s.busy = false;
            if (r.kind === 'wide') s.runs++; else { s.balls++; s.runs += r.runs; if (r.out) s.wkts++; if (!r.runs && !r.out) s.dots++; }
            setHud((h) => ({ ...h, balls: s.balls, runs: s.runs, wkts: s.wkts, msg: r.desc }));
            if (s.balls >= TOTAL && !s.over) { s.over = true; const score = Math.max(0, Math.min(299, 120 - s.runs * 3 + s.wkts * 35 + s.dots * 4)); onDone({ score, line: `${s.wkts} wickets, ${s.runs} runs, ${s.dots} dots`, meta: { wkts: s.wkts, runs: s.runs } }); }
            else mm.setBatter({ skill: 60 + Math.floor(Math.random() * 25), power: 55 + Math.floor(Math.random() * 35), hand: Math.random() < 0.3 ? 'L' : 'R' });
          },
        });
        m3.current = mm; mm.setCamera('bowl'); mm.setBatter({ skill: 70, power: 70, hand: 'R' });
        mm.showReticle(0, 5.6, true);
      } catch (e) { console.error(e); setErr('Your browser could not start 3D graphics (WebGL).'); }
    }).catch(() => setErr('Failed to load the 3D engine.'));
    return () => { dead = true; mm && mm.dispose(); };
  }, []); // eslint-disable-line

  const aimAt = (x, y) => {
    const m = m3.current; if (!m) return;
    const p = m.groundAt(x, y); if (!p) return;
    const hz = 10.06; const z = Math.min(hz - 0.5, Math.max(hz - 9, p.z)), px = Math.max(-1.1, Math.min(1.1, p.x));
    S.current.aim = { lineX: px, length: hz - z }; m.showReticle(px, z, !S.current.busy);
  };
  const bowl = () => {
    const s = S.current, m = m3.current; if (!m || s.busy || s.over) return;
    const a = s.aim || { lineX: 0, length: 5.6 };
    s.busy = true; m.showReticle(0, 0, false);
    m.bowlDelivery(a.lineX, a.length, { pace: spinRef.current ? 40 : 65, skill: 78, style: spinRef.current ? 'S' : 'P' }, 1.0);
  };
  if (err) return <div className="card center"><h3>3D unavailable</h3><p className="mute">{err}</p><button className="btn" onClick={onQuit}>Back</button></div>;
  return (
    <div className="stage" onPointerMove={(e) => aimAt(e.clientX, e.clientY)} onPointerDown={(e) => { aimAt(e.clientX, e.clientY); if (e.target.tagName === 'CANVAS') bowl(); }}>
      <div ref={box} style={{ position: 'absolute', inset: 0 }} />
      <div className="hud"><div className="pill"><div className="tiny mute">Your spell</div><div className="score">{hud.wkts}/{hud.runs}</div><div className="tiny mute">{hud.balls}/{TOTAL} balls</div></div><div className="pill small">{hud.msg}</div></div>
      {call && <div key={call.k} className="callout" style={{ color: call.c }}>{call.t}</div>}
      <div className="ctrl"><div className="row"><button className={'btn sm' + (!spin ? ' pri' : '')} onClick={() => setSpin(false)}>Pace</button><button className={'btn sm' + (spin ? ' pri' : '')} onClick={() => setSpin(true)}>Spin</button></div><button className="shot" onPointerDown={(e) => { e.stopPropagation(); bowl(); }}>BOWL</button></div>
      <button className="btn sm" style={{ position: 'absolute', left: 12, top: 100 }} onClick={onQuit}>Quit</button>
    </div>
  );
}
