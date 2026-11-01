import React, { useState } from 'react';
import { api } from '../api.js';
import { useApp, Dot } from '../ui.jsx';
import { go } from '../App.jsx';

function Team({ t, on, onClick }) { return <button type="button" className={'pick' + (on ? ' on' : '')} onClick={onClick}><Dot c={t.col} c2={t.col2} /><span>{t.name || t.n}</span></button>; }

export default function NewGame({ initial }) {
  const { meta, say } = useApp();
  const [type, setType] = useState(['league', 'tournament', 'series', 'career', 'custom'].includes(initial) ? initial : 'league');
  const [busy, setBusy] = useState(false);
  const create = async (body) => {
    setBusy(true);
    try { const r = await api.post('/games', body); go('/game/' + r.id); } catch (e) { say(e.message, true); setBusy(false); }
  };
  const tabs = [['league', 'Auction & League'], ['tournament', 'Tournament'], ['series', 'Series'], ['custom', 'Custom Cup'], ['career', 'Career']];
  return (
    <div className="col" style={{ gap: 20 }}>
      <h2>New game</h2>
      <div className="tabs">{tabs.map(([k, l]) => <button key={k} className={'tab' + (type === k ? ' on' : '')} onClick={() => setType(k)}>{l}</button>)}</div>
      {type === 'league' && <League meta={meta} busy={busy} create={create} />}
      {type === 'tournament' && <Tournament meta={meta} busy={busy} create={create} />}
      {type === 'series' && <Series meta={meta} busy={busy} create={create} say={say} />}
      {type === 'custom' && <Custom meta={meta} busy={busy} create={create} />}
      {type === 'career' && <Career meta={meta} busy={busy} create={create} />}
    </div>
  );
}

function League({ meta, busy, create }) {
  const [lid, setLid] = useState('ipl'); const [team, setTeam] = useState(null);
  const L = meta.leagues.find((l) => l.id === lid);
  return (
    <div className="col">
      <div className="grid g4">{meta.leagues.map((l) => <button key={l.id} className={'pick' + (l.id === lid ? ' on' : '')} onClick={() => { setLid(l.id); setTeam(null); }}><span style={{ width: 8, alignSelf: 'stretch', borderRadius: 4, background: l.accent }} /><span><b>{l.short}</b><div className="tiny mute">{l.women ? "Women's · " : ''}{l.teams.length} teams · {l.fmt === 'H100' ? '100 balls' : 'T20'}</div></span></button>)}</div>
      <div className="card">
        <h3>{L.name}</h3>
        <p className="small mute">Squad of {L.squad}, up to {L.maxOS} overseas players. Choose your franchise.</p>
        <div className="grid g3">{L.teams.map((t) => <Team key={t.id} t={t} on={team === t.id} onClick={() => setTeam(t.id)} />)}</div>
      </div>
      <div><button className="btn pri big" disabled={!team || busy} onClick={() => create({ type: 'league', leagueId: lid, team })}>{busy ? 'Setting up...' : 'Enter the auction'}</button></div>
    </div>
  );
}

function Tournament({ meta, busy, create }) {
  const [tid, setTid] = useState('t20wc'); const [team, setTeam] = useState(null);
  const T = meta.tournaments.find((t) => t.id === tid);
  const byC = Object.fromEntries(meta.nations.map((n) => [n.c, n]));
  return (
    <div className="col">
      <div className="grid g3">{meta.tournaments.map((t) => <button key={t.id} className={'pick' + (t.id === tid ? ' on' : '')} onClick={() => { setTid(t.id); setTeam(null); }}><span style={{ fontSize: '1.6rem' }}>{t.icon === 'urn' ? '🏺' : t.women ? '🏆' : '🏆'}</span><span><b>{t.short || t.name}</b><div className="tiny mute">{t.fmt} · {t.teams.length} teams</div></span></button>)}</div>
      <div className="card"><h3>{T.name}</h3>{T.blurb && <p className="small mute">{T.blurb}</p>}<div className="tiny mute" style={{ marginBottom: 10 }}>{T.stages.join(' → ')}</div>
        <div className="grid g4">{T.teams.map((c) => <Team key={c} t={byC[c] || { n: c }} on={team === c} onClick={() => setTeam(c)} />)}</div></div>
      <div><button className="btn pri big" disabled={!team || busy} onClick={() => create({ type: 'tournament', templateId: tid, team })}>Lead {team || 'your team'} out</button></div>
    </div>
  );
}

function Series({ meta, busy, create, say }) {
  const [a, setA] = useState('AUS'), [b, setB] = useState('ENG'), [fmt, setFmt] = useState('TEST'), [games, setGames] = useState(5), [women, setWomen] = useState(false), [mine, setMine] = useState('AUS');
  const pool = women ? meta.womenNations : fmt === 'TEST' ? meta.testNations : meta.nations.map((n) => n.c);
  const nm = Object.fromEntries(meta.nations.map((n) => [n.c, n.n]));
  const ok = a !== b && pool.includes(a) && pool.includes(b);
  return (
    <div className="card col">
      <div className="grid g4">
        <div><label>Format</label><select value={fmt} onChange={(e) => setFmt(e.target.value)}><option value="TEST">Test</option><option value="ODI">ODI</option><option value="T20">T20</option></select></div>
        <div><label>Matches</label><select value={games} onChange={(e) => setGames(+e.target.value)}><option value={1}>1</option><option value={3}>3</option><option value={5}>5</option></select></div>
        <div><label>Team A</label><select value={a} onChange={(e) => { setA(e.target.value); setMine(e.target.value); }}>{pool.map((c) => <option key={c} value={c}>{nm[c]}</option>)}</select></div>
        <div><label>Team B</label><select value={b} onChange={(e) => setB(e.target.value)}>{pool.map((c) => <option key={c} value={c}>{nm[c]}</option>)}</select></div>
      </div>
      <div className="row"><label style={{ margin: 0 }}><input type="checkbox" style={{ width: 'auto' }} checked={women} onChange={(e) => { setWomen(e.target.checked); }} /> Women's teams</label>
        <span className="mute small">You captain:</span>
        {[a, b].map((c) => <button key={c} className={'pick' + (mine === c ? ' on' : '')} onClick={() => setMine(c)}>{nm[c]}</button>)}</div>
      <div><button className="btn pri big" disabled={!ok || busy} onClick={() => create({ type: 'series', a, b, fmt, games, women, team: mine })}>{ok ? 'Start series' : 'Pick two different teams'}</button></div>
    </div>
  );
}

function Custom({ meta, busy, create }) {
  const [fmt, setFmt] = useState('T20'), [women, setWomen] = useState(false), [structure, setStructure] = useState('rr_semis'), [sel, setSel] = useState(['IND', 'AUS', 'ENG', 'RSA', 'NZ', 'PAK']), [mine, setMine] = useState('IND'), [name, setName] = useState('My Cup');
  const pool = women ? meta.womenNations : fmt === 'TEST' ? meta.testNations : meta.nations.map((n) => n.c);
  const nm = Object.fromEntries(meta.nations.map((n) => [n.c, n.n]));
  const st = meta.structures.find((s) => s.id === structure);
  const toggle = (c) => setSel((s) => s.includes(c) ? s.filter((x) => x !== c) : [...s, c]);
  const teams = sel.filter((c) => pool.includes(c));
  const bad = !st || teams.length < st.min || teams.length > st.max || (st.only && !st.only.includes(teams.length));
  return (
    <div className="card col">
      <div className="grid g4">
        <div><label>Name</label><input value={name} maxLength={30} onChange={(e) => setName(e.target.value)} /></div>
        <div><label>Format</label><select value={fmt} onChange={(e) => setFmt(e.target.value)}><option>T20</option><option>ODI</option><option value="TEST">Test</option></select></div>
        <div style={{ gridColumn: 'span 2' }}><label>Structure</label><select value={structure} onChange={(e) => setStructure(e.target.value)}>{meta.structures.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
      </div>
      <label style={{ margin: 0 }}><input type="checkbox" style={{ width: 'auto' }} checked={women} onChange={(e) => { setWomen(e.target.checked); setSel([]); }} /> Women's teams</label>
      <div><label>Teams ({teams.length}) {st && <span className="tiny">{st.only ? 'needs ' + st.only.join(' / ') : `${st.min}-${st.max}`}</span>}</label>
        <div className="grid g4">{pool.map((c) => <button key={c} className={'pick' + (teams.includes(c) ? ' on' : '')} onClick={() => toggle(c)}>{nm[c]}</button>)}</div></div>
      <div><label>You captain</label><select value={teams.includes(mine) ? mine : teams[0] || ''} onChange={(e) => setMine(e.target.value)}>{teams.map((c) => <option key={c} value={c}>{nm[c]}</option>)}</select></div>
      <div><button className="btn pri big" disabled={bad || busy} onClick={() => create({ type: 'custom', name, fmt, women, structure, teams, team: teams.includes(mine) ? mine : teams[0] })}>{bad ? 'Adjust the number of teams' : 'Create competition'}</button></div>
    </div>
  );
}

function Career({ meta, busy, create }) {
  const [name, setName] = useState(''), [country, setCountry] = useState('IND'), [preset, setPreset] = useState('opener'), [hand, setHand] = useState('R'), [style, setStyle] = useState('P'), [arm, setArm] = useState('R'), [women, setWomen] = useState(false);
  const [bat, setBat] = useState(7), [bowl, setBowl] = useState(7);
  const P = meta.presets[preset]; const left = 14 - bat - bowl;
  return (
    <div className="card col">
      <div className="grid g3">
        <div><label>Player name</label><input value={name} maxLength={28} onChange={(e) => setName(e.target.value)} placeholder="Your name" /></div>
        <div><label>Country</label><select value={country} onChange={(e) => setCountry(e.target.value)}>{meta.nations.map((n) => <option key={n.c} value={n.c}>{n.n}</option>)}</select></div>
        <div><label>Category</label><select value={women ? 'w' : 'm'} onChange={(e) => setWomen(e.target.value === 'w')}><option value="m">Men's cricket</option><option value="w">Women's cricket</option></select></div>
      </div>
      <div><label>Playing style</label><div className="grid g4">{Object.entries(meta.presets).map(([k, p]) => <button key={k} className={'pick' + (preset === k ? ' on' : '')} onClick={() => setPreset(k)}><span><b>{p.label}</b><div className="tiny mute">Bat {p.bat} · Bowl {p.bowl}</div></span></button>)}</div></div>
      <div className="grid g4">
        <div><label>Batting hand</label><select value={hand} onChange={(e) => setHand(e.target.value)}><option value="R">Right</option><option value="L">Left</option></select></div>
        <div><label>Bowling type</label><select value={style} onChange={(e) => setStyle(e.target.value)}><option value="P">Pace</option><option value="S">Spin</option></select></div>
        <div><label>Bowling arm</label><select value={arm} onChange={(e) => setArm(e.target.value)}><option value="R">Right</option><option value="L">Left</option></select></div>
      </div>
      <div className="card tight"><div className="row sp"><b>Spend 14 attribute points</b><span className={'chip ' + (left < 0 ? 'r' : 'g')}>{left} left</span></div>
        <div className="grid g2" style={{ marginTop: 10 }}>
          <div><label>Batting: {P.bat + bat}</label><input type="range" min="0" max="14" value={bat} onChange={(e) => setBat(+e.target.value)} /></div>
          <div><label>Bowling: {P.bowl + bowl}</label><input type="range" min="0" max="14" value={bowl} onChange={(e) => setBowl(+e.target.value)} /></div>
        </div></div>
      <div><button className="btn pri big" disabled={busy || name.trim().length < 2 || left < 0} onClick={() => create({ type: 'career', name, country, women, preset, hand, style, arm, alloc: { bat, bowl } })}>Begin my career</button></div>
    </div>
  );
}
