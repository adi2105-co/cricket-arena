import React, { useEffect, useRef, useState } from 'react';
import { useApp, Dot, Ovr, PlayerRow, money, roleChip } from '../ui.jsx';

export default function AuctionView({ g, act, busy }) {
  const { meta } = useApp();
  const L = meta.leagues.find((l) => l.id === g.leagueId);
  const A = g.auction, P = g.players, me = g.userTeam;
  const [auto, setAuto] = useState(true), [tab, setTab] = useState('squad'), [bump, setBump] = useState(0);
  const cur = A.current, p = cur && P[cur.pid];
  const squad = A.squads[me], purse = A.purse[me];
  const lastBid = useRef(null);
  const team = (id) => L.teams.find((t) => t.id === id);
  const myTop = cur && cur.bidder === me;

  useEffect(() => { if (cur && cur.bid !== lastBid.current) { lastBid.current = cur.bid; setBump((b) => b + 1); } }, [cur && cur.bid]);

  // live auction clock: each tick is one rival decision or the hammer
  useEffect(() => {
    if (!auto || A.status === 'done') return;
    const id = setTimeout(() => act({ action: 'tick', n: 1 }, { quiet: true }), cur ? 700 : 1500);
    return () => clearTimeout(id);
  }, [auto, A.status, A.idx, cur && cur.bid, cur && cur.bidder, cur && cur.pid, A.sold.length, A.unsold.length]);

  const nextAmt = cur ? (cur.bidder === null ? cur.bid : cur.bid + inc(L, cur.bid)) : 0;
  const finish = async () => { await act({ action: 'start_season' }); };
  const slotsLeft = L.squad - squad.length;
  const os = squad.filter((e) => P[e.pid] && !L.loc.includes(P[e.pid].c)).length;

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="row sp"><div><span className="eyebrow">{L.name} auction</span><h2 style={{ margin: 0 }}>{team(me).name}</h2></div>
        <div className="row"><div className="stat"><b style={{ color: 'var(--gold)' }}>{money(L, purse)}</b><span>purse</span></div><div className="stat"><b>{squad.length}/{L.squad}</b><span>squad</span></div><div className="stat"><b>{os}/{L.maxOS}</b><span>overseas</span></div><div className="stat"><b>{A.idx}/{A.queue.length}</b><span>lots</span></div></div></div>

      {A.status === 'done' ? (
        <div className="card center col glow" style={{ gap: 10 }}><h2>Auction complete!</h2><p>Your squad is set: {squad.length} players, {money(L, purse)} unspent. Time to play the season.</p><div><button className="btn pri big" disabled={busy} onClick={finish}>Start the season</button></div></div>
      ) : (
        <div className="grid g2" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))' }}>
          <div className="card lot glow">
            {cur && p ? (<>
              <div className="row" style={{ justifyContent: 'center' }}><Ovr v={p.ovr} /><span className="chip">{p.c}</span><span className="chip g">{roleChip(p)}</span>{!L.loc.includes(p.c) && <span className="chip y">Overseas</span>}</div>
              <div className="lname" style={{ margin: "10px 0" }}>{p.name}</div>
              <div className="row small mute" style={{ justifyContent: 'center' }}><span>Bat {p.bat}</span><span>Bowl {p.bowl}</span><span>{p.hand === 'L' ? 'Left-hand' : 'Right-hand'}</span></div>
              <div key={bump} className={'price bump'}>{money(L, cur.bid)}</div>
              <div className="small" style={{ minHeight: 24 }}>{cur.bidder ? <>Top bid: <b style={{ color: cur.bidder === me ? 'var(--acc)' : 'var(--text)' }}>{cur.bidder === me ? 'YOU' : team(cur.bidder).name}</b></> : 'Base price: no bids yet'}</div>
              <div className="row" style={{ justifyContent: 'center', marginTop: 14 }}>
                <button className="btn pri big" disabled={myTop || busy} onClick={() => act({ action: 'bid' })}>{myTop ? 'You lead' : `Bid ${money(L, nextAmt)}`}</button>
                <button className="btn" disabled={myTop || busy} onClick={() => act({ action: 'skip' })}>Pass</button>
              </div>
            </>) : (
              <div style={{ minHeight: 230, display: 'grid', placeItems: 'center' }}>{A.last ? (A.last.type === 'sold' ? <div><div className="chip g" style={{ fontSize: '1rem' }}>SOLD</div><div className="lname">{P[A.last.pid]?.name}</div><div className="price">{money(L, A.last.price)}</div><div className="small">to {A.last.team === me ? 'YOU' : team(A.last.team).name}</div></div> : <div><div className="chip r" style={{ fontSize: '1rem' }}>UNSOLD</div><div className="lname">{P[A.last.pid]?.name}</div></div>) : <div className="mute">Next lot coming up...</div>}</div>
            )}
            <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}>
              <button className="btn sm" onClick={() => setAuto((a) => !a)}>{auto ? 'Pause' : 'Resume'}</button>
              <button className="btn sm" disabled={busy} onClick={() => act({ action: 'ff' })}>Skip to next star</button>
              <button className="btn sm gold" disabled={busy} onClick={() => { if (window.confirm('Let the AI finish the auction for everyone, including your remaining slots?')) act({ action: 'auto' }); }}>Finish auction</button>
            </div>
            {slotsLeft > 0 && <div className="tiny mute" style={{ marginTop: 10 }}>You still need {slotsLeft} more player{slotsLeft > 1 ? 's' : ''} (minimum 11). Keep {money(L, L.reserve)} spare per empty slot.</div>}
          </div>
          <div className="card">
            <div className="tabs"><button className={'tab' + (tab === 'squad' ? ' on' : '')} onClick={() => setTab('squad')}>My squad</button><button className={'tab' + (tab === 'teams' ? ' on' : '')} onClick={() => setTab('teams')}>Rivals</button><button className={'tab' + (tab === 'next' ? ' on' : '')} onClick={() => setTab('next')}>Up next</button><button className={'tab' + (tab === 'log' ? ' on' : '')} onClick={() => setTab('log')}>Feed</button></div>
            {tab === 'squad' && <div className="plist" style={{ maxHeight: 420, overflow: 'auto' }}>{squad.length ? squad.map((e) => <PlayerRow key={e.pid} p={P[e.pid]} right={<span className="chip y">{money(L, e.price)}</span>} />) : <div className="mute small">No players yet. Place your first bid!</div>}</div>}
            {tab === 'teams' && <table className="tbl"><thead><tr><th>Team</th><th className="n">Squad</th><th className="n">Purse</th></tr></thead><tbody>{L.teams.map((t) => <tr key={t.id} className={t.id === me ? 'me' : ''}><td><Dot c={t.col} /> {t.short}</td><td className="n">{A.squads[t.id].length}</td><td className="n">{money(L, A.purse[t.id])}</td></tr>)}</tbody></table>}
            {tab === 'next' && <div className="plist" style={{ maxHeight: 420, overflow: 'auto' }}>{A.queue.slice(A.idx, A.idx + 14).map((id) => <PlayerRow key={id} p={P[id]} />)}</div>}
            {tab === 'log' && <div className="log">{A.log.map((l, i) => <div key={i}>{l}</div>)}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

const inc = (L, bid) => L.inc.find(([u]) => bid < u)[1];
