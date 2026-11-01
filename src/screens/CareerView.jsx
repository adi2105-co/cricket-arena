import React, { useState } from 'react';
import { useApp } from '../ui.jsx';
import Play3D from './Play3D.jsx';

export default function CareerView({ g, act, busy }) {
  const { meta, say } = useApp();
  const T = meta.tiers[g.tier], p = g.player, played = g.ratings.length, last = g.matches[0];
  const [knock, setKnock] = useState(false);
  const canKnock = last && !last.knocked && last.fmt !== 'TEST' && last.perf.inn > 0 && last.n === g.matchNo;
  const st = g.stats;
  const avg = st.inn - st.no > 0 ? (st.runs / (st.inn - st.no)).toFixed(1) : '-';
  const sr = st.balls ? ((st.runs / st.balls) * 100).toFixed(1) : '-';
  const eco = st.bballs ? ((st.bruns / st.bballs) * 6).toFixed(2) : '-';
  const seasonAvg = g.ratings.length ? (g.ratings.reduce((a, b) => a + b, 0) / g.ratings.length).toFixed(1) : '-';

  if (knock) {
    const mine = { id: p.id, name: p.name, bat: p.bat, ovr: Math.max(p.ovr, 50), hand: p.hand };
    const mates = Array.from({ length: 10 }, (_, i) => ({ id: 'm' + i, name: 'Teammate ' + (i + 1), bat: 45 + T.ovr[0] / 3 | 0, ovr: 50, hand: 'R' }));
    const ent = last.ent || {};
    return (
      <div className="col"><div className="res-banner">Play your own innings from the match vs {last.vs}. {ent.target ? `Chasing ${ent.target}.` : ''} It ends when you are out or after 60 balls. Your real score replaces the simulated one.</div>
        <Play3D xi={[mine, ...mates]} balls={60} target={ent.target && ent.target < 200 ? ent.target : null} focusId={p.id} title={p.name} free venue={{ night: true, size: 'M', pitch: 'balanced' }} bowl={{ pace: 40 + T.ovr[1] / 2, skill: 40 + T.ovr[1] / 2 }}
          onQuit={() => setKnock(false)}
          onFinish={async (r) => { const me = r.bat.find((x) => x.id === p.id) || { r: 0, b: 0 }; await act({ action: 'knock', match: last.n, runs: me.r, balls: me.b, out: !!me.o }); setKnock(false); say(`You made ${me.r} off ${me.b}`); }} /></div>
    );
  }

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="card glow"><div className="row sp"><div><span className="eyebrow">{T.name} · season {g.season} · age {g.age}</span><h2 style={{ margin: 0 }}>{p.name} ★</h2><div className="small mute">{p.c} · {p.role === 'AR' ? 'All-rounder' : p.role === 'WK' ? 'Wicketkeeper-batter' : p.role === 'BOWL' ? 'Bowler' : 'Batter'} · {p.hand === 'L' ? 'Left' : 'Right'}-handed{p.style ? ' · ' + (p.style === 'S' ? 'Spin' : 'Pace') : ''}</div></div>
        <div className="row"><div className="stat"><b>{p.ovr}</b><span>overall</span></div><div className="stat"><b>{p.bat}</b><span>batting</span></div><div className="stat"><b>{p.bowl}</b><span>bowling</span></div><div className="stat"><b style={{ color: 'var(--gold)' }}>{g.points}</b><span>points</span></div></div></div>
        <div className="bar" style={{ height: 6, background: 'rgba(255,255,255,.08)', borderRadius: 6, marginTop: 12, overflow: 'hidden' }}><i style={{ display: 'block', height: '100%', width: (g.xp / 130) * 100 + '%', background: 'linear-gradient(90deg,var(--acc),var(--acc2))' }} /></div>
        <div className="tiny mute">XP to next point: {g.xp}/130</div>
        {g.points > 0 && <div className="row" style={{ marginTop: 10 }}>{['bat', 'bowl'].map((a) => <button key={a} className="btn sm gold" disabled={busy || g.points < g.upgradeCost[a]} onClick={() => act({ action: 'upgrade', attr: a })}>+1 {a === 'bat' ? 'Batting' : 'Bowling'} ({g.upgradeCost[a]} pt)</button>)}</div>}
      </div>
      {g.retired ? <div className="card center"><h3>Career over</h3><p className="mute">{g.player.name} retired after {st.m} matches: {st.runs} runs, {st.w} wickets.</p></div> : (
        <div className="card">
          <div className="row sp"><div><h3 style={{ margin: 0 }}>Season {g.season}: {T.name}</h3><div className="small mute">{played}/{T.matches} matches · season rating {seasonAvg} (need {T.need < 90 ? T.need : '—'} to move up) · {T.fee}</div></div>
            <div className="row">
              {played < T.matches && <button className="btn pri" disabled={busy} onClick={() => act({ action: 'play_next' })}>Play next match</button>}
              {canKnock && <button className="btn gold" onClick={() => setKnock(true)}>Play my innings in 3D</button>}
              {played >= T.matches && <button className="btn pri" disabled={busy} onClick={() => act({ action: 'end_season' })}>Finish season</button>}
              <button className="btn red sm" onClick={() => { if (window.confirm('Retire your player?')) act({ action: 'retire' }); }}>Retire</button></div></div>
          {last && <div className="res-banner" style={{ marginTop: 12 }}>Last match: {last.fmt} vs {last.vs} · <b>{last.result === 'W' ? 'Won' : last.result === 'L' ? 'Lost' : last.result === 'T' ? 'Tied' : 'Draw'}</b> · {last.perf.inn ? `${last.perf.runs}${last.perf.out ? '' : '*'} (${last.perf.balls})` : 'did not bat'}{last.perf.bballs ? ` · ${last.perf.wk}/${last.perf.bruns} (${Math.floor(last.perf.bballs / 6)}.${last.perf.bballs % 6})` : ''} · rating <b>{last.rating}</b> · +{last.xp} XP{last.pom ? ' · ⭐ Player of the match' : ''}</div>}
        </div>)}
      <div className="grid g2">
        <div className="card"><h3>Career stats</h3><table className="tbl"><tbody>
          {[['Matches', st.m], ['Runs', st.runs], ['Average', avg], ['Strike rate', sr], ['High score', st.hs], ['100s', st.h], ['Wickets', st.w], ['Economy', eco], ['Best bowling', st.best], ['Match awards', st.pom], ['Caps T20/ODI/Test', `${g.caps.T20}/${g.caps.ODI}/${g.caps.TEST}`]].map(([k, v]) => <tr key={k}><td className="mute">{k}</td><td className="n"><b>{v}</b></td></tr>)}</tbody></table></div>
        <div className="card"><h3>Career log</h3><div className="log" style={{ maxHeight: 340 }}>{g.log.map((l, i) => <div key={i}>{l}</div>)}</div>
          {g.honours.length > 0 && <><h3 style={{ marginTop: 14 }}>Seasons</h3><table className="tbl"><tbody>{g.honours.slice(0, 8).map((h) => <tr key={h.season}><td>S{h.season} · age {h.age}</td><td>{h.tier}</td><td className="n">{h.avg}</td></tr>)}</tbody></table></>}</div>
      </div>
      <div className="card"><h3>Recent matches</h3><div className="plist">{g.matches.slice(0, 10).map((m) => <div key={m.n} className="prow"><span className={'chip ' + (m.result === 'W' ? 'g' : m.result === 'L' ? 'r' : '')}>{m.result}</span><div className="grow small">{m.fmt} vs {m.vs} <span className="mute">· {m.text}</span></div><span className="small">{m.perf.inn ? `${m.perf.runs}(${m.perf.balls})` : ''} {m.perf.bballs ? `${m.perf.wk}/${m.perf.bruns}` : ''}</span><span className="chip y">{m.rating}</span></div>)}</div></div>
    </div>
  );
}
