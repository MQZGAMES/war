/* ================================================================
   NATUREZA — árvores, pinheiros, pedras, grama, flores e a decoração
   de cada ponto de caça. Tudo instanciado: poucas chamadas de desenho.
   O tema da zona reveste o que já existe: árvore no vale calcinado
   vira tronco queimado, pedra na ruína vira coluna quebrada.
   ================================================================ */
import * as THREE from "three";
import { W } from "../sim/state";
import { vnoise } from "../sim/rng";
import { CID_R } from "../sim/map";
import { alturaEm, temaDaZona } from "./terrain";
import { Montador, P, deformar, lamina } from "./geo";
import { canvasTex, comVento, cor, h2 } from "./util";
import type { Zona } from "../sim/types";

export interface Emissor { x: number; y: number; h: number; tipo: "fogo" | "brasa" | "vagalume" | "fumaca" | "cristal"; r: number }
export const EMISSORES: Emissor[] = [];
/* blocos de grama: somem no zoom bem aberto, onde não se leem */
export const GRAMAS: THREE.InstancedMesh[] = [];
/* árvores guardadas para o esmaecimento quando cobrem o herói */
export const ARVORES: { x: number; y: number; h: number; mesh: THREE.InstancedMesh; i: number; mesh2: THREE.InstancedMesh; i2: number }[] = [];

const temaEm = (x: number, y: number): Zona | null => {
  let best: Zona | null = null, bd = 1e9;
  for (const z of W.zones) {
    if (z.errante) continue;
    const d = Math.hypot(x - z.x, y - z.y);
    if (d < z.r + 2.2 && d < bd) { bd = d; best = z; }
  }
  return best;
};
const QUEIMADO = new Set(["Vale calcinado", "Toca do dragão", "Fenda infernal"]);
const SOMBRIO = new Set(["Bosque negro", "Teia"]);
const SECO = new Set(["Savana", "Cerrado", "Ermo"]);
const RUINA = new Set(["Ruína antiga", "Trono do ciclope"]);

function instancias(geo: THREE.BufferGeometry, mat: THREE.Material, n: number, sombra = true) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, n));
  m.count = 0;
  m.castShadow = sombra; m.receiveShadow = true;
  m.frustumCulled = false;
  return m;
}
const dummy = new THREE.Object3D();
const tmpC = new THREE.Color();
function por(m: THREE.InstancedMesh, x: number, y: number, z: number, ry: number, s: number | [number, number, number], c?: THREE.Color) {
  dummy.position.set(x, y, z);
  dummy.rotation.set(0, ry, 0);
  if (typeof s === "number") dummy.scale.setScalar(s); else dummy.scale.set(s[0], s[1], s[2]);
  dummy.updateMatrix();
  const i = m.count++;
  m.setMatrixAt(i, dummy.matrix);
  if (c) m.setColorAt(i, c);
  return i;
}

/* ---------- modelos ---------- */
function geoTronco() {
  return new Montador().add(P.cil(.09, .15, 1, 6), [0, .5, 0], "#6b4a2e").geometria();
}
function geoCopa() {
  const verde = cor("#3f7a36"), claro = cor("#6aa648");
  const grad = (_x: number, y: number) => new THREE.Color().copy(verde).lerp(claro, Math.min(1, Math.max(0, (y - .9) / 1.1)));
  const m = new Montador();
  m.add(deformar(P.esfera(.72, 1), .14, 3), [0, 1.25, 0], grad);
  m.add(deformar(P.esfera(.52, 1), .12, 5), [.34, 1.62, .08], grad);
  m.add(deformar(P.esfera(.48, 1), .12, 7), [-.3, 1.5, -.22], grad);
  m.add(deformar(P.esfera(.4, 0), .1, 9), [.05, 1.95, -.05], grad);
  return m.geometria();
}
function geoPinheiro() {
  const base = cor("#24553a"), topo = cor("#3f8a52");
  const grad = (_x: number, y: number) => new THREE.Color().copy(base).lerp(topo, Math.min(1, y / 2.6));
  const m = new Montador();
  m.add(P.cone(.78, 1.0, 7), [0, 1.0, 0], grad);
  m.add(P.cone(.6, .9, 7), [0, 1.55, 0], grad, 0, [0, .4, 0]);
  m.add(P.cone(.42, .8, 7), [0, 2.05, 0], grad, 0, [0, .8, 0]);
  m.add(P.cone(.24, .5, 6), [0, 2.45, 0], grad);
  return m.geometria();
}
function geoGalhos() {
  const m = new Montador(), c = cor("#2c2420");
  m.add(P.cil(.05, .07, .7, 5), [.18, 1.1, 0], c, 0, [0, 0, -.8]);
  m.add(P.cil(.04, .06, .6, 5), [-.16, 1.2, .08], c, 0, [.3, 0, .9]);
  m.add(P.cil(.035, .05, .5, 5), [0, 1.35, -.15], c, 0, [-.8, 0, 0]);
  return m.geometria();
}
function geoPedra(seed: number) {
  const topo = cor("#6f8a5a"), lado = cor("#7c7f82"), esc = cor("#5e6164");
  const g = deformar(P.esfera(.5, 1), .22, seed);
  return new Montador().add(g, [0, .22, 0], (_x, y, _z) => y > .52 ? topo : y > .25 ? lado : esc, 0, [0, 0, 0], [1, .78, 1]).geometria();
}
function geoColuna() {
  const m = new Montador(), c = cor("#b8b09a"), e = cor("#8e8676");
  m.add(P.cil(.26, .3, .9, 8), [0, .45, 0], c);
  m.add(P.caixa(.72, .16, .72), [0, .08, 0], e);
  m.add(deformar(P.cil(.24, .26, .25, 8), .08, 4), [.02, 1.0, 0], c, 0, [.2, 0, .15]);
  return m.geometria();
}
function geoObsidiana() {
  const m = new Montador(), c = cor("#2a2230");
  m.add(deformar(P.octa(.45), .15, 11), [0, .4, 0], c, 0, [0, .3, .1], [1, 1.5, 1]);
  m.add(deformar(P.octa(.28), .1, 13), [.3, .25, .15], c, 0, [.2, 0, -.3], [1, 1.4, 1]);
  return m.geometria();
}
/* tufo: cinco lâminas de um triângulo só (a grama é a maior parte da cena) */
function geoTufo() {
  const pos: number[] = [], col: number[] = [], nor: number[] = [];
  const base = cor("#355f2a"), ponta = cor("#9ccf62");
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2 + .3, inc = .45 + (i % 2) * .25, h = .22 + (i % 3) * .05;
    const cx = Math.cos(a) * .045, cz = Math.sin(a) * .045;
    const tx = -Math.sin(a) * .028, tz = Math.cos(a) * .028;
    const px = cx + Math.cos(a) * inc * h * .5, pz = cz + Math.sin(a) * inc * h * .5;
    pos.push(cx - tx, 0, cz - tz, cx + tx, 0, cz + tz, px, h, pz);
    for (let k = 0; k < 2; k++) col.push(base.r, base.g, base.b);
    col.push(ponta.r, ponta.g, ponta.b);
    for (let k = 0; k < 3; k++) nor.push(0, 1, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}
function geoFlor() {
  const m = new Montador();
  m.add(P.cil(.008, .01, .2, 3), [0, .1, 0], "#3f7a36");
  const branco = cor("#ffffff");
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2;
    m.add(P.esfera(.035, 0), [Math.cos(a) * .045, .21, Math.sin(a) * .045], branco, 0, [0, 0, 0], [1, .45, 1]);
  }
  m.add(P.esfera(.028, 0), [0, .225, 0], "#f2c53d");
  return m.geometria();
}
function geoOsso() {
  const m = new Montador(), c = cor("#e8e0cc");
  m.add(P.cil(.025, .025, .34, 5), [0, .03, 0], c, 0, [0, 0, Math.PI / 2]);
  for (const s of [-1, 1]) { m.add(P.esfera(.04, 0), [s * .17, .04, .025], c); m.add(P.esfera(.04, 0), [s * .17, .04, -.025], c); }
  m.add(P.esfera(.09, 1), [.25, .07, .18], c, 0, [0, 0, 0], [1, .85, 1.1]);          // crânio
  m.add(P.caixa(.03, .03, .03), [.31, .08, .2], "#2a241c");
  return m.geometria();
}
function geoCogumelo() {
  const m = new Montador();
  m.add(P.cil(.03, .04, .14, 6), [0, .07, 0], "#efe6d2");
  m.add(P.cone(.11, .1, 7), [0, .17, 0], "#c0392b");
  m.add(P.esfera(.018, 0), [.05, .19, .02], "#ffffff");
  m.add(P.esfera(.015, 0), [-.03, .2, -.04], "#ffffff");
  m.add(P.cil(.02, .03, .1, 6), [.13, .05, .06], "#efe6d2");
  m.add(P.cone(.07, .07, 7), [.13, .12, .06], "#c0392b");
  return m.geometria();
}
function geoCerca() {
  const m = new Montador(), c = cor("#8a6440");
  m.add(P.caixa(.08, .5, .08), [0, .25, 0], c);
  m.add(P.caixa(.08, .5, .08), [.9, .25, 0], c);
  m.add(P.caixa(1.0, .06, .05), [.45, .38, 0], "#9c744c");
  m.add(P.caixa(1.0, .06, .05), [.45, .2, 0], "#9c744c");
  return m.geometria();
}
function geoFogueira() {
  const m = new Montador();
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; m.add(P.esfera(.1, 0), [Math.cos(a) * .3, .05, Math.sin(a) * .3], "#6d6a66"); }
  m.add(P.cil(.04, .04, .5, 5), [0, .08, 0], "#5a3b22", 0, [0, .3, Math.PI / 2]);
  m.add(P.cil(.04, .04, .5, 5), [0, .1, 0], "#4a3020", 0, [0, 1.8, Math.PI / 2]);
  return m.geometria();
}
function geoEstandarte() {
  const m = new Montador();
  m.add(P.cil(.03, .035, 1.6, 5), [0, .8, 0], "#4a3424");
  m.add(lamina([[0, 0], [.42, -.05], [.36, -.3], [.42, -.55], [0, -.6]], .01), [.02, 1.55, 0], "#8e2a22");
  m.add(P.esfera(.05, 0), [0, 1.62, 0], "#c9c2b0");
  return m.geometria();
}
function geoCristal() {
  const m = new Montador(), c = cor("#ff4a2a");
  m.add(P.octa(.12), [0, .2, 0], c, 0, [0, 0, 0], [1, 2.2, 1]);
  m.add(P.octa(.08), [.1, .12, .05], c, 0, [.3, 0, .4], [1, 2, 1]);
  m.add(P.octa(.07), [-.08, .1, -.06], c, 0, [-.3, 0, -.2], [1, 1.8, 1]);
  return m.geometria();
}

/* ---------- decalques de chão (teia, rachadura) ---------- */
function texTeia() {
  return canvasTex(128, 128, (g) => {
    g.strokeStyle = "rgba(240,240,245,.8)"; g.lineWidth = 1.2;
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.cos(a) * 62, 64 + Math.sin(a) * 62); g.stroke(); }
    for (let r = 8; r < 62; r += 8) {
      g.beginPath();
      for (let i = 0; i <= 10; i++) { const a = i / 10 * Math.PI * 2, rr = r * (1 + (i % 2) * .08); const x = 64 + Math.cos(a) * rr, y = 64 + Math.sin(a) * rr; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
      g.stroke();
    }
  });
}
function texLava() {
  return canvasTex(128, 128, (g) => {
    g.lineCap = "round";
    const risco = (x: number, y: number, a: number, n: number, w: number) => {
      g.beginPath(); g.moveTo(x, y);
      for (let i = 0; i < n; i++) { a += (Math.random() - .5) * 1.2; x += Math.cos(a) * 9; y += Math.sin(a) * 9; g.lineTo(x, y); }
      g.lineWidth = w; g.stroke();
    };
    for (let k = 0; k < 2; k++) {
      g.strokeStyle = k ? "rgba(255,210,90,.95)" : "rgba(255,70,20,.9)";
      for (let i = 0; i < 5; i++) risco(64, 64, i * 1.3, 6, k ? 1.5 : 4.5);
    }
  });
}

export function construirNatureza(qual: "baixa" | "media" | "alta"): THREE.Group {
  const grupo = new THREE.Group();
  grupo.name = "natureza";
  EMISSORES.length = 0; ARVORES.length = 0; GRAMAS.length = 0;
  const N = W.N, tc = W.tileCol, c = W.cidade;
  const matV = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const matCopa = comVento(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), .045, 2.2, .8, true);
  const matPinho = comVento(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), .035, 2.6, .8, true);
  const matGrama = comVento(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), .09, .3, 1.4);

  /* árvores e pedras em blocos de 32×32 ladrilhos: a câmera (e a luz da
     sombra) só desenha os blocos à vista — é o que deixa o mapa Mega leve */
  const BLOCO = 32;
  const porBloco = <T extends { x: number; y: number }>(L: T[]) => {
    const m = new Map<number, T[]>();
    for (const p of L) { const k = ((p.y / BLOCO) | 0) * 1000 + ((p.x / BLOCO) | 0); let l = m.get(k); if (!l) m.set(k, l = []); l.push(p); }
    return [...m.values()];
  };
  const fechar = (...ms: THREE.InstancedMesh[]) => {
    for (const im of ms) {
      if (!im.count) continue;
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere(); im.frustumCulled = true;
      grupo.add(im);
    }
  };
  const gTronco = geoTronco(), gCopa = geoCopa(), gPinho = geoPinheiro(), gGalhos = geoGalhos();
  const tintas = {
    normal: [cor("#ffffff"), cor("#e8f2d8"), cor("#f4ffe8"), cor("#dfe9cf")],
    sombrio: [cor("#7a6a8a"), cor("#6a7a70"), cor("#80708a")],
    seco: [cor("#e8d890"), cor("#f0e0a0"), cor("#d8c880")],
  };
  for (const arvores of porBloco(W.props.filter((p) => p.t === "tree"))) {
    const n = arvores.length;
    const tronco = instancias(gTronco, matV, n);
    const copa = instancias(gCopa.clone(), matCopa, n);
    const pinho = instancias(gPinho.clone(), matPinho, n);
    const galhos = instancias(gGalhos, matV, n);
    for (const im of [copa, pinho]) im.geometry.setAttribute("aFade", new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, n)), 1).setUsage(THREE.DynamicDrawUsage));
    for (const p of arvores) {
      const x = p.x + .5 + (h2(p.x, p.y) - .5) * .3, y = p.y + .5 + (h2(p.y, p.x) - .5) * .3;
      const z = temaEm(x, y), nome = z ? z.name : "";
      const s = .85 + p.s * .45, ry = h2(p.x * 3, p.y * 7) * 6.28, hy = alturaEm(x, y);
      if (QUEIMADO.has(nome)) {                                  // tronco queimado, sem copa
        const t = por(tronco, x, hy, y, ry, [s * 1.2, s * 1.5, s * 1.2], cor("#3a2e28"));
        const gI = por(galhos, x, hy, y, ry, s);
        ARVORES.push({ x, y, h: 1.6 * s, mesh: tronco, i: t, mesh2: galhos, i2: gI });
        if (h2(p.x, p.y * 3) < .25) EMISSORES.push({ x, y, h: .3, tipo: "brasa", r: .6 });
        continue;
      }
      const t = por(tronco, x, hy, y, ry, s);
      const tinta = SOMBRIO.has(nome) ? tintas.sombrio : SECO.has(nome) ? tintas.seco : tintas.normal;
      const tc0 = tinta[Math.floor(h2(p.x * 5, p.y) * tinta.length)];
      if (p.s < .6) {
        const i = por(copa, x, hy, y, ry, s, tc0);
        ARVORES.push({ x, y, h: 2.1 * s, mesh: tronco, i: t, mesh2: copa, i2: i });
      } else {
        const i = por(pinho, x, hy, y, ry, s * 1.05, tc0);
        ARVORES.push({ x, y, h: 2.6 * s, mesh: tronco, i: t, mesh2: pinho, i2: i });
      }
    }
    fechar(tronco, copa, pinho, galhos);
  }

  /* pedras: três variações; ruína e fenda trocam o modelo */
  const gPedra = [0, 1, 2].map((k) => geoPedra(k * 17 + 3)), gColuna = geoColuna(), gObs = geoObsidiana();
  for (const pedras of porBloco(W.props.filter((p) => p.t === "rock"))) {
    const n = pedras.length;
    const pv = gPedra.map((g) => instancias(g, matV, n));
    const coluna = instancias(gColuna, matV, n);
    const obs = instancias(gObs, matV, n);
    for (const p of pedras) {
      const x = p.x + .5, y = p.y + .5, z = temaEm(x, y), nome = z ? z.name : "", hy = alturaEm(x, y);
      const ry = h2(p.x, p.y * 5) * 6.28, s = .9 + p.s * .5;
      if (RUINA.has(nome)) { por(coluna, x, hy, y, ry, .9 + p.s * .3); continue; }
      if (nome === "Fenda infernal" || nome === "Vale calcinado") {
        por(obs, x, hy, y, ry, s);
        if (h2(p.x * 7, p.y) < .5) EMISSORES.push({ x, y, h: .5, tipo: "cristal", r: .5 });
        continue;
      }
      const big = nome === "Penhasco" || nome === "Trono do ciclope" ? 1.35 : 1;
      por(pv[Math.floor(p.s * 3) % 3], x, hy, y, ry, [s * big, s * big * (.9 + p.s * .3), s * big]);
    }
    fechar(...pv, coluna, obs);
  }

  /* grama: tufos por ladrilho, em blocos de 16×16 para o recorte da câmera */
  const dens = qual === "alta" ? 4 : qual === "media" ? 2 : 1;
  const geoT = geoTufo();
  const B = 16;
  for (let by = 0; by < N; by += B) for (let bx = 0; bx < N; bx += B) {
    const pts: [number, number, number, number, THREE.Color][] = [];
    for (let y = by; y < Math.min(N, by + B); y++) for (let x = bx; x < Math.min(N, bx + B); x++) {
      const i = y * N + x;
      if (tc[i] === 200 || tc[i] >= 4 || W.solid[i] || W.tronco[i]) continue;
      const dc = Math.hypot(x + .5 - c.x, y + .5 - c.y);
      if (dc < CID_R + .8) continue;
      const z = temaEm(x + .5, y + .5), nome = z ? z.name : "";
      let d = dens;
      if (QUEIMADO.has(nome)) d = h2(x, y) < .2 ? 1 : 0;
      else if (SECO.has(nome)) d = Math.max(1, dens - 1);
      const n = vnoise(x * .2, y * .2);
      if (n < .28) d = Math.max(0, d - 1);
      for (let k = 0; k < d; k++) {
        const px = x + h2(x * 13 + k, y * 7) , py = y + h2(y * 11 + k, x * 5 + k);
        const tint = QUEIMADO.has(nome) ? cor("#6a5a4a") : SECO.has(nome) ? cor("#e6d27a")
          : SOMBRIO.has(nome) ? cor("#7c8a78") : z ? cor(temaDaZona(nome)).multiplyScalar(1.6).lerp(cor("#ffffff"), .35) : cor("#ffffff");
        tint.multiplyScalar(.85 + h2(px * 9, py * 3) * .3);
        pts.push([px, alturaEm(px, py), py, .7 + h2(px, py) * .7, tint]);
      }
    }
    if (!pts.length) continue;
    const im = instancias(geoT, matGrama, pts.length, false);
    im.frustumCulled = true;
    for (const q of pts) por(im, q[0], q[1], q[2], h2(q[0] * 3, q[2]) * 6.28, [q[3], q[3] * (.8 + h2(q[2], q[0]) * .5), q[3]], q[4]);
    im.computeBoundingSphere();
    grupo.add(im);
    GRAMAS.push(im);
  }

  /* enfeites por tema */
  const flor = instancias(geoFlor(), matV, 2400, false);
  const osso = instancias(geoOsso(), matV, 300);
  const cog = instancias(geoCogumelo(), matV, 400);
  const cerca = instancias(geoCerca(), matV, 200);
  const fog = instancias(geoFogueira(), matV, 60);
  const est = instancias(geoEstandarte(), comVento(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }), .05, 1.6, 2), 80);
  const cri = instancias(geoCristal(), new THREE.MeshBasicMaterial({ vertexColors: true }), 200, false);
  const CF = [cor("#ffffff"), cor("#f7d24a"), cor("#c77dff"), cor("#ff7aa8"), cor("#7ec8ff")];
  for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
    const i = y * N + x;
    if (tc[i] === 200 || tc[i] >= 4 || W.solid[i] || W.tronco[i]) continue;
    const px = x + .2 + h2(x, y * 3) * .6, py = y + .2 + h2(y, x * 3) * .6, hy = alturaEm(px, py);
    const r = h2(x * 17, y * 31);
    const dc = Math.hypot(px - c.x, py - c.y);
    const z = temaEm(px, py), nome = z ? z.name : "";
    if (dc < CID_R + .8) continue;
    if (!z) {
      if (r < .045 && flor.count < 2400) por(flor, px, hy, py, r * 60, .9 + r * 4, CF[Math.floor(r * 1000) % CF.length]);
      continue;
    }
    const t = z.tier;
    if (t <= 2 && r < .12 && flor.count < 2400) por(flor, px, hy, py, r * 60, 1, CF[Math.floor(r * 1000) % CF.length]);
    if ((nome === "Pastagem" || nome === "Ninhada") && r > .965 && cerca.count < 200) por(cerca, px, hy, py, Math.floor(r * 100) * .7, 1);
    if (["Alcateia", "Covil", "Toca do dragão", "Vale calcinado", "Trono do ciclope", "Fenda infernal", "Colina do touro", "Ermo"].includes(nome) && r < .06 && osso.count < 300)
      por(osso, px, hy, py, r * 90, .9 + r * 3);
    if (["Teia", "Bosque negro", "Lameiro", "Toca de ratos", "Urso do norte"].includes(nome) && r > .93 && cog.count < 400) por(cog, px, hy, py, r * 50, .8 + (r - .93) * 6);
    if (QUEIMADO.has(nome) && r > .95) EMISSORES.push({ x: px, y: py, h: .05, tipo: "brasa", r: 1 });
    if (nome === "Fenda infernal" && r > .9 && cri.count < 200) por(cri, px, hy, py, r * 40, .8 + (r - .9) * 5);
  }
  /* acampamentos: fogueira no centro e estandartes na borda */
  for (const z of W.zones) {
    if (z.errante) continue;
    const orc = z.name === "Acampamento orc" || z.name === "Horda orc";
    const ruina = RUINA.has(z.name);
    if (orc || ruina || z.name === "Colina do touro") {
      const fx0 = z.x + .3, fy0 = z.y - .2;
      const tx = fx0 | 0, ty = fy0 | 0;
      if (!W.solid[ty * N + tx]) {
        por(fog, fx0, alturaEm(fx0, fy0), fy0, 0, 1);
        EMISSORES.push({ x: fx0, y: fy0, h: .15, tipo: "fogo", r: 1 });
      }
      const nE = orc ? 4 : 2;
      for (let k = 0; k < nE; k++) {
        const a = k / nE * 6.28 + z.id, ex = z.x + Math.cos(a) * (z.r + .6), ey = z.y + Math.sin(a) * (z.r + .6);
        if (ex < 1 || ey < 1 || ex > N - 1 || ey > N - 1) continue;
        por(est, ex, alturaEm(ex, ey), ey, a, orc ? 1 : .9);
      }
    }
  }
  for (const m of [flor, osso, cog, cerca, fog, est, cri]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  grupo.add(flor, osso, cog, cerca, fog, est, cri);

  /* decalques de chão: teias e rachaduras de lava */
  const teia = new THREE.MeshBasicMaterial({ map: texTeia(), transparent: true, depthWrite: false, opacity: .75 });
  const lava = new THREE.MeshBasicMaterial({ map: texLava(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  for (const z of W.zones) {
    if (z.errante) continue;
    const n = z.name === "Teia" ? 7 : z.name === "Bosque negro" ? 3 : QUEIMADO.has(z.name) ? 6 : 0;
    for (let k = 0; k < n; k++) {
      const a = h2(z.id * 7 + k, k) * 6.28, d = Math.sqrt(h2(k, z.id * 3)) * (z.r + .5);
      const x = z.x + Math.cos(a) * d, y = z.y + Math.sin(a) * d;
      if (x < 1 || y < 1 || x > N - 1 || y > N - 1) continue;
      const q = new THREE.Mesh(P.plano(1, 1), QUEIMADO.has(z.name) ? lava : teia);
      q.rotation.x = -Math.PI / 2; q.rotation.z = a;
      const s = QUEIMADO.has(z.name) ? 1.4 + h2(k, 9) * 1.2 : 1.2 + h2(k, 5) * 1.3;
      q.scale.set(s, s, 1);
      q.position.set(x, alturaEm(x, y) + .02, y);
      q.renderOrder = 1;
      grupo.add(q);
      if (QUEIMADO.has(z.name)) EMISSORES.push({ x, y, h: .05, tipo: "brasa", r: s * .4 });
    }
  }
  /* vaga-lumes: perto de água e de mato, acendem à noite */
  for (const p of W.props) {
    if (p.t !== "water" && p.t !== "tree") continue;
    if (h2(p.x * 13, p.y * 17) > (p.t === "water" ? .25 : .06)) continue;
    EMISSORES.push({ x: p.x + .5, y: p.y + .5, h: .6, tipo: "vagalume", r: 1.6 });
  }
  void tmpC;
  return grupo;
}
