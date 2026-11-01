import * as THREE from 'three';

export function canvasTex(w, h, draw, { repeat, srgb = true, anisotropy = 4 } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb && THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = anisotropy;
  return t;
}

export function grassTexture(night) {
  return canvasTex(512, 512, (g, w, h) => {
    const a = night ? '#1d5a31' : '#2f8a45', b = night ? '#236b3a' : '#37a052';
    const n = 16, sw = w / n;
    for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? a : b; g.fillRect(i * sw, 0, sw, h); }
    for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(${i % 2 ? '255,255,255' : '0,40,10'},${Math.random() * 0.05})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  }, { repeat: [1, 1] });
}

export function skyTexture(night) {
  return canvasTex(8, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    if (night) { gr.addColorStop(0, '#02060f'); gr.addColorStop(0.55, '#0a1d33'); gr.addColorStop(0.85, '#16405a'); gr.addColorStop(1, '#2a6a70'); }
    else { gr.addColorStop(0, '#2b79d6'); gr.addColorStop(0.55, '#6db2ef'); gr.addColorStop(0.9, '#cfe9f7'); gr.addColorStop(1, '#eaf4e6'); }
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}

export function starsTexture() {
  return canvasTex(1024, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 380; i++) { const y = Math.random() * h * 0.55; g.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.7})`; g.fillRect(Math.random() * w, y, Math.random() < 0.1 ? 2 : 1, Math.random() < 0.1 ? 2 : 1); }
  });
}

export function adTexture(accent, label) {
  return canvasTex(512, 64, (g, w, h) => {
    g.fillStyle = '#071b12'; g.fillRect(0, 0, w, h);
    g.fillStyle = accent; g.fillRect(0, 0, w, 6); g.fillRect(0, h - 6, w, 6);
    g.fillStyle = '#e9fff1'; g.font = '800 34px system-ui, sans-serif'; g.textBaseline = 'middle';
    const t = label.toUpperCase();
    for (let x = 12; x < w; x += g.measureText(t).width + 56) { g.fillText(t, x, h / 2 + 2); g.fillStyle = accent; g.fillRect(x + g.measureText(t).width + 22, h / 2 - 5, 10, 10); g.fillStyle = '#e9fff1'; }
  });
}

export function ballTexture() {
  return canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#b3171c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1200; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.strokeStyle = '#f3e8d0'; g.lineWidth = 3;
    for (const y of [h * 0.5 - 5, h * 0.5 + 5]) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.lineWidth = 1.5; g.setLineDash([4, 4]);
    for (let k = -1; k <= 1; k += 2) { g.beginPath(); g.moveTo(0, h * 0.5 + k * 12); g.lineTo(w, h * 0.5 + k * 12); g.stroke(); }
  });
}

/** LED scoreboard that can be redrawn. */
export class Scoreboard {
  constructor(accent = '#4ade80') {
    this.c = document.createElement('canvas'); this.c.width = 1024; this.c.height = 384;
    this.g = this.c.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.c);
    if (THREE.SRGBColorSpace) this.tex.colorSpace = THREE.SRGBColorSpace;
    this.accent = accent;
    this.draw({ title: 'CRICKET ARENA', line1: 'Welcome', line2: '' });
  }
  draw(s) {
    const g = this.g, w = this.c.width, h = this.c.height;
    g.fillStyle = '#04120b'; g.fillRect(0, 0, w, h);
    g.strokeStyle = this.accent; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = this.accent; g.font = '700 38px system-ui, sans-serif'; g.textBaseline = 'top';
    g.fillText(s.title || '', 40, 34);
    g.fillStyle = '#f2fff6'; g.font = '800 120px system-ui, sans-serif';
    g.fillText(s.line1 || '', 40, 96);
    g.fillStyle = '#9fe9bd'; g.font = '600 52px system-ui, sans-serif';
    g.fillText(s.line2 || '', 40, 250);
    this.tex.needsUpdate = true;
  }
}

export function softDisc(color = '#ffffff') {
  return canvasTex(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, color); gr.addColorStop(0.4, color + '88'); gr.addColorStop(1, color + '00');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
}
