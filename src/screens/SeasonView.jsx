import React, { useMemo, useState } from 'react';
import { useApp, Dot, Ovr, PlayerRow, roleChip } from '../ui.jsx';
import Play3D from './Play3D.jsx';
import Scorecard from './Scorecard.jsx';

const FMT = { T20: 'T20', ODI: 'ODI', TEST: 'Test', H100: 'The Hundred' };

function autoXI(squad, P) {
  const ps = squad.map((id) => P[id]).filter(Boolean);
  const chosen = new Set();
  const wk = [...ps].filter((p) => p.role === 'WK').sort((a, b) => b.ovr - a.ovr)[0]; if (wk) chosen.add(wk);
  [...ps].filter((p) => p.role === 'BOWL').sort((a, b) => b.bowl - a.bowl).slice(0, 4).forEach((p) => chosen.add(p));
  [...ps].sort((a, b) => b.ovr - a.ovr).forEach((p) => { if (chosen.size < 11) chosen.add(p); });
  return [...chosen].sort((a, b) => (b.bat + (b.role === 'BAT' ? 2 : 0) - (b.role === 'BOWL' ? 10 : 0)) - (a.bat + (a.role === 'BAT' ? 2 : 0) - (a.role === 'BOWL' ? 10 : 0))).map((p) => p.id);
}

export default function SeasonView({ g, act, busy, id }) {
  const { meta } = useApp();
  const t = g.tour, P = g.players, me = g.userTeam;
  const teams = t.teams, tm = (c) => teams.find((x) => x.id === c) || { id: c, name: c, col: '#888' };
  const squad = g.kind === 'league' ? g.auction.squads[me].map((e) => e.pid) : g.squads[me];
  const [tab, setTab] = useState('fixtures'), [card, setCard] = useState(null);
  const [xi, setXi] = useState(() => g.xi[me] || autoXI(squad, P));
  const fixtures = t.fixtures, nu = fixtures.find((f) => f.id === t.nextUser), nx = fixtures.find((f) => f.id === t.next);
  const stageName = t.stages[t.si] && t.stages[t.si].name;
  const L = g.kind === 'league' ? meta.leagues.find((l) => l.id === g.leagueId) : null;
  const limited = t.fmt !== 'TEST';

  const score = (f) => {
    if (!f.res) return null;
    const r = f.res;
    return r.inns.map((i) => `${tm(i.t).id} ${i.r}/${i.w}`).join(' · ');
  };
  const play = g.play;

  if (play) {
    const players = play.xi.map((i) => P[i]);
    return (
      <div className="col"><div className="res-banner">Your 3D innings. {play.target ? `Chase ${play.target} to win.` : 'Set a total for your bowlers to defend.'} (You {play.toss.w === me ? 'won' : 'lost'} the toss.)</div>
        <Play3D xi={players} balls={play.maxBalls} target={play.target} bpo={play.bpo} venue={{ night: play.night, size: 'M', pitch: 'balanced' }} bowl={{ pace: 62, skill: 72 }} title={`${tm(me).name} v ${play.oppName}`}
          kit={{ a: { kit: tm(me).col, kit2: '#ffffff' }, b: { kit: '#c0392b', kit2: '#f2f2f2' }, crowd: [tm(me).col, '#ffffff', '#ffd24a'] }}
          onQuit={() => act({ action: 'play_cancel' })} onFinish={(report) => act({ action: 'play_finish', report })} /></div>
    );
  }

  const header = (
    <div className="card glow">
      <div className="row sp">
        <div><span className="eyebrow">{FMT[t.fmt]}{L ? ' · ' + L.name : ''}</span><h2 style={{ margin: 0 }}>{t.name}</h2><div className="small mute">You: <b style={{ color: 'var(--text)' }}>{tm(me).name}</b> · {t.done ? 'Complete' : stageName} · {t.progress.played}/{t.progress.total} matches</div></div>
        {t.done && <div className="center"><div style={{ fontSize: '2.4rem' }}>🏆</div><b>{tm(t.champion).name}</b>{t.champion === me && <div className="chip y">YOUR CHAMPIONS</div>}</div>}
      </div>
      {t.seriesResult && <div className="res-banner" style={{ marginTop: 10 }}>{t.seriesResult}</div>}
      {t.userOut && !t.done && <div className="res-banner" style={{ marginTop: 10 }}>Your team is out of the competition. Sim on to see who wins.</div>}
      {!t.done && (
        <div style={{ marginTop: 14 }}>
          {nu ? (
            <div className="card tight" style={{ background: 'rgba(74,222,128,.08)' }}>
              <div className="small mute">Your next match · {nu.n || stageName}</div>
              <div className="row sp"><h3 style={{ margin: 0 }}><Dot c={tm(nu.a).col} /> {tm(nu.a).name} <span className="mute">v</span> <Dot c={tm(nu.b).col} /> {tm(nu.b).name}</h3>
                <div className="row"><button className="btn pri" disabled={busy} onClick={() => act({ action: 'play_next' })}>Sim this match</button>{limited && <button className="btn gold" disabled={busy} onClick={() => act({ action: 'play_start' })}>Play my innings in 3D</button>}</div></div>
            </div>
          ) : (
            <div className="row"><button className="btn pri" disabled={busy} onClick={() => act({ action: 'sim_to_user' })}>Sim to my next match</button></div>
          )}
          <div className="row" style={{ marginTop: 10 }}>
            {!nu && nx && <button className="btn" disabled={busy} onClick={() => act({ action: 'play_next' })}>Play next fixture</button>}
            <button className="btn" disabled={busy} onClick={() => act({ action: 'sim_stage' })}>Sim stage</button>
            <button className="btn" disabled={busy} onClick={() => { if (window.confirm('Sim the whole competition?')) act({ action: 'sim_all' }); }}>Sim everything</button>
          </div>
        </div>
      )}
    </div>
  );

  const stageGroups = t.stages.map((s, i) => ({ s, i, list: fixtures.filter((f) => f.si === i) })).filter((x) => x.list.length);
  const FixRow = ({ f }) => {
    const mine = f.a === me || f.b === me;
    return (
      <div className="prow click" style={mine ? { borderColor: 'rgba(74,222,128,.35)' } : null} onClick={() => f.played && setCard(f.id)}>
        <div className="grow"><div style={{ fontWeight: 600 }}><Dot c={tm(f.a).col} /> {tm(f.a).name} <span className="mute">v</span> <Dot c={tm(f.b).col} /> {tm(f.b).name}</div>
          <div className="tiny mute">{f.n || ''}{f.rd ? ' · R' + f.rd : ''}{f.played ? ' · ' + score(f) : ''}</div></div>
        {f.played ? <span className="chip g">{f.res.text.length > 38 ? f.res.text.slice(0, 36) + '…' : f.res.text}</span> : <span className="chip">{f.id === t.nextUser ? 'Your match' : 'Upcoming'}</span>}
      </div>
    );
  };

  const tabs = [['fixtures', 'Fixtures'], ['table', 'Table'], ['stats', 'Stats'], ['squad', 'Squad & XI']];
  return (
    <div className="col" style={{ gap: 16 }}>
      {header}
      <div className="tabs">{tabs.map(([k, l]) => <button key={k} className={'tab' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'fixtures' && (
        <div className="col">{stageGroups.map(({ s, i, list }) => (
          <div key={i} className="card"><h3>{s.name}</h3>
            <div className="plist">{(i === t.si && !t.done ? [...list.filter((f) => !f.played).slice(0, 12), ...list.filter((f) => f.played).slice(-6).reverse()] : [...list].reverse()).map((f) => <FixRow key={f.id} f={f} />)}</div></div>
        ))}</div>
      )}
      {tab === 'table' && (
        <div className="col">{Object.keys(t.rows).length === 0 ? <div className="card mute center">Knockout format: no table.</div> : Object.entries(t.rows).map(([gid, rows]) => {
          const grp = t.groups.find((x) => String(x.id) === String(gid));
          return (
            <div className="card scroll-x" key={gid}><h3>{grp && grp.name ? grp.name : 'Table'}</h3>
              <table className="tbl"><thead><tr><th>#</th><th>Team</th><th className="n">P</th><th className="n">W</th><th className="n">L</th><th className="n">NR</th><th className="n">Pts</th><th className="n">NRR</th></tr></thead>
                <tbody>{rows.map((r, i) => <tr key={r.id} className={(r.id === me ? 'me ' : '') + (t.qual && t.qual.includes(r.id) ? 'q' : '')}><td>{i + 1}</td><td><Dot c={tm(r.id).col} /> {tm(r.id).name}</td><td className="n">{r.p}</td><td className="n">{r.w}</td><td className="n">{r.l}</td><td className="n">{r.nr}</td><td className="n"><b>{r.pts}</b></td><td className="n">{r.nrr > 0 ? '+' : ''}{(+r.nrr).toFixed(3)}</td></tr>)}</tbody></table></div>
          );
        })}</div>
      )}
      {tab === 'stats' && (
        <div className="grid g3">{[['Most runs', t.leaders.runs, (s) => s.r + ' runs'], ['Most wickets', t.leaders.wickets, (s) => s.w + ' wkts'], ['Most sixes', t.leaders.sixes, (s) => s.s + ' sixes']].map(([title, list, f]) => (
          <div className="card" key={title}><h3>{title}</h3><div className="plist">{list.filter((s) => (title.includes('runs') ? s.r : title.includes('wick') ? s.w : s.s) > 0).map((s) => <div key={s.id} className="prow"><div className="grow"><div style={{ fontWeight: 600 }}>{(P[s.id] && P[s.id].name) || s.id}</div><div className="tiny mute">{s.c} · {s.m} m</div></div><b>{f(s)}</b></div>)}</div></div>
        ))}</div>
      )}
      {tab === 'squad' && <XI squad={squad} P={P} xi={xi} setXi={setXi} act={act} busy={busy} saved={g.xi[me]} onAuto={() => setXi(autoXI(squad, P))} />}
      {card && <Scorecard gameId={id} fxid={card} teams={teams} onClose={() => setCard(null)} />}
    </div>
  );
}

function XI({ squad, P, xi, setXi, act, busy, saved, onAuto }) {
  const toggle = (id) => setXi((x) => (x.includes(id) ? x.filter((i) => i !== id) : x.length < 11 ? [...x, id] : x));
  const mv = (i, d) => setXi((x) => { const a = [...x]; const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; });
  const ok = xi.length === 11 && xi.some((i) => P[i].role === 'WK') && xi.filter((i) => P[i].bowl >= 45).length >= 4;
  return (
    <div className="grid g2">
      <div className="card"><div className="row sp"><h3 style={{ margin: 0 }}>Squad ({squad.length})</h3><span className="tiny mute">Tap to add or remove</span></div>
        <div className="plist" style={{ marginTop: 10, maxHeight: 520, overflow: 'auto' }}>{[...squad].sort((a, b) => P[b].ovr - P[a].ovr).map((i) => <PlayerRow key={i} p={P[i]} sel={xi.includes(i)} onClick={() => toggle(i)} />)}</div></div>
      <div className="card"><div className="row sp"><h3 style={{ margin: 0 }}>Playing XI ({xi.length}/11)</h3><div className="row"><button className="btn sm" onClick={onAuto}>Auto-pick</button><button className="btn sm pri" disabled={!ok || busy} onClick={() => act({ action: 'xi', ids: xi })}>Save XI</button></div></div>
        <div className="tiny mute" style={{ margin: '6px 0' }}>Order = batting order. Needs a wicketkeeper and 4+ bowling options.{saved ? ' Saved XI is in use.' : ' Auto XI is used until you save one.'}</div>
        {!ok && xi.length === 11 && <div className="chip r" style={{ margin: '6px 0' }}>{xi.some((i) => P[i].role === 'WK') ? 'Need at least 4 bowling options' : 'Your XI needs a wicketkeeper (none in this selection)'}</div>}
        <div className="plist">{xi.map((i, k) => <PlayerRow key={i} p={P[i]} sub={'#' + (k + 1)} right={<span className="row" style={{ gap: 4 }}><button className="btn sm" onClick={() => mv(k, -1)}>↑</button><button className="btn sm" onClick={() => mv(k, 1)}>↓</button></span>} />)}</div></div>
    </div>
  );
}
