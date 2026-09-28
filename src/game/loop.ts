/* ================================================================
   LAÇO PRINCIPAL — simulação em passo fixo de 1/60 s, desenho com
   interpolação, câmera que segue quem está no comando, válvula de
   desempenho, música que acompanha o combate e salvamento automático.
   ================================================================ */
import { G, W, hooks } from "../sim/state";
import { DT, OLHO, novoQuadro, step } from "../sim/step";
import { engine, redimensionar, aoRedimensionar, type Qualidade } from "../render/engine";
import { desenharQuadro, mudarQualidade, ceu } from "../render/scene";
import { redimensionarOverlay } from "../render/overlay";
import { lerEntrada, limitarCamera } from "./input";
import { PREF, salvarLocalMundo } from "../sim/save";
import { climaMusical } from "../audio/sfx";

export const laco = { aoTick: () => {}, pausadoPorTela: false };
let last = performance.now(), acc = 0, uiT = 0, autoT = 0;
let medAcc = 0, medN = 0, lentas = 0, folgas = 0, combate = 0;

export function centrarEm(p: { x: number; y: number }) { engine.cam.x = p.x; engine.cam.y = p.y; }
hooks.centrarEm = centrarEm;

export function iniciarLaco() {
  aoRedimensionar.push(() => redimensionarOverlay());
  requestAnimationFrame(quadro);
}

function quadro(now: number) {
  requestAnimationFrame(quadro);
  const bruto = now - last;
  last = now;
  const dt = Math.min(.05, bruto / 1000);
  const simula = G.running && !G.paused;
  if (simula) {
    /* a simulação sabe onde a câmera olha (para poupar só o que ninguém vê) */
    OLHO.x = engine.cam.x; OLHO.y = engine.cam.y; OLHO.r = 16 * engine.cam.zoom + 14;
    novoQuadro();
    acc += dt;
    let n = 0;
    while (acc >= DT && n < 8) { step(); acc -= DT; n++; }
    if (acc > DT * 10) acc = 0;
    autoT += dt;
    if (autoT > 60) { autoT = 0; salvarLocalMundo(); }
    if (bruto < 300) valvula(bruto);
  }
  lerEntrada();
  seguirCamera(dt);
  const alpha = simula ? Math.min(1, acc / DT) : 1;
  if (!G.paused || laco.pausadoPorTela) desenharQuadro(simula ? dt : 0, alpha);
  uiT += dt;
  if (uiT > .2) {
    uiT = 0;
    const c = G.ctrl;
    const luta = c && !c.dead && ((c.target && !c.target.dead) || c.hurt < 3) ? 1 : 0;
    combate += (luta - combate) * .25;
    climaMusical(ceu.noite, combate);
    laco.aoTick();
  }
}

/* [SYSTEM: CAM] quem está no comando manda na câmera, vivo ou caído */
function seguirCamera(dt: number) {
  if (!G.autoCam || !W.units.length) return;
  let tx: number | null = null, ty = 0, k = 2;
  const c = G.ctrl, s = G.sel, f = W.featured;
  if (c) { tx = c.x; ty = c.y; k = c.dead ? 3 : 7; }
  else if (s && !s.dead) { tx = s.x; ty = s.y; k = 6; }
  else if (f && !f.dead) { tx = f.x; ty = f.y; k = 1.6; }
  if (tx === null) return;
  const a = 1 - Math.exp(-k * dt);
  engine.cam.x += (tx - engine.cam.x) * a;
  engine.cam.y += (ty - engine.cam.y) * a;
  limitarCamera();
}

/* [SYSTEM: PERF] válvula: primeiro a resolução, depois a qualidade */
const ORDEM: Qualidade[] = ["baixa", "media", "alta"];
function valvula(ms: number) {
  if (PREF.qualidade !== "auto") return;
  medAcc += ms; medN++;
  if (medN < 45) return;
  const m = medAcc / medN; medAcc = 0; medN = 0;
  lentas = m > 26 ? lentas + 1 : 0;
  folgas = m < 14 ? folgas + 1 : 0;
  if (lentas >= 3) {
    lentas = 0;
    if (engine.resScale > .7) { engine.resScale = Math.max(.7, engine.resScale - .1); redimensionar(); return; }
    const i = ORDEM.indexOf(engine.qual);
    if (i > 0) { mudarQualidade(ORDEM[i - 1]); engine.resScale = .9; redimensionar(); }
  } else if (folgas >= 4) {
    folgas = 0;
    if (engine.resScale < 1) { engine.resScale = Math.min(1, engine.resScale + .05); redimensionar(); }
  }
}
