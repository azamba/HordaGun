// ===================== CONFIG =====================
const W = 480, H = 800;
const SQUAD_Y = H - 125;      // linha onde ficam os atiradores
const MAX_SQUAD = 30;         // limite de atiradores

// A ordem define a tecla (1 a 7). ammo = munição ganha por caixote, contada por disparo
// (não por atirador); Infinity = munição infinita.
const WEAPONS = {
  pistol:  { name: 'PISTOLA',      rate: 4,   dmg: 1,    speed: 650,  spread: 0.04, pellets: 1, color: '#ffe066', ammo: Infinity },
  shotgun: { name: 'ESCOPETA',     rate: 1.4, dmg: 1,    speed: 600,  spread: 0.40, pellets: 5, color: '#ffb347', ammo: 30 },
  minigun: { name: 'MINIGUN',      rate: 12,  dmg: 1,    speed: 820,  spread: 0.10, pellets: 1, color: '#ff6b6b', ammo: 300 },
  laser:   { name: 'LASER',        rate: 4,   dmg: 2,    speed: 1000, spread: 0,    pellets: 1, color: '#5ef0ff', ammo: 100, pierce: 4 },
  rocket:  { name: 'BAZUCA',       rate: 1.1, dmg: 5,    speed: 420,  spread: 0.02, pellets: 1, color: '#ff9f1c', ammo: 30, splash: 65 },
  missile: { name: 'MÍSSEIS',      rate: 1.5, dmg: 4,    speed: 160,  spread: 1.2,  pellets: 1, color: '#f472b6', ammo: 24, splash: 45 },
  flame:   { name: 'LANÇA-CHAMAS', rate: 20,  dmg: 0.35, speed: 380,  spread: 0.35, pellets: 1, color: '#ff7a1a', ammo: 400, pierce: 99, range: 0.45 },
};
const WEAPON_ORDER = Object.keys(WEAPONS);
// tiros necessários para destravar cada arma (aumenta um pouco a cada onda)
const WEAPON_UNLOCK = { shotgun: 25, minigun: 50, laser: 40, rocket: 60, missile: 70, flame: 45 };

// moedas por zumbi morto; ao fim de cada onda ganha também 10 + onda * 5
const COINS = { walker: 1, runner: 1, tank: 4, boss: 40 };
const MAX_SHIELD = 3;

// loja entre as ondas
const UPGRADES = [
  { name: 'DANO', color: '#ef4444', desc: ['+15% de dano', 'em todas as armas'], max: 10,
    cost: () => Math.round(30 * 1.45 ** S.up.dmg), level: () => S.up.dmg,
    info: () => `nível ${S.up.dmg}/10`, buy: () => { S.up.dmg++; } },
  { name: 'CADÊNCIA', color: '#fde047', desc: ['+10% de tiros', 'por segundo'], max: 10,
    cost: () => Math.round(30 * 1.45 ** S.up.rate), level: () => S.up.rate,
    info: () => `nível ${S.up.rate}/10`, buy: () => { S.up.rate++; } },
  { name: '+1 ATIRADOR', color: '#60a5fa', desc: ['mais um soldado', 'no esquadrão'], max: Infinity,
    cost: () => Math.round(25 * 1.3 ** S.up.squad), level: () => S.up.squad,
    can: () => S.count < MAX_SQUAD,
    info: () => `esquadrão: ${S.count}/${MAX_SQUAD}`, buy: () => { S.up.squad++; S.count++; } },
  { name: 'MUNIÇÃO', color: '#a3e635', desc: ['+50% de munição para', 'cada arma que você tem'], max: Infinity,
    cost: () => 40 + 15 * S.up.ammo, level: () => S.up.ammo,
    can: () => WEAPON_ORDER.some(k => k !== 'pistol' && S.owned[k]),
    info: () => !UPGRADES[3].can() ? 'precisa de uma arma' : S.up.ammo ? `comprado ${S.up.ammo}x` : 'recarrega todas',
    buy: () => {
      S.up.ammo++;
      for (const k of WEAPON_ORDER) if (k !== 'pistol' && S.owned[k]) S.ammo[k] += Math.ceil(WEAPONS[k].ammo * 0.5);
    } },
  { name: 'CAIXOTES', color: '#d9a066', desc: ['caixotes e painéis pedem', '-10% de tiros'], max: 5,
    cost: () => Math.round(40 * 1.6 ** S.up.unlock), level: () => S.up.unlock,
    info: () => `nível ${S.up.unlock}/5`, buy: () => { S.up.unlock++; } },
  { name: 'ESCUDO', color: '#22d3ee', desc: ['bloqueia 1 ataque', 'de zumbi'], max: MAX_SHIELD,
    cost: () => 50 + 25 * S.shield, level: () => S.shield,
    info: () => `escudos: ${S.shield}/${MAX_SHIELD}`, buy: () => { S.shield++; } },
];
const dmgMult = () => 1 + 0.15 * S.up.dmg;
const rateMult = () => 1 + 0.1 * S.up.rate;

// ===================== SETUP =====================
const cv = document.getElementById('c');
const ctx = cv.getContext('2d');
const DPR = Math.min(2, window.devicePixelRatio || 1);
cv.width = W * DPR; cv.height = H * DPR;
function resize() {
  const s = Math.min(innerWidth / W, innerHeight / H);
  cv.style.width = W * s + 'px';
  cv.style.height = H * s + 'px';
}
addEventListener('resize', resize); resize();

const SPR = buildSprites(W, H, WEAPONS);

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

let best = 0;
try { best = +localStorage.getItem('hordagun_best') || 0; } catch (e) {}

let mode = 'menu'; // menu | play | paused | over
let S;
let clock = 0;

function waveSize(w) { return 12 + w * 6; }

function reset() {
  S = {
    x: W / 2, tx: W / 2, count: 3,
    weapon: 'pistol', fireCd: 0, muzzle: 0,
    owned: { pistol: true },
    coins: 0, shield: 0, up: { dmg: 0, rate: 0, squad: 0, ammo: 0, unlock: 0 },
    shopAt: 0, shopBonus: 0, hover: -1,
    ammo: Object.fromEntries(WEAPON_ORDER.map(k => [k, k === 'pistol' ? Infinity : 0])),
    bullets: [], zombies: [], items: [], parts: [], texts: [], decals: [], booms: [],
    wave: 1, toSpawn: waveSize(1), spawnCd: 1.5, itemCd: 2.5,
    score: 0, kills: 0, banner: 2, shake: 0, scroll: 0,
  };
}
reset();

// ===================== FORMAÇÃO =====================
const PER_ROW = 6, GAP = 22, ROW_GAP = 25;
function slots() {
  const out = [];
  for (let i = 0; i < S.count; i++) {
    const row = Math.floor(i / PER_ROW), col = i % PER_ROW;
    const inRow = Math.min(PER_ROW, S.count - row * PER_ROW);
    out.push({ x: S.x + (col - (inRow - 1) / 2) * GAP, y: SQUAD_Y + row * ROW_GAP });
  }
  return out;
}
function squadHalfWidth() { return (Math.min(PER_ROW, S.count) - 1) / 2 * GAP + 14; }

// ===================== SPAWN =====================
function makeZ(type, props) {
  const t = ZTYPES[type];
  const z = Object.assign({ type, r: t.r, key: type + Math.floor(Math.random() * t.shirts.length),
    x: rand(20, W - 20), y: -30, wob: rand(0, 6), flash: 0, flashCd: 0, drift: 0 }, props);
  z.maxHp = z.hp;
  return z;
}
function spawnZombie() {
  const w = S.wave, r = Math.random();
  let z;
  if (r < 0.12 && w >= 2)      z = makeZ('tank',   { hp: 20 + w * 6,  speed: 22 + w,       score: 50 });
  else if (r < 0.35 && w >= 2) z = makeZ('runner', { hp: 2 + w * 0.6, speed: 95 + w * 3,   score: 15 });
  else                         z = makeZ('walker', { hp: 2 + w * 1.0, speed: 36 + w * 2.5, score: 10 });
  z.hp *= 1 + w * w * 0.03;   // zumbis ficam bem mais resistentes nas ondas altas
  z.maxHp = z.hp;
  S.zombies.push(z);
}
function spawnBoss() {
  const w = S.wave;
  S.zombies.push(makeZ('boss', { hp: 150 + w * 45, speed: 16, score: 500, x: W / 2, y: -60 }));
  Sound.play('boss');
}
function spawnItem() {
  const w = S.wave;
  let it;
  if (Math.random() < 0.45) {
    const amt = Math.random() < 0.7 ? 1 : (Math.random() < 0.7 ? 2 : 3);
    it = { kind: 'squad', amt, need: 12 * amt + w * 3 };
  } else {
    // prefere armas que você ainda não tem; as que já tem viram caixote de munição
    const all = Object.keys(WEAPON_UNLOCK), notOwned = all.filter(k => !S.owned[k]);
    const k = pick(notOwned.length && Math.random() < 0.6 ? notOwned : all);
    it = { kind: 'weapon', weapon: k, need: WEAPON_UNLOCK[k] + (w - 1) * 4 };
  }
  it.need = Math.max(5, Math.ceil(it.need * (1 - 0.1 * S.up.unlock)));
  it.w = 90; it.h = 66; it.x = rand(55, W - 55); it.y = -40; it.hits = 0; it.flash = 0; it.pop = 0;
  S.items.push(it);
}

// ===================== EFEITOS =====================
function burst(x, y, color, n, spd = 160, life = 0.5, kind = 'dot') {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), s = rand(spd * 0.3, spd);
    S.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, color, kind,
      size: kind === 'chunk' ? rand(3, 6) : rand(2, 4), rot: rand(0, 6), vr: rand(-12, 12) });
  }
}
function gore(x, y, n) {
  burst(x, y, '#8b1a1a', n, 170);
  burst(x, y, '#5a0d0d', Math.ceil(n / 3), 120, 0.7, 'chunk');
}
function addDecal(x, y, size) {
  S.decals.push({ x, y, i: Math.floor(Math.random() * SPR.blood.length), rot: rand(0, 6), s: size, a: 0.7 });
  if (S.decals.length > 90) S.decals.shift();
}
function floatText(x, y, txt, color = '#fff', size = 18) {
  S.texts.push({ x, y, txt, color, size, life: 1.2 });
}

// ===================== COMBATE =====================
function fire() {
  const k = S.weapon, w = WEAPONS[k], tip = GUN_TIP[k];
  if (S.ammo[k] <= 0) return false;
  S.ammo[k]--;
  const sl = slots();
  for (const s of sl) {
    for (let p = 0; p < w.pellets; p++) {
      const off = w.pellets > 1 ? (p / (w.pellets - 1) - 0.5) * w.spread : rand(-w.spread / 2, w.spread / 2);
      const a = -Math.PI / 2 + off;
      const sp = w.range ? w.speed * rand(0.8, 1.2) : w.speed;
      const life = w.range ? w.range * rand(0.85, 1.15) : 4;
      S.bullets.push({ x: s.x + 4, y: s.y + tip, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, kind: k,
        dmg: w.dmg * dmgMult(), pierce: w.pierce || 1, splash: w.splash || 0, color: w.color, glow: SPR.glow[k], hit: [],
        life, max: life, target: null });
    }
  }
  // cápsulas ejetadas (só armas de bala)
  if (S.weapon === 'pistol' || S.weapon === 'minigun' || S.weapon === 'shotgun') {
    for (let i = 0; i < Math.min(4, sl.length); i++) {
      const s = pick(sl);
      S.parts.push({ x: s.x + 6, y: s.y - 6, vx: rand(60, 140), vy: rand(-30, 30), life: 0.4, max: 0.4,
        color: '#d4a017', kind: 'shell', size: 3, rot: rand(0, 6), vr: rand(-25, 25) });
    }
  }
  S.muzzle = 0.05;
  Sound.play(k);
  if (S.ammo[k] <= 0) {
    floatText(S.x, SQUAD_Y - 50, 'SEM MUNIÇÃO', '#aaa', 16);
    Sound.play('empty');
    S.weapon = 'pistol';
  }
  return true;
}

function selectWeapon(k) {
  if (!k || k === S.weapon) return;
  if (!S.owned[k]) { floatText(S.x, SQUAD_Y - 50, 'BLOQUEADA', '#888', 16); Sound.play('empty'); return; }
  if (S.ammo[k] <= 0) { floatText(S.x, SQUAD_Y - 50, 'SEM MUNIÇÃO', '#aaa', 16); Sound.play('empty'); return; }
  S.weapon = k;
  S.fireCd = Math.max(S.fireCd, 0.15); // trocar de arma não zera a recarga
  Sound.play('switch');
}
// próxima/anterior arma com munição
function cycleWeapon(dir) {
  const n = WEAPON_ORDER.length;
  let i = WEAPON_ORDER.indexOf(S.weapon);
  for (let s = 1; s < n; s++) {
    const k = WEAPON_ORDER[(i + dir * s + n * s) % n];
    if (S.owned[k] && S.ammo[k] > 0) { selectWeapon(k); return; }
  }
}

function steerMissile(b, dt) {
  if (!b.target || b.target.dead) {
    const d2 = z => (z.x - b.x) ** 2 + (z.y - b.y) ** 2;
    const near = S.zombies.filter(z => !z.dead).sort((p, q) => d2(p) - d2(q)).slice(0, 3);
    b.target = near.length ? pick(near) : null; // espalha os mísseis entre os alvos mais próximos
  }
  let a = Math.atan2(b.vy, b.vx);
  const sp = Math.min(560, Math.hypot(b.vx, b.vy) + 500 * dt);
  if (b.target) {
    let d = Math.atan2(b.target.y - b.y, b.target.x - b.x) - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    a += clamp(d, -6 * dt, 6 * dt);
  }
  b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp;
}

function damage(z, dmg) {
  if (z.dead) return;
  z.hp -= dmg;
  if (z.flashCd <= 0) { z.flash = 0.06; z.flashCd = 0.18; } // pisca, mas sem ficar branco direto
  if (z.hp > 0) { Sound.play('hit'); return; }
  z.dead = true;
  S.score += z.score; S.kills++;
  S.coins += COINS[z.type];
  if (COINS[z.type] >= 4) floatText(z.x, z.y - z.r - 10, '+' + COINS[z.type], '#fbbf24', 16);
  const big = z.type === 'boss';
  gore(z.x, z.y, big ? 60 : z.type === 'tank' ? 24 : 12);
  addDecal(z.x, z.y, z.r / 18);
  Sound.play('zdie');
  if (z.type === 'tank') S.shake = 0.15;
  if (big) {
    S.shake = 0.6;
    S.booms.push({ x: z.x, y: z.y, r: 90, life: 0.6, max: 0.6 });
    Sound.play('explosion');
    floatText(z.x, z.y, 'CHEFÃO ELIMINADO!', '#ffdd57', 26);
    S.count = Math.min(MAX_SQUAD, S.count + 2);
    Sound.play('squad');
  }
}

function explode(x, y, radius, dmg) {
  S.booms.push({ x, y, r: radius, life: 0.4, max: 0.4 });
  burst(x, y, '#ffb347', 18, 260, 0.35);
  burst(x, y, '#444', 10, 110, 0.8, 'chunk');
  S.shake = Math.max(S.shake, 0.12);
  Sound.play('explosion');
  for (const z of S.zombies) {
    if (Math.hypot(z.x - x, z.y - y) < radius + z.r) damage(z, dmg);
  }
}

function unlock(it) {
  it.done = true;
  const cx = it.x, cy = it.y;
  if (it.kind === 'weapon') {
    const k = it.weapon, w = WEAPONS[k], isNew = !S.owned[k];
    S.owned[k] = true;
    S.ammo[k] += w.ammo;
    if (isNew) S.weapon = k; // arma nova já vem equipada
    floatText(cx, cy, isNew ? w.name + '! [' + (WEAPON_ORDER.indexOf(k) + 1) + ']' : '+MUNIÇÃO ' + w.name,
      w.color, isNew ? 26 : 20);
    burst(cx, cy, w.color, 30, 260);
    burst(cx, cy, '#7a4f24', 14, 200, 0.7, 'chunk'); // lascas do caixote
    Sound.play('unlock');
  } else {
    const before = S.count;
    S.count = Math.min(MAX_SQUAD, S.count + it.amt);
    floatText(cx, cy, '+' + (S.count - before) + ' ATIRADOR', '#4ade80', 24);
    burst(cx, cy, '#60a5fa', 30, 260);
    Sound.play('squad');
  }
}

function loseShooter(x, y) {
  if (S.shield > 0) {
    S.shield--;
    burst(x, y, '#22d3ee', 20, 220);
    floatText(x, y - 20, 'ESCUDO!', '#22d3ee', 20);
    S.shake = 0.1;
    Sound.play('shield');
    return;
  }
  S.count--;
  burst(x, y, '#3a86ff', 12, 180);
  gore(x, y, 10);
  addDecal(x, y, 0.6);
  floatText(x, y - 20, '-1', '#ff4d4d', 22);
  S.shake = 0.2;
  Sound.play('lose');
  if (S.count <= 0) gameOver();
}

function gameOver() {
  mode = 'over';
  Sound.stopMusic();
  Sound.play('over');
  if (S.score > best) { best = S.score; try { localStorage.setItem('hordagun_best', best); } catch (e) {} }
}

// ===================== LOJA =====================
const SHOP_DELAY = 0.6; // ignora cliques logo que a loja abre (evita comprar/pular sem querer)
function upState(u) {
  if (u.level() >= u.max || (u.can && !u.can())) return 'max';
  return S.coins < u.cost() ? 'poor' : 'ok';
}
function openShop() {
  S.shopBonus = 10 + S.wave * 5;
  S.coins += S.shopBonus;
  S.bullets.length = 0;
  mode = 'shop'; S.shopAt = clock; S.hover = -1;
  mouseDown = false;
  Sound.stopMusic();
  Sound.play('shop');
}
function buyUpgrade(i) {
  const u = UPGRADES[i];
  if (!u || mode !== 'shop' || clock - S.shopAt < SHOP_DELAY) return;
  if (upState(u) !== 'ok') { Sound.play('empty'); return; }
  S.coins -= u.cost();
  u.buy();
  Sound.play('buy');
}
function nextWave() {
  if (mode !== 'shop' || clock - S.shopAt < SHOP_DELAY) return;
  mode = 'play';
  S.wave++; S.toSpawn = waveSize(S.wave); S.spawnCd = 2; S.banner = 2;
  Sound.startMusic();
  Sound.play('wave');
  if (S.wave % 5 === 0) spawnBoss();
}

// ===================== UPDATE =====================
const keys = {};
function update(dt) {
  S.scroll = (S.scroll + 80 * dt) % TILE_H;
  S.shake = Math.max(0, S.shake - dt);
  S.banner = Math.max(0, S.banner - dt);
  S.muzzle = Math.max(0, S.muzzle - dt);

  // movimento
  if (keys.ArrowLeft || keys.a) S.tx -= 450 * dt;
  if (keys.ArrowRight || keys.d) S.tx += 450 * dt;
  const hw = squadHalfWidth();
  S.tx = clamp(S.tx, hw, W - hw);
  S.x += (S.tx - S.x) * Math.min(1, dt * 12);

  // disparo: só enquanto segura o botão esquerdo (ou espaço / dedo na tela)
  const firing = mouseDown || keys[' '];
  S.fireCd = Math.max(S.fireCd - dt, firing ? -0.2 : 0);
  while (firing && S.fireCd <= 0) {
    if (!fire()) break;
    S.fireCd += 1 / (WEAPONS[S.weapon].rate * rateMult());
  }

  // spawn de zumbis / ondas
  if (S.toSpawn > 0) {
    S.spawnCd -= dt;
    if (S.spawnCd <= 0) {
      spawnZombie(); S.toSpawn--;
      S.spawnCd = Math.max(0.15, 1.4 - S.wave * 0.08) * rand(0.5, 1.4);
    }
  } else if (S.zombies.length === 0) {
    openShop();
    return;
  }
  Sound.setBoss(S.zombies.some(z => z.type === 'boss'));
  if (S.zombies.length && Math.random() < dt * Math.min(1.5, S.zombies.length * 0.08)) Sound.play('groan');

  // itens
  S.itemCd -= dt;
  if (S.itemCd <= 0) { spawnItem(); S.itemCd = rand(5, 9); }
  for (const it of S.items) {
    it.y += 50 * dt;
    it.flash = Math.max(0, it.flash - dt);
    it.pop = Math.max(0, it.pop - dt * 4);
    if (it.y - it.h / 2 > H) it.done = true;
  }

  // balas
  for (const b of S.bullets) {
    b.life -= dt;
    if (b.kind === 'missile') steerMissile(b, dt);
    if (b.kind === 'flame') { b.vx *= 0.97; b.vy *= 0.97; }
    if ((b.kind === 'missile' || b.kind === 'rocket') && Math.random() < 0.7) {
      S.parts.push({ x: b.x, y: b.y, vx: rand(-15, 15), vy: rand(-15, 15), life: 0.5, max: 0.5,
        color: '#9ca3af', kind: 'smoke', size: rand(2.5, 4), rot: 0, vr: 0 });
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.life <= 0 || b.y < -60 || b.y > H + 40 || b.x < -60 || b.x > W + 60) { b.dead = true; continue; }
    // acerta caixas de item (míssil teleguiado ignora caixas e vai direto nos zumbis)
    for (const it of S.items) {
      if (it.done || b.kind === 'missile') continue;
      if (Math.abs(b.x - it.x) < it.w / 2 && Math.abs(b.y - it.y) < it.h / 2) {
        b.dead = true; it.hits++; it.flash = 0.05; it.pop = 1;
        S.parts.push({ x: b.x, y: it.y + it.h / 2 - 2, vx: rand(-60, 60), vy: rand(20, 80), life: 0.25, max: 0.25,
          color: it.kind === 'weapon' ? '#d9a066' : '#93c5fd', kind: 'dot', size: 2, rot: 0, vr: 0 });
        Sound.play('itemHit');
        if (it.hits >= it.need) unlock(it);
        break;
      }
    }
    if (b.dead) continue;
    // acerta zumbis
    for (const z of S.zombies) {
      if (z.dead || b.hit.includes(z)) continue;
      const hr = z.r + (b.kind === 'flame' ? 10 : 3);
      if ((b.x - z.x) ** 2 + (b.y - z.y) ** 2 < hr * hr) {
        b.hit.push(z);
        if (b.splash) { explode(b.x, b.y, b.splash, b.dmg); b.dead = true; break; }
        damage(z, b.dmg);
        burst(b.x, b.y, '#6a1010', 3, 90, 0.25);
        if (--b.pierce <= 0) { b.dead = true; break; }
      }
    }
  }

  // zumbis
  const sl = slots();
  for (const z of S.zombies) {
    if (z.dead) continue;
    z.flash = Math.max(0, z.flash - dt);
    z.flashCd -= dt;
    z.wob += dt * (z.type === 'runner' ? 14 : z.type === 'boss' ? 3 : 6);
    z.y += z.speed * dt;
    // seguem o esquadrão de leve
    const dx = S.x - z.x;
    const step = Math.sign(dx) * Math.min(Math.abs(dx), z.speed * 0.35 * dt);
    z.x += step;
    z.drift = dt > 0 ? step / dt : 0;
    // colisão com atiradores
    for (const s of sl) {
      if ((s.x - z.x) ** 2 + (s.y - z.y) ** 2 < (z.r + 9) ** 2) {
        loseShooter(s.x, s.y);
        if (z.type === 'boss') z.y -= 60;
        else { z.dead = true; gore(z.x, z.y, 10); }
        break;
      }
    }
    if (mode !== 'play') return;
    if (!z.dead && z.y - z.r > H) { z.dead = true; loseShooter(S.x, SQUAD_Y); if (mode !== 'play') return; }
  }

  // explosões, partículas e textos
  for (const b of S.booms) b.life -= dt;
  for (const p of S.parts) {
    p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; p.rot += p.vr * dt; p.life -= dt;
  }
  for (const t of S.texts) { t.y -= 40 * dt; t.life -= dt; }
  for (const d of S.decals) { d.y += 80 * dt; d.a = Math.max(0, d.a - dt * 0.03); }

  S.bullets = S.bullets.filter(b => !b.dead);
  S.zombies = S.zombies.filter(z => !z.dead);
  S.items = S.items.filter(i => !i.done);
  S.booms = S.booms.filter(b => b.life > 0);
  S.parts = S.parts.filter(p => p.life > 0);
  S.texts = S.texts.filter(t => t.life > 0);
  S.decals = S.decals.filter(d => d.y < H + 50 && d.a > 0);
}

// ===================== DRAW =====================
function shadow(x, y, rx, ry) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
}

function drawBackground() {
  const t = SPR.tile, y0 = S.scroll - TILE_H;
  for (let y = y0; y < H; y += TILE_H) ctx.drawImage(t.c, 0, y, W, TILE_H);
  for (const d of S.decals) {
    ctx.globalAlpha = d.a;
    drawSprite(ctx, SPR.blood[d.i], d.x, d.y, d.rot, d.s);
  }
  ctx.globalAlpha = 1;
}

function outlined(txt, x, y, size, color, align = 'center', stroke = 4) {
  ctx.font = `900 ${size}px 'Trebuchet MS', system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = stroke; ctx.strokeText(txt, x, y);
  ctx.fillStyle = color; ctx.fillText(txt, x, y);
}

function drawItem(it) {
  const isW = it.kind === 'weapon';
  const col = isW ? WEAPONS[it.weapon].color : '#93c5fd';
  const sc = 1 + it.pop * 0.04;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(it.x - it.w / 2 + 6, it.y - it.h / 2 + 8, it.w, it.h);
  drawSprite(ctx, isW ? SPR.crate : SPR.panel, it.x, it.y, 0, sc);
  if (it.flash > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    rr(ctx, it.x - it.w / 2, it.y - it.h / 2, it.w, it.h, 7); ctx.fill();
  }
  const y = it.y - it.h / 2;
  if (isW) { // mostra a arma desenhada no caixote
    drawSprite(ctx, SPR.gun[it.weapon], it.x - 22, it.y + 8, Math.PI / 2, 1.3);
  }
  const label = !isW ? '+' + it.amt + ' ATIRADOR' : S.owned[it.weapon] ? 'MUNIÇÃO' : WEAPONS[it.weapon].name;
  outlined(label, it.x, y + 18, label.length > 10 ? 10 : 13, col, 'center', 3);
  outlined(Math.max(0, it.need - it.hits), it.x + (isW ? 10 : 0), y + 47, 26, '#fff');
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(it.x - it.w / 2 + 8, y + it.h - 12, it.w - 16, 6);
  ctx.fillStyle = col; ctx.fillRect(it.x - it.w / 2 + 8, y + it.h - 12, (it.w - 16) * (it.hits / it.need), 6);
}

function drawZombie(z) {
  const set = SPR.zombie[z.key];
  const frame = Math.sin(z.wob) > 0 ? 1 : 0;
  const spr = z.flash > 0 ? set[2 + frame] : set[frame];
  const tilt = Math.sin(z.wob * 0.5) * 0.12 - z.drift * 0.004;
  drawSprite(ctx, spr, z.x, z.y, tilt);
  if (z.hp < z.maxHp) {
    const bw = z.r * 2, by = z.y - z.r - 12;
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(z.x - bw / 2 - 1, by - 1, bw + 2, 6);
    ctx.fillStyle = z.type === 'boss' ? '#d946ef' : '#ef4444';
    ctx.fillRect(z.x - bw / 2, by, bw * Math.max(0, z.hp / z.maxHp), 4);
  }
}

function drawHUD() {
  const g = ctx.createLinearGradient(0, 0, 0, 62);
  g.addColorStop(0, 'rgba(0,0,0,0.85)'); g.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 62);

  outlined('ONDA ' + S.wave, 12, 26, 22, '#fde047', 'left');
  drawCoin(19, 43, 7);
  outlined(String(S.coins), 30, 49, 15, '#fbbf24', 'left', 3);
  outlined(S.score + ' pts', 88, 49, 12, '#94a3b8', 'left', 3);

  drawSprite(ctx, SPR.soldier[S.weapon], W / 2 - 28, 30, 0, 0.62);
  outlined('x' + S.count, W / 2 - 14, 30, 22, '#60a5fa', 'left');
  outlined('zumbis: ' + (S.toSpawn + S.zombies.length), W / 2, 52, 12, '#a3e635', 'center', 3);
  if (S.shield > 0) outlined('escudo ' + S.shield, W / 2 + 58, 30, 12, '#22d3ee', 'left', 3);

  const w = WEAPONS[S.weapon];
  outlined(w.name, W - 50, 24, 15, w.color, 'right');
  outlined(fmtAmmo(S.weapon), W - 50, 46, 14, '#e2e8f0', 'right', 3);
  drawMuteIcon();
  drawInventory();
}

function drawCoin(x, y, r) {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, '#fff3b0'); g.addColorStop(0.5, '#fbbf24'); g.addColorStop(1, '#b45309');
  ctx.fillStyle = g; circ(ctx, x, y, r);
  ctx.strokeStyle = 'rgba(120,53,15,0.8)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, Math.PI * 2); ctx.stroke();
}

const SHOP = { x0: 22, y0: 190, w: 212, h: 120, gx: 12, gy: 12, btn: { x: 100, y: 604, w: 280, h: 58 } };
function shopCardRect(i) {
  const c = i % 2, r = Math.floor(i / 2);
  return { x: SHOP.x0 + c * (SHOP.w + SHOP.gx), y: SHOP.y0 + r * (SHOP.h + SHOP.gy), w: SHOP.w, h: SHOP.h };
}
const inRect = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
function shopHit(p) {
  for (let i = 0; i < UPGRADES.length; i++) if (inRect(p, shopCardRect(i))) return i;
  return inRect(p, SHOP.btn) ? 'next' : -1;
}

function drawShop() {
  ctx.fillStyle = 'rgba(5,8,14,0.9)'; ctx.fillRect(0, 0, W, H);
  outlined('LOJA', W / 2, 92, 46, '#fde047', 'center', 7);
  outlined(`Onda ${S.wave} concluída!  Bônus +${S.shopBonus}`, W / 2, 124, 15, '#a3e635', 'center', 3);
  ctx.font = "900 28px 'Trebuchet MS', system-ui, sans-serif";
  const cw = ctx.measureText(String(S.coins)).width;
  drawCoin(W / 2 - cw / 2 - 14, 158, 11);
  outlined(String(S.coins), W / 2 + 6, 168, 28, '#fbbf24', 'center', 5);

  UPGRADES.forEach((u, i) => {
    const r = shopCardRect(i), st = upState(u), hov = S.hover === i && st === 'ok';
    ctx.fillStyle = hov ? '#2a3140' : '#171c25';
    rr(ctx, r.x, r.y, r.w, r.h, 10); ctx.fill();
    ctx.strokeStyle = st === 'ok' ? u.color : 'rgba(255,255,255,0.12)'; ctx.lineWidth = hov ? 3 : 1.5; ctx.stroke();
    ctx.globalAlpha = st === 'max' ? 0.45 : 1;
    ctx.fillStyle = u.color; rr(ctx, r.x + 6, r.y + 12, 4, r.h - 24, 2); ctx.fill();
    outlined(u.name, r.x + 18, r.y + 28, 17, u.color, 'left', 3);
    outlined('[' + (i + 1) + ']', r.x + r.w - 10, r.y + 24, 12, '#94a3b8', 'right', 3);
    ctx.font = "13px 'Trebuchet MS', system-ui, sans-serif"; ctx.fillStyle = '#cbd5e1'; ctx.textAlign = 'left';
    u.desc.forEach((d, j) => ctx.fillText(d, r.x + 18, r.y + 52 + j * 17));
    outlined(u.info(), r.x + 18, r.y + r.h - 14, 12, '#94a3b8', 'left', 3);
    if (st === 'max') outlined(u.level() >= u.max ? 'MÁXIMO' : '—', r.x + r.w - 12, r.y + r.h - 13, 13, '#64748b', 'right', 3);
    else {
      const c = String(u.cost());
      outlined(c, r.x + r.w - 12, r.y + r.h - 12, 18, st === 'ok' ? '#fbbf24' : '#ef4444', 'right', 4);
      drawCoin(r.x + r.w - 22 - ctx.measureText(c).width, r.y + r.h - 18, 7);
    }
    ctx.globalAlpha = 1;
  });

  const b = SHOP.btn, hovB = S.hover === 'next', ready = clock - S.shopAt >= SHOP_DELAY;
  ctx.fillStyle = !ready ? '#14532d' : hovB ? '#22c55e' : '#16a34a';
  rr(ctx, b.x, b.y, b.w, b.h, 12); ctx.fill();
  ctx.strokeStyle = '#86efac'; ctx.lineWidth = 2; ctx.stroke();
  outlined('PRÓXIMA ONDA  »', W / 2, b.y + 38, 22, '#fff', 'center', 4);
  ctx.font = "13px 'Trebuchet MS', system-ui, sans-serif"; ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'center';
  ctx.fillText('1 a 6 = comprar     Enter = próxima onda', W / 2, b.y + b.h + 28);
  if ((S.wave + 1) % 5 === 0) outlined('Atenção: a próxima onda tem CHEFÃO!', W / 2, b.y + b.h + 56, 15, '#d946ef', 'center', 3);
}

function fmtAmmo(k) { return S.ammo[k] === Infinity ? '∞' : String(S.ammo[k]); }

// barra de inventário: 7 espaços, um por arma (tecla 1 a 7)
const INV = { x: 14, y: 62, w: 62, h: 44, gap: 3 };
function invSlotAt(px, py) {
  if (py < INV.y || py > INV.y + INV.h) return -1;
  const i = Math.floor((px - INV.x) / (INV.w + INV.gap));
  if (i < 0 || i >= WEAPON_ORDER.length || px - INV.x - i * (INV.w + INV.gap) > INV.w) return -1;
  return i;
}
function drawInventory() {
  WEAPON_ORDER.forEach((k, i) => {
    const x = INV.x + i * (INV.w + INV.gap), y = INV.y, w = WEAPONS[k];
    const owned = S.owned[k], sel = S.weapon === k;
    ctx.fillStyle = sel ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.55)';
    rr(ctx, x, y, INV.w, INV.h, 6); ctx.fill();
    ctx.strokeStyle = sel ? w.color : 'rgba(255,255,255,0.15)'; ctx.lineWidth = sel ? 2.5 : 1; ctx.stroke();
    ctx.globalAlpha = owned ? 1 : 0.2;
    ctx.filter = 'brightness(2.2)'; // armas são escuras; clareia para ler no fundo preto
    drawSprite(ctx, SPR.gun[k], x + INV.w / 2 + 6, y + 19, Math.PI / 2, k === 'pistol' ? 1.6 : 1.15);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    outlined(String(i + 1), x + 5, y + 14, 12, owned ? '#fff' : '#666', 'left', 3);
    const empty = owned && S.ammo[k] <= 0;
    outlined(owned ? fmtAmmo(k) : '- - -', x + INV.w / 2, y + INV.h - 4, S.ammo[k] === Infinity ? 16 : 11,
      !owned ? '#555' : empty ? '#ef4444' : '#e2e8f0', 'center', 3);
  });
}

const MUTE_BTN = { x: W - 24, y: 28, r: 15 };
function drawMuteIcon() {
  const { x, y } = MUTE_BTN;
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; circ(ctx, x, y, MUTE_BTN.r);
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.moveTo(x - 9, y - 4); ctx.lineTo(x - 5, y - 4); ctx.lineTo(x, y - 9);
  ctx.lineTo(x, y + 9); ctx.lineTo(x - 5, y + 4); ctx.lineTo(x - 9, y + 4); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = Sound.muted ? '#ef4444' : '#e2e8f0'; ctx.lineWidth = 2;
  if (Sound.muted) { line(ctx, x + 3, y - 5, x + 10, y + 5); line(ctx, x + 10, y - 5, x + 3, y + 5); }
  else { ctx.beginPath(); ctx.arc(x + 1, y, 5, -0.9, 0.9); ctx.stroke(); ctx.beginPath(); ctx.arc(x + 1, y, 9, -0.9, 0.9); ctx.stroke(); }
}

function overlay(title, lines, color) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(0,0,0,0.85)'); g.addColorStop(0.5, 'rgba(0,0,0,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0.85)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  outlined(title, W / 2, H / 2 - 90, 52, color, 'center', 8);
  ctx.font = "17px 'Trebuchet MS', system-ui"; ctx.textAlign = 'center'; ctx.fillStyle = '#e2e8f0';
  lines.forEach((l, i) => ctx.fillText(l, W / 2, H / 2 - 30 + i * 28));
}

function drawMenu() {
  overlay('HORDAGUN', [
    'Mova o esquadrão: mouse / dedo / ← →',
    'Segure o BOTÃO ESQUERDO (ou espaço) para atirar',
    'Teclas 1 a 7 ou rodinha: trocar de arma',
    'Atire nos CAIXOTES para ganhar armas e munição',
    'Atire nos painéis AZUIS para ganhar atiradores',
    'Entre as ondas: LOJA de upgrades com suas moedas',
    '', 'Clique ou ESPAÇO para começar', 'M = som   P = pausa', best ? 'Recorde: ' + best : ''], '#fde047');
  const bob = Math.sin(clock * 3);
  drawSprite(ctx, SPR.zombie.boss0[bob > 0 ? 1 : 0], W / 2, 170 + bob * 4, Math.sin(clock * 1.5) * 0.1);
  drawSprite(ctx, SPR.zombie.walker0[bob > 0 ? 0 : 1], W / 2 - 110, 220, 0.2);
  drawSprite(ctx, SPR.zombie.runner0[bob > 0 ? 1 : 0], W / 2 + 115, 215, -0.2);
  WEAPON_ORDER.forEach((k, i) =>
    drawSprite(ctx, SPR.soldier[k], W / 2 + (i - 3) * 50, H - 95, 0, 1.2));
}

function draw() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.save();
  if (S.shake > 0) ctx.translate(rand(-6, 6) * S.shake * 4, rand(-6, 6) * S.shake * 4);
  drawBackground();

  // sombras
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  for (const z of S.zombies) shadow(z.x + 3, z.y + 5, z.r * 1.05, z.r * 0.75);
  const sl = slots();
  for (const s of sl) shadow(s.x + 3, s.y + 4, 11, 8);

  for (const it of S.items) drawItem(it);
  for (const z of S.zombies) drawZombie(z);
  for (let i = sl.length - 1; i >= 0; i--) drawSprite(ctx, SPR.soldier[S.weapon], sl[i].x, sl[i].y);
  if (S.shield > 0 && S.count > 0) { // bolha do escudo em volta do esquadrão
    const rows = Math.ceil(S.count / PER_ROW), half = (rows - 1) * ROW_GAP / 2;
    ctx.beginPath();
    ctx.ellipse(S.x, SQUAD_Y + half - 6, squadHalfWidth() + 14, half + 30, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(34,211,238,0.07)'; ctx.fill();
    ctx.strokeStyle = `rgba(34,211,238,${0.45 + Math.sin(clock * 4) * 0.15})`; ctx.lineWidth = 1 + S.shield;
    ctx.stroke();
  }

  // brilhos (modo aditivo)
  ctx.globalCompositeOperation = 'lighter';
  if (S.muzzle > 0 && S.weapon !== 'laser' && S.weapon !== 'flame') {
    const tip = GUN_TIP[S.weapon], big = S.weapon === 'rocket' || S.weapon === 'missile';
    for (const s of sl) drawSprite(ctx, SPR.muzzle, s.x + 4, s.y + tip - 6, 0, big ? 1.5 : 1);
  }
  for (const b of S.bullets) {
    if (b.kind === 'flame') { // bola de fogo que cresce e some
      const k = b.life / b.max;
      ctx.globalAlpha = Math.min(1, k * 1.5);
      drawSprite(ctx, b.glow, b.x, b.y, 0, 0.7 + (1 - k) * 1.8);
      continue;
    }
    if (b.kind === 'rocket' || b.kind === 'missile') { // chama do propulsor
      const sp = Math.hypot(b.vx, b.vy) || 1;
      drawSprite(ctx, b.glow, b.x - b.vx / sp * 9, b.y - b.vy / sp * 9, 0, 1.1);
      continue;
    }
    ctx.strokeStyle = b.color; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.018, b.y - b.vy * 0.018); ctx.stroke();
    drawSprite(ctx, b.glow, b.x, b.y, 0, 0.8);
  }
  ctx.globalAlpha = 1;
  for (const b of S.booms) {
    const k = b.life / b.max;
    ctx.globalAlpha = k;
    drawSprite(ctx, SPR.glow.fire, b.x, b.y, 0, (b.r * 2.6 / 64) * (1.2 - k * 0.5));
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  for (const b of S.bullets) { // corpo dos foguetes/mísseis, apontando para onde voam
    if (b.kind === 'rocket' || b.kind === 'missile')
      drawSprite(ctx, b.kind === 'missile' ? SPR.missile : SPR.rocket, b.x, b.y, Math.atan2(b.vy, b.vx) + Math.PI / 2);
  }
  for (const b of S.booms) { // onda de choque
    const k = b.life / b.max;
    ctx.strokeStyle = `rgba(255,220,150,${k * 0.8})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (1.3 - k), 0, Math.PI * 2); ctx.stroke();
  }

  for (const p of S.parts) {
    ctx.globalAlpha = Math.min(1, p.life / p.max * 1.5); ctx.fillStyle = p.color;
    if (p.kind === 'smoke') {
      ctx.globalAlpha = p.life / p.max * 0.45;
      circ(ctx, p.x, p.y, p.size * (1 + (1 - p.life / p.max) * 2));
    } else if (p.kind === 'shell' || p.kind === 'chunk') {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillRect(-p.size / 2, -p.size, p.size, p.size * (p.kind === 'shell' ? 2 : 1.3));
      ctx.restore();
    } else ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  for (const t of S.texts) {
    ctx.globalAlpha = Math.min(1, t.life * 2);
    outlined(t.txt, t.x, t.y, t.size, t.color);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  ctx.drawImage(SPR.vignette.c, 0, 0, W, H);
  drawHUD();

  if (S.banner > 0 && mode === 'play') {
    ctx.globalAlpha = Math.min(1, S.banner);
    const boss = S.wave % 5 === 0;
    const sc = 1 + Math.max(0, S.banner - 1.7) * 2;
    ctx.save(); ctx.translate(W / 2, H / 2 - 110); ctx.scale(sc, sc);
    outlined(boss ? 'ONDA ' + S.wave + ' — CHEFÃO!' : 'ONDA ' + S.wave, 0, 0, boss ? 40 : 52, boss ? '#d946ef' : '#fde047', 'center', 8);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  if (mode === 'shop') drawShop();
  if (mode === 'menu') drawMenu();
  if (mode === 'paused') overlay('PAUSADO', ['P para continuar'], '#fff');
  if (mode === 'over') overlay('GAME OVER', [
    'Onda alcançada: ' + S.wave, 'Zumbis mortos: ' + S.kills, 'Pontos: ' + S.score,
    'Recorde: ' + best, '', 'Clique ou ESPAÇO para jogar de novo'], '#ef4444');
}

// ===================== INPUT =====================
function toGame(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
}
function start() { Sound.init(); reset(); mode = 'play'; Sound.startMusic(); Sound.play('wave'); }
function togglePause() {
  if (mode === 'play') { mode = 'paused'; Sound.stopMusic(); }
  else if (mode === 'paused') { mode = 'play'; Sound.startMusic(); }
}
let mouseDown = false; // botão esquerdo (ou dedo na tela) pressionado = atirando
cv.addEventListener('pointermove', e => {
  if (e.pointerType === 'mouse' && !(e.buttons & 1)) mouseDown = false; // soltou fora da janela
  if (mode === 'play') S.tx = toGame(e).x;
  if (mode === 'shop') S.hover = shopHit(toGame(e));
});
cv.addEventListener('pointerdown', e => {
  Sound.init();
  const p = toGame(e);
  if (Math.hypot(p.x - MUTE_BTN.x, p.y - MUTE_BTN.y) < MUTE_BTN.r + 6) { Sound.toggleMute(); return; }
  if (mode === 'menu' || mode === 'over') { start(); return; }
  if (mode === 'shop') {
    const h = shopHit(p);
    if (h === 'next') nextWave(); else if (h >= 0) buyUpgrade(h);
    return;
  }
  if (mode !== 'play') return;
  const slot = invSlotAt(p.x, p.y);
  if (slot >= 0) { selectWeapon(WEAPON_ORDER[slot]); return; }
  S.tx = p.x;
  if (e.button === 0) { mouseDown = true; cv.setPointerCapture(e.pointerId); }
});
const release = () => { mouseDown = false; };
addEventListener('pointerup', release);
addEventListener('pointercancel', release);
addEventListener('blur', () => { release(); for (const k in keys) keys[k] = false; });
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('wheel', e => {
  if (mode !== 'play') return;
  e.preventDefault();
  cycleWeapon(Math.sign(e.deltaY));
}, { passive: false });
addEventListener('keydown', e => {
  if (e.key === ' ') e.preventDefault(); // não rolar a página
  if (e.repeat) { keys[e.key] = true; return; }
  keys[e.key] = true;
  if (e.key === ' ' && (mode === 'menu' || mode === 'over')) start();
  if (e.key === 'p' || e.key === 'P') togglePause();
  if (e.key === 'm' || e.key === 'M') { Sound.init(); Sound.toggleMute(); }
  if (mode === 'shop') {
    if (e.key >= '1' && e.key <= String(UPGRADES.length)) buyUpgrade(+e.key - 1);
    if (e.key === 'Enter') nextWave();
  }
  if (mode === 'play') {
    if (e.key >= '1' && e.key <= String(WEAPON_ORDER.length)) selectWeapon(WEAPON_ORDER[+e.key - 1]);
    if (e.key === 'q' || e.key === 'Q') cycleWeapon(-1);
    if (e.key === 'e' || e.key === 'E') cycleWeapon(1);
  }
});
addEventListener('keyup', e => { keys[e.key] = false; });
// pausa sozinho ao trocar de aba
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') togglePause(); });

// ===================== LOOP =====================
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  clock += dt;
  if (mode === 'play') update(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
