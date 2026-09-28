/* ================================================================
   SOM — tudo sintetizado na hora com WebAudio: golpes, flechas,
   magias, explosões, moedas, fanfarra de nível; música ambiente
   generativa e o som do mundo (vento, pássaros de dia, grilos à noite).
   Nenhum arquivo de áudio: o jogo continua cabendo num .html.
   ================================================================ */
let ctx: AudioContext | null = null;
let mestre: GainNode, sfx: GainNode, mus: GainNode, amb: GainNode;
let ruido: AudioBuffer;
let volSfx = .8, volMus = .45;
const ultimo = new Map<string, number>();
let vozes = 0;

export function iniciarAudio() {
  if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.ratio.value = 5; comp.attack.value = .004; comp.release.value = .2;
  mestre = ctx.createGain(); mestre.gain.value = .9;
  sfx = ctx.createGain(); sfx.gain.value = volSfx;
  mus = ctx.createGain(); mus.gain.value = volMus * .32;
  amb = ctx.createGain(); amb.gain.value = volMus * .5;
  sfx.connect(mestre); mus.connect(mestre); amb.connect(mestre);
  mestre.connect(comp); comp.connect(ctx.destination);
  ruido = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = ruido.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  iniciarMusica();
  iniciarAmbiente();
}
export function volumes(s: number, m: number) {
  volSfx = s; volMus = m;
  if (!ctx) return;
  sfx.gain.setTargetAtTime(s, ctx.currentTime, .05);
  mus.gain.setTargetAtTime(m * .32, ctx.currentTime, .3);
  amb.gain.setTargetAtTime(m * .5, ctx.currentTime, .3);
}
export function pausarAudio(p: boolean) {
  if (!ctx) return;
  if (p) ctx.suspend(); else ctx.resume();
}

/* ---------- blocos ---------- */
function env(g: GainNode, t: number, a: number, pico: number, dec: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(.0002, pico), t + a);
  g.gain.exponentialRampToValueAtTime(.0001, t + a + dec);
}
function osc(tipo: OscillatorType, f0: number, f1: number, t: number, dur: number, vol: number, destino: AudioNode, a = .005) {
  const c = ctx!, o = c.createOscillator(), g = c.createGain();
  o.type = tipo; o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  env(g, t, a, vol, dur);
  o.connect(g); g.connect(destino);
  o.start(t); o.stop(t + a + dur + .05);
  vozes++; o.onended = () => { vozes--; };
}
function chiado(t: number, dur: number, vol: number, filtro: BiquadFilterType, f0: number, f1: number, q = 1, destino: AudioNode = sfx, a = .004) {
  const c = ctx!, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = ruido; s.playbackRate.value = .8 + Math.random() * .4;
  f.type = filtro; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  env(g, t, a, vol, dur);
  s.connect(f); f.connect(g); g.connect(destino);
  const off = Math.random() * 1.5;
  s.start(t, off); s.stop(t + a + dur + .05);
  vozes++; s.onended = () => { vozes--; };
}

type Receita = (t: number, v: number) => void;
const R: Record<string, Receita> = {
  clique: (t, v) => osc("sine", 1400, 900, t, .04, .15 * v, sfx),
  nega: (t, v) => { osc("square", 150, 110, t, .12, .08 * v, sfx); },
  impacto: (t, v) => { chiado(t, .07, .35 * v, "lowpass", 2400, 500); osc("sine", 140, 60, t, .09, .35 * v, sfx); },
  impactoForte: (t, v) => { chiado(t, .14, .5 * v, "lowpass", 1800, 300); osc("sine", 110, 40, t, .18, .55 * v, sfx); },
  dor: (t, v) => { chiado(t, .1, .4 * v, "lowpass", 1400, 300); osc("triangle", 180, 90, t, .16, .3 * v, sfx); },
  esquiva: (t, v) => chiado(t, .16, .2 * v, "bandpass", 900, 2600, 2),
  espada: (t, v) => { chiado(t, .14, .22 * v, "bandpass", 1200, 3400, 1.6); osc("sine", 2600 + Math.random() * 500, 2300, t + .05, .18, .05 * v, sfx); },
  mordida: (t, v) => { chiado(t, .09, .3 * v, "lowpass", 1100, 350); osc("sawtooth", 95, 70, t, .12, .12 * v, sfx); },
  mordidaForte: (t, v) => { chiado(t, .16, .45 * v, "lowpass", 900, 200); osc("sawtooth", 70, 45, t, .25, .2 * v, sfx); },
  rugido: (t, v) => { osc("sawtooth", 90, 60, t, .5, .16 * v, sfx, .06); chiado(t, .5, .15 * v, "lowpass", 600, 200, 1, sfx, .06); },
  flecha: (t, v) => { osc("triangle", 520, 260, t, .08, .14 * v, sfx); chiado(t + .02, .18, .14 * v, "highpass", 1800, 5000); },
  fogo: (t, v) => chiado(t, .35, .28 * v, "lowpass", 400, 2400, 1, sfx, .03),
  gelo: (t, v) => { for (let i = 0; i < 4; i++) osc("sine", 1800 + i * 640 + Math.random() * 200, 1500, t + i * .025, .25, .06 * v, sfx); chiado(t, .3, .12 * v, "highpass", 3000, 7000); },
  trevas: (t, v) => { osc("sawtooth", 160, 55, t, .45, .12 * v, sfx, .03); osc("sawtooth", 163, 57, t, .45, .1 * v, sfx, .03); chiado(t, .4, .1 * v, "lowpass", 900, 150); },
  fogoLanca: (t, v) => { chiado(t, .5, .3 * v, "bandpass", 300, 1800, 1.2, sfx, .1); osc("triangle", 220, 440, t, .4, .08 * v, sfx, .08); },
  geloLanca: (t, v) => { for (let i = 0; i < 5; i++) osc("sine", 1200 + i * 400, 2400 + i * 300, t + i * .04, .3, .05 * v, sfx); },
  cura: (t, v) => { [523, 659, 784, 1046].forEach((f, i) => osc("sine", f, f, t + i * .06, .5, .08 * v, sfx, .02)); },
  magia: (t, v) => { osc("triangle", 880, 1320, t, .15, .07 * v, sfx); },
  terremoto: (t, v) => { osc("sine", 70, 30, t, .6, .7 * v, sfx); chiado(t, .6, .45 * v, "lowpass", 500, 80); },
  investida: (t, v) => { chiado(t, .35, .3 * v, "bandpass", 400, 1400, 1.5); osc("sawtooth", 120, 200, t, .2, .1 * v, sfx); },
  explosao: (t, v) => { chiado(t, .9, .8 * v, "lowpass", 3000, 120); osc("sine", 120, 30, t, .8, .9 * v, sfx); },
  explosaoMedia: (t, v) => { chiado(t, .55, .55 * v, "lowpass", 2600, 150); osc("sine", 140, 40, t, .45, .6 * v, sfx); },
  chuva: (t, v) => { for (let i = 0; i < 6; i++) osc("sine", 1000 + Math.random() * 1400, 900, t + i * .05, .3, .05 * v, sfx); },
  baque: (t, v) => { osc("sine", 90, 35, t, .3, .6 * v, sfx); chiado(t, .25, .3 * v, "lowpass", 700, 100); },
  nivel: (t, v) => { [523, 659, 784, 1046, 1318].forEach((f, i) => { osc("triangle", f, f, t + i * .09, .45, .12 * v, sfx, .01); osc("sine", f * 2, f * 2, t + i * .09, .3, .03 * v, sfx); }); },
  morte: (t, v) => { osc("triangle", 440, 110, t, .9, .15 * v, sfx, .02); osc("sine", 330, 80, t + .1, .9, .1 * v, sfx); },
  morteBicho: (t, v) => { osc("sawtooth", 180, 60, t, .35, .1 * v, sfx); chiado(t, .3, .15 * v, "lowpass", 700, 150); },
  renascer: (t, v) => { for (let i = 0; i < 6; i++) osc("sine", 400 + i * 150, 800 + i * 200, t + i * .05, .5, .05 * v, sfx, .05); },
  pocao: (t, v) => { for (let i = 0; i < 3; i++) osc("sine", 300 + i * 90 + Math.random() * 60, 700, t + i * .07, .08, .12 * v, sfx); },
  moedas: (t, v) => { for (let i = 0; i < 3; i++) osc("sine", 2200 + Math.random() * 900, 2000, t + i * .06, .14, .06 * v, sfx); },
  loot: (t, v) => { [880, 1175, 1568].forEach((f, i) => osc("sine", f, f, t + i * .05, .25, .07 * v, sfx)); },
  grupo: (t, v) => { osc("triangle", 660, 660, t, .18, .1 * v, sfx); osc("triangle", 880, 880, t + .12, .25, .1 * v, sfx); },
  trovao: (t, v) => { chiado(t, .08, .6 * v, "highpass", 2500, 6000); chiado(t + .04, .7, .55 * v, "lowpass", 1600, 90); osc("sine", 90, 35, t + .03, .6, .5 * v, sfx); },
  lamina: (t, v) => { for (let i = 0; i < 4; i++) chiado(t + i * .07, .08, .16 * v, "bandpass", 1500 + i * 300, 3200, 2); },
  veneno: (t, v) => { for (let i = 0; i < 4; i++) osc("sine", 260 + Math.random() * 180, 520, t + i * .05, .07, .07 * v, sfx); },
  equipar: (t, v) => { chiado(t, .08, .25 * v, "bandpass", 2400, 1200, 3); osc("sine", 1900, 1700, t + .02, .12, .05 * v, sfx); },
};

export function som(nome: string, v = 1) {
  if (!ctx || v <= .02 || volSfx <= 0) return;
  if (ctx.state !== "running") return;
  const agora = ctx.currentTime;
  const u = ultimo.get(nome) || 0;
  if (agora - u < .045) return;
  if (vozes > 48) return;
  ultimo.set(nome, agora);
  const r = R[nome];
  if (r) r(agora + .005, Math.min(1, v));
}

/* ---------- música generativa ---------- */
let noite = 0, combate = 0;
export function climaMusical(n: number, c: number) { noite = n; combate = c; }
function iniciarMusica() {
  const c = ctx!;
  /* reverberação barata: eco com filtro */
  const eco = c.createDelay(1); eco.delayTime.value = .38;
  const fb = c.createGain(); fb.gain.value = .35;
  const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1800;
  eco.connect(lp); lp.connect(fb); fb.connect(eco); lp.connect(mus);
  const escala = [0, 2, 3, 5, 7, 9, 10];            // dórico
  const acordes = [[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [-5, -1, 2], [5, 9, 12], [3, 7, 10]];
  const base = 146.83;                               // Ré
  const hz = (st: number) => base * Math.pow(2, st / 12);
  let passo = 0, acorde = 0;
  const tick = () => {
    if (!ctx || ctx.state !== "running") return;
    const t = ctx.currentTime + .05;
    const bpm = 64 + combate * 26, bt = 60 / bpm;
    if (passo % 8 === 0) {
      acorde = (acorde + 1 + (Math.random() < .3 ? 1 : 0)) % acordes.length;
      const A = acordes[acorde];
      for (const n of A) {
        const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
        o.type = "triangle"; o.frequency.value = hz(n - 12);
        f.type = "lowpass"; f.frequency.value = 900 - noite * 400;
        g.gain.setValueAtTime(.0001, t);
        g.gain.linearRampToValueAtTime(.05, t + bt * 2);
        g.gain.linearRampToValueAtTime(.0001, t + bt * 8.5);
        o.connect(f); f.connect(g); g.connect(mus); g.connect(eco);
        o.start(t); o.stop(t + bt * 9);
      }
    }
    /* dedilhado: notas da escala que caem no acorde, às vezes silêncio */
    if (Math.random() < (.55 + combate * .3) - noite * .2) {
      const A = acordes[acorde];
      const grau = Math.random() < .6 ? A[Math.floor(Math.random() * 3)] : escala[Math.floor(Math.random() * 7)];
      const oit = Math.random() < .5 ? 12 : 24;
      const o = c.createOscillator(), g = c.createGain();
      o.type = combate > .5 ? "sawtooth" : "sine";
      o.frequency.value = hz(grau + oit - 12);
      g.gain.setValueAtTime(.0001, t);
      g.gain.exponentialRampToValueAtTime(.04 * (combate > .5 ? .5 : 1), t + .01);
      g.gain.exponentialRampToValueAtTime(.0001, t + bt * 1.8);
      const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 2200;
      o.connect(f); f.connect(g); g.connect(mus); g.connect(eco);
      o.start(t); o.stop(t + bt * 2);
    }
    if (combate > .5 && passo % 2 === 0) {
      /* tambor baixo no combate */
      const o = c.createOscillator(), g = c.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(45, t + .2);
      g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.0001, t + .25);
      o.connect(g); g.connect(mus); o.start(t); o.stop(t + .3);
    }
    passo++;
  };
  let prox = 0;
  setInterval(() => {
    if (!ctx) return;
    const bt = 60 / (64 + combate * 26);
    if (ctx.currentTime >= prox) { tick(); prox = ctx.currentTime + bt; }
  }, 60);
}
/* ---------- som do mundo ---------- */
function iniciarAmbiente() {
  const c = ctx!;
  const s = c.createBufferSource(); s.buffer = ruido; s.loop = true;
  const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 500; f.Q.value = .6;
  const g = c.createGain(); g.gain.value = .05;
  s.connect(f); f.connect(g); g.connect(amb); s.start();
  setInterval(() => {
    if (!ctx || ctx.state !== "running") return;
    const t = ctx.currentTime;
    f.frequency.setTargetAtTime(350 + Math.random() * 500, t, 1.5);
    g.gain.setTargetAtTime(.03 + Math.random() * .05, t, 1.5);
    if (noite < .4 && Math.random() < .35) {             // pássaro
      const f0 = 2400 + Math.random() * 1800;
      for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
        const o = c.createOscillator(), gg = c.createGain();
        o.type = "sine"; o.frequency.setValueAtTime(f0, t + i * .12);
        o.frequency.exponentialRampToValueAtTime(f0 * (1.2 + Math.random() * .4), t + i * .12 + .07);
        gg.gain.setValueAtTime(.0001, t + i * .12); gg.gain.exponentialRampToValueAtTime(.025, t + i * .12 + .01);
        gg.gain.exponentialRampToValueAtTime(.0001, t + i * .12 + .09);
        o.connect(gg); gg.connect(amb); o.start(t + i * .12); o.stop(t + i * .12 + .1);
      }
    }
    if (noite > .5 && Math.random() < .7) {              // grilos
      for (let i = 0; i < 6; i++) {
        const o = c.createOscillator(), gg = c.createGain();
        o.type = "square"; o.frequency.value = 4200 + Math.random() * 300;
        const ti = t + i * .06 + Math.random() * .02;
        gg.gain.setValueAtTime(.0001, ti); gg.gain.exponentialRampToValueAtTime(.006, ti + .005);
        gg.gain.exponentialRampToValueAtTime(.0001, ti + .04);
        o.connect(gg); gg.connect(amb); o.start(ti); o.stop(ti + .05);
      }
    }
  }, 1400);
}
