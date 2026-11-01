// Scroll-driven landing scene: a floodlit pitch, a drifting ball, a golden trophy and fireflies.
// `getProgress()` returns smoothed scroll progress 0..1; the camera flies through the story as the user scrolls.
import * as THREE from 'three';
import { ballTexture, softDisc, grassTexture } from './textures.js';

const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);

// Camera path: [progress, camera xyz, look xyz]
const PATH = [
  [0.00, [0, 3.4, 15], [0, 1.6, 0]],
  [0.18, [-5, 2.4, 9], [0, 1.3, 0]],
  [0.36, [6, 4.5, 8], [0, 1.8, -3]],
  [0.54, [0, 9, 14], [0, 0, -4]],
  [0.72, [-7, 3.2, 6], [0, 2.4, -2]],
  [0.88, [4, 2.6, 7], [0, 2.1, 0]],
  [1.00, [0, 5.5, 13], [0, 1.6, -2]],
];

export function createLanding(container, getProgress) {
  const low = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 700;
  const renderer = new THREE.WebGLRenderer({ antialias: !low, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1.5 : 2));
  if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
  if (THREE.ACESFilmicToneMapping) { renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1; }
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x06170f, 0.028);
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 300);

  scene.add(new THREE.HemisphereLight(0x9bf5c4, 0x0a2417, 0.8));
  const key = new THREE.DirectionalLight(0xfff0cf, 1.4); key.position.set(-6, 12, 8); scene.add(key);
  const rim = new THREE.PointLight(0x4ade80, 40, 40, 1.6); rim.position.set(5, 3, -4); scene.add(rim);
  const warm = new THREE.PointLight(0xffc15e, 30, 30, 1.6); warm.position.set(-5, 4, 3); scene.add(warm);

  // ground with a pitch
  const gt = grassTexture(true); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(7, 7);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 64), new THREE.MeshStandardMaterial({ map: gt, roughness: 1, color: 0x9fe0b4 }));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(3.05, 22), new THREE.MeshStandardMaterial({ color: 0xc9ab72, roughness: 0.95 }));
  pitch.rotation.x = -Math.PI / 2; pitch.position.set(0, 0.02, -2); scene.add(pitch);
  const stumps = new THREE.Group();
  const sm = new THREE.MeshStandardMaterial({ color: 0xf1e3b8 });
  for (const z of [-12.5, 8.5]) for (let i = -1; i <= 1; i++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.72, 8), sm); s.position.set(i * 0.1, 0.36, z); stumps.add(s); }
  scene.add(stumps);

  // ring of floodlights + glow in the distance
  const lights = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, r = 34;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 24, 6), new THREE.MeshStandardMaterial({ color: 0x405448 })); pole.position.set(Math.sin(a) * r, 12, Math.cos(a) * r);
    const head = new THREE.Mesh(new THREE.BoxGeometry(4, 2.2, 0.5), new THREE.MeshBasicMaterial({ color: 0xfff3d0 })); head.position.set(Math.sin(a) * r, 24.5, Math.cos(a) * r); head.lookAt(0, 24, 0);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDisc('#fff1c4'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 }));
    halo.scale.set(18, 18, 1); halo.position.copy(head.position);
    lights.add(pole, head, halo);
  }
  scene.add(lights);

  // stand silhouette
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(52, 40, 14, 48, 1, true), new THREE.MeshStandardMaterial({ color: 0x0e2a1c, side: THREE.DoubleSide, roughness: 1 }));
  bowl.position.y = 7; scene.add(bowl);
  const crowdPts = [];
  for (let i = 0; i < (low ? 700 : 1800); i++) { const a = Math.random() * Math.PI * 2, r = 41 + Math.random() * 10, y = 1 + ((r - 41) / 10) * 12 + Math.random() * 0.5; crowdPts.push(Math.sin(a) * r, y, Math.cos(a) * r); }
  const crowdGeo = new THREE.BufferGeometry(); crowdGeo.setAttribute('position', new THREE.Float32BufferAttribute(crowdPts, 3));
  const crowd = new THREE.Points(crowdGeo, new THREE.PointsMaterial({ color: 0xbff7d6, size: 0.35, transparent: true, opacity: 0.85 }));
  scene.add(crowd);

  // hero objects
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.4, metalness: 0.05 }));
  ball.position.set(3.2, 2.6, 0); scene.add(ball);

  const trophy = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0xf2c14e, metalness: 0.95, roughness: 0.25 });
  const pts = [[0.0, 0], [1.1, 0], [1.1, 0.25], [0.8, 0.35], [0.8, 0.6], [0.28, 0.8], [0.22, 1.9], [0.5, 2.1], [0.8, 2.6], [1.25, 3.5], [1.45, 4.2], [1.35, 4.3], [1.0, 3.9], [0.6, 3.0], [0.3, 2.5]].map(([x, y]) => new THREE.Vector2(x, y));
  const cup = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), gold); trophy.add(cup);
  for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.07, 10, 24, Math.PI), gold); h.position.set(s * 1.3, 3.5, 0); h.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2; trophy.add(h); }
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 18), gold); globe.position.y = 4.65; trophy.add(globe);
  trophy.scale.setScalar(0.62); trophy.position.set(-3.6, 0.1, -3); scene.add(trophy);

  const bat = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.62, 2.1, 0.16), new THREE.MeshStandardMaterial({ color: 0xe0bd7c, roughness: 0.5 }));
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.9, 10), new THREE.MeshStandardMaterial({ color: 0x15201a }));
  handle.position.y = 1.5; blade.position.y = 0; bat.add(blade, handle); bat.position.set(4.5, 1.1, -5); bat.rotation.z = 0.5; scene.add(bat);

  // fireflies
  const FF = low ? 90 : 200, ffPos = new Float32Array(FF * 3), ffSeed = [];
  for (let i = 0; i < FF; i++) { ffPos[i * 3] = (Math.random() - 0.5) * 36; ffPos[i * 3 + 1] = Math.random() * 8 + 0.4; ffPos[i * 3 + 2] = (Math.random() - 0.5) * 36; ffSeed.push(Math.random() * 100); }
  const ffGeo = new THREE.BufferGeometry(); ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
  const ff = new THREE.Points(ffGeo, new THREE.PointsMaterial({ map: softDisc('#d7ff8a'), size: 0.5, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 }));
  scene.add(ff);

  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  const onMove = (e) => { const t = e.touches ? e.touches[0] : e; mouse.x = (t.clientX / window.innerWidth) * 2 - 1; mouse.y = (t.clientY / window.innerHeight) * 2 - 1; };
  window.addEventListener('pointermove', onMove); window.addEventListener('touchmove', onMove, { passive: true });

  function resize() {
    const w = container.clientWidth || window.innerWidth, h = container.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 0.8 ? 62 : 46; camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  const cp = new THREE.Vector3(), cl = new THREE.Vector3();
  let raf, last = performance.now(), t = 0;
  function sample(p) {
    let i = 0; while (i < PATH.length - 2 && p > PATH[i + 1][0]) i++;
    const a = PATH[i], b = PATH[i + 1], k = ease(Math.min(1, Math.max(0, (p - a[0]) / (b[0] - a[0]))));
    cp.set(lerp(a[1][0], b[1][0], k), lerp(a[1][1], b[1][1], k), lerp(a[1][2], b[1][2], k));
    cl.set(lerp(a[2][0], b[2][0], k), lerp(a[2][1], b[2][1], k), lerp(a[2][2], b[2][2], k));
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    const p = Math.min(1, Math.max(0, getProgress()));
    mouse.sx += (mouse.x - mouse.sx) * (1 - Math.exp(-3 * dt)); mouse.sy += (mouse.y - mouse.sy) * (1 - Math.exp(-3 * dt));
    sample(p);
    camera.position.set(cp.x + mouse.sx * 0.9, cp.y - mouse.sy * 0.5, cp.z);
    camera.lookAt(cl);
    // hero objects respond to the scroll
    ball.rotation.y = t * 0.6 + p * 9; ball.rotation.x = t * 0.2;
    ball.position.y = 2.6 + Math.sin(t * 1.2) * 0.18 + Math.sin(p * Math.PI * 2) * 0.6;
    ball.position.x = 3.2 - p * 5 + Math.sin(p * 9) * 1.2; ball.position.z = -p * 7;
    trophy.rotation.y = t * 0.5 + p * 4; trophy.position.y = 0.1 + Math.sin(t * 0.9) * 0.08;
    bat.rotation.z = 0.5 - p * 1.4 + Math.sin(t * 0.8) * 0.04; bat.rotation.y = p * 3;
    lights.rotation.y = t * 0.02;
    rim.intensity = 36 + Math.sin(t * 1.3) * 6;
    const pa = ffGeo.attributes.position;
    for (let i = 0; i < FF; i++) { pa.array[i * 3 + 1] = 0.5 + ((ffPos[i * 3 + 1] + t * 0.25 * (0.4 + (ffSeed[i] % 1))) % 9); pa.array[i * 3] = ffPos[i * 3] + Math.sin(t * 0.4 + ffSeed[i]) * 0.8; }
    pa.needsUpdate = true;
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);

  return {
    dispose() {
      cancelAnimationFrame(raf); window.removeEventListener('resize', resize); window.removeEventListener('pointermove', onMove); window.removeEventListener('touchmove', onMove);
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); } });
      renderer.dispose(); if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    },
  };
}
