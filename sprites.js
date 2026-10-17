// Sprites desenhados por código e pré-renderizados em canvas (sem arquivos de imagem)
const SPR_SCALE = 2; // resolução extra para ficar nítido em telas de alta densidade

function makeCanvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * SPR_SCALE); c.height = Math.ceil(h * SPR_SCALE);
  const g = c.getContext('2d');
  g.scale(SPR_SCALE, SPR_SCALE);
  draw(g);
  return { c, w, h };
}
// sprite com origem (0,0) no centro
function makeSprite(w, h, draw) {
  return makeCanvas(w, h, g => { g.translate(w / 2, h / 2); draw(g); });
}
function whiteVersion(s) {
  const c = document.createElement('canvas');
  c.width = s.c.width; c.height = s.c.height;
  const g = c.getContext('2d');
  g.drawImage(s.c, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(0, 0, c.width, c.height);
  return { c, w: s.w, h: s.h };
}
function drawSprite(ctx, s, x, y, rot = 0, scale = 1) {
  if (!rot && scale === 1) { ctx.drawImage(s.c, x - s.w / 2, y - s.h / 2, s.w, s.h); return; }
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(scale, scale);
  ctx.drawImage(s.c, -s.w / 2, -s.h / 2, s.w, s.h);
  ctx.restore();
}

// ---------- helpers de desenho ----------
function seeded(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function circ(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
function line(g, x1, y1, x2, y2) { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
function shade(hex, amt) { // amt > 0 clareia, < 0 escurece
  const n = parseInt(hex.slice(1), 16);
  const f = c => Math.round(amt > 0 ? c + (255 - c) * amt : c * (1 + amt));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

// ---------- soldado (olhando para cima) ----------
const GUNS = {
  pistol(g) { g.fillStyle = '#2b2b2b'; rr(g, 2, -18, 4, 10, 1); g.fill(); },
  shotgun(g) {
    g.fillStyle = '#3a3a3a'; g.fillRect(2.5, -26, 3, 19);
    g.fillStyle = '#8a5428'; rr(g, 1.5, -17, 5, 5, 1); g.fill();
    g.fillStyle = '#5a3418'; rr(g, 1.5, -9, 5, 7, 1); g.fill();
  },
  minigun(g) {
    g.fillStyle = '#2a2a2a'; rr(g, -1, -15, 11, 11, 2); g.fill();
    g.fillStyle = '#5c5c5c'; for (const dx of [0.5, 3.5, 6.5]) g.fillRect(dx, -31, 2, 17);
    g.fillStyle = '#888'; g.fillRect(-0.5, -26, 10, 2.5); g.fillRect(-0.5, -20, 10, 2);
    g.fillStyle = '#c0392b'; g.fillRect(1, -9, 7, 2);
  },
  laser(g) {
    g.fillStyle = '#d7e1ea'; rr(g, 1, -25, 6, 19, 2); g.fill();
    g.fillStyle = '#7d8a96'; g.fillRect(1, -12, 6, 2);
    g.shadowColor = '#5ef0ff'; g.shadowBlur = 6; g.fillStyle = '#5ef0ff';
    g.fillRect(3, -28, 2, 17); g.shadowBlur = 0;
  },
  rocket(g) {
    g.fillStyle = '#4b5b2a'; rr(g, 0, -31, 8, 28, 2); g.fill();
    g.fillStyle = '#2e3a18'; g.fillRect(0, -31, 8, 3); g.fillRect(0, -14, 8, 2);
    g.fillStyle = '#d35400'; circ(g, 4, -31, 2.6);
  },
  missile(g) { // lançador com 4 tubos
    g.fillStyle = '#3b3f46'; rr(g, -2, -25, 12, 21, 2); g.fill();
    g.strokeStyle = '#1c1f24'; g.lineWidth = 1; rr(g, -2, -25, 12, 21, 2); g.stroke();
    for (const [dx, dy] of [[0, -24], [5, -24], [0, -18], [5, -18]]) {
      g.fillStyle = '#16181c'; rr(g, dx, dy, 4, 5, 1); g.fill();
      g.fillStyle = '#f472b6'; circ(g, dx + 2, dy + 2.5, 1.1);
    }
    g.fillStyle = '#2a2d33'; g.fillRect(2, -6, 5, 5);
  },
  flame(g) { // tanque de combustível + bico
    g.fillStyle = '#b91c1c'; rr(g, -1.5, -13, 11, 10, 3); g.fill();
    g.fillStyle = '#7f1d1d'; g.fillRect(-1.5, -9, 11, 2);
    g.fillStyle = '#4b4b4b'; g.fillRect(3, -26, 3, 14);
    g.fillStyle = '#777'; g.fillRect(2, -28, 5, 3);
    g.fillStyle = '#60a5fa'; circ(g, 4.5, -29.5, 1.4);
  },
};
const GUN_TIP = { pistol: -19, shotgun: -27, minigun: -32, laser: -29, rocket: -33, missile: -26, flame: -30 };

// projétil apontando para cima (o jogo gira conforme a direção do voo)
function makeProjectile(body, tip, fins, len) {
  return makeSprite(12, len + 8, g => {
    const h = len / 2;
    g.fillStyle = fins;
    g.beginPath(); g.moveTo(-1.5, h - 4); g.lineTo(-4.5, h + 1); g.lineTo(-1.5, h); g.fill();
    g.beginPath(); g.moveTo(1.5, h - 4); g.lineTo(4.5, h + 1); g.lineTo(1.5, h); g.fill();
    g.fillStyle = body; rr(g, -2.2, -h + 3, 4.4, len - 3, 1.5); g.fill();
    g.fillStyle = tip;
    g.beginPath(); g.moveTo(0, -h - 1); g.lineTo(2.2, -h + 4); g.lineTo(-2.2, -h + 4); g.closePath(); g.fill();
  });
}

function makeSoldier(weapon) {
  return makeSprite(36, 70, g => {
    // mochila
    g.fillStyle = '#3f4a1f'; rr(g, -7, 2, 14, 10, 3); g.fill();
    g.fillStyle = '#5a672c'; rr(g, -6, 3, 12, 4, 2); g.fill();
    // ombros
    const gr = g.createLinearGradient(-12, 0, 12, 0);
    gr.addColorStop(0, '#1b4aa0'); gr.addColorStop(0.5, '#3c80f5'); gr.addColorStop(1, '#1b4aa0');
    g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, 12, 7.5, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1; g.stroke();
    GUNS[weapon](g);
    // braços segurando a arma
    g.lineCap = 'round'; g.strokeStyle = '#2b62c9'; g.lineWidth = 5;
    line(g, -9, -1, 1, -11); line(g, 9, -1, 7, -6);
    g.fillStyle = '#e8b48a'; circ(g, 2, -12, 2.6); circ(g, 7, -7, 2.6);
    // capacete
    const hg = g.createRadialGradient(-2, -3, 1, 0, 0, 7.5);
    hg.addColorStop(0, '#7c8c46'); hg.addColorStop(1, '#2f3a16');
    g.fillStyle = hg; circ(g, 0, 0, 7);
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1; g.beginPath(); g.arc(0, 0, 7, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.18)'; circ(g, -2.5, -2.5, 2.2);
  });
}

// ---------- zumbis (olhando para baixo) ----------
const ZTYPES = {
  walker: { r: 15, skin: '#86a85e', shirts: ['#4f5d7a', '#7a5a3a', '#6b6b6b', '#5e7a4f'] },
  runner: { r: 11, skin: '#a8cc62', shirts: ['#8a3434', '#a0702a'] },
  tank:   { r: 24, skin: '#6b8a4a', shirts: ['#3a3a3a'] },
  boss:   { r: 42, skin: '#8a5a9e', shirts: ['#4a2357'] },
};

function makeZombie(type, shirt, frame, seed) {
  const { r, skin } = ZTYPES[type];
  const rnd = seeded(seed);
  const wide = type === 'tank' ? 1.18 : type === 'boss' ? 1.1 : 1;
  return makeSprite(r * 3.4, r * 3.4, g => {
    const sw = frame ? 1 : -1;
    g.lineCap = 'round';
    // braços esticados em direção ao jogador
    for (const side of [-1, 1]) {
      const reach = r * (1.2 + side * sw * 0.2);
      const sx = side * r * 0.72 * wide, ex = side * r * 0.42;
      g.strokeStyle = shade(shirt, -0.15); g.lineWidth = r * 0.36; line(g, sx, -r * 0.05, ex, reach * 0.55);
      g.strokeStyle = skin; g.lineWidth = r * 0.26; line(g, ex, reach * 0.55, ex * 0.9, reach);
      g.fillStyle = shade(skin, -0.35); circ(g, ex * 0.9, reach + r * 0.05, r * 0.14);
    }
    // espinhos de osso nas costas do chefão
    if (type === 'boss') {
      g.fillStyle = '#e8dcc0';
      for (let i = 0; i < 7; i++) {
        const a = Math.PI + 0.35 + i * (Math.PI - 0.7) / 6;
        const bx = Math.cos(a) * r * wide * 0.9, by = Math.sin(a) * r * 0.62 - r * 0.12;
        const tx = Math.cos(a) * r * wide * 1.35, ty = Math.sin(a) * r * 1.05 - r * 0.12;
        const px = -Math.sin(a) * r * 0.1, py = Math.cos(a) * r * 0.1;
        g.beginPath(); g.moveTo(bx + px, by + py); g.lineTo(tx, ty); g.lineTo(bx - px, by - py); g.fill();
      }
    }
    // tronco
    const gr = g.createRadialGradient(0, -r * 0.25, r * 0.15, 0, 0, r * 1.15);
    gr.addColorStop(0, shade(shirt, 0.18)); gr.addColorStop(1, shade(shirt, -0.4));
    g.fillStyle = gr; g.beginPath(); g.ellipse(0, -r * 0.12, r * wide, r * 0.68, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = Math.max(1, r * 0.06); g.stroke();
    // rasgos e manchas de sangue
    for (let i = 0; i < 6; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(120,10,10,0.75)' : shade(shirt, -0.5);
      g.beginPath();
      g.ellipse((rnd() - 0.5) * r * 1.4 * wide, (rnd() - 0.65) * r * 0.9,
        r * (0.07 + rnd() * 0.14), r * (0.04 + rnd() * 0.09), rnd() * 3, 0, Math.PI * 2);
      g.fill();
    }
    if (type === 'tank') { // colete blindado
      g.fillStyle = '#56606b'; rr(g, -r * 0.62, -r * 0.62, r * 1.24, r * 0.78, r * 0.15); g.fill();
      g.strokeStyle = '#2b3036'; g.lineWidth = 2; g.stroke();
      g.fillStyle = '#7b8794'; for (const dx of [-0.4, 0.4]) circ(g, dx * r, -r * 0.45, r * 0.06);
    }
    // cabeça
    const hy = r * 0.18, hr = r * (type === 'boss' ? 0.45 : 0.5);
    const hg = g.createRadialGradient(-hr * 0.3, hy - hr * 0.35, hr * 0.1, 0, hy, hr);
    hg.addColorStop(0, shade(skin, 0.25)); hg.addColorStop(1, shade(skin, -0.3));
    g.fillStyle = hg; circ(g, 0, hy, hr);
    g.fillStyle = 'rgba(40,60,20,0.55)';
    for (let i = 0; i < 2; i++) circ(g, (rnd() - 0.5) * hr, hy - hr * 0.4 + rnd() * hr * 0.3, hr * (0.12 + rnd() * 0.1));
    // olhos brilhando
    g.shadowColor = '#ff2020'; g.shadowBlur = Math.max(3, r * 0.4); g.fillStyle = '#ff3b3b';
    circ(g, -hr * 0.38, hy + hr * 0.35, hr * 0.17); circ(g, hr * 0.38, hy + hr * 0.35, hr * 0.17);
    g.shadowBlur = 0;
    // boca
    g.fillStyle = '#2a0505'; g.beginPath(); g.ellipse(0, hy + hr * 0.72, hr * 0.3, hr * 0.12, 0, 0, Math.PI * 2); g.fill();
  });
}

// ---------- itens ----------
function makeCrate() {
  return makeSprite(94, 70, g => {
    const x = -45, y = -33, w = 90, h = 66;
    const gr = g.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, '#b07a40'); gr.addColorStop(1, '#6e4520');
    g.fillStyle = gr; rr(g, x, y, w, h, 6); g.fill();
    const rnd = seeded(5);
    g.strokeStyle = 'rgba(60,30,10,0.35)'; g.lineWidth = 0.8;
    for (let i = 0; i < 14; i++) { const yy = y + 4 + rnd() * (h - 8); line(g, x + 4, yy, x + w - 4, yy + (rnd() - 0.5) * 3); }
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.5;
    for (let yy = y + 16; yy < y + h; yy += 16) line(g, x + 2, yy, x + w - 2, yy);
    g.strokeStyle = '#4a2e12'; g.lineWidth = 4; rr(g, x + 2, y + 2, w - 4, h - 4, 5); g.stroke();
    // cantoneiras de metal
    g.fillStyle = '#8c96a0';
    for (const [cx, cy] of [[x, y], [x + w - 12, y], [x, y + h - 12], [x + w - 12, y + h - 12]]) {
      rr(g, cx, cy, 12, 12, 3); g.fill();
      g.fillStyle = '#4b535b'; circ(g, cx + 6, cy + 6, 1.6); g.fillStyle = '#8c96a0';
    }
  });
}
function makePanel() {
  return makeSprite(100, 76, g => {
    const x = -45, y = -33, w = 90, h = 66;
    g.shadowColor = '#60a5fa'; g.shadowBlur = 10;
    const gr = g.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, 'rgba(37,99,235,0.85)'); gr.addColorStop(1, 'rgba(12,40,110,0.85)');
    g.fillStyle = gr; rr(g, x, y, w, h, 8); g.fill();
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(255,255,255,0.07)';
    for (let yy = y + 2; yy < y + h; yy += 4) g.fillRect(x + 3, yy, w - 6, 1.5);
    g.strokeStyle = '#93c5fd'; g.lineWidth = 2.5; rr(g, x, y, w, h, 8); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.12)'; rr(g, x + 4, y + 4, w - 8, h * 0.35, 5); g.fill();
  });
}

// ---------- efeitos ----------
function makeGlow(color, size) {
  return makeSprite(size, size, g => {
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, size / 2);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.25, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(-size / 2, -size / 2, size, size);
  });
}
function makeMuzzle() {
  return makeSprite(18, 26, g => {
    const gr = g.createRadialGradient(0, 2, 0, 0, 2, 10);
    gr.addColorStop(0, '#fff'); gr.addColorStop(0.3, '#ffe066'); gr.addColorStop(1, 'rgba(255,120,0,0)');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(0, -13); g.lineTo(3.5, 0); g.lineTo(8, 4); g.lineTo(2, 6); g.lineTo(0, 12);
    g.lineTo(-2, 6); g.lineTo(-8, 4); g.lineTo(-3.5, 0); g.closePath(); g.fill();
  });
}
function makeBlood(seed) {
  return makeSprite(70, 70, g => {
    const rnd = seeded(seed);
    g.fillStyle = 'rgb(105,8,8)';
    for (let i = 0; i < 9; i++) circ(g, (rnd() - 0.5) * 22, (rnd() - 0.5) * 22, 6 + rnd() * 9);
    for (let i = 0; i < 14; i++) {
      const a = rnd() * Math.PI * 2, d = 18 + rnd() * 14;
      circ(g, Math.cos(a) * d, Math.sin(a) * d, 1 + rnd() * 2.5);
    }
    g.fillStyle = 'rgba(60,0,0,0.5)';
    for (let i = 0; i < 4; i++) circ(g, (rnd() - 0.5) * 14, (rnd() - 0.5) * 14, 3 + rnd() * 5);
  });
}

// ---------- cenário ----------
const TILE_H = 400; // múltiplo de 80 para as faixas encaixarem ao repetir
function makeRoadTile(W) {
  return makeCanvas(W, TILE_H, g => {
    const rnd = seeded(42);
    g.fillStyle = '#2f3d24'; g.fillRect(0, 0, W, TILE_H);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(90,120,55,0.55)' : 'rgba(18,28,12,0.55)';
      const x = rnd() < 0.5 ? rnd() * 30 : W - 30 + rnd() * 30;
      g.fillRect(x, rnd() * TILE_H, 2, 3);
    }
    g.fillStyle = '#6b6f75'; g.fillRect(30, 0, 6, TILE_H); g.fillRect(W - 36, 0, 6, TILE_H);
    g.fillStyle = '#2a2d33'; g.fillRect(36, 0, W - 72, TILE_H);
    for (let i = 0; i < 5000; i++) {
      g.fillStyle = rnd() < 0.5 ? `rgba(255,255,255,${0.03 + rnd() * 0.05})` : `rgba(0,0,0,${0.1 + rnd() * 0.15})`;
      g.fillRect(36 + rnd() * (W - 72), rnd() * TILE_H, 1.5, 1.5);
    }
    g.fillStyle = 'rgba(0,0,0,0.15)';
    for (let i = 0; i < 3; i++) { rr(g, 60 + rnd() * (W - 180), 30 + rnd() * (TILE_H - 120), 40 + rnd() * 60, 30 + rnd() * 50, 4); g.fill(); }
    g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) {
      let x = 60 + rnd() * (W - 120), y = 40 + rnd() * (TILE_H - 80);
      g.beginPath(); g.moveTo(x, y);
      for (let j = 0; j < 6; j++) { x += (rnd() - 0.5) * 30; y += (rnd() - 0.5) * 30; g.lineTo(x, y); }
      g.stroke();
    }
    g.fillStyle = '#c9a227'; g.fillRect(42, 0, 3, TILE_H); g.fillRect(W - 45, 0, 3, TILE_H);
    g.fillStyle = 'rgba(235,235,235,0.55)';
    for (let y = 0; y < TILE_H; y += 80) { g.fillRect(W / 3 - 2, y + 20, 4, 40); g.fillRect(2 * W / 3 - 2, y + 20, 4, 40); }
  });
}
function makeVignette(W, H) {
  return makeCanvas(W, H, g => {
    const gr = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.6)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  });
}

// ---------- monta tudo ----------
function buildSprites(W, H, weapons) {
  const S = { soldier: {}, zombie: {}, glow: {}, blood: [] };
  S.gun = {};
  for (const k in GUNS) {
    S.soldier[k] = makeSoldier(k);
    S.gun[k] = makeSprite(24, 44, g => { g.translate(-4, 17); GUNS[k](g); });
  }
  let seed = 1;
  for (const type in ZTYPES) {
    ZTYPES[type].shirts.forEach((shirt, v) => {
      const s = seed++ * 977;
      const f0 = makeZombie(type, shirt, 0, s), f1 = makeZombie(type, shirt, 1, s);
      S.zombie[type + v] = [f0, f1, whiteVersion(f0), whiteVersion(f1)];
    });
  }
  for (const k in weapons) S.glow[k] = makeGlow(weapons[k].color, 24);
  S.glow.fire = makeGlow('#ff8c1a', 64);
  for (let i = 0; i < 5; i++) S.blood.push(makeBlood(100 + i * 31));
  S.crate = makeCrate();
  S.panel = makePanel();
  S.muzzle = makeMuzzle();
  S.rocket = makeProjectile('#5b6b2e', '#d35400', '#2e3a18', 16);
  S.missile = makeProjectile('#e5e7eb', '#ec4899', '#6b7280', 13);
  S.tile = makeRoadTile(W);
  S.vignette = makeVignette(W, H);
  return S;
}
