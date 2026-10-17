// Sons e música sintetizados com Web Audio (sem arquivos de áudio)
const Sound = (() => {
  let ac = null, master, sfxBus, musicBus, noiseBuf;
  let muted = false;
  try { muted = localStorage.getItem('hordagun_mute') === '1'; } catch (e) {}
  const last = {};

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    const comp = ac.createDynamicsCompressor();
    comp.connect(ac.destination);
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.6; master.connect(comp);
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master);
    musicBus = ac.createGain(); musicBus.gain.value = 0.22; musicBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  function env(g, t, vol, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  // t = tempo absoluto do AudioContext
  function tone(type, f1, f2, dur, vol, t, bus = sfxBus) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f1, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + dur);
    env(g, t, vol, dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, type, f1, f2, t, bus = sfxBus, q = 1) {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf;
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f1, t);
    f.frequency.exponentialRampToValueAtTime(f2, t + dur);
    env(g, t, vol, dur);
    s.connect(f); f.connect(g); g.connect(bus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  const fx = {
    pistol(t)  { noise(0.09, 0.35, 'bandpass', 2600, 700, t, sfxBus, 0.8); tone('square', 420, 110, 0.06, 0.1, t); },
    shotgun(t) { noise(0.3, 0.7, 'lowpass', 3500, 250, t); tone('sine', 150, 45, 0.2, 0.45, t); },
    minigun(t) { noise(0.05, 0.3, 'bandpass', 3200, 1200, t); tone('square', 260, 140, 0.035, 0.07, t); },
    laser(t)   { tone('sawtooth', 1900, 280, 0.15, 0.1, t); tone('sine', 2600, 700, 0.12, 0.1, t); },
    rocket(t)  { noise(0.4, 0.35, 'bandpass', 500, 2800, t, sfxBus, 2); tone('triangle', 180, 520, 0.25, 0.1, t); },
    explosion(t) { noise(0.8, 0.9, 'lowpass', 1400, 50, t); tone('sine', 95, 28, 0.6, 0.6, t); },
    hit(t)     { noise(0.05, 0.15, 'lowpass', 1000, 250, t); },
    itemHit(t) { tone('square', 1250 + Math.random() * 250, 1000, 0.035, 0.05, t); },
    zdie(t)    { tone('sawtooth', 170 + Math.random() * 70, 45, 0.28, 0.12, t); noise(0.18, 0.28, 'lowpass', 800, 120, t); },
    unlock(t)  { [523, 659, 784, 1047].forEach((f, i) => tone('square', f, f, 0.13, 0.11, t + i * 0.07)); },
    squad(t)   { [392, 523, 659, 784].forEach((f, i) => tone('triangle', f, f * 1.01, 0.16, 0.22, t + i * 0.06)); },
    lose(t)    { tone('sawtooth', 420, 70, 0.4, 0.2, t); noise(0.25, 0.35, 'lowpass', 1600, 150, t); },
    wave(t)    { tone('sawtooth', 220, 220, 0.3, 0.1, t); tone('sawtooth', 330, 330, 0.5, 0.1, t + 0.28); },
    boss(t)    { tone('sawtooth', 75, 35, 1.4, 0.35, t); noise(1.2, 0.3, 'lowpass', 450, 60, t); },
    over(t)    { [392, 330, 262, 196].forEach((f, i) => tone('triangle', f, f * 0.97, 0.35, 0.22, t + i * 0.24)); },
    missile(t) { noise(0.5, 0.3, 'bandpass', 700, 3500, t, sfxBus, 3); tone('sine', 300, 900, 0.3, 0.07, t); },
    flame(t)   { noise(0.14, 0.28, 'bandpass', 700, 350, t, sfxBus, 0.6); },
    switch(t)  { tone('square', 800, 800, 0.03, 0.08, t); tone('square', 1200, 1200, 0.03, 0.08, t + 0.05); },
    empty(t)   { tone('square', 180, 120, 0.06, 0.1, t); noise(0.03, 0.15, 'highpass', 3000, 3000, t); },
    groan(t) {
      const o = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain();
      const f = ac.createBiquadFilter(), g = ac.createGain();
      const base = 65 + Math.random() * 55, dur = 0.7 + Math.random() * 0.5;
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(base, t);
      o.frequency.linearRampToValueAtTime(base * 0.7, t + dur);
      lfo.frequency.value = 5 + Math.random() * 5; lg.gain.value = 9;
      lfo.connect(lg); lg.connect(o.frequency);
      f.type = 'lowpass'; f.frequency.value = 520;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.07, t + 0.2);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(f); f.connect(g); g.connect(sfxBus);
      o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
    },
  };
  // intervalo mínimo entre repetições do mesmo som (evita "metralhar" o áudio)
  const GAP = { pistol: 0.05, minigun: 0.06, flame: 0.07, empty: 0.15, hit: 0.04, itemHit: 0.035, zdie: 0.05, explosion: 0.08, groan: 0.9 };

  function play(name) {
    if (!ac || muted || !fx[name]) return;
    const t = ac.currentTime;
    if (last[name] && t - last[name] < (GAP[name] || 0.02)) return;
    last[name] = t;
    fx[name](t);
  }

  // ---------- música: sequenciador simples de bateria + baixo ----------
  const BASS = [55, 55, 65.41, 55, 49, 49, 58.27, 61.74]; // lá menor sombrio
  let timer = null, step = 0, nextT = 0, boss = false;
  function schedule() {
    const stepDur = 60 / (boss ? 150 : 112) / 4;
    while (nextT < ac.currentTime + 0.15) {
      const t = nextT, s = step % 16;
      if (s % 4 === 0) tone('sine', 150, 40, 0.18, 0.9, t, musicBus);                 // bumbo
      if (s % 8 === 4) noise(0.14, 0.5, 'bandpass', 1800, 900, t, musicBus, 0.7);     // caixa
      if (s % 2 === 1) noise(0.03, boss ? 0.25 : 0.12, 'highpass', 7000, 7000, t, musicBus); // chimbal
      if (s % 2 === 0) {
        const f = BASS[(step >> 1) % 8] * (boss ? 1.06 : 1);
        tone('sawtooth', f, f, stepDur * 1.8, 0.35, t, musicBus);
      }
      nextT += stepDur; step++;
    }
  }
  function startMusic() {
    if (!ac || timer) return;
    nextT = ac.currentTime + 0.05;
    timer = setInterval(schedule, 40);
  }
  function stopMusic() { clearInterval(timer); timer = null; }
  function setBoss(v) { boss = v; }

  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.6;
    try { localStorage.setItem('hordagun_mute', muted ? '1' : '0'); } catch (e) {}
  }

  return { init, play, startMusic, stopMusic, setBoss, toggleMute, get muted() { return muted; } };
})();
