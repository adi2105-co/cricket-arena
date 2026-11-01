import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api.js';
import { Spinner } from './../ui.jsx';

export default function Scorecard({ gameId, fxid, teams, onClose }) {
  const [d, setD] = useState(null); const [tab, setTab] = useState(0); const [v, setV] = useState('card');
  useEffect(() => { api.get(`/games/${gameId}/match/${fxid}`).then(setD).catch(() => setD({ err: 1 })); }, [gameId, fxid]);
  const nm = (id) => { const t = teams.find((x) => x.id === id); return t ? t.name : id; };
  const body = !d ? <Spinner /> : d.err ? <div className="mute">Could not load this match.</div> : (() => {
    const res = d.fixture.res, P = d.players || {}, pn = (id) => (P[id] ? P[id].name : id);
    const inn = res.inns[tab];
    return (
      <>
        <div className="res-banner" style={{ marginBottom: 12 }}>{res.text}{res.potm ? ` · Player of the match: ${pn(res.potm.id)}` : ''}{res.played3d ? ' · played in 3D' : ''}</div>
        <div className="tabs">{res.inns.map((i, k) => <button key={k} className={'tab' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{nm(i.t)} {i.r}/{i.w}</button>)}</div>
        <div className="tabs"><button className={'tab' + (v === 'card' ? ' on' : '')} onClick={() => setV('card')}>Scorecard</button>{inn.comm && inn.comm.length > 0 && <button className={'tab' + (v === 'comm' ? ' on' : '')} onClick={() => setV('comm')}>Commentary</button>}</div>
        {v === 'card' ? (
          <div className="scroll-x">
            <table className="tbl"><thead><tr><th>Batter</th><th /><th className="n">R</th><th className="n">B</th><th className="n">4s</th><th className="n">6s</th><th className="n">SR</th></tr></thead>
              <tbody>{inn.bat.map((b) => <tr key={b.id}><td>{pn(b.id)}</td><td className="mute small">{b.o || 'not out'}</td><td className="n"><b>{b.r}</b></td><td className="n">{b.b}</td><td className="n">{b.f}</td><td className="n">{b.s}</td><td className="n">{b.b ? ((b.r / b.b) * 100).toFixed(0) : '-'}</td></tr>)}
                <tr><td>Extras</td><td /><td className="n">{inn.ex}</td><td colSpan="4" /></tr><tr><td><b>Total</b></td><td /><td className="n"><b>{inn.r}/{inn.w}</b></td><td colSpan="4" className="mute small">{Math.floor(inn.b / 6)}.{inn.b % 6} ov</td></tr></tbody></table>
            {inn.dnb && inn.dnb.length > 0 && <div className="small mute" style={{ margin: '8px 0' }}>Did not bat: {inn.dnb.map(pn).join(', ')}</div>}
            {inn.bowl && inn.bowl.length > 0 && <table className="tbl"><thead><tr><th>Bowler</th><th className="n">O</th><th className="n">M</th><th className="n">R</th><th className="n">W</th><th className="n">Eco</th></tr></thead><tbody>{inn.bowl.map((b) => <tr key={b.id}><td>{pn(b.id)}</td><td className="n">{Math.floor(b.b / 6)}.{b.b % 6}</td><td className="n">{b.m}</td><td className="n">{b.r}</td><td className="n"><b>{b.w}</b></td><td className="n">{b.b ? ((b.r / b.b) * 6).toFixed(1) : '-'}</td></tr>)}</tbody></table>}
            {inn.fow && inn.fow.length > 0 && <div className="small mute" style={{ marginTop: 8 }}>Fall of wickets: {inn.fow.map((f) => `${f[0]}-${f[1]} (${pn(f[2])}, ${f[3]})`).join(', ')}</div>}
          </div>
        ) : (
          <div style={{ maxHeight: 420, overflow: 'auto' }}>{[...inn.comm].reverse().map((c, i) => <div key={i} className="comm"><span className="o">{c.o}.{c.bi ?? ''}</span><span className={'ball ' + (c.w ? 'w' : c.r === 4 ? 'f' : c.r === 6 ? 's' : c.k === 'wd' || c.k === 'nb' ? 'x' : '')}>{c.w ? 'W' : c.k === 'wd' ? 'Wd' : c.r}</span><span>{c.t}</span></div>)}</div>
        )}
      </>
    );
  })();
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,.7)', display: 'grid', placeItems: 'center', padding: 12 }} onClick={onClose}>
      <div className="card" style={{ width: 'min(900px,100%)', maxHeight: '92vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div className="row sp"><h3 style={{ margin: 0 }}>Match centre</h3><button className="btn sm" onClick={onClose}>Close</button></div>{body}
      </div>
    </div>, document.body
  );
}
