import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useApp, Spinner, Dot, Ovr, PlayerRow, money, roleChip } from '../ui.jsx';
import { go } from '../App.jsx';
import Play3D from './Play3D.jsx';
import Scorecard from './Scorecard.jsx';
import CareerView from './CareerView.jsx';
import AuctionView from './AuctionView.jsx';
import SeasonView from './SeasonView.jsx';

export default function Game({ id }) {
  const { say } = useApp();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const chain = useRef(Promise.resolve());

  useEffect(() => { api.get('/games/' + id).then(setData).catch((e) => { say(e.message, true); go('/'); }); }, [id]);

  // all state-changing calls are serialised so quick clicks cannot interleave
  const act = useCallback((body, { quiet } = {}) => {
    const run = async () => {
      if (!quiet) setBusy(true);
      try {
        const r = await api.post(`/games/${id}/act`, body);
        setData((d) => ({ ...d, state: r.state }));
        return r;
      } catch (e) { say(e.message, true); return null; } finally { if (!quiet) setBusy(false); }
    };
    const p = chain.current.then(run, run); chain.current = p.catch(() => {}); return p;
  }, [id, say]);

  if (!data) return <Spinner />;
  const g = data.state, props = { g, act, busy, id };
  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="row"><button className="btn sm" onClick={() => go('/')}>← My games</button><span className="chip g">Saved to cloud</span></div>
      {g.kind === 'career' ? <CareerView {...props} />
        : g.kind === 'league' && !g.tour ? <AuctionView {...props} />
        : <SeasonView {...props} />}
    </div>
  );
}
