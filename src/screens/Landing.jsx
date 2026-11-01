import React, { useEffect, useRef, useState } from 'react';
import { api, setToken } from '../api.js';
import { useReveal } from '../ui.jsx';

function AuthCard({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [u, setU] = useState(''), [p, setP] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const r = await api.post(mode === 'login' ? '/auth/login' : '/auth/register', { username: u, password: p });
      setToken(r.token); onAuth(r.user);
    } catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  return (
    <form className="card glow loginbox" onSubmit={submit}>
      <div className="tabs">
        <button type="button" className={'tab' + (mode === 'login' ? ' on' : '')} onClick={() => { setMode('login'); setErr(''); }}>Sign in</button>
        <button type="button" className={'tab' + (mode === 'register' ? ' on' : '')} onClick={() => { setMode('register'); setErr(''); }}>Create account</button>
      </div>
      <div className="col">
        <div><label htmlFor="un">Username</label><input id="un" autoComplete="username" value={u} onChange={(e) => setU(e.target.value)} placeholder="e.g. aditya_sixes" required minLength={3} maxLength={20} /></div>
        <div><label htmlFor="pw">Password</label><input id="pw" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={p} onChange={(e) => setP(e.target.value)} placeholder="at least 6 characters" required minLength={6} /></div>
        {err && <div className="chip r" role="alert" style={{ borderRadius: 10, padding: '8px 12px' }}>{err}</div>}
        <button className="btn pri big" disabled={busy}>{busy ? 'One moment...' : mode === 'login' ? 'Walk out to bat' : 'Start my career'}</button>
        <div className="tiny mute center">Your games save to the cloud automatically, so you can resume on any device.</div>
      </div>
    </form>
  );
}

const SECTIONS = 7;

export default function Landing({ onAuth }) {
  const root = useRef(null);
  const stage = useRef(null);
  const spring = useRef({ p: 0, v: 0, target: 0, last: performance.now() });
  const [active, setActive] = useState(0);
  const [noGL, setNoGL] = useState(false);
  useReveal(root);

  useEffect(() => {
    const onScroll = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const t = Math.min(1, Math.max(0, window.scrollY / max));
      spring.current.target = t;
      setActive(Math.min(SECTIONS - 1, Math.round(t * (SECTIONS - 1))));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, []);

  useEffect(() => {
    let scene, dead = false;
    // the elastic feel: a spring-damper chases the scroll position and overshoots slightly
    const getProgress = () => {
      const s = spring.current, now = performance.now(), dt = Math.min(0.05, (now - s.last) / 1000); s.last = now;
      const k = 38, damp = 9.5;
      s.v += ((s.target - s.p) * k - s.v * damp) * dt; s.p += s.v * dt;
      return s.p;
    };
    import('../three/landing3d.js').then((m) => { if (!dead && stage.current) { try { scene = m.createLanding(stage.current, getProgress); } catch (e) { console.warn('WebGL unavailable', e); setNoGL(true); } } }).catch(() => setNoGL(true));
    return () => { dead = true; scene && scene.dispose(); };
  }, []);

  return (
    <div className="landing" ref={root}>
      <div className="bgfx" />
      {!noGL && <div className="l3d" ref={stage} aria-hidden="true" />}
      <div className="progress-dots" aria-hidden="true">{Array.from({ length: SECTIONS }, (_, i) => <i key={i} className={i === active ? 'on' : ''} />)}</div>

      <section className="lsec">
        <div className="row sp grow" style={{ alignItems: 'center', gap: 40 }}>
          <div className="lbox" style={{ maxWidth: 640 }}>
            <span className="eyebrow reveal">Cricket Arena</span>
            <h1 className="hero-title reveal d1">Build the squad.<br />Chase the cup.</h1>
            <p className="reveal d2" style={{ fontSize: '1.15rem', maxWidth: 520 }}>A full cricket universe in your browser: franchise auctions, every major league, World Cups, Test series, a career of your own and 3D batting you control ball by ball.</p>
          </div>
          <div className="reveal d3 grow" style={{ display: 'flex', justifyContent: 'center' }}><AuthCard onAuth={onAuth} /></div>
        </div>
        <div className="scrollhint"><i /> scroll</div>
      </section>

      <section className="lsec right">
        <div className="card lbox reveal">
          <span className="eyebrow">What is this?</span>
          <h2>One game. Every way to love cricket.</h2>
          <p>Cricket Arena is a cricket sim you play, not just watch. Run a franchise on auction night, manage a World Cup campaign, or start as a teenager at a local club and fight your way to a national cap. When you want to take control, step into the 3D stadium and face the bowler yourself.</p>
          <div className="row"><span className="chip g">12 leagues</span><span className="chip y">T20 · ODI · Test</span><span className="chip b">PC &amp; phone</span></div>
        </div>
      </section>

      <section className="lsec">
        <div className="card lbox reveal">
          <span className="eyebrow">Auction &amp; leagues</span>
          <h2>Bid like it is crore night.</h2>
          <p>Pick a franchise from the IPL, WPL, BBL, WBBL, PSL, CPL, The Hundred, SA20, ILT20, MLC, LPL or BPL. Real names, real purses, overseas limits and rival owners who bid with their own personalities. Then play the full season through to the playoffs.</p>
          <div className="feat" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div><b>Smart rivals</b><div className="small mute">AI teams chase the roles they need and protect their purse.</div></div>
            <div><b>Your XI, your call</b><div className="small mute">Set the batting order, or let the coach pick.</div></div>
          </div>
        </div>
      </section>

      <section className="lsec right">
        <div className="card lbox reveal">
          <span className="eyebrow">World Cups &amp; series</span>
          <h2>From the group stage to the final.</h2>
          <p>T20 World Cup with a Super 8, the ODI World Cup, Champions Trophy, Asia Cup, both women's World Cups, and five-Test series like the Ashes and the Border-Gavaskar Trophy. Or invent your own cup with any teams and any format.</p>
          <div className="row"><span className="chip">Net run rate</span><span className="chip">Super Over</span><span className="chip">Declarations</span><span className="chip">Follow-on</span></div>
        </div>
      </section>

      <section className="lsec">
        <div className="card lbox reveal">
          <span className="eyebrow">Career mode</span>
          <h2>Create yourself. Earn the cap.</h2>
          <p>Build your player: name, country, role, batting hand and a handful of attribute points. Start at club level, rack up XP match by match, spend points on skills and earn promotion through state cricket, franchise leagues and finally the national side.</p>
        </div>
      </section>

      <section className="lsec right">
        <div className="card lbox reveal">
          <span className="eyebrow">3D gameplay</span>
          <h2>Face the bowler.</h2>
          <p>Time your swing, aim your shot and loft it over the rope in a floodlit stadium with a roaring crowd. Net practice, run chases, bowling challenges and your own innings inside any match you are playing. Keyboard on PC, thumbs on mobile.</p>
        </div>
      </section>

      <section className="lsec mid">
        <div className="lbox wide">
          <span className="eyebrow reveal">Cloud saves</span>
          <h2 className="reveal d1">Close the tab. Come back tomorrow.</h2>
          <p className="reveal d2">Every auction, season and career saves to your account, so you resume exactly where you stopped, on your laptop or your phone.</p>
          <div className="reveal d3" style={{ display: 'flex', justifyContent: 'center' }}><AuthCard onAuth={onAuth} /></div>
        </div>
      </section>
    </div>
  );
}
