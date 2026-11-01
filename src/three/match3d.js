// 3D match controller: renders the stadium, runs the delivery/shot state machine and drives the camera.
import * as THREE from 'three';
import { buildStadium } from './stadium.js';
import { createPerson } from './people.js';
import { ballTexture } from './textures.js';
import * as PH from '../game/physics.js';

const { HALF, RELEASE_Z } = PH;
const SWING = 0.13, SWING_LEN = 0.26;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

export class Match3D {
  /**
   * opts: { night, size, pitch, accent, crowd[], kitA:{kit,kit2}, kitB:{kit,kit2}, low, seed }
   * cbs:  { onContact(result), onSettled(result), onDelivery(d), onPhase(phase) }
   */
  constructor(container, opts = {}, cbs = {}) {
    this.container = container; this.opts = opts; this.cbs = cbs;
    this.rng = PH.mulberry32(opts.seed || (Math.random() * 1e9) | 0);
    const low = opts.low ?? (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 700);
    this.low = low;
    this.renderer = new THREE.WebGLRenderer({ antialias: !low, powerPreference: 'high-performance', alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1.5 : 2));
    if (THREE.SRGBColorSpace) this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    if (THREE.ACESFilmicToneMapping) { this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = opts.night ? 1.15 : 1.0; }
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none';

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(opts.night ? 0x0a1d33 : 0xcfe5f2, 140, 520);
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 1200);
    this.stadium = buildStadium({ ...opts, low });
    this.R = this.stadium.R;
    this.scene.add(this.stadium.group);

    // ball
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.45 }));
    this.ball.visible = false; this.scene.add(this.ball);
    this.trail = []; this.trailMesh = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
    this.trailMesh.frustumCulled = false; this.scene.add(this.trailMesh);
    this.mark = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.2, 20), new THREE.MeshBasicMaterial({ color: 0xffe66d, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    this.mark.rotation.x = -Math.PI / 2; this.mark.position.y = 0.05; this.scene.add(this.mark);
    this.arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0.08, HALF), 9, 0x7cffb2, 1.4, 0.8);
    this.scene.add(this.arrow);
    this.reticle = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.4, 24), new THREE.MeshBasicMaterial({ color: 0xff5d5d, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    this.reticle.rotation.x = -Math.PI / 2; this.reticle.position.set(0, 0.06, HALF - 5.6); this.reticle.visible = false; this.scene.add(this.reticle);

    // people
    const A = opts.kitA || { kit: '#1f6fe0', kit2: '#ffd24a' }, B = opts.kitB || { kit: '#e23b3b', kit2: '#f2f2f2' };
    this.batter = createPerson({ ...A, helmet: true, pads: true, bat: true, hand: 'R', skin: 1 });
    this.bowler = createPerson({ ...B, skin: 2 });
    this.keeper = createPerson({ ...B, pads: true, skin: 3, hat: 'white' });
    this.umpire = createPerson({ kit: '#161616', kit2: '#161616', skin: 1, hat: 'white' });
    this.nonStriker = createPerson({ ...A, helmet: true, pads: true, bat: true, skin: 4 });
    this.fielders = [];
    for (let i = 0; i < 9; i++) { const f = createPerson({ ...B, skin: (i + 2) % 5, hat: i % 2 ? 'white' : undefined }); this.fielders.push(f); this.scene.add(f.root); }
    [this.batter, this.bowler, this.keeper, this.umpire, this.nonStriker].forEach((p) => this.scene.add(p.root));
    this.setHand('R');
    this.setField('mid');
    this.umpire.root.position.set(1.7, 0, -HALF - 1.5); this.umpire.root.rotation.y = 0; this.umpire.ready(0);
    this.nonStriker.root.position.set(0.9, 0, -HALF + 1.2); this.nonStriker.stance(0, 1); this.nonStriker.root.rotation.y = Math.PI * 0.5;
    this.keeper.root.position.set(0.25, 0, HALF + 7.5); this.keeper.root.rotation.y = Math.PI; this.keeper.keeperPose(0);

    this.t = 0; this.phase = 'idle'; this.pt = 0; this.mode = 'bat';
    this.cam = { pos: new THREE.Vector3(0.8, 4.3, HALF + 22), look: new THREE.Vector3(0, 0.9, -2), fov: 34 };
    this.camTarget = { pos: this.cam.pos.clone(), look: this.cam.look.clone(), fov: 34 };
    this.setCamera('bat', true);
    this.aim = 0; this.loft = false; this.forced = null;
    this.raycaster = new THREE.Raycaster(); this.ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    this._resize = () => this.resize();
    window.addEventListener('resize', this._resize);
    this.ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(this._resize) : null; this.ro && this.ro.observe(container);
    this.resize();
    this.last = performance.now();
    this._loop = (now) => {
      this.raf = requestAnimationFrame(this._loop);
      const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
      this.update(dt);
      this.renderer.render(this.scene, this.camera);
    };
    this.raf = requestAnimationFrame(this._loop);
  }

  resize() {
    const w = this.container.clientWidth || 800, h = this.container.clientHeight || 450;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.portrait = h > w;
  }

  // -------------------------------------------------------------------- setup helpers
  setHand(h) { this.hand = h === 'L' ? -1 : 1; this.batter.hand = this.hand; this.batter.root.position.set(-0.62 * this.hand, 0, HALF - 0.9); }
  setBatter(b) { this.batterInfo = b; this.setHand(b.hand); }
  setBowler(b) { this.bowlerInfo = b; }
  setField(style) {
    this.fieldStyle = style; this.field = PH.fieldFor(style, this.R);
    this.field.forEach((p, i) => { const f = this.fielders[i]; if (f) { f.base = { x: p.x, z: p.z }; f.root.position.set(p.x, 0, p.z); f.root.rotation.y = Math.atan2(-p.x, HALF - p.z); f.move = null; } });
  }
  setScoreboard(s) { this.stadium.board.draw(s); }
  setCamera(kind, snap) {
    this.camKind = kind;
    const c = this.camTarget;
    if (kind === 'bat') { c.pos.set(0.8, this.portrait ? 5.2 : 4.3, HALF + (this.portrait ? 27 : 22)); c.look.set(0, 0.9, -2); c.fov = this.portrait ? 40 : 34; }
    else if (kind === 'bowl') { c.pos.set(0.6, 3.9, -HALF - 19); c.look.set(0, 0.9, 4); c.fov = this.portrait ? 40 : 34; }
    else if (kind === 'side') { c.pos.set(32, 7, 2); c.look.set(0, 1.2, 0); c.fov = 38; }
    else if (kind === 'high') { c.pos.set(0, 46, HALF + 36); c.look.set(0, 0, -4); c.fov = 44; }
    if (snap) { this.cam.pos.copy(c.pos); this.cam.look.copy(c.look); this.cam.fov = c.fov; }
  }
  setPhase(p) { this.phase = p; this.pt = 0; this.cbs.onPhase && this.cbs.onPhase(p); }

  // -------------------------------------------------------------------- game flow
  /** Batting game: bowler runs in and delivers. `profile` = {pace, skill, style} (defaults to current bowler). */
  nextDelivery(profile, aim) {
    if (this.phase !== 'idle') return false;
    this.mode = 'bat'; this.setCamera('bat');
    const bp = profile || this.bowlerInfo || { pace: 60, skill: 70, style: 'P' };
    this.d = PH.makeDelivery(this.rng, bp, aim);
    this.begin();
    return true;
  }
  /** Bowling game: the user chose line/length; a bot batter responds. */
  bowlDelivery(lineX, length, profile, difficulty = 1) {
    if (this.phase !== 'idle') return false;
    this.mode = 'bowl'; this.setCamera('bowl');
    const bp = profile || this.bowlerInfo || { pace: 60, skill: 75, style: 'P' };
    this.d = PH.makeDelivery(this.rng, bp, { lineX, length });
    this.botDifficulty = difficulty;
    const bot = PH.botSwing(this.rng, this.d, this.batterInfo || { skill: 65, power: 65 }, difficulty);
    this.bot = bot;
    this.begin();
    return true;
  }
  /** Highlights/replay mode: play a simulator event (batter swing is scripted). */
  playEvent(ev, hand = 'R') {
    return new Promise((resolve) => {
      if (this.phase !== 'idle') this.reset();
      this.mode = 'view'; this.setCamera('bat'); this.setHand(hand);
      this.d = PH.makeDelivery(this.rng, this.bowlerInfo || { pace: 60, skill: 80, style: 'P' }, { lineX: (this.rng() - 0.5) * 0.3, length: PH.LENGTHS.good });
      this.forced = PH.scriptedResult(ev, this.rng, this.field, this.R);
      this.viewDone = resolve;
      this.begin();
      this.pressT = PH.arrival(this.d).t - SWING; this.pressAim = this.forced.yaw || 0; this.pressLoft = this.forced.kind === 'six';
      if (this.forced.how === 'bowled' || this.forced.how === 'lbw' || this.forced.how === 'stumped') this.pressT = this.d.dur + 0.1;
    });
  }
  begin() {
    this.pressT = null; this.result = null; this.fT = 0; this.forced = this.mode === 'view' ? this.forced : null;
    this.resetStumps(); this.ball.visible = false; this.trail.length = 0; this.mark.material.opacity = 0;
    this.bowler.root.position.set(this.d.x0, 0, -HALF - (this.d.spin ? 6 : 11)); this.bowler.root.rotation.y = 0;
    this.batter.root.position.set(-0.62 * this.hand, 0, HALF - 0.9);
    this.runDur = this.d.spin ? 1.0 : 1.55;
    this.setPhase('runup');
    this.cbs.onDelivery && this.cbs.onDelivery(this.d);
  }
  /** Player presses SHOT. aim in degrees (off side +), loft bool. */
  swing(aim = this.aim, loft = this.loft) {
    if (this.phase !== 'flight' || this.pressT != null || this.mode !== 'bat') return false;
    this.pressT = this.fT; this.pressAim = aim; this.pressLoft = !!loft;
    return true;
  }
  setAim(a, loft) { this.aim = PH.clamp(a, -95, 95); if (loft !== undefined) this.loft = !!loft; }
  /** Convert a screen point to a pitch point (for the bowling reticle). */
  groundAt(clientX, clientY) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -(((clientY - r.top) / r.height) * 2 - 1));
    this.raycaster.setFromCamera(v, this.camera);
    const p = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.ground, p) ? p : null;
  }
  showReticle(x, z, on = true) { this.reticle.visible = on; this.reticle.position.set(x, 0.06, z); }
  reset() { this.phase = 'idle'; this.pt = 0; this.ball.visible = false; this.resetStumps(); this.fielders.forEach((f) => { if (f.base) { f.root.position.set(f.base.x, 0, f.base.z); f.move = null; f.root.rotation.z = 0; } }); this.viewDone = null; }

  resetStumps() { for (const s of this.stadium.stumps) { s.rotation.set(0, 0, 0); s.children.forEach((c, i) => { c.rotation.z = c.userData.rz ?? c.rotation.z; }); s.userData.down = false; } }
  knockStumps() { const s = this.stadium.stumps[1]; s.userData.down = true; s.userData.dt = 0; }

  finishContact(res) {
    this.result = res; this.hitT = 0; this.setPhase('hit');
    if (res.traj && res.traj.length) this.trailBase = res.traj[0];
    this.ball.visible = true;
    res.fieldMoves.forEach((m) => { const f = this.fielders[m.i]; if (f) f.move = { from: { x: f.root.position.x, z: f.root.position.z }, to: m.to, dur: Math.max(0.5, m.t), t0: 0 }; });
    if (res.how === 'bowled' || res.how === 'lbw') this.knockStumps();
    if (res.kind === 'six' || res.kind === 'four') this.stadium.cheer(res.kind === 'six' ? 2.6 : 1.8);
    if (res.out) this.stadium.cheer(1.2);
    // camera reaction
    if (res.shot && res.shot.air && (res.kind === 'six' || res.kind === 'wicket')) { this.camTarget.pos.set(0.8 * -this.hand, 11, HALF + 32); this.camTarget.fov = 44; }
    else if (res.kind === 'four') { this.camTarget.pos.set(0.8, 6.5, HALF + 28); this.camTarget.fov = 40; }
    this.cbs.onContact && this.cbs.onContact(res);
  }

  update(dt) {
    this.t += dt; this.pt += dt;
    this.stadium.update(dt, this.t);
    const t = this.t;
    // players idle
    if (this.phase === 'idle' || this.phase === 'runup' || this.phase === 'flight') {
      if (this.mode !== 'bowl' || this.phase !== 'flight') this.batter.stance(t, this.hand);
    }
    this.fielders.forEach((f) => { if (!f.move) { f.ready(t + f.root.position.x); } });
    this.keeper.keeperPose(t);

    switch (this.phase) {
      case 'idle':
        this.bowler.root.position.set(this.d ? this.d.x0 : 0, 0, -HALF - 6); this.bowler.root.rotation.y = 0; this.bowler.walk(t, 0.5);
        break;
      case 'runup': {
        const k = Math.min(1, this.pt / this.runDur);
        const z0 = -HALF - (this.d.spin ? 6 : 11), z1 = -HALF - 0.4;
        this.bowler.root.position.z = z0 + (z1 - z0) * (k * (2 - k) * 0.6 + k * 0.4);
        this.bowler.bowl(k, 0, t);
        if (k >= 1) { this.setPhase('flight'); this.fT = 0; this.ball.visible = true; }
        break;
      }
      case 'flight': {
        this.fT += dt;
        const d = this.d;
        // bowler delivery action + follow-through
        const act = Math.min(1, 0.3 + this.fT * 1.8);
        this.bowler.bowl(1, act, t);
        this.bowler.root.position.z = Math.min(-HALF + 3.2, this.bowler.root.position.z + dt * (d.spin ? 2.2 : 4.2));
        const p = PH.deliveryAt(d, this.fT);
        if (this.fT < 0.04) { const a = this.bowler.root.position; this.ball.position.set(a.x, 2.0, a.z + 0.2); } else this.ball.position.set(p.x, p.y, p.z);
        this.pushTrail(this.ball.position);
        if (p.bounced && !this.markShown) { this.markShown = true; this.mark.position.set(p.x, 0.05, p.z); this.mark.material.opacity = 0.9; }
        if (!p.bounced) this.markShown = false;
        this.mark.material.opacity = Math.max(0, this.mark.material.opacity - dt * 0.35);
        if (this.mode === 'bowl' && this.bot && this.pressT == null && this.bot.pressT != null && this.fT >= this.bot.pressT) { this.pressT = this.fT; this.pressAim = this.bot.aim; this.pressLoft = this.bot.loft; }
        // batter swing animation
        if (this.pressT != null) {
          const u = Math.min(1, (this.fT - this.pressT) / SWING_LEN);
          this.batter.swing(u, this.pressAim, this.pressLoft, this.hand);
          if (this.fT >= this.pressT + SWING) this.contact(false);
        } else if (this.fT > d.dur + 0.1) this.contact(true);
        break;
      }
      case 'hit': {
        this.hitT += dt;
        const r = this.result;
        const u = r.traj;
        const idx = Math.min(u.length - 1, Math.floor(this.hitT * 30));
        const a = u[idx], b = u[Math.min(u.length - 1, idx + 1)], f = this.hitT * 30 - idx;
        const px = a.x + (b.x - a.x) * f, py = a.y + (b.y - a.y) * f, pz = a.z + (b.z - a.z) * f;
        this.ball.position.set(px, py, pz);
        this.pushTrail(this.ball.position);
        if (this.pressT != null) { const uu = Math.min(1, (this.fT + this.hitT - this.pressT) / SWING_LEN); this.batter.swing(uu, this.pressAim, this.pressLoft, this.hand); }
        // fielders chase
        this.fielders.forEach((fl) => {
          if (!fl.move) return;
          const m = fl.move; m.t0 += dt; const k = Math.min(1, m.t0 / m.dur);
          fl.root.position.set(m.from.x + (m.to.x - m.from.x) * k, 0, m.from.z + (m.to.z - m.from.z) * k);
          const dx = m.to.x - m.from.x, dz = m.to.z - m.from.z;
          if (Math.hypot(dx, dz) > 0.5) fl.root.rotation.y = Math.atan2(dx, dz);
          if (k < 1) fl.run(t); else if (r.how === 'caught' && r.catcher != null && this.fielders[r.catcher] === fl) fl.catchPose(t); else fl.ready(t);
        });
        // camera follows the ball
        this.camTarget.look.set(px, Math.max(0.8, py * 0.7), pz);
        if (this.hitT * 30 >= u.length - 1 && this.hitT > 0.4) {
          if (r.out || r.kind === 'six' || r.kind === 'four') this.celebrate(r);
          this.setPhase('settle');
        }
        if (this.stadium.stumps[1].userData.down) this.animateStumps(dt);
        break;
      }
      case 'settle': {
        this.animateStumps(dt);
        const r = this.result;
        if (r.out && r.how !== 'caught') this.bowler.celebrate(t); else if (r.out) this.bowler.celebrate(t);
        if (r.kind === 'six' || r.kind === 'four') this.batter.celebrate(t, this.hand);
        if (this.pt > (r.out ? 2.0 : r.kind === 'six' || r.kind === 'four' ? 1.7 : 1.0)) this.finishBall();
        break;
      }
    }
    // arrow + camera
    this.arrow.visible = this.mode === 'bat' && (this.phase === 'idle' || this.phase === 'runup' || this.phase === 'flight') && this.pressT == null;
    if (this.arrow.visible) {
      const a = (this.aim * this.hand * Math.PI) / 180;
      const dir = new THREE.Vector3(Math.sin(a), 0, -Math.cos(a)); this.arrow.setDirection(dir);
      this.arrow.position.set(-0.62 * this.hand, 0.09, HALF - 1.0);
      this.arrow.setColor(this.loft ? 0xffd24a : 0x7cffb2);
    }
    const k = this.phase === 'hit' ? 4.2 : 3.0;
    this.cam.pos.x = damp(this.cam.pos.x, this.camTarget.pos.x, 2.4, dt); this.cam.pos.y = damp(this.cam.pos.y, this.camTarget.pos.y, 2.4, dt); this.cam.pos.z = damp(this.cam.pos.z, this.camTarget.pos.z, 2.4, dt);
    this.cam.look.x = damp(this.cam.look.x, this.camTarget.look.x, k, dt); this.cam.look.y = damp(this.cam.look.y, this.camTarget.look.y, k, dt); this.cam.look.z = damp(this.cam.look.z, this.camTarget.look.z, k, dt);
    this.cam.fov = damp(this.cam.fov, this.camTarget.fov, 2.5, dt);
    if (Math.abs(this.camera.fov - this.cam.fov) > 0.01) { this.camera.fov = this.cam.fov; this.camera.updateProjectionMatrix(); }
    this.camera.position.copy(this.cam.pos); this.camera.lookAt(this.cam.look);
  }

  pushTrail(p) {
    this.trail.push(p.x, p.y, p.z); if (this.trail.length > 3 * 22) this.trail.splice(0, 3);
    const g = this.trailMesh.geometry; g.setAttribute('position', new THREE.Float32BufferAttribute(this.trail, 3)); g.computeBoundingSphere();
  }

  contact(missed) {
    let res;
    if (this.forced) res = this.forced;
    else if (this.mode === 'bowl') res = PH.resolveShot({ d: this.d, pressT: this.pressT, aim: this.pressAim, loft: this.pressLoft, bat: this.batterInfo || { skill: 65, power: 65, hand: 'R' }, field: this.field, R: this.R, rng: this.rng, difficulty: this.botDifficulty || 1 });
    else res = PH.resolveShot({ d: this.d, pressT: this.pressT, aim: this.pressAim, loft: this.pressLoft, bat: this.batterInfo || { skill: 70, power: 70, hand: this.hand > 0 ? 'R' : 'L' }, field: this.field, R: this.R, rng: this.rng, difficulty: this.difficulty || 1.1 });
    this.finishContact(res);
  }

  celebrate() { this.stadium.cheer(2); }

  animateStumps(dt) {
    const s = this.stadium.stumps[1]; if (!s.userData.down) return;
    s.userData.dt = Math.min(1, (s.userData.dt || 0) + dt * 3);
    s.rotation.x = -s.userData.dt * 0.9;
  }

  finishBall() {
    const res = this.result;
    this.phase = 'idle'; this.pt = 0;
    this.ball.visible = false; this.trail.length = 0;
    this.fielders.forEach((f) => { if (f.base) { f.root.position.set(f.base.x, 0, f.base.z); f.root.rotation.z = 0; f.move = null; } });
    this.resetStumps(); this.setCamera(this.mode === 'bowl' ? 'bowl' : 'bat');
    this.camTarget.look.set(0, 0.9, this.mode === 'bowl' ? 4 : -2);
    this.cbs.onSettled && this.cbs.onSettled(res);
    if (this.viewDone) { const f = this.viewDone; this.viewDone = null; this.forced = null; f(res); }
  }

  dispose() {
    cancelAnimationFrame(this.raf); window.removeEventListener('resize', this._resize); this.ro && this.ro.disconnect();
    this.stadium.dispose();
    this.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
  }
}
