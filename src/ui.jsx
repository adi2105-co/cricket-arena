import React, { createContext, useContext, useEffect, useState } from 'react';

export const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export const Spinner = () => <div className="spin" role="status" aria-label="Loading" />;
export const Dot = ({ c, c2 }) => <span className="dot" style={{ background: c || '#888', borderColor: c2 || 'rgba(255,255,255,.6)' }} />;
export const Ovr = ({ v }) => <span className={'ovr ' + (v >= 88 ? 'e' : v < 60 ? 'l' : '')}>{v}</span>;

export function useToastState() {
  const [t, setT] = useState(null);
  useEffect(() => { if (!t) return; const id = setTimeout(() => setT(null), t.err ? 4200 : 2600); return () => clearTimeout(id); }, [t]);
  return [t, (msg, err = false) => setT({ msg, err, k: Math.random() })];
}

export const ROLE_LABEL = { BAT: 'Batter', BOWL: 'Bowler', AR: 'All-rounder', WK: 'Keeper' };
export const roleChip = (p) => p.role === 'WK' ? 'WK' : p.role === 'AR' ? 'AR' : p.role === 'BOWL' ? (p.style === 'S' ? 'SPIN' : 'PACE') : 'BAT';

export function PlayerRow({ p, right, sel, onClick, sub }) {
  if (!p) return null;
  return (
    <div className={'prow' + (sel ? ' sel' : '') + (onClick ? ' click' : '')} onClick={onClick}>
      <Ovr v={p.ovr} />
      <div className="grow">
        <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}{p.custom ? ' ★' : ''}</div>
        <div className="tiny mute">{p.c} · {roleChip(p)}{p.hand === 'L' ? ' · LHB' : ''}{sub ? ' · ' + sub : ''}</div>
      </div>
      {right}
    </div>
  );
}

export const money = (L, v) => {
  if (v == null) return '';
  if (L.unit === 'lakh') return v >= 100 ? `₹${(v / 100).toFixed(v % 100 ? 2 : 0)} Cr` : `₹${v} L`;
  return v >= 1000 ? `${L.cur}${(v / 1000).toFixed(v % 1000 ? 2 : 0)}M` : `${L.cur}${v}k`;
};

export function Empty({ children }) { return <div className="card center mute">{children}</div>; }

export function useReveal(ref) {
  useEffect(() => {
    const root = ref.current; if (!root) return;
    const els = root.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) e.target.classList.add('in'); else if (e.boundingClientRect.top > 0) e.target.classList.remove('in'); }), { threshold: 0.18 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [ref]);
}
