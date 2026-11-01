import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Spinner } from '../ui.jsx';

export default function Leaderboard() {
  const [mode, setMode] = useState('net'); const [rows, setRows] = useState(null);
  useEffect(() => { setRows(null); api.get('/leaderboard?mode=' + mode).then((r) => setRows(r.rows)).catch(() => setRows([])); }, [mode]);
  return (
    <div className="col"><h2>Leaderboard</h2>
      <div className="tabs">{[['net', 'Net Session'], ['chase', 'Run Chase'], ['bowl', 'Bowling']].map(([k, l]) => <button key={k} className={'tab' + (mode === k ? ' on' : '')} onClick={() => setMode(k)}>{l}</button>)}</div>
      {!rows ? <Spinner /> : !rows.length ? <div className="card center mute">No scores yet. Be the first from the 3D Arcade.</div> : (
        <div className="card"><table className="tbl"><thead><tr><th>#</th><th>Player</th><th className="n">Score</th></tr></thead><tbody>{rows.map((r, i) => <tr key={i}><td>{i + 1}</td><td>{r.username}</td><td className="n"><b>{r.score}</b></td></tr>)}</tbody></table></div>)}
    </div>
  );
}
