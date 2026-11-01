// Builds the whole stadium: outfield, pitch, rope, hoardings, tiered stands with an instanced crowd, floodlights.
import * as THREE from 'three';
import { grassTexture, skyTexture, starsTexture, adTexture, Scoreboard, softDisc } from './textures.js';
import { BOUNDARY, HALF } from '../game/physics.js';

const PITCH_COL = { flat: '#c9ab72', green: '#8aa061', dusty: '#d8bf8a', bouncy: '#b78e5b', balanced: '#c3a56e' };

export function buildStadium(opts = {}) {
  const night = !!opts.night;
  const R = BOUNDARY[opts.size] || BOUNDARY.M;
  const accent = opts.accent || '#4ade80';
  const crowdCols = opts.crowd && opts.crowd.length ? opts.crowd : ['#1f6fe0', '#ffd24a', '#ffffff', '#e23b3b'];
  const low = !!opts.low;
  const root = new THREE.Group();
  const anim = [];

  // sky
  const sky = new THREE.Mesh(new THREE.SphereGeometry(520, 24, 16), new THREE.MeshBasicMaterial({ map: skyTexture(night), side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.rotation.y = Math.PI; root.add(sky);
  if (night) {
    const st = new THREE.Mesh(new THREE.SphereGeometry(510, 24, 16), new THREE.MeshBasicMaterial({ map: starsTexture(), transparent: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    root.add(st);
  }

  // light
  root.add(new THREE.HemisphereLight(night ? 0x8fb4ff : 0xffffff, 0x2d6a3a, night ? 0.55 : 0.95));
  const sun = new THREE.DirectionalLight(night ? 0xbcd4ff : 0xfff2d8, night ? 0.5 : 1.35);
  sun.position.set(-60, 120, 70); root.add(sun);

  // outfield
  const grassTex = grassTexture(night);
  grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping; grassTex.repeat.set(4, 4);
  const field = new THREE.Mesh(new THREE.CircleGeometry(R + 4, 96), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1, metalness: 0 }));
  field.rotation.x = -Math.PI / 2; field.position.z = 0; root.add(field);
  // mowing rings
  const rings = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const a = new THREE.Mesh(new THREE.RingGeometry(R * (i / 9), R * ((i + 1) / 9), 96), new THREE.MeshBasicMaterial({ color: i % 2 ? 0x1e6b36 : 0x2c8a48, transparent: true, opacity: 0.32, depthWrite: false }));
    a.rotation.x = -Math.PI / 2; a.position.y = 0.012; rings.add(a);
  }
  rings.position.z = HALF * 0; root.add(rings);
  const outer = new THREE.Mesh(new THREE.CircleGeometry(R + 120, 48), new THREE.MeshLambertMaterial({ color: night ? 0x0f2e1b : 0x2a6d3c }));
  outer.rotation.x = -Math.PI / 2; outer.position.y = -0.05; root.add(outer);

  // pitch
  const pc = PITCH_COL[opts.pitch] || PITCH_COL.balanced;
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(3.05, 22.8), new THREE.MeshStandardMaterial({ color: pc, roughness: 0.95 }));
  pitch.rotation.x = -Math.PI / 2; pitch.position.y = 0.02; root.add(pitch);
  const line = (w, d, x, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color: 0xf6f6f0 })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.035, z); root.add(m); };
  for (const sz of [-1, 1]) {
    const z = sz * HALF;
    line(2.64, 0.05, 0, z - sz * 1.22); line(2.64, 0.05, 0, z); line(0.05, 1.22, -1.32, z - sz * 0.61); line(0.05, 1.22, 1.32, z - sz * 0.61);
    line(0.05, 2.4, 0, z - sz * 1.22 + 0); // return crease hints
  }
  // stumps
  const stumpMat = new THREE.MeshStandardMaterial({ color: 0xf1e3b8, roughness: 0.6 });
  const stumps = [];
  for (const sz of [-1, 1]) {
    const g = new THREE.Group();
    for (let i = -1; i <= 1; i++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.71, 8), stumpMat); s.position.set(i * 0.1, 0.355, 0); g.add(s); }
    for (const bx of [-0.05, 0.05]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.11, 6), stumpMat); b.rotation.z = Math.PI / 2; b.position.set(bx, 0.72, 0); g.add(b); }
    g.position.set(0, 0, sz * HALF); root.add(g); stumps.push(g);
  }

  // rope + hoardings
  const rope = new THREE.Mesh(new THREE.TorusGeometry(R, 0.14, 8, 160), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  rope.rotation.x = Math.PI / 2; rope.position.y = 0.14; root.add(rope);
  const adTexA = adTexture(accent, 'Cricket Arena'), adTexB = adTexture('#ffd24a', 'Play · Build · Win');
  const N = low ? 36 : 64, seg = (2 * Math.PI * (R + 2.2)) / N;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const m = new THREE.Mesh(new THREE.BoxGeometry(seg * 0.98, 1.0, 0.25), new THREE.MeshBasicMaterial({ map: i % 2 ? adTexA : adTexB }));
    m.position.set(Math.sin(a) * (R + 2.2), 0.55, Math.cos(a) * (R + 2.2)); m.lookAt(0, 0.55, 0); root.add(m);
  }

  // stands: 3 tiers with an instanced crowd
  const standMat = new THREE.MeshStandardMaterial({ color: night ? 0x1b2630 : 0x39495a, roughness: 0.9, side: THREE.DoubleSide });
  const tiers = 3, tierH = 5.2, depth = 9;
  const seatPts = [];
  for (let k = 0; k < tiers; k++) {
    const r0 = R + 5 + k * depth, r1 = r0 + depth, y0 = 1 + k * tierH * 0.95, y1 = y0 + tierH * 0.95;
    const geo = new THREE.CylinderGeometry(r1, r0, y1 - y0, 96, 1, true);
    const m = new THREE.Mesh(geo, standMat); m.position.y = (y0 + y1) / 2; root.add(m);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(r1, 0.5, 6, 96), new THREE.MeshStandardMaterial({ color: night ? 0x25384a : 0x7d8a99, roughness: 0.8 }));
    lip.rotation.x = Math.PI / 2; lip.position.y = y1; root.add(lip);
    // seats rows
    const rows = low ? 3 : 5;
    for (let r = 0; r < rows; r++) {
      const f = (r + 0.5) / rows, rad = r0 + (r1 - r0) * f * 0.92 + 1, y = y0 + (y1 - y0) * f + 0.55;
      const count = Math.floor((2 * Math.PI * rad) / (low ? 1.45 : 1.05));
      for (let i = 0; i < count; i++) if (Math.random() > 0.08) seatPts.push([Math.sin((i / count) * Math.PI * 2) * rad, y, Math.cos((i / count) * Math.PI * 2) * rad, (i / count) * Math.PI * 2]);
    }
  }
  const roofR = R + 5 + tiers * depth;
  const roof = new THREE.Mesh(new THREE.RingGeometry(roofR - 14, roofR + 4, 96), new THREE.MeshStandardMaterial({ color: night ? 0x0e161d : 0x28343f, roughness: 0.7, side: THREE.DoubleSide }));
  roof.rotation.x = -Math.PI / 2; roof.position.y = 1 + tiers * tierH * 0.95 + 4; root.add(roof);

  const cg = new THREE.BoxGeometry(0.62, 1.0, 0.5);
  const crowd = new THREE.InstancedMesh(cg, new THREE.MeshLambertMaterial({ color: 0xffffff }), seatPts.length);
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  const base = [];
  seatPts.forEach((p, i) => {
    m4.makeRotationY(p[3] + Math.PI); m4.setPosition(p[0], p[1], p[2]); crowd.setMatrixAt(i, m4);
    col.set(crowdCols[(Math.random() * crowdCols.length) | 0]); col.offsetHSL(0, 0, (Math.random() - 0.5) * 0.12); crowd.setColorAt(i, col);
    base.push([p[0], p[1], p[2], p[3]]);
  });
  crowd.instanceMatrix.needsUpdate = true; if (crowd.instanceColor) crowd.instanceColor.needsUpdate = true;
  root.add(crowd);
  let cheerT = 0;
  const q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), pos = new THREE.Vector3(), eul = new THREE.Euler();
  anim.push((dt, t) => {
    if (cheerT <= 0) return;
    cheerT -= dt;
    const k = Math.max(0, cheerT) / 1.8;
    for (let i = 0; i < base.length; i += 1) {
      const b = base[i];
      const lift = Math.max(0, Math.sin(t * 9 + b[3] * 14 + i * 0.37)) * 0.55 * k;
      eul.set(0, b[3] + Math.PI, 0); q.setFromEuler(eul);
      pos.set(b[0], b[1] + lift, b[2]);
      m4.compose(pos, q, sc); crowd.setMatrixAt(i, m4);
    }
    crowd.instanceMatrix.needsUpdate = true;
  });

  // floodlight towers
  const towers = [];
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2, rr = roofR + 6;
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.4, 70, 8), new THREE.MeshStandardMaterial({ color: 0x8a96a3, roughness: 0.6, metalness: 0.4 })); pole.position.y = 35; g.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(14, 8, 1.6), new THREE.MeshBasicMaterial({ color: night ? 0xfff6dd : 0xbfc7cf })); head.position.y = 72; g.add(head);
    if (night) {
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDisc('#fff1c4'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
      halo.scale.set(70, 70, 1); halo.position.y = 72; g.add(halo);
    }
    g.position.set(Math.sin(a) * rr, 0, Math.cos(a) * rr); g.lookAt(0, 72, 0); root.add(g); towers.push(g);
    if (night && !low) { const sl = new THREE.SpotLight(0xfff0d0, 22000, 320, 0.7, 0.6, 1.4); sl.position.set(g.position.x, 72, g.position.z); sl.target.position.set(0, 0, 0); root.add(sl); root.add(sl.target); }
  }
  if (night && low) root.add(new THREE.AmbientLight(0x6f8bb0, 0.7));

  // scoreboard + sightscreens
  const board = new Scoreboard(accent);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(26, 9.75), new THREE.MeshBasicMaterial({ map: board.tex, toneMapped: false }));
  screen.position.set(0, 18, -(R + 22)); screen.lookAt(0, 8, 0); root.add(screen);
  for (const sz of [-1, 1]) {
    const ss = new THREE.Mesh(new THREE.BoxGeometry(12, 8, 0.6), new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.9 }));
    ss.position.set(0, 4, sz * (R + 0.8)); root.add(ss);
  }

  // drifting clouds / moths for atmosphere
  const clouds = [];
  if (!night) for (let i = 0; i < 6; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDisc('#ffffff'), transparent: true, opacity: 0.55, depthWrite: false, fog: false })); s.scale.set(140, 50, 1); s.position.set(-300 + i * 120, 150 + (i % 3) * 25, -250 - (i % 2) * 80); root.add(s); clouds.push(s); }
  anim.push((dt) => { for (const c of clouds) { c.position.x += dt * 2; if (c.position.x > 340) c.position.x = -340; } });

  return {
    group: root, R, board, stumps,
    cheer(sec = 1.8) { cheerT = sec; },
    update(dt, t) { for (const f of anim) f(dt, t); },
    dispose() { root.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); } }); },
  };
}
