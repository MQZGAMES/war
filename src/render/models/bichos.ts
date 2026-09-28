/* ================================================================
   Fauna de quatro patas, a galinha, a aranha e o dragão. Silhueta
   própria em cada uma (orelha, presa, juba, chifre, corcova, asa,
   cauda) e três tons por espécie, como no bestiário da v54.
   ================================================================ */
import * as THREE from "three";
import { Montador, P, lamina, deformar } from "../geo";
import type { ModeloBase, OssoSpec } from "./rig";
import { vnoise } from "../../sim/rng";

export const Q = { ROOT: 0, BODY: 1, HEAD: 2, FL: 3, FR: 4, BL: 5, BR: 6, TAIL: 7 };
export const A = { ROOT: 0, BODY: 1, HEAD: 2, LEG_L: 3, LEG_R: 4, WING_L: 5, WING_R: 6, TAIL: 7 };
export const S = { ROOT: 0, BODY: 1 };          // pernas 2..9, presas 10
export const D = { ROOT: 0, BODY: 1, NECK: 2, HEAD: 3, FL: 4, FR: 5, BL: 6, BR: 7, TAIL1: 8, TAIL2: 9, WING_L: 10, WING_R: 11 };
const C = (h: string) => new THREE.Color(h);

interface QP { len: number; larg: number; alt: number; corpoH: number; pernaR: number; cabR: number; cabUp: number; cabFw: number }
function ossosQuad(q: QP): OssoSpec[] {
  const legY = q.alt - q.corpoH * .25;
  return [
    { pai: -1, p: [0, 0, 0] },
    { pai: 0, p: [0, q.alt, 0] },
    { pai: 1, p: [0, q.alt + q.cabUp * .5, q.len * .42] },
    { pai: 1, p: [q.larg * .34, legY, q.len * .3] },
    { pai: 1, p: [-q.larg * .34, legY, q.len * .3] },
    { pai: 1, p: [q.larg * .34, legY, -q.len * .3] },
    { pai: 1, p: [-q.larg * .34, legY, -q.len * .3] },
    { pai: 1, p: [0, q.alt + q.corpoH * .15, -q.len * .48] },
  ];
}
function pernas(m: Montador, q: QP, cor: THREE.Color, casco: THREE.Color, grossa = 1) {
  const legY = q.alt - q.corpoH * .25;
  const pts: [number, number, number][] = [[q.larg * .34, legY, q.len * .3], [-q.larg * .34, legY, q.len * .3], [q.larg * .34, legY, -q.len * .3], [-q.larg * .34, legY, -q.len * .3]];
  pts.forEach((pt, i) => {
    m.add(P.cil(q.pernaR * grossa, q.pernaR * .8 * grossa, legY, 6), [pt[0], legY * .5, pt[2]], cor, Q.FL + i);
    m.add(P.caixa(q.pernaR * 2.2 * grossa, q.pernaR * 1.4, q.pernaR * 2.6 * grossa), [pt[0], q.pernaR * .7, pt[2] + q.pernaR * .3], casco, Q.FL + i);
  });
}
function corpoQuad(m: Montador, q: QP, cor: (x: number, y: number, z: number) => THREE.Color | THREE.Color) {
  m.add(deformar(P.esfera(.5, 1), .04, 5), [0, q.alt, 0], cor as never, Q.BODY, [0, 0, 0], [q.larg, q.corpoH, q.len]);
}
function base(arq: ModeloBase["arq"], geo: THREE.BufferGeometry, ossos: OssoSpec[], alt: number, raio: number, pontos: ModeloBase["pontos"], anim: ModeloBase["anim"]): ModeloBase {
  return { arq, geo, ossos, alt, raio, pontos, anim };
}

export function modeloQuad(kind: string): ModeloBase {
  const m = new Montador();
  let q: QP;
  const pontos: ModeloBase["pontos"] = {};
  if (kind === "rat") {
    q = { len: .5, larg: .22, alt: .17, corpoH: .19, pernaR: .025, cabR: .09, cabUp: .04, cabFw: .08 };
    const c1 = C("#8f8574"), c2 = C("#574d42"), rosa = C("#dca3ab");
    corpoQuad(m, q, (_x, y) => y < q.alt - .04 ? C("#b8ae9c") : c1);
    pernas(m, q, c2, rosa);
    const hy = q.alt + q.cabUp, hz = q.len * .5;
    m.add(P.esfera(q.cabR, 1), [0, hy, hz], c1, Q.HEAD, [0, 0, 0], [1, .9, 1.2]);
    m.add(P.cone(q.cabR * .6, q.cabR * 1.3, 6), [0, hy - .01, hz + q.cabR * 1.1], c1, Q.HEAD, [Math.PI / 2, 0, 0]);
    m.add(P.esfera(.018, 0), [0, hy - .01, hz + q.cabR * 1.75], rosa, Q.HEAD);
    for (const s of [1, -1]) {
      m.add(P.cil(.05, .05, .012, 8), [s * q.cabR * .6, hy + q.cabR * .75, hz - .02], rosa, Q.HEAD, [Math.PI / 2 - .3, 0, s * .4]);
      m.add(P.esfera(.016, 0), [s * q.cabR * .45, hy + q.cabR * .25, hz + q.cabR * .8], "#120c08", Q.HEAD);
    }
    for (let i = 0; i < 5; i++) m.add(P.cil(.012 - i * .0015, .014 - i * .0015, .1, 4), [0, q.alt - .01 + i * .012, -q.len * .5 - .05 - i * .085], rosa, Q.TAIL, [Math.PI / 2 - .2 + i * .15, 0, 0]);
  } else if (kind === "cow") {
    q = { len: 1.05, larg: .48, alt: .62, corpoH: .48, pernaR: .07, cabR: .18, cabUp: .12, cabFw: .15 };
    const branco = C("#efe9de"), preto = C("#2e2c29"), rosa = C("#e6b8b2");
    corpoQuad(m, q, (x, y, z) => vnoise(x * 5.5 + 3, z * 4.5 + y * 3) > .58 ? preto : branco);
    pernas(m, q, branco, preto);
    const hy = q.alt + q.cabUp, hz = q.len * .52;
    m.add(P.esfera(q.cabR, 1), [0, hy, hz], (x, _y, z) => vnoise(x * 9, z * 7) > .6 ? preto : branco, Q.HEAD, [0, 0, 0], [.95, 1, 1.25]);
    m.add(P.caixa(q.cabR * 1.35, q.cabR * .9, q.cabR * .6), [0, hy - q.cabR * .35, hz + q.cabR * 1.05], rosa, Q.HEAD);
    for (const s of [1, -1]) {
      m.add(P.cone(.035, .14, 5), [s * q.cabR * .6, hy + q.cabR * .85, hz - .02], "#e8dcc0", Q.HEAD, [0, 0, -s * .8]);
      m.add(P.esfera(.07, 0), [s * q.cabR * 1.1, hy + q.cabR * .3, hz - .04], branco, Q.HEAD, [0, 0, 0], [1.4, .5, .8]);
      m.add(P.esfera(.022, 0), [s * q.cabR * .55, hy + q.cabR * .25, hz + q.cabR * .95], "#120c08", Q.HEAD);
    }
    m.add(P.esfera(.12, 1), [0, q.alt - q.corpoH * .45, -q.len * .15], rosa, Q.BODY, [0, 0, 0], [1, .6, 1]);
    m.add(P.cil(.015, .015, .45, 4), [0, q.alt - .1, -q.len * .5 - .02], branco, Q.TAIL, [.25, 0, 0]);
    m.add(P.esfera(.045, 0), [0, q.alt - .32, -q.len * .5 - .08], preto, Q.TAIL);
  } else if (kind === "wolf") {
    q = { len: .78, larg: .3, alt: .44, corpoH: .3, pernaR: .045, cabR: .15, cabUp: .12, cabFw: .15 };
    const c1 = C("#868d95"), c2 = C("#4a5058"), c3 = C("#d7dbde");
    corpoQuad(m, q, (_x, y) => y < q.alt - .06 ? c3 : y > q.alt + .08 ? c2 : c1);
    pernas(m, q, c1, c2);
    const hy = q.alt + q.cabUp, hz = q.len * .5;
    m.add(P.esfera(q.cabR * 1.45, 1), [0, q.alt + .05, q.len * .36], c3, Q.BODY, [0, 0, 0], [1, 1, .9]);
    m.add(P.esfera(q.cabR, 1), [0, hy, hz], c1, Q.HEAD);
    m.add(P.cil(q.cabR * .35, q.cabR * .55, q.cabR * 1.2, 6), [0, hy - q.cabR * .2, hz + q.cabR * 1.05], c1, Q.HEAD, [Math.PI / 2, 0, 0]);
    m.add(P.esfera(.028, 0), [0, hy - q.cabR * .15, hz + q.cabR * 1.7], "#141414", Q.HEAD);
    for (const s of [1, -1]) {
      m.add(P.cone(.05, .14, 4), [s * q.cabR * .55, hy + q.cabR * .95, hz - .03], c2, Q.HEAD, [-.15, 0, -s * .2]);
      m.add(P.caixa(.03, .02, .02), [s * q.cabR * .45, hy + q.cabR * .25, hz + q.cabR * .88], "#f0cf4a", Q.HEAD);
    }
    m.add(deformar(P.esfera(.1, 1), .02, 3), [0, q.alt - .05, -q.len * .5 - .15], c1, Q.TAIL, [.9, 0, 0], [.8, .8, 2.2]);
  } else if (kind === "boar") {
    q = { len: .76, larg: .42, alt: .38, corpoH: .4, pernaR: .05, cabR: .16, cabUp: .02, cabFw: .15 };
    const c1 = C("#5b4a3d"), c2 = C("#2c221b"), c3 = C("#ebdfc8");
    corpoQuad(m, q, (_x, y) => y < q.alt - .08 ? C("#76604e") : c1);
    pernas(m, q, c1, c2);
    m.add(P.esfera(.2, 1), [0, q.alt + .12, q.len * .22], c1, Q.BODY, [0, 0, 0], [1.1, .9, 1.2]);
    for (let i = 0; i < 7; i++) m.add(P.cone(.03, .1, 4), [0, q.alt + q.corpoH * .5 + .04 - Math.abs(i - 2) * .015, q.len * .3 - i * .1], c2, Q.BODY, [-.3, 0, 0]);
    const hy = q.alt + q.cabUp, hz = q.len * .52;
    m.add(P.esfera(q.cabR, 1), [0, hy, hz], c1, Q.HEAD, [0, 0, 0], [1, .95, 1.2]);
    m.add(P.cil(q.cabR * .45, q.cabR * .55, q.cabR * .9, 7), [0, hy - q.cabR * .2, hz + q.cabR * 1.05], c1, Q.HEAD, [Math.PI / 2, 0, 0]);
    m.add(P.cil(q.cabR * .46, q.cabR * .46, .02, 8), [0, hy - q.cabR * .2, hz + q.cabR * 1.5], "#d99a8e", Q.HEAD, [Math.PI / 2, 0, 0]);
    for (const s of [1, -1]) {
      m.add(P.cone(.022, .13, 4), [s * q.cabR * .45, hy - q.cabR * .05, hz + q.cabR * 1.15], c3, Q.HEAD, [-.5, 0, -s * .35]);
      m.add(P.cone(.04, .09, 4), [s * q.cabR * .5, hy + q.cabR * .9, hz - .04], c2, Q.HEAD, [-.3, 0, -s * .3]);
      m.add(P.caixa(.025, .018, .02), [s * q.cabR * .42, hy + q.cabR * .3, hz + q.cabR * .9], "#e0703a", Q.HEAD);
    }
    m.add(P.cil(.012, .012, .15, 4), [0, q.alt + .05, -q.len * .5 - .05], c2, Q.TAIL, [.6, 0, 0]);
  } else if (kind === "bear") {
    q = { len: 1.0, larg: .6, alt: .58, corpoH: .58, pernaR: .1, cabR: .22, cabUp: .08, cabFw: .15 };
    const c1 = C("#6e5138"), c2 = C("#3e2b1b"), c3 = C("#a98661");
    corpoQuad(m, q, (_x, y) => y > q.alt + .12 ? C("#7a5a3e") : c1);
    pernas(m, q, c1, c2, 1.1);
    m.add(P.esfera(.3, 1), [0, q.alt + .16, q.len * .2], c1, Q.BODY, [0, 0, 0], [1.05, .9, 1.1]);
    const hy = q.alt + q.cabUp + .04, hz = q.len * .52;
    m.add(P.esfera(q.cabR, 1), [0, hy, hz], c1, Q.HEAD);
    m.add(P.esfera(q.cabR * .55, 1), [0, hy - q.cabR * .25, hz + q.cabR * .9], c3, Q.HEAD, [0, 0, 0], [1, .85, 1.1]);
    m.add(P.esfera(.035, 0), [0, hy - q.cabR * .1, hz + q.cabR * 1.4], "#120c08", Q.HEAD);
    for (const s of [1, -1]) {
      m.add(P.esfera(.07, 0), [s * q.cabR * .72, hy + q.cabR * .75, hz - .04], c2, Q.HEAD);
      m.add(P.esfera(.025, 0), [s * q.cabR * .45, hy + q.cabR * .28, hz + q.cabR * .86], "#120c08", Q.HEAD);
      for (let k = 0; k < 3; k++) m.add(P.cone(.018, .06, 3), [s * q.larg * .34 + (k - 1) * .04, .03, q.len * .3 + q.pernaR * 1.6], "#efe6d2", s > 0 ? Q.FL : Q.FR, [Math.PI / 2, 0, 0]);
    }
    m.add(P.esfera(.08, 0), [0, q.alt + .08, -q.len * .5], c1, Q.TAIL);
  } else if (kind === "crocodile") {
    q = { len: 1.3, larg: .44, alt: .22, corpoH: .2, pernaR: .05, cabR: .13, cabUp: 0, cabFw: .15 };
    const c1 = C("#4f6b3a"), c2 = C("#2f4527"), ventre = C("#bdb27c"), dente = C("#f2ecda");
    corpoQuad(m, q, (_x, y) => y < q.alt - .05 ? ventre : c1);
    pernas(m, q, c1, c2, 1.2);
    /* escamas duras em duas fileiras no dorso */
    for (let i = 0; i < 9; i++) for (const s of [1, -1]) m.add(P.cone(.03, .06, 4), [s * .07, q.alt + q.corpoH * .42, q.len * .36 - i * .1], c2, Q.BODY);
    const hy = q.alt + .03, hz = q.len * .5;
    m.add(P.caixa(.22, .11, .2), [0, hy, hz + .04], c1, Q.HEAD);
    m.add(P.caixa(.15, .06, .38), [0, hy - .01, hz + .32], c1, Q.HEAD);
    m.add(P.caixa(.14, .04, .36), [0, hy - .065, hz + .3], ventre, Q.HEAD);
    for (let i = 0; i < 5; i++) for (const s of [1, -1]) m.add(P.cone(.012, .035, 3), [s * .065, hy - .045, hz + .18 + i * .07], dente, Q.HEAD, [Math.PI, 0, 0]);
    for (const s of [1, -1]) {
      m.add(P.esfera(.04, 0), [s * .07, hy + .07, hz + .06], c1, Q.HEAD);
      m.add(P.caixa(.03, .018, .02), [s * .07, hy + .09, hz + .09], "#e6d23a", Q.HEAD);
    }
    /* cauda: placas que afinam e balançam */
    for (let i = 0; i < 7; i++) m.add(P.caixa(.24 - i * .03, .13 - i * .014, .17), [0, q.alt - .02 - i * .006, -q.len * .5 - .02 - i * .15], i % 2 ? c2 : c1, Q.TAIL);
  } else {
    /* leão */
    q = { len: 1.0, larg: .42, alt: .52, corpoH: .42, pernaR: .07, cabR: .18, cabUp: .12, cabFw: .15 };
    const c1 = C("#c9954b"), c2 = C("#7a5322"), c3 = C("#4d3316");
    corpoQuad(m, q, (_x, y) => y < q.alt - .08 ? C("#e0b87a") : c1);
    pernas(m, q, c1, C("#a07038"));
    const hy = q.alt + q.cabUp, hz = q.len * .5;
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * Math.PI * 2;
      m.add(deformar(P.esfera(.12, 0), .04, i), [Math.cos(a) * q.cabR * 1.05, hy + Math.sin(a) * q.cabR * 1.05, hz - .08], i % 2 ? c2 : c3, Q.HEAD, [0, 0, a], [1, 1, 1.4]);
    }
    m.add(P.esfera(q.cabR * 1.25, 1), [0, hy - .02, hz - .14], c2, Q.HEAD);
    m.add(P.esfera(q.cabR, 1), [0, hy, hz + .02], c1, Q.HEAD);
    m.add(P.esfera(q.cabR * .5, 1), [0, hy - q.cabR * .35, hz + q.cabR * .85], "#e8c890", Q.HEAD, [0, 0, 0], [1.1, .8, 1]);
    m.add(P.esfera(.03, 0), [0, hy - q.cabR * .15, hz + q.cabR * 1.25], "#3a2616", Q.HEAD);
    for (const s of [1, -1]) m.add(P.caixa(.035, .02, .02), [s * q.cabR * .42, hy + q.cabR * .28, hz + q.cabR * .9], "#e6c24a", Q.HEAD);
    for (let i = 0; i < 5; i++) m.add(P.cil(.018, .02, .14, 4), [0, q.alt + .02 - i * .05, -q.len * .5 - .06 - i * .09], c1, Q.TAIL, [.6 + i * .12, 0, 0]);
    m.add(P.esfera(.05, 0), [0, q.alt - .24, -q.len * .5 - .5], c3, Q.TAIL);
  }
  pontos.boca = { osso: Q.HEAD, p: [0, q.alt + q.cabUp - q.cabR * .2, q.len * .5 + q.cabR * 1.3] };
  pontos.cabeca = { osso: Q.HEAD, p: [0, q.alt + q.cabUp + q.cabR * 1.3, q.len * .5] };
  return base("quad", m.geometria(true), ossosQuad(q), q.alt + q.cabUp + q.cabR * 1.2, Math.max(q.larg, q.len * .6) * .7, pontos,
    { passo: kind === "cow" ? .8 : kind === "crocodile" ? .7 : 1.2, balanco: 1, cauda: 1 });
}

export function modeloGalinha(): ModeloBase {
  const m = new Montador();
  const branco = C("#f2ecdc"), vermelho = C("#d24a3c"), amarelo = C("#e8a33a");
  const y0 = .28;
  m.add(P.esfera(.2, 1), [0, y0, 0], (_x, y) => y < y0 - .08 ? C("#ddd6c4") : branco, A.BODY, [0, 0, 0], [.9, .95, 1.2]);
  const hy = y0 + .2, hz = .15;
  m.add(P.esfera(.1, 1), [0, hy, hz], branco, A.HEAD);
  m.add(P.cone(.035, .09, 4), [0, hy - .01, hz + .12], amarelo, A.HEAD, [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 3; i++) m.add(P.esfera(.035, 0), [0, hy + .1 - i * .005, hz - .04 + i * .045], vermelho, A.HEAD);
  m.add(P.esfera(.03, 0), [0, hy - .07, hz + .08], vermelho, A.HEAD, [0, 0, 0], [.8, 1.4, .8]);
  for (const s of [1, -1]) m.add(P.esfera(.016, 0), [s * .06, hy + .02, hz + .07], "#1a120c", A.HEAD);
  for (const s of [1, -1]) {
    m.add(P.esfera(.12, 0), [s * .17, y0 + .02, -.02], C("#e4dccb"), s > 0 ? A.WING_L : A.WING_R, [0, 0, 0], [.35, .7, 1.1]);
    const osso = s > 0 ? A.LEG_L : A.LEG_R;
    m.add(P.cil(.012, .012, .16, 4), [s * .06, .08, 0], amarelo, osso);
    m.add(lamina([[-.04, 0], [.04, 0], [0, .08]], .01), [s * .06, .005, .03], amarelo, osso, [Math.PI / 2, 0, 0]);
  }
  for (let i = 0; i < 3; i++) m.add(P.cone(.05, .18, 4), [(i - 1) * .05, y0 + .12, -.24], i === 1 ? C("#ddd6c4") : branco, A.TAIL, [-.6, 0, (i - 1) * .3]);
  const ossos: OssoSpec[] = [
    { pai: -1, p: [0, 0, 0] }, { pai: 0, p: [0, y0, 0] }, { pai: 1, p: [0, hy - .04, hz - .04] },
    { pai: 1, p: [.06, .16, 0] }, { pai: 1, p: [-.06, .16, 0] },
    { pai: 1, p: [.14, y0 + .08, 0] }, { pai: 1, p: [-.14, y0 + .08, 0] }, { pai: 1, p: [0, y0 + .1, -.2] },
  ];
  return base("ave", m.geometria(true), ossos, .5, .18, { cabeca: { osso: A.HEAD, p: [0, .62, .15] }, boca: { osso: A.HEAD, p: [0, hy, hz + .15] } }, { passo: 1.8, balanco: 1, asas: 1 });
}

export function modeloAranha(): ModeloBase {
  const m = new Montador();
  const c1 = C("#6b5f88"), c2 = C("#2b2340"), c3 = C("#d8699c");
  const s = 1.2;
  const yb = .26;
  m.add(P.esfera(.16, 1), [0, yb, .1], c2, S.BODY, [0, 0, 0], [1, .8, 1.1]);
  m.add(P.esfera(.26, 1), [0, yb + .08, -.26], (x, y, z) => (Math.abs(x) < .05 && y > yb + .1) || (vnoise(x * 12 + 3, z * 12) > .7 && y > yb + .05) ? c3 : c1, S.BODY, [0, 0, 0], [1, .85, 1.2]);
  for (let i = 0; i < 6; i++) m.add(P.esfera(.022, 0), [(i % 3 - 1) * .045, yb + .07 + Math.floor(i / 3) * .035, .24], "#ff5050", S.BODY);
  for (const q of [1, -1]) m.add(P.cone(.022, .09, 4), [q * .04, yb - .06, .24], "#1a1422", 10, [Math.PI - .3, 0, 0]);
  const ossos: OssoSpec[] = [{ pai: -1, p: [0, 0, 0] }, { pai: 0, p: [0, yb, 0] }];
  const angs = [.55, 1.0, 1.45, 1.95];
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? 1 : -1, a = angs[i % 4];
    const hx = side * .1, hz = .12 - (i % 4) * .08;
    ossos.push({ pai: 1, p: [hx, yb, hz] });
    const dx = side * Math.sin(a), dz = Math.cos(a);
    const kx = hx + dx * .28, kz = hz + dz * .28, ky = yb + .16;
    const fx = hx + dx * .52, fz = hz + dz * .52;
    const seg = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, r: number) => {
      const len = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
      const g = P.cil(r * .8, r, len, 4);
      const dir = new THREE.Vector3(x1 - x0, y1 - y0, z1 - z0).normalize();
      const qq = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      const e = new THREE.Euler().setFromQuaternion(qq);
      m.add(g, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], i % 2 ? c2 : C("#3a3050"), 2 + i, [e.x, e.y, e.z]);
    };
    seg(hx, yb, hz, kx, ky, kz, .03);
    seg(kx, ky, kz, fx, 0, fz, .022);
  }
  ossos.push({ pai: 1, p: [0, yb - .04, .24] });
  const b = base("aranha", m.geometria(true), ossos, .5, .45, { boca: { osso: 1, p: [0, yb, .3] }, cabeca: { osso: 1, p: [0, .6, 0] } }, { passo: 2.2, balanco: 1 });
  b.geo.scale(s, s, s);
  for (const o of b.ossos) o.p = [o.p[0] * s, o.p[1] * s, o.p[2] * s];
  for (const k in b.pontos) { const p = b.pontos[k].p; b.pontos[k].p = [p[0] * s, p[1] * s, p[2] * s]; }
  b.alt *= s; b.raio *= s;
  return b;
}

export function modeloDragao(): ModeloBase {
  const m = new Montador();
  const c1 = C("#8a2e34"), c2 = C("#3e141a"), c3 = C("#d8a04a");
  const alt = .82, len = 1.5, larg = .62;
  m.add(deformar(P.esfera(.5, 1), .03, 2), [0, alt, 0], (_x, y) => y < alt - .1 ? c3 : c1, D.BODY, [0, 0, 0], [larg, .56, len]);
  for (let i = 0; i < 9; i++) m.add(P.cone(.05, .16, 4), [0, alt + .27 - Math.abs(i - 3) * .01, len * .38 - i * .16], c2, D.BODY, [-.4, 0, 0]);
  /* pernas grossas com garras */
  const legY = alt - .12;
  const pts: [number, number, number][] = [[larg * .38, legY, len * .28], [-larg * .38, legY, len * .28], [larg * .4, legY, -len * .25], [-larg * .4, legY, -len * .25]];
  pts.forEach((pt, i) => {
    m.add(P.cil(.11, .08, legY, 6), [pt[0], legY * .5, pt[2]], c1, D.FL + i);
    m.add(P.caixa(.2, .08, .24), [pt[0], .04, pt[2] + .06], c2, D.FL + i);
    for (let k = 0; k < 3; k++) m.add(P.cone(.02, .07, 3), [pt[0] + (k - 1) * .06, .03, pt[2] + .2], "#e8dcc0", D.FL + i, [Math.PI / 2, 0, 0]);
  });
  /* pescoço e cabeça */
  const nx = 0, ny = alt + .18, nz = len * .42;
  for (let i = 0; i < 4; i++) m.add(P.cil(.13 - i * .01, .15 - i * .01, .2, 7), [0, ny + i * .13, nz + i * .08], (_x, y) => y < ny + i * .13 - .02 ? c3 : c1, D.NECK, [.55, 0, 0]);
  const hy = ny + .6, hz = nz + .36;
  m.add(P.esfera(.17, 1), [0, hy, hz], c1, D.HEAD, [0, 0, 0], [1, .85, 1.1]);
  m.add(P.caixa(.2, .12, .3), [0, hy - .05, hz + .2], c1, D.HEAD);
  m.add(P.caixa(.18, .05, .26), [0, hy - .12, hz + .18], c3, D.HEAD);
  for (const s of [1, -1]) {
    m.add(P.cone(.04, .3, 5), [s * .1, hy + .12, hz - .15], "#e8dcc0", D.HEAD, [-1.9, 0, -s * .25]);
    m.add(P.cone(.03, .18, 5), [s * .16, hy + .02, hz - .12], "#e8dcc0", D.HEAD, [-1.7, 0, -s * .7]);
    m.add(P.caixa(.05, .025, .03), [s * .09, hy + .05, hz + .12], "#ffd24a", D.HEAD);
    /* asas: braço ósseo e membrana */
    const osso = s > 0 ? D.WING_L : D.WING_R;
    const mem = lamina([[0, 0], [.7, .5], [1.35, .35], [1.2, .05], [1.3, -.25], [.9, -.1], [.8, -.4], [.45, -.15]], .02);
    m.add(mem, [s * .2, alt + .25, len * .12], c2, osso, [-Math.PI / 2, s > 0 ? 0 : Math.PI, 0]);
    m.add(P.cil(.03, .04, .75, 5), [s * .55, alt + .27, len * .14], c1, osso, [0, 0, Math.PI / 2 - s * .2]);
  }
  /* cauda em dois ossos, com ponta de lança */
  for (let i = 0; i < 4; i++) m.add(P.cil(.14 - i * .025, .16 - i * .025, .26, 6), [0, alt - .02 - i * .03, -len * .45 - i * .22], (_x, y) => y < alt - .1 - i * .03 ? c3 : c1, D.TAIL1, [Math.PI / 2 + .12, 0, 0]);
  for (let i = 0; i < 4; i++) m.add(P.cil(.06 - i * .01, .08 - i * .01, .24, 5), [0, alt - .14 - i * .03, -len * .45 - .88 - i * .21], c1, D.TAIL2, [Math.PI / 2 + .12, 0, 0]);
  m.add(lamina([[0, 0], [.12, .14], [0, .3], [-.12, .14]], .02), [0, alt - .26, -len * .45 - 1.78], c2, D.TAIL2, [Math.PI / 2, 0, 0]);
  const ossos: OssoSpec[] = [
    { pai: -1, p: [0, 0, 0] }, { pai: 0, p: [0, alt, 0] }, { pai: 1, p: [nx, ny, nz] }, { pai: 2, p: [0, hy - .08, hz - .12] },
    { pai: 1, p: pts[0] }, { pai: 1, p: pts[1] }, { pai: 1, p: pts[2] }, { pai: 1, p: pts[3] },
    { pai: 1, p: [0, alt, -len * .45] }, { pai: 8, p: [0, alt - .12, -len * .45 - .88] },
    { pai: 1, p: [.2, alt + .25, len * .12] }, { pai: 1, p: [-.2, alt + .25, len * .12] },
  ];
  const b = base("dragao", m.geometria(true), ossos, hy + .2, .9, { boca: { osso: D.HEAD, p: [0, hy - .06, hz + .38] }, cabeca: { osso: D.HEAD, p: [0, hy + .45, hz] } }, { passo: .7, balanco: 1, cauda: 1, asas: 1 });
  const s = 1.25;
  b.geo.scale(s, s, s);
  for (const o of b.ossos) o.p = [o.p[0] * s, o.p[1] * s, o.p[2] * s];
  for (const k in b.pontos) { const p = b.pontos[k].p; b.pontos[k].p = [p[0] * s, p[1] * s, p[2] * s]; }
  b.alt *= s; b.raio *= s;
  return b;
}
