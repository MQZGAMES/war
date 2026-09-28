/* ================================================================
   Figuras humanoides: as quatro vocações, os três NPCs e a fauna de
   pé (orc, troll, minotauro, ciclope, demônio). Proporção de miniatura
   — cabeça grande, silhueta lida de longe — e a cor de cada um nas
   roupas. O metal muda com o nível do equipamento vestido.
   ================================================================ */
import * as THREE from "three";
import { Montador, P, lamina, deformar } from "../geo";
import type { ModeloBase, OssoSpec } from "./rig";

export const H = { ROOT: 0, HIPS: 1, TORSO: 2, HEAD: 3, ARM_L: 4, ARM_R: 5, LEG_L: 6, LEG_R: 7, CAPE: 8, WING_L: 9, WING_R: 10, TAIL: 11,
  /* arco: osso na mão esquerda (gira o arco em relação ao braço), as duas
     metades da corda (dobram ao puxar) e a flecha na mão direita */
  ARCO: 12, CORDA_A: 13, CORDA_B: 14, FLECHA: 15 };
/* medidas do arco, compartilhadas com a animação */
export const ARCO = { meia: .31, barriga: .1 };

interface Prop {
  pernaH: number; troncoH: number; cabR: number; ombro: number; quadril: number;
  troncoW: number; troncoD: number; bracoL: number; bracoR: number; pernaR: number;
}
const HEROI: Prop = { pernaH: .34, troncoH: .33, cabR: .205, ombro: .19, quadril: .085, troncoW: .31, troncoD: .2, bracoL: .3, bracoR: .052, pernaR: .062 };

function esqueleto(p: Prop): OssoSpec[] {
  const hip = p.pernaH, sh = p.pernaH + p.troncoH * .88, head = p.pernaH + p.troncoH;
  return [
    { pai: -1, p: [0, 0, 0] },
    { pai: 0, p: [0, hip, 0] },
    { pai: 1, p: [0, hip + .02, 0] },
    { pai: 2, p: [0, head, 0] },
    { pai: 2, p: [p.ombro, sh, 0] },
    { pai: 2, p: [-p.ombro, sh, 0] },
    { pai: 1, p: [p.quadril, hip, 0] },
    { pai: 1, p: [-p.quadril, hip, 0] },
    { pai: 2, p: [0, sh, -p.troncoD * .5] },
    { pai: 2, p: [p.troncoW * .3, sh, -p.troncoD * .5] },
    { pai: 2, p: [-p.troncoW * .3, sh, -p.troncoD * .5] },
    { pai: 1, p: [0, hip, -p.troncoD * .45] },
    { pai: 4, p: [p.ombro, sh - p.bracoL - p.bracoR * .4, 0] },
    { pai: 12, p: [p.ombro, sh - p.bracoL - p.bracoR * .4 + ARCO.meia, -ARCO.barriga] },
    { pai: 12, p: [p.ombro, sh - p.bracoL - p.bracoR * .4 - ARCO.meia, -ARCO.barriga] },
    { pai: 5, p: [-p.ombro, sh - p.bracoL - p.bracoR * .4, 0] },
  ];
}
const C = (h: string) => new THREE.Color(h);
const escurecer = (c: THREE.Color, k: number) => c.clone().multiplyScalar(k);

/* metal pelo nível do item: ferro, aço, ouro, arcano */
export function metalDoNivel(k: number) {
  return k >= 9 ? C("#b99cff") : k >= 7 ? C("#e8c35a") : k >= 4 ? C("#d4dde4") : C("#9aa3aa");
}

interface Cores { pele: THREE.Color; roupa: THREE.Color; roupa2: THREE.Color; calca: THREE.Color; bota: THREE.Color; cinto?: THREE.Color }
/* corpo comum: pernas, tronco afunilado, cinto, braços, mãos, cabeça e olhos */
function corpo(m: Montador, p: Prop, c: Cores, o: { saia?: boolean; semOlhos?: boolean; barriga?: number; ombreira?: THREE.Color } = {}) {
  const hip = p.pernaH, sh = p.pernaH + p.troncoH * .88, head = p.pernaH + p.troncoH;
  for (const s of [1, -1]) {
    const osso = s > 0 ? H.LEG_L : H.LEG_R, x = s * p.quadril;
    m.add(P.cil(p.pernaR, p.pernaR * .85, hip * .82, 6), [x, hip * .56, 0], c.calca, osso);
    m.add(P.caixa(p.pernaR * 2.1, hip * .2, p.pernaR * 2.9), [x, hip * .1, p.pernaR * .45], c.bota, osso);
  }
  if (o.saia) m.add(P.cil(p.troncoW * .52, p.troncoW * .86, hip * .98, 8), [0, hip * .5, 0], c.roupa, H.HIPS);
  /* tronco: tronco de pirâmide de quatro faces, girado para frente */
  m.add(P.cil(p.troncoW * .74, p.troncoW * .6, p.troncoH, 4), [0, hip + p.troncoH * .5, 0], c.roupa, H.TORSO, [0, Math.PI / 4, 0], [1, 1, p.troncoD / p.troncoW * 1.05]);
  m.add(P.cil(p.troncoW * .63, p.troncoW * .63, p.troncoH * .16, 4), [0, hip + p.troncoH * .1, 0], c.cinto || c.roupa2, H.TORSO, [0, Math.PI / 4, 0], [1, 1, p.troncoD / p.troncoW * 1.12]);
  if (o.barriga) m.add(P.esfera(p.troncoW * .5 * o.barriga, 1), [0, hip + p.troncoH * .38, p.troncoD * .28], c.roupa, H.TORSO, [0, 0, 0], [1, .9, .8]);
  m.add(P.cil(p.cabR * .35, p.cabR * .42, p.troncoH * .2, 6), [0, head + p.cabR * .02, 0], c.pele, H.HEAD);
  for (const s of [1, -1]) {
    const osso = s > 0 ? H.ARM_L : H.ARM_R, x = s * p.ombro;
    m.add(P.esfera(p.bracoR * 1.55, 0), [x, sh, 0], o.ombreira || c.roupa, osso);
    m.add(P.cil(p.bracoR, p.bracoR * .9, p.bracoL, 6), [x, sh - p.bracoL * .5, 0], c.roupa, osso);
    m.add(P.esfera(p.bracoR * 1.12, 0), [x, sh - p.bracoL - p.bracoR * .4, 0], c.pele, osso);
  }
  const hy = head + p.cabR * .92;
  m.add(P.esfera(p.cabR, 1), [0, hy, 0], c.pele, H.HEAD);
  if (!o.semOlhos) {
    for (const s of [1, -1]) m.add(P.caixa(p.cabR * .2, p.cabR * .28, p.cabR * .1), [s * p.cabR * .36, hy + p.cabR * .05, p.cabR * .88], "#1b140f", H.HEAD);
  }
  return { hip, sh, head, hy };
}
function hemisferio(r: number, fim = .55) { return new THREE.SphereGeometry(r, 9, 5, 0, Math.PI * 2, 0, Math.PI * fim); }

/* ---------- armas ---------- */
function espada(m: Montador, x: number, y: number, metal: THREE.Color, grande = false) {
  const L = grande ? .78 : .56;
  m.add(P.caixa(.05, .028, L), [x, y + .02, .06 + L * .5], metal, H.ARM_R);
  m.add(P.cone(.026, .06, 4), [x, y + .02, .06 + L + .02], metal, H.ARM_R, [Math.PI / 2, 0, 0]);
  m.add(P.caixa(.2, .035, .035), [x, y + .02, .05], "#b08a3a", H.ARM_R);
  m.add(P.cil(.022, .022, .14, 5), [x, y + .02, -.02], "#5a3a22", H.ARM_R, [Math.PI / 2, 0, 0]);
  m.add(P.esfera(.03, 0), [x, y + .02, -.1], "#b08a3a", H.ARM_R);
}
function escudo(m: Montador, x: number, y: number, face: THREE.Color, metal: THREE.Color, detalhe: THREE.Color) {
  const rot: [number, number, number] = [Math.PI / 2, 0, 0];
  const g = new Montador();
  g.add(P.cil(.2, .2, .04, 10), [0, 0, 0], face, 0, rot);
  g.add(P.toro(.2, .022, 4, 12), [0, 0, .005], metal, 0, [0, 0, 0]);
  g.add(P.esfera(.05, 0), [0, 0, .035], metal);
  g.add(P.caixa(.03, .26, .012), [0, 0, .03], detalhe);
  g.add(P.caixa(.26, .03, .012), [0, 0, .03], detalhe);
  m.add(g.geometria(), [x + .07, y, .05], null, H.ARM_L, [0, .75, 0]);
}
/* Arco longo na mão esquerda, montado em pé na pose de repouso: empunhadura
   na mão, barriga para a frente (+Z), pontas e corda para trás. Quem o põe
   na vertical durante a mira é o osso ARCO, que desfaz a rotação do braço.
   A corda são duas metades presas às pontas: dobram em V ao puxar. */
function arco(m: Montador, maoX: number, maoY: number, madeira: THREE.Color, corda: THREE.Color, flecha: THREE.Color) {
  const n = 10, A = 1.05, R = ARCO.meia / Math.sin(A), B = ARCO.barriga;
  const zDe = (a: number) => -B * (1 - Math.cos(a)) / (1 - Math.cos(A));
  for (let i = 0; i < n; i++) {
    const a0 = -A + i / n * 2 * A, a1 = -A + (i + 1) / n * 2 * A;
    const y0 = Math.sin(a0) * R, y1 = Math.sin(a1) * R, z0 = zDe(a0), z1 = zDe(a1);
    const len = Math.hypot(y1 - y0, z1 - z0), ang = Math.atan2(z1 - z0, y1 - y0);
    const meio = i === n / 2 - 1 || i === n / 2;
    const esp = meio ? .036 : .026 - Math.abs(i - (n - 1) / 2) * .0012;
    m.add(P.caixa(esp, len * 1.08, esp * 1.15), [maoX, maoY + (y0 + y1) / 2, (z0 + z1) / 2], meio ? C("#4a2e1a") : madeira, H.ARCO, [ang, 0, 0]);
  }
  /* pontas reforçadas */
  for (const s of [1, -1]) m.add(P.caixa(.03, .05, .03), [maoX, maoY + s * ARCO.meia, -B], C("#d8c9a4"), H.ARCO);
  /* corda: cada metade no seu osso, do topo (ou da base) até o meio */
  m.add(P.caixa(.007, ARCO.meia, .007), [maoX, maoY + ARCO.meia / 2, -B], corda, H.CORDA_A);
  m.add(P.caixa(.007, ARCO.meia, .007), [maoX, maoY - ARCO.meia / 2, -B], corda, H.CORDA_B);
  /* flecha encaixada, na mão direita: só aparece durante a mira */
  const fx = -maoX;
  m.add(P.cil(.009, .009, .5, 4), [fx, maoY, .23], flecha, H.FLECHA, [Math.PI / 2, 0, 0]);
  m.add(P.cone(.024, .07, 4), [fx, maoY, .5], "#cfd6da", H.FLECHA, [Math.PI / 2, 0, 0]);
  for (const r of [0, Math.PI / 2]) m.add(P.caixa(.045, .004, .08), [fx, maoY, .01], "#e8e0cc", H.FLECHA, [0, 0, r]);
}
function cajado(m: Montador, x: number, sh: number, bracoL: number, madeira: THREE.Color, orbe: THREE.Color, druida: boolean) {
  /* o cajado passa pela mão, à frente do braço, preso ao osso da mão
     direita (o mesmo da flecha): a animação o mantém de pé */
  const mao = sh - bracoL - .02, zc = .1;
  x -= .035;
  m.add(P.cil(.026, .03, 1.15, 6), [x, mao + .2, zc], madeira, H.FLECHA);
  m.add(P.cil(.034, .034, .07, 6), [x, mao, zc], "#3a2a1a", H.FLECHA);
  const topo = mao + .78;
  if (druida) {
    m.add(P.octa(.075), [x, topo + .06, zc], orbe, H.FLECHA, [0, 0, 0], [1, 1.6, 1]);
    m.add(lamina([[0, 0], [.1, .04], [.14, .1], [.05, .08]], .01), [x, topo - .06, zc], "#4f9a3c", H.FLECHA, [0, .4, .6]);
    m.add(lamina([[0, 0], [-.1, .04], [-.14, .1], [-.05, .08]], .01), [x, topo - .02, zc], "#5fae48", H.FLECHA, [0, -.4, -.5]);
    m.add(P.toro(.05, .012, 4, 8), [x, topo - .02, zc], madeira, H.FLECHA, [Math.PI / 2, 0, 0]);
  } else {
    m.add(P.toro(.06, .016, 4, 9), [x, topo, zc], "#c9a23e", H.FLECHA, [0, 0, 0]);
    m.add(P.esfera(.068, 1), [x, topo + .02, zc], orbe, H.FLECHA);
  }
  return [x, topo + .04, zc] as [number, number, number];
}

/* ---------- vocações ---------- */
export interface EquipVisual { arma: number; armadura: number; cabeca: number; escudo: number }
export function modeloHeroi(kind: string, cor: { c: string; lo: string; hi: string }, eq: EquipVisual): ModeloBase {
  const p = HEROI, m = new Montador();
  const roupa = C(cor.c), escura = C(cor.lo), clara = C(cor.hi);
  const pele = C("#f0c9a0");
  const pontos: ModeloBase["pontos"] = {};
  let arma: ModeloBase["anim"]["arma"] = "espada";
  if (kind === "knight") {
    const metal = metalDoNivel(eq.armadura), metalA = metalDoNivel(eq.arma), metalC = metalDoNivel(eq.cabeca);
    const b = corpo(m, p, { pele, roupa, roupa2: escurecer(metal, .7), calca: escurecer(metal, .8), bota: C("#3b2e26"), cinto: C("#5a3a22") }, { ombreira: metal });
    /* peitoral sobre a túnica e saia de cota */
    m.add(P.cil(p.troncoW * .66, p.troncoW * .55, p.troncoH * .7, 4), [0, b.hip + p.troncoH * .6, .012], metal, H.TORSO, [0, Math.PI / 4, 0], [1, 1, .72]);
    m.add(P.cil(p.troncoW * .5, p.troncoW * .62, .1, 8), [0, b.hip - .02, 0], roupa, H.HIPS);
    /* elmo de cavaleiro com o rosto à mostra: cúpula, aro na testa,
       proteção de nariz e de bochechas, e um penacho em arco na cor do dono */
    const aro = escurecer(metalC, .7), R = p.cabR, topo = b.hy + R * .2;
    m.add(hemisferio(R * 1.1, .5), [0, topo, -R * .03], metalC, H.HEAD);
    m.add(P.cil(R * 1.12, R * 1.12, R * .17, 12), [0, topo + R * .02, -R * .03], aro, H.HEAD);
    m.add(P.caixa(R * .15, R * .52, .04), [0, b.hy + R * .02, R * 1.0], metalC, H.HEAD);
    for (const q of [1, -1]) m.add(P.caixa(.04, R * .72, R * .62), [q * R * .98, b.hy - R * .22, R * .18], metalC, H.HEAD, [0, q * .22, 0]);
    m.add(P.caixa(R * 1.7, R * .62, .045), [0, b.hy - R * .18, -R * .96], metalC, H.HEAD, [.18, 0, 0]);
    m.add(P.caixa(R * .12, R * .12, R * 1.8), [0, topo + R * 1.06, -R * .06], aro, H.HEAD);
    for (let i = 0; i < 8; i++) {
      const a = -.3 + i * .27, rp = R * 1.32;
      m.add(P.esfera(.055 - i * .002, 0), [0, topo + Math.cos(a) * rp, -R * .05 - Math.sin(a) * rp], i % 3 === 2 ? clara : roupa, H.HEAD, [a, 0, 0], [.45, .8, 1.8]);
    }
    /* capa */
    m.add(P.caixa(.3, .42, .025), [0, b.sh - .2, -p.troncoD * .5 - .03], escura, H.CAPE, [.08, 0, 0]);
    espada(m, -p.ombro, b.sh - p.bracoL - .03, metalA, eq.arma >= 7);
    if (eq.escudo) escudo(m, p.ombro, b.sh - p.bracoL * .6, roupa, metalDoNivel(eq.escudo), clara);
    pontos.arma = { osso: H.ARM_R, p: [-p.ombro, b.sh - p.bracoL + .02, .5] };
  } else if (kind === "archer") {
    arma = "arco";
    const couro = C("#8a5f3a");
    const b = corpo(m, p, { pele, roupa, roupa2: couro, calca: C("#5c4a36"), bota: C("#4a3322"), cinto: C("#3c2a1c") });
    m.add(P.cil(p.troncoW * .66, p.troncoW * .56, p.troncoH * .66, 4), [0, b.hip + p.troncoH * .52, .01], couro, H.TORSO, [0, Math.PI / 4, 0], [1, 1, .7]);
    /* capuz com ponta caída */
    m.add(hemisferio(p.cabR * 1.14, .62), [0, b.hy + p.cabR * .02, -p.cabR * .08], escura, H.HEAD, [-.25, 0, 0]);
    m.add(P.cone(p.cabR * .55, p.cabR * 1.2, 6), [0, b.hy + p.cabR * .15, -p.cabR * 1.05], escura, H.HEAD, [-2.1, 0, 0]);
    m.add(P.cil(p.cabR * 1.1, p.troncoW * .55, .08, 9), [0, b.head + .02, 0], escura, H.HEAD);
    /* aljava nas costas */
    m.add(P.cil(.06, .05, .36, 6), [.08, b.sh - .1, -p.troncoD * .55 - .04], "#6a4428", H.TORSO, [.3, 0, -.35]);
    for (let i = 0; i < 3; i++) m.add(P.caixa(.025, .07, .012), [.1 + i * .025 - .025, b.sh + .12, -p.troncoD * .55 - .1], i === 1 ? clara : C("#f2ecda"), H.TORSO, [.3, 0, -.35]);
    const maoY = b.sh - p.bracoL - p.bracoR * .4;
    arco(m, p.ombro, maoY, eq.arma >= 7 ? C("#caa04a") : C("#8e6436"), C("#ece6d6"), clara);
    m.add(P.caixa(.18, .3, .02), [0, b.sh - .2, -p.troncoD * .5 - .02], roupa, H.CAPE, [.12, 0, 0]);
    pontos.arma = { osso: H.ARCO, p: [p.ombro, maoY, .04] };
  } else {
    const druida = kind === "druid";
    arma = "cajado";
    const tunica = druida ? C("#5a6b3a").lerp(roupa, .45) : roupa;
    const b = corpo(m, p, { pele, roupa: tunica, roupa2: druida ? C("#7a5a34") : clara, calca: escura, bota: C("#3b2e26"), cinto: druida ? C("#6a4a2a") : C("#c9a23e") }, { saia: true });
    if (druida) {
      m.add(hemisferio(p.cabR * 1.08, .6), [0, b.hy + p.cabR * .05, -p.cabR * .1], "#7a4a28", H.HEAD, [-.3, 0, 0]);
      m.add(P.caixa(p.cabR * 1.5, p.cabR * 1.4, p.cabR * .5), [0, b.hy - p.cabR * .4, -p.cabR * .75], "#7a4a28", H.HEAD);
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * Math.PI * 2;
        m.add(P.tetra(.055), [Math.sin(a) * p.cabR * 1.02, b.hy + p.cabR * .45, Math.cos(a) * p.cabR * 1.02], i % 2 ? "#6fbf4a" : "#3f8a3a", H.HEAD, [a, a * 2, 0]);
      }
      m.add(P.caixa(.07, .36, .02), [.06, b.sh - .1, p.troncoD * .52], roupa, H.TORSO, [0, 0, .5]);
    } else {
      /* chapéu pontudo de aba larga e barba */
      m.add(P.cil(p.cabR * 1.7, p.cabR * 1.75, .035, 12), [0, b.hy + p.cabR * .55, 0], escura, H.HEAD);
      m.add(P.cone(p.cabR * 1.02, .42, 8), [0, b.hy + p.cabR * .55 + .2, -.02], escura, H.HEAD, [-.14, 0, 0]);
      m.add(P.cone(p.cabR * .42, .18, 6), [0, b.hy + p.cabR * .55 + .45, -.1], escura, H.HEAD, [-.9, 0, 0]);
      m.add(P.cil(p.cabR * 1.04, p.cabR * 1.04, .045, 10), [0, b.hy + p.cabR * .64, 0], clara, H.HEAD);
      m.add(P.cone(p.cabR * .62, .3, 6), [0, b.hy - p.cabR * .72, p.cabR * .55], "#e8e4dc", H.HEAD, [Math.PI + .25, 0, 0]);
      m.add(P.caixa(.28, .45, .025), [0, b.sh - .2, -p.troncoD * .5 - .03], clara, H.CAPE, [.08, 0, 0]);
    }
    const orbe = druida ? (eq.arma >= 7 ? C("#b8ff7a") : C("#62e08a")) : (eq.arma >= 9 ? C("#d08cff") : eq.arma >= 5 ? C("#9fd8ff") : C("#6fb2ff"));
    const topo = cajado(m, -p.ombro, b.sh, p.bracoL, C("#7a5a34"), orbe, druida);
    pontos.orbe = { osso: H.FLECHA, p: topo };
    pontos.arma = pontos.orbe;
  }
  pontos.cabeca = { osso: H.HEAD, p: [0, p.pernaH + p.troncoH + p.cabR * 2.1, 0] };
  pontos.peito = { osso: H.TORSO, p: [0, p.pernaH + p.troncoH * .6, .1] };
  pontos.maoL = { osso: H.ARM_L, p: [p.ombro, p.pernaH + p.troncoH * .88 - p.bracoL, .05] };
  return { arq: "humano", geo: m.geometria(true), ossos: esqueleto(p), alt: 1.15, raio: .32, pontos, anim: { passo: 1, balanco: 1, arma } };
}

/* ---------- NPCs ---------- */
export function modeloNpc(id: string, cor: { c: string; lo: string; hi: string }): ModeloBase {
  const p = HEROI, m = new Montador();
  const pele = C("#eac29a"), roupa = C(cor.c), escura = C(cor.lo), clara = C(cor.hi);
  if (id === "feiticeiro") {
    const b = corpo(m, p, { pele, roupa, roupa2: clara, calca: escura, bota: C("#2e2430"), cinto: C("#e0bd63") }, { saia: true });
    m.add(P.cil(p.cabR * 1.6, p.cabR * 1.6, .03, 12), [0, b.hy + p.cabR * .55, 0], escura, H.HEAD);
    m.add(P.cone(p.cabR * 1.0, .5, 8), [0, b.hy + p.cabR * .55 + .24, 0], escura, H.HEAD, [-.1, 0, 0]);
    m.add(P.octa(.05), [0, b.hy + p.cabR * .55 + .52, -.04], "#ffe08a", H.HEAD);
    m.add(P.cone(p.cabR * .5, .26, 6), [0, b.hy - p.cabR * .7, p.cabR * .55], "#d8d0c8", H.HEAD, [Math.PI + .2, 0, 0]);
    m.add(P.cil(.05, .045, .12, 7), [-p.ombro, b.sh - p.bracoL - .03, .08], "#e0e0e8", H.ARM_R);
    m.add(P.cil(.047, .042, .07, 7), [-p.ombro, b.sh - p.bracoL - .06, .08], "#d0473f", H.ARM_R);
  } else if (id === "comerciante") {
    const b = corpo(m, p, { pele, roupa, roupa2: C("#5a3a22"), calca: C("#4a3c30"), bota: C("#3b2e26"), cinto: C("#5a3a22") }, { barriga: 1.1 });
    m.add(P.caixa(p.troncoW * .9, p.troncoH * 1.2, .02), [0, b.hip + p.troncoH * .35, p.troncoD * .55 + .02], "#d8c9a4", H.TORSO);
    m.add(hemisferio(p.cabR * 1.05, .5), [0, b.hy + p.cabR * .2, 0], escura, H.HEAD);
    m.add(P.caixa(p.cabR * 1.2, .03, p.cabR * .8), [0, b.hy + p.cabR * .4, p.cabR * .9], escura, H.HEAD);
    m.add(P.caixa(p.cabR * .9, p.cabR * .18, .06), [0, b.hy - p.cabR * .3, p.cabR * .92], "#6a4428", H.HEAD);
    m.add(P.cil(.02, .02, .3, 5), [-p.ombro, b.sh - p.bracoL - .03, .1], "#6a4428", H.ARM_R, [Math.PI / 2, 0, 0]);
    m.add(P.caixa(.14, .08, .08), [-p.ombro, b.sh - p.bracoL - .03, .26], "#8e949a", H.ARM_R);
  } else if (id === "ferreiro") {
    /* ferreiro: avental de couro, braços fortes, careca com barba e martelo */
    const b = corpo(m, p, { pele, roupa: C("#6a4a34"), roupa2: C("#3a2a1c"), calca: C("#3a3230"), bota: C("#241c18"), cinto: C("#2a1e16") }, { barriga: 1.05, ombreira: pele });
    m.add(P.caixa(p.troncoW * .95, p.troncoH * 1.25, .025), [0, b.hip + p.troncoH * .3, p.troncoD * .56], "#3a2a1c", H.TORSO);
    m.add(P.cone(p.cabR * .62, .2, 6), [0, b.hy - p.cabR * .75, p.cabR * .5], "#6a3a1c", H.HEAD, [Math.PI + .25, 0, 0]);
    m.add(P.caixa(p.cabR * 1.1, p.cabR * .15, .04), [0, b.hy + p.cabR * .35, p.cabR * .9], "#6a3a1c", H.HEAD);
    const mao = b.sh - p.bracoL - .03;
    m.add(P.cil(.022, .022, .3, 5), [-p.ombro, mao + .08, .06], "#5a3a22", H.ARM_R);
    m.add(P.caixa(.14, .08, .08), [-p.ombro, mao + .24, .06], "#4a4a52", H.ARM_R);
    void roupa;
  } else {
    const b = corpo(m, p, { pele, roupa: C("#26222a"), roupa2: C("#e8c35a"), calca: C("#1e1b22"), bota: C("#141216"), cinto: C("#141216") });
    m.add(P.caixa(.06, p.troncoH * .8, .02), [0, b.hip + p.troncoH * .5, p.troncoD * .55], "#efe6d2", H.TORSO);
    m.add(P.toro(.08, .008, 3, 10), [.05, b.hip + p.troncoH * .45, p.troncoD * .56], "#e8c35a", H.TORSO, [0, 0, 0]);
    m.add(P.cil(p.cabR * 1.5, p.cabR * 1.5, .03, 12), [0, b.hy + p.cabR * .62, 0], "#141216", H.HEAD);
    m.add(P.cil(p.cabR * .85, p.cabR * .9, .3, 10), [0, b.hy + p.cabR * .62 + .15, 0], "#141216", H.HEAD);
    m.add(P.cil(p.cabR * .92, p.cabR * .92, .05, 10), [0, b.hy + p.cabR * .62 + .04, 0], clara, H.HEAD);
    m.add(P.cil(.065, .065, .02, 10), [-p.ombro, b.sh - p.bracoL - .03, .09], "#f2c53d", H.ARM_R, [Math.PI / 2, 0, 0]);
    void roupa;
  }
  return { arq: "humano", geo: m.geometria(true), ossos: esqueleto(p), alt: 1.15, raio: .3, pontos: { cabeca: { osso: H.HEAD, p: [0, 1.3, 0] } }, anim: { passo: 1, balanco: .4, arma: "nenhuma" } };
}

/* ---------- fauna de pé ---------- */
function escalar(base: ModeloBase, s: number): ModeloBase {
  base.geo.scale(s, s, s);
  base.geo.computeBoundingSphere();
  for (const o of base.ossos) o.p = [o.p[0] * s, o.p[1] * s, o.p[2] * s];
  for (const k in base.pontos) { const q = base.pontos[k].p; base.pontos[k].p = [q[0] * s, q[1] * s, q[2] * s]; }
  base.alt *= s; base.raio *= s;
  return base;
}
export function modeloMonstroHumano(kind: string): ModeloBase {
  const m = new Montador();
  let p: Prop, s = 1, alt = 1.2, corcunda = 0;
  const pontos: ModeloBase["pontos"] = {};
  let arma: ModeloBase["anim"]["arma"] = "clava";
  if (kind === "orc") {
    p = { pernaH: .38, troncoH: .4, cabR: .19, ombro: .24, quadril: .1, troncoW: .42, troncoD: .28, bracoL: .36, bracoR: .07, pernaR: .08 };
    const pele = C("#6a8a40"), couro = C("#7a5236");
    const b = corpo(m, p, { pele, roupa: pele, roupa2: couro, calca: C("#4a3a2a"), bota: C("#2e241c"), cinto: couro }, { semOlhos: true, ombreira: pele });
    m.add(P.cil(p.troncoW * .7, p.troncoW * .6, p.troncoH * .55, 4), [0, b.hip + p.troncoH * .4, .01], couro, H.TORSO, [0, Math.PI / 4, 0], [1, 1, .74]);
    m.add(P.esfera(.1, 0), [-p.ombro - .02, b.sh + .03, 0], "#5c5a58", H.ARM_R, [0, 0, 0], [1.2, .7, 1.2]);
    m.add(P.caixa(p.cabR * 1.9, .05, p.cabR * 1.9), [0, b.hy + p.cabR * .35, 0], "#b03a2e", H.HEAD);
    m.add(P.cone(.07, .2, 5), [0, b.hy + p.cabR * 1.15, -.04], "#1e1a16", H.HEAD, [-.4, 0, 0]);
    for (const q of [1, -1]) {
      m.add(P.cone(.03, .1, 4), [q * p.cabR * .42, b.hy - p.cabR * .35, p.cabR * .75], "#f2ecda", H.HEAD, [-.3, 0, 0]);
      m.add(P.cone(.05, .16, 4), [q * p.cabR * 1.05, b.hy + p.cabR * .15, -.02], pele, H.HEAD, [0, 0, -q * 1.25]);
      m.add(P.caixa(p.cabR * .22, p.cabR * .14, .03), [q * p.cabR * .38, b.hy + p.cabR * .08, p.cabR * .9], "#ffe08a", H.HEAD);
    }
    const mao = b.sh - p.bracoL - .04;
    m.add(P.cil(.028, .028, .62, 5), [-p.ombro, mao + .12, .1], "#5a3b22", H.ARM_R, [Math.PI / 2 - .5, 0, 0]);
    m.add(lamina([[0, 0], [.2, .08], [.24, -.14], [0, -.08]], .025), [-p.ombro, mao + .3, .36], "#b8bec4", H.ARM_R, [0, Math.PI / 2, -.5]);
    s = 1.12; alt = 1.3; arma = "espada";
  } else if (kind === "troll") {
    p = { pernaH: .34, troncoH: .44, cabR: .17, ombro: .26, quadril: .12, troncoW: .44, troncoD: .32, bracoL: .5, bracoR: .075, pernaR: .09 };
    const pele = C("#8b8474");
    corcunda = .38;
    const b = corpo(m, p, { pele, roupa: pele, roupa2: C("#6f5a3a"), calca: pele, bota: C("#5c5448"), cinto: C("#6f5a3a") }, { barriga: 1.2, semOlhos: true });
    m.add(P.cil(p.troncoW * .75, p.troncoW * .75, .14, 7), [0, b.hip + .02, 0], "#6f5a3a", H.HIPS);
    m.add(P.cone(.06, .18, 5), [0, b.hy - .02, p.cabR * 1.05], "#b8766a", H.HEAD, [Math.PI / 2 + .3, 0, 0]);
    m.add(P.cone(.08, .16, 5), [0, b.hy + p.cabR * 1.05, 0], "#5f7a3c", H.HEAD);
    for (const q of [1, -1]) {
      m.add(P.caixa(p.cabR * .22, p.cabR * .16, .03), [q * p.cabR * .38, b.hy + p.cabR * .15, p.cabR * .9], "#ffd77a", H.HEAD);
      m.add(P.esfera(.05, 0), [q * p.cabR * 1.02, b.hy + .02, 0], pele, H.HEAD, [0, 0, 0], [.6, 1, 1]);
    }
    const mao = b.sh - p.bracoL - .04;
    m.add(P.cil(.08, .035, .6, 6), [-p.ombro, mao + .05, .22], "#6a4a2a", H.ARM_R, [Math.PI / 2 - .3, 0, 0]);
    s = 1.3; alt = 1.55;
  } else if (kind === "minotaur") {
    p = { pernaH: .38, troncoH: .42, cabR: .18, ombro: .27, quadril: .11, troncoW: .46, troncoD: .3, bracoL: .4, bracoR: .08, pernaR: .085 };
    const pelo = C("#6b4a30"), claro = C("#9c8c6a");
    const b = corpo(m, p, { pele: pelo, roupa: pelo, roupa2: C("#3a2617"), calca: C("#4a3322"), bota: C("#1e1814"), cinto: C("#3a2617") }, { semOlhos: true });
    m.add(P.cil(p.troncoW * .68, p.troncoW * .56, p.troncoH * .5, 4), [0, b.hip + p.troncoH * .62, .015], "#8e949a", H.TORSO, [0, Math.PI / 4, 0], [1, 1, .7]);
    m.add(P.caixa(p.cabR * 1.1, p.cabR * .9, p.cabR * 1.1), [0, b.hy - p.cabR * .25, p.cabR * .85], claro, H.HEAD);
    m.add(P.toro(.05, .012, 4, 8), [0, b.hy - p.cabR * .55, p.cabR * 1.42], "#e8c35a", H.HEAD, [.2, 0, 0]);
    for (const q of [1, -1]) {
      m.add(P.cone(.05, .22, 5), [q * p.cabR * 1.05, b.hy + p.cabR * .55, 0], "#efe6d2", H.HEAD, [0, 0, -q * 1.1]);
      m.add(P.cone(.035, .16, 5), [q * p.cabR * 1.55, b.hy + p.cabR * .95, .02], "#efe6d2", H.HEAD, [0, 0, -q * .2]);
      m.add(P.caixa(p.cabR * .2, p.cabR * .14, .03), [q * p.cabR * .42, b.hy + p.cabR * .15, p.cabR * .92], "#ff6a3c", H.HEAD);
    }
    const mao = b.sh - p.bracoL - .04;
    m.add(P.cil(.03, .03, .9, 5), [-p.ombro, mao + .1, .12], "#5a3b22", H.ARM_R, [Math.PI / 2 - .6, 0, 0]);
    for (const q of [1, -1]) m.add(lamina([[0, 0], [.22, .12], [.26, -.16], [0, -.08]], .03), [-p.ombro, mao + .38, .45], "#c9cfd3", H.ARM_R, [0, Math.PI / 2 + (q > 0 ? 0 : Math.PI), -.6]);
    s = 1.55; alt = 1.85; arma = "espada";
  } else if (kind === "cyclops") {
    p = { pernaH: .36, troncoH: .44, cabR: .2, ombro: .27, quadril: .12, troncoW: .46, troncoD: .32, bracoL: .42, bracoR: .085, pernaR: .09 };
    const pele = C("#9b8465");
    const b = corpo(m, p, { pele, roupa: pele, roupa2: C("#6d5a3c"), calca: pele, bota: C("#57452f"), cinto: C("#6d5a3c") }, { barriga: 1.35, semOlhos: true });
    m.add(P.cil(p.troncoW * .72, p.troncoW * .72, .16, 7), [0, b.hip + .02, 0], "#6d5a3c", H.HIPS);
    m.add(P.esfera(p.cabR * .46, 1), [0, b.hy + p.cabR * .1, p.cabR * .72], "#f4f0e8", H.HEAD);
    m.add(P.esfera(p.cabR * .24, 0), [0, b.hy + p.cabR * .1, p.cabR * 1.08], "#4ab0d8", H.HEAD);
    m.add(P.esfera(p.cabR * .1, 0), [0, b.hy + p.cabR * .1, p.cabR * 1.25], "#0a0a0a", H.HEAD);
    m.add(P.caixa(p.cabR * 1.2, p.cabR * .18, .04), [0, b.hy + p.cabR * .62, p.cabR * .78], "#57452f", H.HEAD);
    const mao = b.sh - p.bracoL - .04;
    m.add(P.cil(.035, .035, .8, 5), [-p.ombro, mao + .05, .1], "#5a3b22", H.ARM_R, [Math.PI / 2 - .5, 0, 0]);
    m.add(deformar(P.caixa(.28, .24, .24), .05, 7), [-p.ombro, mao + .3, .44], "#6d6a66", H.ARM_R);
    s = 1.95; alt = 2.4;
    pontos.olho = { osso: H.HEAD, p: [0, (b.hy + p.cabR * .1), p.cabR * 1.2] };
  } else if (kind === "skeleton") {
    /* esqueleto: ossos brancos finos, costelas, crânio com órbitas, espada e escudo velhos */
    p = { pernaH: .38, troncoH: .36, cabR: .16, ombro: .2, quadril: .08, troncoW: .26, troncoD: .16, bracoL: .36, bracoR: .035, pernaR: .04 };
    const osso = C("#e8e2cc"), sujo = C("#b8b096");
    const b = corpo(m, p, { pele: osso, roupa: osso, roupa2: sujo, calca: osso, bota: sujo, cinto: C("#5a4a3a") }, { semOlhos: true, ombreira: osso });
    for (let i = 0; i < 4; i++) m.add(P.toro(p.troncoW * .42, .012, 3, 8), [0, b.hip + p.troncoH * (.35 + i * .15), 0], osso, H.TORSO, [Math.PI / 2, 0, 0], [1, 1, .7]);
    for (const q of [1, -1]) m.add(P.esfera(p.cabR * .3, 0), [q * p.cabR * .36, b.hy + p.cabR * .08, p.cabR * .78], "#120e0a", H.HEAD);
    m.add(P.caixa(p.cabR * .8, p.cabR * .3, p.cabR * .5), [0, b.hy - p.cabR * .7, p.cabR * .45], osso, H.HEAD);
    for (let i = 0; i < 4; i++) m.add(P.caixa(.012, .03, .012), [(i - 1.5) * .025, b.hy - p.cabR * .55, p.cabR * .72], "#3a3228", H.HEAD);
    const mao = b.sh - p.bracoL - .02;
    m.add(P.caixa(.04, .025, .5), [-p.ombro, mao + .02, .3], "#8e8a80", H.ARM_R);
    m.add(P.caixa(.15, .03, .03), [-p.ombro, mao + .02, .06], "#6a5a3a", H.ARM_R);
    m.add(P.cil(.15, .15, .035, 8), [p.ombro + .06, mao + .12, .06], "#6a5236", H.ARM_L, [Math.PI / 2, .7, 0]);
    s = 1.05; alt = 1.2; arma = "espada";
  } else if (kind === "vampire") {
    /* vampiro: pele pálida, capa alta de gola, cabelo penteado para trás e olhos vermelhos */
    p = { pernaH: .4, troncoH: .4, cabR: .16, ombro: .22, quadril: .09, troncoW: .36, troncoD: .22, bracoL: .38, bracoR: .05, pernaR: .055 };
    const pele = C("#d8d0d8"), preto = C("#1c1620"), vinho = C("#6a1020");
    const b = corpo(m, p, { pele, roupa: preto, roupa2: vinho, calca: preto, bota: C("#0e0a10"), cinto: C("#b8a060") }, { semOlhos: true });
    m.add(P.caixa(.36, .7, .03), [0, b.sh - .32, -p.troncoD * .55 - .02], vinho, H.CAPE, [.06, 0, 0]);
    for (const q of [1, -1]) m.add(P.caixa(.03, .22, .16), [q * .15, b.sh + .08, -.04], vinho, H.TORSO, [0, q * .5, q * .25]);
    m.add(hemisferio(p.cabR * 1.04, .45), [0, b.hy + p.cabR * .1, -p.cabR * .08], "#141016", H.HEAD);
    m.add(P.cone(p.cabR * .3, p.cabR * .5, 4), [0, b.hy + p.cabR * .8, p.cabR * .55], "#141016", H.HEAD, [.5, 0, 0]);
    for (const q of [1, -1]) {
      m.add(P.caixa(p.cabR * .22, p.cabR * .12, .03), [q * p.cabR * .36, b.hy + p.cabR * .05, p.cabR * .9], "#ff2a3a", H.HEAD);
      m.add(P.cone(.01, .04, 3), [q * .025, b.hy - p.cabR * .5, p.cabR * .85], "#ffffff", H.HEAD, [Math.PI, 0, 0]);
    }
    s = 1.15; alt = 1.35; arma = "clava";
    pontos.olho = { osso: H.HEAD, p: [0, b.hy + p.cabR * .05, p.cabR * .95] };
  } else if (kind === "behemoth") {
    /* beemote: colosso de pedra escura, chifres para a frente, espinhos nas costas e punhos enormes */
    p = { pernaH: .34, troncoH: .46, cabR: .15, ombro: .3, quadril: .13, troncoW: .56, troncoD: .38, bracoL: .44, bracoR: .1, pernaR: .1 };
    const pele = C("#5a4e5e"), claro = C("#8a7a8e"), osso = C("#e0d4b8");
    corcunda = .3;
    const b = corpo(m, p, { pele, roupa: pele, roupa2: claro, calca: pele, bota: C("#2a2230"), cinto: C("#3a3040") }, { barriga: 1.1, semOlhos: true, ombreira: claro });
    for (let i = 0; i < 5; i++) m.add(P.cone(.06, .22, 4), [(i % 2 ? .08 : -.08), b.sh - .05 - i * .08, -p.troncoD * .55], osso, H.TORSO, [-1.2, 0, 0]);
    for (const q of [1, -1]) {
      m.add(P.cone(.05, .3, 5), [q * p.cabR * .9, b.hy + p.cabR * .5, p.cabR * .3], osso, H.HEAD, [.9, 0, -q * .6]);
      m.add(P.caixa(p.cabR * .3, p.cabR * .14, .03), [q * p.cabR * .38, b.hy + p.cabR * .1, p.cabR * .92], "#ff8a2a", H.HEAD);
      m.add(P.esfera(p.bracoR * 1.9, 0), [q * p.ombro, b.sh - p.bracoL - p.bracoR * .6, 0], claro, q > 0 ? H.ARM_L : H.ARM_R);
      m.add(P.cone(.05, .18, 4), [q * (p.ombro + .08), b.sh + .06, 0], osso, q > 0 ? H.ARM_L : H.ARM_R, [0, 0, -q * .8]);
    }
    s = 2.3; alt = 3.0; arma = "clava";
    pontos.olho = { osso: H.HEAD, p: [0, b.hy + p.cabR * .1, p.cabR * .95] };
  } else {
    /* demônio */
    p = { pernaH: .4, troncoH: .44, cabR: .17, ombro: .28, quadril: .11, troncoW: .5, troncoD: .3, bracoL: .42, bracoR: .085, pernaR: .085 };
    const pele = C("#b0281f"), esc = C("#4d0f10");
    const b = corpo(m, p, { pele, roupa: pele, roupa2: esc, calca: C("#6a1614"), bota: C("#1a1013"), cinto: esc }, { semOlhos: true, ombreira: C("#8e1d18") });
    for (const q of [1, -1]) {
      m.add(P.cone(.06, .3, 5), [q * p.cabR * .7, b.hy + p.cabR * .95, -.02], "#1a1013", H.HEAD, [-.5, 0, -q * .45]);
      m.add(P.cone(.04, .2, 5), [q * p.cabR * 1.05, b.hy + p.cabR * 1.55, -.14], "#1a1013", H.HEAD, [-1.1, 0, -q * .1]);
      m.add(P.caixa(p.cabR * .3, p.cabR * .14, .03), [q * p.cabR * .38, b.hy + p.cabR * .12, p.cabR * .92], "#ffe14a", H.HEAD);
      const asa = lamina([[0, 0], [.55, .35], [.85, .15], [.7, -.05], [.78, -.35], [.5, -.2], [.4, -.45], [.2, -.2]], .015);
      m.add(asa, [q * .06, b.sh - .02, -p.troncoD * .5 - .03], "#5a1216", q > 0 ? H.WING_L : H.WING_R, [0, q > 0 ? -.5 : Math.PI + .5, 0]);
      m.add(P.cone(.025, .1, 4), [q * p.ombro, b.sh - p.bracoL - .1, .06], "#1a1013", q > 0 ? H.ARM_L : H.ARM_R, [Math.PI * .8, 0, 0]);
    }
    for (let i = 0; i < 5; i++) m.add(P.cil(.05 - i * .008, .06 - i * .008, .16, 5), [0, b.hip - .02 - i * .03, -p.troncoD * .5 - .08 - i * .13], esc, H.TAIL, [1.2 - i * .1, 0, 0]);
    m.add(lamina([[0, 0], [.08, .1], [0, .2], [-.08, .1]], .02), [0, b.hip - .12, -p.troncoD * .5 - .82], esc, H.TAIL, [Math.PI / 2, 0, 0]);
    s = 2.1; alt = 2.8; arma = "clava";
    pontos.olho = { osso: H.HEAD, p: [0, b.hy + p.cabR * .12, p.cabR * .95] };
  }
  pontos.cabeca = { osso: H.HEAD, p: [0, p.pernaH + p.troncoH + p.cabR * 2.2, 0] };
  pontos.boca = { osso: H.HEAD, p: [0, p.pernaH + p.troncoH + p.cabR * .6, p.cabR * 1.1] };
  const base: ModeloBase = { arq: "humano", geo: m.geometria(true), ossos: esqueleto(p), alt: alt / s, raio: .34, pontos, anim: { passo: .8, balanco: .8, arma, corcunda } };
  return escalar(base, s);
}
