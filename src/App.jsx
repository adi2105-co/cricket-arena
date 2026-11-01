import React, { useCallback, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api.js';
import { Ctx, Spinner, useToastState } from './ui.jsx';
import Landing from './screens/Landing.jsx';
import Hub from './screens/Hub.jsx';
import NewGame from './screens/NewGame.jsx';
import Game from './screens/Game.jsx';
import Arcade from './screens/Arcade.jsx';
import Leaderboard from './screens/Leaderboard.jsx';

const useHash = () => {
  const [h, setH] = useState(window.location.hash.slice(1) || '/');
  useEffect(() => { const f = () => { setH(window.location.hash.slice(1) || '/'); window.scrollTo(0, 0); }; window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  return h;
};
export const go = (p) => { window.location.hash = p; };

export default function App() {
  const [user, setUser] = useState(null);
  const [meta, setMeta] = useState(null);
  const [boot, setBoot] = useState(true);
  const [toast, say] = useToastState();
  const hash = useHash();

  useEffect(() => {
    (async () => {
      try { setMeta(await api.get('/meta')); } catch (e) { say(e.message, true); }
      if (getToken()) { try { setUser((await api.get('/me')).user); } catch { setToken(''); } }
      setBoot(false);
    })();
    const out = () => setUser(null);
    window.addEventListener('arena:logout', out);
    return () => window.removeEventListener('arena:logout', out);
  }, []);

  const logout = useCallback(() => { setToken(''); setUser(null); go('/'); }, []);
  if (boot) return <><div className="bgfx" /><Spinner /></>;
  if (!user) return <Ctx.Provider value={{ say }}><Landing onAuth={(u) => { setUser(u); go('/'); }} />{toast && <div key={toast.k} className={'toast' + (toast.err ? ' err' : '')}>{toast.msg}</div>}</Ctx.Provider>;

  const parts = hash.split('/').filter(Boolean);
  let page;
  if (!parts.length) page = <Hub />;
  else if (parts[0] === 'new') page = <NewGame initial={parts[1]} />;
  else if (parts[0] === 'game') page = <Game id={parts[1]} key={parts[1]} />;
  else if (parts[0] === 'arcade') page = <Arcade mode={parts[1]} />;
  else if (parts[0] === 'leaderboard') page = <Leaderboard />;
  else page = <Hub />;

  return (
    <Ctx.Provider value={{ user, meta, say }}>
      <div className="bgfx" />
      <div className="shell">
        <nav className="nav">
          <div className="logo" onClick={() => go('/')}><i />Cricket Arena</div>
          <div className="grow" />
          <a href="#/" className={!parts.length ? 'on' : ''}>My games</a>
          <a href="#/arcade" className={parts[0] === 'arcade' ? 'on' : ''}>3D Arcade</a>
          <a href="#/leaderboard" className={"hide-m" + (parts[0] === "leaderboard" ? " on" : "")}>Leaderboard</a>
          <span className="mute small hide-m">{user.username}</span>
          <button className="lnk" onClick={logout}>Sign out</button>
        </nav>
        <div className="wrap page-in" key={hash}>{page}</div>
      </div>
      {toast && <div key={toast.k} className={'toast' + (toast.err ? ' err' : '')}>{toast.msg}</div>}
    </Ctx.Provider>
  );
}
