// Low-poly articulated cricketers with procedural animation.
import * as THREE from 'three';

const geoCache = {};
const cyl = (r0, r1, h, seg = 8) => { const k = `c${r0}_${r1}_${h}_${seg}`; return (geoCache[k] ||= new THREE.CylinderGeometry(r0, r1, h, seg)); };
const sph = (r, w = 10, h = 8) => { const k = `s${r}_${w}`; return (geoCache[k] ||= new THREE.SphereGeometry(r, w, h)); };
const boxg = (x, y, z) => { const k = `b${x}_${y}_${z}`; return (geoCache[k] ||= new THREE.BoxGeometry(x, y, z)); };
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0, ...o });

const SKIN = [0xf0c8a0, 0xd9a577, 0xb77a4f, 0x8d5a38, 0x6b4129];

export function createPerson(o = {}) {
  const kit = mat(o.kit || '#1f6fe0'), kit2 = mat(o.kit2 || '#ffd24a'), skin = mat(SKIN[(o.skin ?? 1) % SKIN.length]);
  const white = mat(0xf4f4ee), dark = mat(0x1a1a22), wood = mat(0xd9b779, { roughness: 0.55 });
  const root = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 0.94; root.add(hips);
  const pelvis = new THREE.Mesh(boxg(0.34, 0.18, 0.2), kit2); pelvis.position.y = 0.02; hips.add(pelvis);
  const torso = new THREE.Group(); torso.position.y = 0.06; hips.add(torso);
  const chest = new THREE.Mesh(cyl(0.2, 0.17, 0.58, 10), kit); chest.position.y = 0.3; chest.scale.z = 0.7; torso.add(chest);
  const num = new THREE.Mesh(boxg(0.18, 0.2, 0.01), kit2); num.position.set(0, 0.33, -0.125); torso.add(num);
  const neck = new THREE.Mesh(cyl(0.05, 0.06, 0.08, 6), skin); neck.position.y = 0.62; torso.add(neck);
  const head = new THREE.Group(); head.position.y = 0.73; torso.add(head);
  const face = new THREE.Mesh(sph(0.115), skin); face.scale.set(0.95, 1.1, 1); head.add(face);
  if (o.helmet) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.135, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), kit); h.position.y = 0.025; head.add(h);
    const grille = new THREE.Mesh(boxg(0.17, 0.08, 0.02), dark); grille.position.set(0, -0.03, 0.115); head.add(grille);
  } else {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), o.hat === 'white' ? white : kit); cap.position.y = 0.04; head.add(cap);
    const brim = new THREE.Mesh(boxg(0.14, 0.015, 0.11), o.hat === 'white' ? white : kit); brim.position.set(0, 0.035, 0.1); head.add(brim);
  }
  const limb = (sx, upper, lower, uR, lR, mu, ml, foot) => {
    const j = new THREE.Group(); const u = new THREE.Mesh(cyl(uR, lR, upper), mu); u.position.y = -upper / 2; j.add(u);
    const k = new THREE.Group(); k.position.y = -upper; j.add(k);
    const l = new THREE.Mesh(cyl(lR, lR * 0.8, lower), ml); l.position.y = -lower / 2; k.add(l);
    if (foot) { const f = new THREE.Mesh(boxg(0.1, 0.07, 0.24), dark); f.position.set(0, -lower, 0.05); k.add(f); }
    return { j, k };
  };
  const armL = limb(-1, 0.3, 0.28, 0.05, 0.04, kit, skin), armR = limb(1, 0.3, 0.28, 0.05, 0.04, kit, skin);
  armL.j.position.set(-0.23, 0.55, 0); armR.j.position.set(0.23, 0.55, 0); torso.add(armL.j, armR.j);
  const legL = limb(-1, 0.46, 0.46, 0.085, 0.06, o.pads ? white : kit2, o.pads ? white : kit2, true), legR = limb(1, 0.46, 0.46, 0.085, 0.06, o.pads ? white : kit2, o.pads ? white : kit2, true);
  legL.j.position.set(-0.1, 0, 0); legR.j.position.set(0.1, 0, 0); hips.add(legL.j, legR.j);
  // equipment
  const bat = new THREE.Group();
  if (o.bat) {
    const blade = new THREE.Mesh(boxg(0.11, 0.62, 0.045), wood); blade.position.y = -0.31; bat.add(blade);
    const handle = new THREE.Mesh(cyl(0.017, 0.017, 0.26, 6), dark); handle.position.y = 0.13; bat.add(handle);
    bat.position.set(0, -0.25, -0.18); torso.add(bat);
  }
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 14), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.04; root.add(shadow);

  const P = { root, hips, torso, head, armL, armR, legL, legR, bat, mode: 'idle', t: 0, hand: o.hand === 'L' ? -1 : 1, scale: o.scale || 1 };
  root.scale.setScalar(P.scale);
  P.reset = () => {
    for (const j of [armL.j, armR.j, armL.k, armR.k, legL.j, legR.j, legL.k, legR.k, torso, hips, head]) j.rotation.set(0, 0, 0);
    hips.position.y = 0.94; torso.position.set(0, 0.06, 0);
    bat.rotation.set(0, 0, 0);
  };
  // ------------------------------------------------------------------ poses
  P.stance = (t = 0, h = P.hand) => {
    P.reset();
    root.rotation.y = Math.PI / 2 * h; // side-on, facing the bowler over the front shoulder
    hips.position.y = 0.86 + Math.sin(t * 2.2) * 0.008;
    legL.j.rotation.x = -0.35; legL.k.rotation.x = 0.55; legR.j.rotation.x = -0.35; legR.k.rotation.x = 0.55;
    legL.j.rotation.z = 0.12; legR.j.rotation.z = -0.12;
    torso.rotation.x = 0.28; torso.rotation.y = 0.5 * h; head.rotation.y = 1.07 * h; head.rotation.x = -0.25;
    armL.j.rotation.x = -0.5; armR.j.rotation.x = -0.5; armL.k.rotation.x = -0.9; armR.k.rotation.x = -0.9;
    armL.j.rotation.z = 0.1; armR.j.rotation.z = -0.1;
    bat.rotation.set(0.12 + Math.sin(t * 3) * 0.03, 0, 0); bat.position.set(0, 0.28, 0.42);
  };
  /** progress 0..1 across the swing (backlift -> contact at ~0.55 -> follow through). yaw in degrees, loft bool. */
  P.swing = (u, yawDeg = 0, loft = false, h = P.hand) => {
    P.reset();
    const e = u < 0.5 ? u / 0.5 : 1;               // 0..1 downswing
    const f = u > 0.55 ? (u - 0.55) / 0.45 : 0;      // follow-through
    const ease = e * e * (3 - 2 * e);
    root.rotation.y = Math.PI / 2 * h + (yawDeg * Math.PI) / 180 * 0.25 * h * ease;
    hips.position.y = 0.86 - ease * 0.05;
    legL.j.rotation.x = -0.35 - ease * 0.3; legL.k.rotation.x = 0.55 + ease * 0.25; legR.j.rotation.x = -0.3 + ease * 0.1; legR.k.rotation.x = 0.5;
    torso.rotation.y = (0.5 + ease * 0.6 + f * 0.7) * h; torso.rotation.x = 0.28 - ease * 0.15 - (loft ? f * 0.2 : 0);
    head.rotation.y = (1.07 - ease * 0.55 - f * 0.5) * h; head.rotation.x = -0.25;
    const lift = (1 - ease) * (loft ? 1.5 : 1.0) - f * 0.9;
    armL.j.rotation.x = -0.5 - lift * 0.9 - ease * 0.4; armR.j.rotation.x = -0.5 - lift * 0.9 - ease * 0.4;
    armL.k.rotation.x = -0.8 + ease * 0.5 - f * 0.6; armR.k.rotation.x = -0.8 + ease * 0.5 - f * 0.6;
    bat.position.set(0, 0.3, 0.4);
    bat.rotation.x = (loft ? -0.6 : -0.1) + (1 - ease) * 1.2 - f * (loft ? 2.4 : 1.4);
    bat.rotation.z = (-0.3 + ease * 0.7 + f * 0.5) * h * (loft ? 0.4 : 1);
  };
  P.celebrate = (t, h = 1) => {
    P.reset(); const k = Math.abs(Math.sin(t * 4));
    armL.j.rotation.x = -2.8 - k * 0.2; armR.j.rotation.x = -2.8 - k * 0.2; armL.j.rotation.z = 0.35; armR.j.rotation.z = -0.35;
    hips.position.y = 0.94 + k * 0.05; head.rotation.x = -0.2;
    if (bat) { bat.rotation.x = -1.2; bat.position.set(0.3 * h, 0.5, -0.1); }
  };
  P.walk = (t, speed = 1) => {
    P.reset(); const s = Math.sin(t * 6 * speed), c = Math.cos(t * 6 * speed);
    legL.j.rotation.x = s * 0.5 * speed; legR.j.rotation.x = -s * 0.5 * speed; legL.k.rotation.x = Math.max(0, -s) * 0.7 * speed; legR.k.rotation.x = Math.max(0, s) * 0.7 * speed;
    armL.j.rotation.x = -s * 0.4; armR.j.rotation.x = s * 0.4; armL.k.rotation.x = -0.4; armR.k.rotation.x = -0.4;
    hips.position.y = 0.94 + Math.abs(c) * 0.03; torso.rotation.x = 0.08 * speed;
  };
  P.run = (t) => {
    P.reset(); const s = Math.sin(t * 13), c = Math.cos(t * 13);
    legL.j.rotation.x = s * 1.0; legR.j.rotation.x = -s * 1.0; legL.k.rotation.x = Math.max(0, -s) * 1.5 + 0.2; legR.k.rotation.x = Math.max(0, s) * 1.5 + 0.2;
    armL.j.rotation.x = -s * 0.9; armR.j.rotation.x = s * 0.9; armL.k.rotation.x = -1.1; armR.k.rotation.x = -1.1;
    hips.position.y = 0.92 + Math.abs(c) * 0.05; torso.rotation.x = 0.3;
  };
  P.ready = (t) => {
    P.reset(); hips.position.y = 0.8 + Math.sin(t * 2) * 0.01;
    legL.j.rotation.x = -0.5; legR.j.rotation.x = -0.5; legL.k.rotation.x = 0.8; legR.k.rotation.x = 0.8; legL.j.rotation.z = 0.15; legR.j.rotation.z = -0.15;
    torso.rotation.x = 0.45; armL.j.rotation.x = -0.6; armR.j.rotation.x = -0.6; armL.k.rotation.x = -0.6; armR.k.rotation.x = -0.6; head.rotation.x = -0.35;
  };
  P.catchPose = (t) => { P.ready(t); armL.j.rotation.x = -2.2; armR.j.rotation.x = -2.2; armL.k.rotation.x = -0.2; armR.k.rotation.x = -0.2; };
  P.dive = (u) => { P.reset(); root.rotation.z = -Math.min(1, u * 3) * 1.35; hips.position.y = 0.55; armL.j.rotation.x = -3; armR.j.rotation.x = -3; };
  P.throwArm = (u) => { P.ready(0); armR.j.rotation.x = -3.0 + u * 3.6; armR.k.rotation.x = -0.4; torso.rotation.y = (-0.6 + u * 1.2); };
  /** Bowling action. r: run-up progress 0..1 (feet cycle), d: delivery progress 0..1 (arm circle after r reaches 1). */
  P.bowl = (r, d, t) => {
    P.reset();
    if (d <= 0) {
      const s = Math.sin(t * 15 * (0.6 + r * 0.6)), c = Math.cos(t * 15);
      legL.j.rotation.x = s * 1.1; legR.j.rotation.x = -s * 1.1; legL.k.rotation.x = Math.max(0, -s) * 1.6; legR.k.rotation.x = Math.max(0, s) * 1.6;
      armL.j.rotation.x = -1.4 - s * 0.2; armR.j.rotation.x = -1.4 + s * 0.2; armL.k.rotation.x = -1.3; armR.k.rotation.x = -1.3;
      hips.position.y = 0.93 + Math.abs(c) * 0.05; torso.rotation.x = 0.28;
    } else {
      const k = Math.min(1, d);
      const bound = Math.sin(Math.min(1, k * 1.3) * Math.PI);
      hips.position.y = 0.94 - bound * 0.1 + (k > 0.5 ? (k - 0.5) * -0.1 : 0);
      torso.rotation.x = 0.1 + k * 0.7; torso.rotation.y = (-0.4 + k * 0.8);
      armR.j.rotation.x = -k * Math.PI * 2 - 0.2; armR.k.rotation.x = 0;
      armL.j.rotation.x = -2.2 + k * 2.4; armL.j.rotation.z = -0.5 + k * 0.5; armL.k.rotation.x = -0.4;
      legL.j.rotation.x = -0.9 + k * 0.5; legL.k.rotation.x = 0.5; legR.j.rotation.x = 0.7 - k * 1.2; legR.k.rotation.x = 0.4 + k * 0.7;
    }
  };
  P.keeperPose = (t) => { P.ready(t); hips.position.y = 0.62; legL.j.rotation.x = -1.2; legR.j.rotation.x = -1.2; legL.k.rotation.x = 1.9; legR.k.rotation.x = 1.9; torso.rotation.x = 0.7; armL.j.rotation.x = -1.1; armR.j.rotation.x = -1.1; armL.k.rotation.x = -0.2; armR.k.rotation.x = -0.2; };
  P.stance(0);
  return P;
}
