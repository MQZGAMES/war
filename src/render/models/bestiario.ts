/* ================================================================
   Bestiário novo: cobra (corpo em corrente de ossos que ondula),
   escorpião (oito patas, pinças e ferrão erguido) e hidra (corpo de
   dragão sem asas, três pescoços). Esqueleto, vampiro e beemote são
   humanoides e moram em humanos.ts.
   ================================================================ */
import * as THREE from "three";
import { Montador, P, lamina, deformar } from "../geo";
import type { ModeloBase, OssoSpec } from "./rig";
import { D } from "./bichos";

const C = (h: string) => new THREE.Color(h);
function escalar(b: ModeloBase, s: number) {
  b.geo.scale(s, s, s);
  for (const o of b.ossos) o.p = [o.p[0] * s, o.p[1] * s, o.p[2] * s];
  for (const k in b.pontos) { const p = b.pontos[k].p; b.pontos[k].p = [p[0] * s, p[1] * s, p[2] * s]; }
  b.alt *= s; b.raio *= s;
  return b;
}

/* ---------- cobra: SEG gomos, cada um filho do anterior ---------- */
export const SERP = { SEG: 8 };
export function modeloCobra(): ModeloBase {
  const m = new Montador();
  const c1 = C("#5f8a3a"), c2 = C("#2f4a1c"), barriga = C("#d8cf8a");
  const n = SERP.SEG, passo = .13, y = .09;
  const ossos: OssoSpec[] = [{ pai: -1, p: [0, 0, 0] }];
  /* da cauda (osso 1) à cabeça (osso n) */
  for (let i = 1; i <= n; i++) ossos.push({ pai: i - 1 < 1 ? 0 : i - 1, p: [0, y, -passo * n * .55 + (i - 1) * passo] });
  for (let i = 1; i <= n; i++) {
    const z = ossos[i].p[2], r = .045 + Math.sin((i / n) * Math.PI * .9) * .045;
    m.add(P.esfera(r, 1), [0, y, z + passo * .5], (_x, yy) => yy < y - r * .3 ? barriga : (i % 2 ? c1 : c2), i, [0, 0, 0], [1, .8, 1.5]);
  }
  const zc = ossos[n].p[2] + passo * .9;
  m.add(P.esfera(.07, 1), [0, y + .02, zc], c1, n, [0, 0, 0], [1, .7, 1.35]);
  for (const s of [1, -1]) {
    m.add(P.caixa(.022, .02, .02), [s * .04, y + .05, zc + .04], "#f0d040", n);
    m.add(P.cone(.008, .035, 3), [s * .018, y - .01, zc + .08], "#f2ecda", n, [Math.PI, 0, 0]);
  }
  m.add(lamina([[0, 0], [.02, .05], [0, .03], [-.02, .05]], .004), [0, y - .01, zc + .1], "#c0303a", n, [Math.PI / 2, 0, 0]);
  const b: ModeloBase = {
    arq: "serpente", geo: m.geometria(true), ossos, alt: .3, raio: .3,
    pontos: { boca: { osso: n, p: [0, y, zc + .08] }, cabeca: { osso: n, p: [0, .35, zc] } },
    anim: { passo: 1, balanco: 1 },
  };
  return escalar(b, 1.35);
}

/* ---------- escorpião: patas como a aranha (ossos 2..9), pinças no 10 ---------- */
export function modeloEscorpiao(): ModeloBase {
  const m = new Montador();
  const c1 = C("#b8863a"), c2 = C("#6a4a1c"), c3 = C("#e8c070");
  const yb = .22;
  for (let i = 0; i < 4; i++) m.add(P.esfera(.17 - i * .012, 1), [0, yb, .12 - i * .13], (_x, y) => y > yb + .05 ? c3 : c1, 1, [0, 0, 0], [1.25, .55, .8]);
  m.add(P.esfera(.12, 1), [0, yb + .02, .24], c1, 1, [0, 0, 0], [1.1, .6, .9]);
  for (let i = 0; i < 4; i++) m.add(P.caixa(.03, .02, .03), [(i % 2 ? 1 : -1) * .03, yb + .08, .3], "#1a0e06", 1);
  /* cauda: seis gomos subindo por cima das costas, ferrão apontando à frente */
  let px = 0, py = yb + .02, pz = -.34, a = .2;
  for (let i = 0; i < 6; i++) {
    a += .42;
    const nx = 0, ny = py + Math.sin(a) * .11, nz = pz - Math.cos(a) * .11;
    m.add(P.esfera(.055 - i * .004, 0), [nx, ny, nz], i % 2 ? c1 : c2, 1, [0, 0, 0], [1, 1, 1.2]);
    px = nx; py = ny; pz = nz;
  }
  m.add(P.esfera(.06, 0), [px, py + .02, pz + .06], c2, 1);
  m.add(P.cone(.022, .12, 4), [px, py - .02, pz + .15], "#1a0e06", 1, [Math.PI / 2 + .6, 0, 0]);
  const ossos: OssoSpec[] = [{ pai: -1, p: [0, 0, 0] }, { pai: 0, p: [0, yb, 0] }];
  const angs = [.7, 1.2, 1.6, 2.05];
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? 1 : -1, ang = angs[i % 4];
    const hx = side * .13, hz = .05 - (i % 4) * .1;
    ossos.push({ pai: 1, p: [hx, yb, hz] });
    const dx = side * Math.sin(ang), dz = Math.cos(ang);
    const kx = hx + dx * .22, kz = hz + dz * .22, ky = yb + .1, fx = hx + dx * .42, fz = hz + dz * .42;
    const seg = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, r: number) => {
      const len = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x1 - x0, y1 - y0, z1 - z0).normalize());
      const e = new THREE.Euler().setFromQuaternion(q);
      m.add(P.cil(r * .8, r, len, 4), [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], c2, 2 + i, [e.x, e.y, e.z]);
    };
    seg(hx, yb, hz, kx, ky, kz, .025);
    seg(kx, ky, kz, fx, 0, fz, .018);
  }
  /* pinças no osso 10 */
  ossos.push({ pai: 1, p: [0, yb, .3] });
  for (const s of [1, -1]) {
    m.add(P.cil(.03, .035, .2, 5), [s * .14, yb, .38], c1, 10, [Math.PI / 2, 0, -s * .5]);
    m.add(P.esfera(.07, 0), [s * .2, yb + .01, .5], c1, 10, [0, 0, 0], [1, .6, 1.3]);
    m.add(P.cone(.03, .12, 4), [s * .24, yb + .01, .6], c2, 10, [Math.PI / 2, 0, s * .3]);
    m.add(P.cone(.025, .1, 4), [s * .16, yb + .01, .6], c2, 10, [Math.PI / 2, 0, -s * .3]);
  }
  const b: ModeloBase = { arq: "aranha", geo: m.geometria(true), ossos, alt: .55, raio: .45,
    pontos: { boca: { osso: 1, p: [0, yb, .35] }, cabeca: { osso: 1, p: [0, .65, 0] } }, anim: { passo: 2, balanco: 1 } };
  return escalar(b, 1.35);
}

/* ---------- hidra: corpo de dragão sem asas e três cabeças ---------- */
export function modeloHidra(): ModeloBase {
  const m = new Montador();
  const c1 = C("#2f7a6a"), c2 = C("#123a34"), c3 = C("#c8d890");
  const alt = .78, len = 1.4, larg = .7;
  m.add(deformar(P.esfera(.5, 1), .03, 4), [0, alt, 0], (_x, y) => y < alt - .1 ? c3 : c1, D.BODY, [0, 0, 0], [larg, .55, len]);
  for (let i = 0; i < 7; i++) m.add(P.cone(.05, .14, 4), [0, alt + .26, len * .3 - i * .16], c2, D.BODY, [-.4, 0, 0]);
  const legY = alt - .12;
  const pts: [number, number, number][] = [[larg * .38, legY, len * .26], [-larg * .38, legY, len * .26], [larg * .4, legY, -len * .24], [-larg * .4, legY, -len * .24]];
  pts.forEach((pt, i) => {
    m.add(P.cil(.12, .09, legY, 6), [pt[0], legY * .5, pt[2]], c1, D.FL + i);
    m.add(P.caixa(.22, .08, .24), [pt[0], .04, pt[2] + .06], c2, D.FL + i);
  });
  const ny = alt + .15, nz = len * .38;
  /* três pescoços saindo do peito, abertos em leque */
  const heads: [number, number, number][] = [];
  for (const k of [-1, 0, 1]) {
    const ax = k * .32;
    for (let i = 0; i < 4; i++) m.add(P.cil(.08 - i * .006, .1 - i * .006, .19, 6), [ax * (i + 1) / 4 + k * .04, ny + i * .13, nz + i * .06], (_x, y) => y < ny + i * .13 - .02 ? c3 : c1, D.NECK, [.5, 0, -k * .35]);
    const hx = ax + k * .08, hy = ny + .58 - Math.abs(k) * .06, hz = nz + .3;
    heads.push([hx, hy, hz]);
    m.add(P.esfera(.12, 1), [hx, hy, hz], c1, D.HEAD, [0, 0, 0], [1, .8, 1.2]);
    m.add(P.caixa(.13, .07, .2), [hx, hy - .04, hz + .15], c1, D.HEAD);
    m.add(P.caixa(.12, .03, .18), [hx, hy - .09, hz + .14], c3, D.HEAD);
    for (const s of [1, -1]) {
      m.add(P.caixa(.035, .02, .02), [hx + s * .06, hy + .04, hz + .1], "#ffe14a", D.HEAD);
      m.add(P.cone(.02, .12, 4), [hx + s * .06, hy + .09, hz - .06], c2, D.HEAD, [-1.9, 0, -s * .3]);
    }
  }
  for (let i = 0; i < 5; i++) m.add(P.cil(.13 - i * .022, .15 - i * .022, .25, 6), [0, alt - .04 - i * .04, -len * .45 - i * .21], (_x, y) => y < alt - .12 - i * .04 ? c3 : c1, i < 3 ? D.TAIL1 : D.TAIL2, [Math.PI / 2 + .15, 0, 0]);
  const ossos: OssoSpec[] = [
    { pai: -1, p: [0, 0, 0] }, { pai: 0, p: [0, alt, 0] }, { pai: 1, p: [0, ny, nz] }, { pai: 2, p: [0, ny + .5, nz + .25] },
    { pai: 1, p: pts[0] }, { pai: 1, p: pts[1] }, { pai: 1, p: pts[2] }, { pai: 1, p: pts[3] },
    { pai: 1, p: [0, alt, -len * .45] }, { pai: 8, p: [0, alt - .12, -len * .45 - .63] },
    { pai: 1, p: [.2, alt + .2, len * .1] }, { pai: 1, p: [-.2, alt + .2, len * .1] },
  ];
  const b: ModeloBase = { arq: "dragao", geo: m.geometria(true), ossos, alt: ny + .75, raio: .85,
    pontos: { boca: { osso: D.HEAD, p: [0, heads[1][1] - .05, heads[1][2] + .25] }, cabeca: { osso: D.HEAD, p: [0, ny + 1.05, nz + .3] } },
    anim: { passo: .6, balanco: 1, cauda: 1 } };
  return escalar(b, 1.25);
}
