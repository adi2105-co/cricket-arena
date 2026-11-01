import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useApp, Spinner } from '../ui.jsx';
import { go } from '../App.jsx';

const KIND = { league: ['🏏', 'Franchise league'], tournament: ['🏆', 'Tournament'], career: ['⭐', 'Career'] };

export default function Hub() {
  const { say, user } = useApp();
  const [games, setGames] = useState(null);
  const load = () => api.get('/games').then((r) => setGames(r.games)).catch((e) => say(e.message, true));
  useEffect(() => { load(); }, []);
  const del = async (e, g) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${g.title}"? This cannot be undone.`)) return;
    try { await api.del('/games/' + g.id); load(); } catch (x) { say(x.message, true); }
  };
  return (
    <div className="col" style={{ gap: 28 }}>
      <div>
        <span className="eyebrow">Welcome back, {user.username}</span>
        <h2>What are we playing?</h2>
      </div>
      <div className="grid g4">
        {[['league', '🏏', 'Auction & League', 'Pick a franchise, win the auction, play the season.'], ['tournament', '🏆', 'World Cups & Tournaments', 'T20 / ODI World Cups, Champions Trophy, Asia Cup.'], ['series', '🏺', 'Test & Bilateral Series', 'Ashes-style five-Test battles or quick series.'], ['career', '⭐', 'Career Mode', 'Create your player and climb from club to country.'], ['custom', '🛠️', 'Custom Cup', 'Pick teams, format and structure.'], ['arcade', '🎮', '3D Arcade', 'Nets, run chases and bowling challenges.']].map(([k, ic, t, d]) => (
          <button key={k} className="tile" onClick={() => go(k === 'arcade' ? '/arcade' : '/new/' + k)}>
            <div className="ic">{ic}</div><h3 style={{ marginTop: 8 }}>{t}</h3><div className="small mute">{d}</div>
          </button>
        ))}
      </div>
      <div>
        <h3>Continue where you left off</h3>
        {!games ? <Spinner /> : games.length === 0 ? <div className="card center mute">No saved games yet. Start one above and it will appear here, saved to the cloud.</div> : (
          <div className="grid g3">
            {games.map((g) => {
              const s = g.summary || {};
              const [ic, label] = KIND[g.kind] || ['🏏', ''];
              const pct = (() => { const m = /(\d+)\/(\d+)/.exec(s.progress || ''); return m ? Math.min(100, (+m[1] / +m[2]) * 100) : 0; })();
              return (
                <div key={g.id} className="card save" onClick={() => go('/game/' + g.id)} style={s.accent ? { borderColor: s.accent + '66' } : null}>
                  <div className="row sp"><span className="chip">{ic} {label}</span><span className={'chip ' + (g.status === 'done' ? 'y' : 'g')}>{g.status === 'done' ? 'Finished' : 'In progress'}</span></div>
                  <h3 style={{ marginTop: 12 }}>{s.label || g.title}</h3>
                  <div className="small mute">{s.sub}</div>
                  <div className="bar"><i style={{ width: pct + '%' }} /></div>
                  <div className="row sp" style={{ marginTop: 8 }}><span className="tiny mute">{s.progress} · saved {new Date(g.updated_at).toLocaleDateString()}</span><button className="btn sm red" onClick={(e) => del(e, g)}>Delete</button></div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
