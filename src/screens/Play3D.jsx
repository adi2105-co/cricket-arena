import React, { useCallback, useEffect, useRef, useState } from 'react';

// Playable 3D batting innings. Reports a scorecard when finished.
// props: xi [{id,name,bat,ovr,hand}], balls (limit, null = unlimited), target, wickets, bowl {pace,skill}, venue {night,size,pitch}, kit, onFinish(report), onQuit, title, free
export default function Play3D({ xi, balls: maxBalls, target = null, wickets = 10, bowl = { pace: 60, skill: 70 }, venue = {}, kit, onFinish, onQuit, title, bpo = 6, free = false, difficulty = 1.1, focusId = null }) {
  const box = useRef(null), m3 = useRef(null);
  const S = useRef(null);
  const [hud, setHud] = useState({ runs: 0, wkts: 0, balls: 0, msg: '', striker: '', ns: '', sr: 0, sb: 0, ctx: '' });
  const [call, setCall] = useState(null);
  const [aim, setAim] = useState(0), [loft, setLoft] = useState(false), [fs, setFs] = useState(false), [err, setErr] = useState(''), [done, setDone] = useState(null), [cam, setCam] = useState('bat'), [busy, setBusy] = useState(true);
  const aimRef = useRef(0), loftRef = useRef(false);
  aimRef.current = aim; loftRef.current = loft;

  if (!S.current) S.current = { runs: 0, wkts: 0, balls: 0, ex: 0, rows: xi.map((p) => ({ id: p.id, r: 0, b: 0, f: 0, s: 0, o: null, did: false })), cur: 0, non: 1, next: 2, finished: false, overBalls: 0, bowlerPace: bowl.pace };

  const refresh = useCallback((msg = '') => {
    const s = S.current, st = s.rows[s.cur], nn = s.rows[s.non];
    const left = maxBalls != null ? maxBalls - s.balls : null;
    setHud({ runs: s.runs, wkts: s.wkts, balls: s.balls, msg, striker: xi[s.cur] ? xi[s.cur].name : '', ns: xi[s.non] ? xi[s.non].name : '', sr: st ? st.r : 0, sb: st ? st.b : 0, nsr: nn ? nn.r : 0, nsb: nn ? nn.b : 0, ctx: target != null ? `Need ${Math.max(0, target - s.runs)} off ${left} ball${left === 1 ? '' : 's'}` : left != null ? `${left} balls left` : '' });
  }, [xi, maxBalls, target]);

  const finish = useCallback((why) => {
    const s = S.current; if (s.finished) return; s.finished = true;
    const rows = s.rows.filter((r) => r.did || r === s.rows[s.cur] || r === s.rows[s.non]).filter((r, i, a) => a.indexOf(r) === i);
    const bat = rows.filter((r) => r.did || r.b > 0 || r.o).map(({ did, ...r }) => r);
    const report = { bat: bat.length ? bat : [{ id: xi[0].id, r: 0, b: 0, f: 0, s: 0, o: null }], ex: s.ex, balls: s.balls, runs: s.runs, wkts: s.wkts, won: target != null ? s.runs >= target : null, why };
    setDone(report);
  }, [xi, target]);

  const startNext = useCallback(() => {
    const s = S.current, m = m3.current; if (!m || s.finished) return;
    const p = xi[s.cur]; m.setBatter({ skill: p.bat, power: Math.max(45, p.ovr), hand: p.hand || 'R' });
    const over = Math.floor(s.balls / bpo);
    const prof = { pace: Math.max(25, Math.min(90, bowl.pace + ((over * 17) % 31) - 15)), skill: bowl.skill, style: over % 3 === 2 && !free ? 'S' : 'P' };
    m.setField(maxBalls && s.balls < maxBalls * 0.3 ? 'pp' : maxBalls && s.balls > maxBalls * 0.75 ? 'death' : 'mid');
    m.nextDelivery(prof);
  }, [xi, bowl, bpo, maxBalls, free]);

  useEffect(() => {
    let dead = false, mm;
    import('../three/match3d.js').then(({ Match3D }) => {
      if (dead || !box.current) return;
      try {
        mm = new Match3D(box.current, { night: !!venue.night, size: venue.size || 'M', pitch: venue.pitch || 'balanced', accent: '#4ade80', kitA: kit && kit.a, kitB: kit && kit.b, crowd: kit && kit.crowd }, {
          onContact: (r) => {
            const s = S.current; s.lastRes = r;
            const t = r.kind === 'six' ? 'SIX!' : r.kind === 'four' ? 'FOUR!' : r.out ? 'OUT!' : r.kind === 'wide' ? 'WIDE' : r.runs ? String(r.runs) : 'DOT';
            setCall({ t, k: Math.random(), c: r.kind === 'six' || r.kind === 'four' ? '#ffd24a' : r.out ? '#ff5d6c' : '#e8fff1' });
          },
          onSettled: (r) => {
            const s = S.current, st = s.rows[s.cur]; st.did = true; s.rows[s.non].did = true;
            let msg = r.desc;
            if (r.kind === 'wide') { s.runs += 1; s.ex += 1; }
            else {
              s.balls++; st.b++; s.overBalls++;
              if (r.out) {
                s.wkts++; st.o = r.how === 'bowled' ? 'b ' + 'bowler' : r.how === 'lbw' ? 'lbw b bowler' : r.how === 'caught behind' ? 'c keeper b bowler' : 'c fielder b bowler';
                if (s.wkts >= wickets || s.next >= xi.length || (focusId && st.id === focusId)) { refresh(msg); return finish('allout'); }
                s.cur = s.next++; s.rows[s.cur].did = true;
              } else {
                s.runs += r.runs; st.r += r.runs; if (r.kind === 'four') st.f++; if (r.kind === 'six') st.s++;
                if (r.runs % 2 === 1) { [s.cur, s.non] = [s.non, s.cur]; }
              }
              if (s.overBalls >= bpo) { s.overBalls = 0; [s.cur, s.non] = [s.non, s.cur]; }
            }
            refresh(msg);
            if (target != null && s.runs >= target) return finish('chased');
            if (maxBalls != null && s.balls >= maxBalls) return finish('overs');
            setTimeout(() => !dead && startNext(), r.out ? 900 : 650);
          },
        });
        m3.current = mm; mm.difficulty = difficulty;
        refresh('Ready'); setBusy(false);
        setTimeout(() => !dead && startNext(), 900);
      } catch (e) { console.error(e); setErr('Your browser could not start 3D graphics (WebGL). Try Chrome or Edge, and make sure hardware acceleration is on.'); }
    }).catch((e) => { console.error(e); setErr('Failed to load the 3D engine.'); });
    return () => { dead = true; mm && mm.dispose(); m3.current = null; };
  }, []); // eslint-disable-line

  // controls
  const shoot = useCallback(() => { const m = m3.current; if (m) m.swing(aimRef.current, loftRef.current); }, []);
  useEffect(() => {
    const down = (e) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); shoot(); }
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') setAim((a) => Math.max(-90, a - 12));
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') setAim((a) => Math.min(90, a + 12));
      else if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'KeyL') setLoft((l) => !l);
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') setAim(0);
    };
    window.addEventListener('keydown', down); return () => window.removeEventListener('keydown', down);
  }, [shoot]);
  useEffect(() => { m3.current && m3.current.setAim(aim, loft); }, [aim, loft]);
  useEffect(() => { const m = m3.current; if (m) { m.setCamera(cam); } }, [cam]);
  useEffect(() => { const m = m3.current; if (m) setTimeout(() => m.resize(), 50); }, [fs]);

  if (err) return <div className="card center"><h3>3D unavailable</h3><p className="mute">{err}</p>{onQuit && <button className="btn" onClick={onQuit}>Back</button>}</div>;
  const rr = hud.balls ? ((hud.runs / hud.balls) * bpo).toFixed(1) : '0.0';

  return (
    <div className={'stage' + (fs ? ' fs' : '')}>
      <div ref={box} style={{ position: 'absolute', inset: 0 }} onPointerDown={(e) => { if (e.target.tagName === 'CANVAS') shoot(); }} />
      <div className="hud">
        <div className="pill"><div className="tiny mute">{title || 'Your innings'}</div><div className="score">{hud.runs}/{hud.wkts}</div><div className="tiny mute">{Math.floor(hud.balls / bpo)}.{hud.balls % bpo} ov · RR {rr}</div></div>
        <div className="pill center grow" style={{ maxWidth: 320 }}><div className="small"><b>{hud.striker}</b> {hud.sr}({hud.sb})*</div><div className="tiny mute">{hud.ns} {hud.nsr}({hud.nsb})</div>{hud.ctx && <div className="chip y" style={{ marginTop: 4 }}>{hud.ctx}</div>}</div>
        <div className="col" style={{ gap: 6, alignItems: 'flex-end' }}>
          <button className="btn sm pill" onClick={() => setFs((f) => !f)}>{fs ? 'Exit' : 'Fullscreen'}</button>
          <select className="pill" style={{ width: 'auto', padding: '4px 8px' }} value={cam} onChange={(e) => setCam(e.target.value)}><option value="bat">Behind bat</option><option value="side">Side-on</option><option value="high">Broadcast</option></select>
        </div>
      </div>
      {hud.msg && <div className="tiny" style={{ position: 'absolute', top: 92, left: 0, right: 0, textAlign: 'center', textShadow: '0 2px 8px #000' }}>{hud.msg}</div>}
      {call && <div key={call.k} className="callout" style={{ color: call.c }}>{call.t}</div>}
      {busy && <div className="spin" style={{ position: 'absolute', inset: 0, margin: 'auto' }} />}
      <div className="help">Aim <span className="kbd">A</span> <span className="kbd">D</span> · Loft <span className="kbd">W</span> · Shot <span className="kbd">Space</span><br />Press the shot when the ball reaches the bat</div>
      {!done && (
        <div className="ctrl">
          <div className="aimbar col" style={{ gap: 2 }}>
            <div className="row sp tiny mute"><span>Leg side</span><span>Straight</span><span>Off side</span></div>
            <input type="range" min="-90" max="90" step="2" value={aim} onChange={(e) => setAim(+e.target.value)} aria-label="Shot direction" />
            <button className={'btn sm' + (loft ? ' gold' : '')} onClick={() => setLoft((l) => !l)}>{loft ? 'LOFTED (hit it over the top)' : 'Ground shot'}</button>
          </div>
          <button className={'shot' + (loft ? ' loft' : '')} onPointerDown={(e) => { e.stopPropagation(); shoot(); }}>{loft ? 'LOFT' : 'SHOT'}</button>
        </div>
      )}
      {done && (
        <div className="hammer" style={{ flexDirection: 'column', gap: 8, fontSize: 'clamp(1.4rem,5vw,2.4rem)' }}>
          <div>{done.why === 'chased' ? 'Target chased!' : done.why === 'allout' ? 'All out' : 'Innings complete'}</div>
          <div className="score">{done.runs}/{done.wkts} <span className="small mute">({Math.floor(done.balls / bpo)}.{done.balls % bpo} ov)</span></div>
          <div className="row" style={{ justifyContent: 'center' }}>
            <button className="btn pri big" onClick={() => onFinish && onFinish(done)}>Continue</button>
            {onQuit && <button className="btn" onClick={onQuit}>Leave</button>}
          </div>
        </div>
      )}
      {onQuit && !done && <button className="btn sm" style={{ position: 'absolute', left: 12, top: 110 }} onClick={() => { if (window.confirm('Leave this innings? Progress will be lost.')) onQuit(); }}>Quit</button>}
    </div>
  );
}
