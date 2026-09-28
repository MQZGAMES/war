/* ================================================================
   CIDADE MURADA (Ultimate) — muralha com ameias, torres nos cantos e
   nos portões, calçamento em toda a cidade, casas de pedra, reboco com
   enxaimel, tijolo e madeira, telhados de duas águas com chaminé, as
   quatro lojas viradas para a praça do obelisco e janelas que acendem
   à noite. Casa ou muro que cobre o herói fica translúcido.
   ================================================================ */
import * as THREE from "three";
import { W } from "../sim/state";
import type { Casa } from "../sim/biomas";
import { alturaEm } from "./terrain";
import { Montador, P, lamina } from "./geo";
import { comVento, cor, h2, U } from "./util";
import { EMISSORES } from "./nature";
import { CIDADE, montarLampioes, montarNpcs, montarObelisco, texCalcamento } from "./city";

/* estilo: parede, base, telhado */
const ESTILOS = [
  { parede: "#b9b1a2", base: "#8a8274", telha: "#4e5660" },          // pedra com ardósia
  { parede: "#e6dac0", base: "#9a8a70", telha: "#a8483a" },          // reboco e enxaimel, telha
  { parede: "#a8604a", base: "#6e4a3a", telha: "#5a4038" },          // tijolo
  { parede: "#9a7048", base: "#6a4a30", telha: "#c0a060" },          // madeira e palha
];
const PEDRA = "#aaa292", PEDRA_ESC = "#847c6e";
const LOJA_COR: Record<string, [string, string]> = {
  feiticeiro: ["#6a3a9a", "#e8d0ff"], comerciante: ["#2a6a4a", "#f0e8c0"], ferreiro: ["#8a3a22", "#f0c080"], banqueiro: ["#8a6a1a", "#fff0b0"],
};

/* telhado de duas águas com a cumeeira ao longo de z: empena na cor da
   parede e as duas águas na cor da telha */
function telhado(sx: number, sz: number, rh: number, parede: THREE.Color, telha: THREE.Color) {
  const m = new Montador(), half = sx / 2;
  m.add(lamina([[-half, 0], [half, 0], [0, rh]], sz), [0, 0, 0], parede);
  const a = Math.atan2(rh, half), L = Math.hypot(half, rh) + .14;
  for (const s of [-1, 1]) {
    const nx = -Math.sin(a) * s, ny = Math.cos(a);
    m.add(P.caixa(L, .07, sz + .22), [s * half / 2 + nx * .035 - s * .02, rh / 2 + ny * .035, 0], telha, 0, [0, 0, -s * a]);
  }
  m.add(P.caixa(.1, .1, sz + .26), [0, rh + .02, 0], telha.clone().multiplyScalar(.75));
  return m.geometria();
}

function casaGeo(c: Casa, janelas: Montador) {
  const m = new Montador();
  const E = ESTILOS[c.estilo % ESTILOS.length];
  const par = cor(E.parede), base = cor(E.base), telha = cor(E.telha);
  const sx = c.x1 - c.x0 + 1, sz = c.y1 - c.y0 + 1;
  const cx = c.x0 + sx / 2, cz = c.y0 + sz / 2, y = alturaEm(cx, cz) + .035, alt = c.alt;
  m.add(P.caixa(sx + .1, .16, sz + .1), [cx, y + .08, cz], base);
  m.add(P.caixa(sx - .04, alt, sz - .04), [cx, y + alt / 2, cz], par);
  /* enxaimel: vigas escuras nos cantos e no meio da altura */
  if (c.estilo % 4 === 1) {
    const v = cor("#5a3a22");
    for (const [qx, qz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) m.add(P.caixa(.09, alt, .09), [cx + qx * (sx / 2 - .02), y + alt / 2, cz + qz * (sz / 2 - .02)], v);
    m.add(P.caixa(sx + .02, .08, sz + .02), [cx, y + alt * .55, cz], v);
    m.add(P.caixa(sx + .02, .08, sz + .02), [cx, y + alt - .04, cz], v);
  }
  /* porta e degrau do lado da rua */
  const dirs: [number, number][] = [[-1, 0], [0, -1], [1, 0], [0, 1]];
  const [px, pz] = dirs[c.porta];
  const fx = cx + px * (sx / 2), fz = cz + pz * (sz / 2);
  const rotP: [number, number, number] = [0, px ? Math.PI / 2 : 0, 0];
  m.add(P.caixa(.5, .86, .08), [fx + px * .02, y + .43 + .1, fz + pz * .02], "#4a2e1c", 0, rotP);
  m.add(P.caixa(.62, .08, .12), [fx + px * .02, y + .9 + .1, fz + pz * .02], E.base, 0, rotP);
  m.add(P.caixa(.7, .1, .3), [fx + px * .15, y + .05, fz + pz * .15], "#8e8676", 0, rotP);
  /* janelas nos quatro lados (menos onde está a porta), num segundo corpo que acende à noite */
  for (let d = 0; d < 4; d++) {
    const [wx, wz] = dirs[d], comp = wx ? sz : sx;
    const n = comp >= 4 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const off = n === 1 ? 0 : (k - .5) * comp * .45;
      if (d === c.porta && Math.abs(off) < .5) continue;
      const jx = cx + wx * (sx / 2 + .02) + (wx ? 0 : off), jz = cz + wz * (sz / 2 + .02) + (wz ? 0 : off);
      const rot: [number, number, number] = [0, wx ? Math.PI / 2 : 0, 0];
      m.add(P.caixa(.42, .42, .06), [jx, y + alt * .62, jz], "#e8e0d0", 0, rot);
      janelas.add(P.caixa(.32, .32, .08), [jx + wx * .005, y + alt * .62, jz + wz * .005], "#ffffff", 0, rot);
      if (alt > 1.8) {
        m.add(P.caixa(.42, .42, .06), [jx, y + alt * .25 + .25, jz], "#e8e0d0", 0, rot);
        janelas.add(P.caixa(.32, .32, .08), [jx + wx * .005, y + alt * .25 + .25, jz + wz * .005], "#ffffff", 0, rot);
      }
    }
  }
  /* telhado: cumeeira no lado comprido */
  const rh = Math.min(sx, sz) * .42;
  const longoX = sx > sz;
  const tg = longoX ? telhado(sz + .3, sx + .3, rh, par, telha) : telhado(sx + .3, sz + .3, rh, par, telha);
  m.add(tg, [cx, y + alt, cz], null, 0, [0, longoX ? Math.PI / 2 : 0, 0]);
  /* chaminé com fumaça em metade das casas */
  if (h2(c.x0 * 7, c.y1 * 3) < .55) {
    const chx = cx + (longoX ? sx * .25 : sx * .18), chz = cz + (longoX ? sz * .15 : sz * .25);
    m.add(P.caixa(.26, rh + .5, .26), [chx, y + alt + (rh + .5) / 2, chz], "#7a5a48");
    m.add(P.caixa(.32, .08, .32), [chx, y + alt + rh + .52, chz], "#5a4038");
    if (h2(c.y0, c.x1) < .5) EMISSORES.push({ x: chx, y: chz, h: alt + rh + .6, tipo: "fumaca", r: .2 });
  }
  /* loja: toldo listrado sobre a porta e placa pendurada */
  if (c.loja) {
    const [c1, c2] = LOJA_COR[c.loja] || ["#6a4a2a", "#f0e0b0"];
    for (let k = 0; k < 6; k++) {
      const t = (k - 2.5) * .26;
      const ax = fx + px * .5 + (px ? 0 : t), az = fz + pz * .5 + (pz ? 0 : t);
      m.add(P.caixa(.26, .04, .95), [ax, y + 1.35, az], k % 2 ? c2 : c1, 0, [px ? 0 : -.35 * pz, px ? Math.PI / 2 : 0, px ? .35 * px : 0]);
    }
    const sx2 = fx + px * .12 + (px ? 0 : .85), sz2 = fz + pz * .12 + (pz ? 0 : .85);
    m.add(P.caixa(.06, .06, .5), [sx2 + px * .2, y + 1.62, sz2 + pz * .2], "#3a2a1c", 0, rotP);
    m.add(P.caixa(.5, .36, .05), [sx2 + px * .3, y + 1.38, sz2 + pz * .3], c1, 0, [0, px ? 0 : Math.PI / 2, 0]);
    m.add(P.caixa(.36, .22, .06), [sx2 + px * .3, y + 1.38, sz2 + pz * .3], c2, 0, [0, px ? 0 : Math.PI / 2, 0]);
  }
  return m.geometria();
}

/* muralha: um lado por malha (para ficar translúcido só o lado que cobre o herói) */
function muralha(g: THREE.Group, mat: () => THREE.Material) {
  const c = W.cidade, H = c.meia!, ox = Math.floor(c.x), oy = Math.floor(c.y);
  const lados = [new Montador(), new Montador(), new Montador(), new Montador()];   // -x, -y, +x, +y
  const pedra = cor(PEDRA), esc = cor(PEDRA_ESC);
  const y0 = .035;
  for (let t = -H; t <= H; t++) {
    for (let s = 0; s < 4; s++) {
      const [x, y] = s === 0 ? [-H, t] : s === 1 ? [t, -H] : s === 2 ? [H, t] : [t, H];
      if (Math.abs(t) <= 1) continue;                     // portão
      if (Math.abs(t) === H && (s === 1 || s === 3)) continue;   // canto: fica com o lado x
      const m = lados[s], wx = ox + x + .5, wz = oy + y + .5, eixoX = s === 1 || s === 3;
      const rot: [number, number, number] = [0, eixoX ? 0 : Math.PI / 2, 0];
      m.add(P.caixa(1.02, 1.05, .86), [wx, y0 + .525, wz], (t & 1) ? pedra : pedra.clone().multiplyScalar(.95), 0, rot);
      m.add(P.caixa(1.06, .1, .96), [wx, y0 + 1.08, wz], esc, 0, rot);
      if (t & 1) m.add(P.caixa(.46, .3, .86), [wx, y0 + 1.28, wz], pedra, 0, rot);
    }
  }
  /* torres dos portões e arco por cima da passagem */
  for (let s = 0; s < 4; s++) {
    const m = lados[s], eixoX = s === 1 || s === 3;
    const bx = s === 0 ? -H : s === 2 ? H : 0, by = s === 1 ? -H : s === 3 ? H : 0;
    for (const lado of [-2, 2]) {
      const x = ox + (eixoX ? lado : bx) + .5, z = oy + (eixoX ? by : lado) + .5;
      m.add(P.caixa(1.25, 1.9, 1.25), [x, y0 + .95, z], pedra);
      m.add(P.caixa(1.4, .12, 1.4), [x, y0 + 1.95, z], esc);
      m.add(P.cone(1.05, .8, 4), [x, y0 + 2.4, z], "#4e5660", 0, [0, Math.PI / 4, 0]);
    }
    const ax = ox + bx + .5, az = oy + by + .5;
    m.add(P.caixa(eixoX ? 3.3 : .9, .5, eixoX ? .9 : 3.3), [ax, y0 + 1.72, az], pedra);
    m.add(P.caixa(eixoX ? 3.4 : 1, .1, eixoX ? 1 : 3.4), [ax, y0 + 2.0, az], esc);
  }
  /* torres redondas nos cantos, com bandeira */
  const band = comVento(new THREE.MeshLambertMaterial({ color: "#d9b45c", side: THREE.DoubleSide }), .1, .8, 3);
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const s = sx < 0 ? 0 : 2, m = lados[s];
    const x = ox + sx * H + .5, z = oy + sy * H + .5;
    m.add(P.cil(1.15, 1.3, 2.4, 10), [x, y0 + 1.2, z], pedra);
    m.add(P.cil(1.3, 1.3, .14, 10), [x, y0 + 2.45, z], esc);
    m.add(P.cone(1.35, 1.2, 10), [x, y0 + 3.1, z], "#4e5660");
    m.add(P.cil(.03, .03, 1.1, 4), [x, y0 + 4.1, z], "#3a2c1e");
    const f = new THREE.Mesh(lamina([[0, 0], [.7, -.05], [.62, -.26], [.7, -.48], [0, -.44]], .01), band);
    f.position.set(x + .03, y0 + 4.6, z); f.rotation.y = -Math.PI / 4;
    g.add(f);
  }
  lados.forEach((m, s) => {
    const mesh = new THREE.Mesh(m.geometria(), mat());
    mesh.castShadow = true; mesh.receiveShadow = true;
    g.add(mesh);
    const x = s === 0 ? c.x - H - .5 : s === 2 ? c.x + H + .5 : c.x, y = s === 1 ? c.y - H - .5 : s === 3 ? c.y + H + .5 : c.y;
    CIDADE.fade.push({ mesh, x0: s === 1 || s === 3 ? c.x - H : x - .5, x1: s === 1 || s === 3 ? c.x + H : x + .5, y0: s === 0 || s === 2 ? c.y - H : y - .5, y1: s === 0 || s === 2 ? c.y + H : y + .5, alt: 1.4 });
  });
}

export function construirCidadeGrande(): THREE.Group {
  const g = new THREE.Group();
  g.name = "cidade";
  const c = W.cidade, H = c.meia!;
  const lado = 2 * H + 1;
  /* calçamento na cidade inteira */
  const tex = texCalcamento();
  tex.repeat.set(lado / 2.3, lado / 2.3);
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(lado, lado), new THREE.MeshLambertMaterial({ map: tex, color: "#e8e0d0" }));
  chao.rotation.x = -Math.PI / 2;
  chao.position.set(c.x, .035, c.y);
  chao.receiveShadow = true;
  g.add(chao);
  const matV = () => new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  muralha(g, matV);
  /* casas e lojas: uma malha por prédio, para o esmaecimento */
  const jm = new Montador();
  for (const casa of c.casas || []) {
    const mesh = new THREE.Mesh(casaGeo(casa, jm), matV());
    mesh.castShadow = true; mesh.receiveShadow = true;
    g.add(mesh);
    CIDADE.fade.push({ mesh, x0: casa.x0, x1: casa.x1 + 1, y0: casa.y0, y1: casa.y1 + 1, alt: casa.alt + Math.min(casa.x1 - casa.x0 + 1, casa.y1 - casa.y0 + 1) * .42 });
  }
  if (jm.pos.length) {
    const janelas = new THREE.Mesh(jm.geometria(), new THREE.MeshLambertMaterial({ color: "#2a3444", emissive: "#ffb04a", emissiveIntensity: 0 }));
    g.add(janelas);
    CIDADE.janelas = janelas;
  }
  /* balcão das lojas, canteiros da praça */
  const dm = new Montador();
  for (const n of c.npcs) {
    const fa = n.fa, bx = n.x + Math.cos(fa) * .52, bz = n.y + Math.sin(fa) * .52, y = alturaEm(bx, bz) + .035;
    const rot: [number, number, number] = [0, Math.PI / 2 - fa, 0];
    dm.add(P.caixa(1.1, .5, .3), [bx, y + .25, bz], "#7a5a3a", 0, rot);
    dm.add(P.caixa(1.2, .06, .38), [bx, y + .53, bz], "#9c7650", 0, rot);
  }
  for (const [x, z] of c.canteiros || []) {
    const cx = x + .5, cz = z + .5;
    dm.add(P.caixa(.95, .32, .95), [cx, .035 + .16, cz], "#8e8676");
    dm.add(P.caixa(.8, .06, .8), [cx, .035 + .33, cz], "#5a4028");
    dm.add(P.cil(.07, .1, .9, 6), [cx, .035 + .75, cz], "#6b4a2e");
    dm.add(P.esfera(.5, 1), [cx, .035 + 1.35, cz], "#4f8a3c", 0, [0, 0, 0], [1, .9, 1]);
    for (let k = 0; k < 5; k++) { const a = k * 1.26; dm.add(P.esfera(.05, 0), [cx + Math.cos(a) * .3, .035 + .4, cz + Math.sin(a) * .3], k % 2 ? "#f2c53d" : "#e86aa0"); }
  }
  const deco = new THREE.Mesh(dm.geometria(), matV());
  deco.castShadow = true; deco.receiveShadow = true;
  g.add(deco);
  montarObelisco(g);
  montarLampioes(g);
  montarNpcs(g);
  /* faixa verde tracejada nos portões: onde a proteção começa */
  const faixa = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: U.uTime, uNight: U.uNight },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `uniform float uTime; uniform float uNight; varying vec2 vUv;
      void main(){
        float d = step(.45, fract(vUv.x * 9.0 - uTime * .35));
        float borda = 1.0 - abs(vUv.y - .5) * 2.0;
        gl_FragColor = vec4(vec3(.5, 1.0, .65) * (.6 + uNight * .4), d * borda * (.55 + uNight * .3));
      }`,
  });
  for (const p of c.portoes || []) {
    const dx = Math.sign(Math.round(p.x - c.x)), dy = Math.sign(Math.round(p.y - c.y));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3.2, .2), faixa);
    m.rotation.x = -Math.PI / 2;
    if (dx) m.rotation.z = Math.PI / 2;
    m.position.set(c.x + dx * (H + .5), .07, c.y + dy * (H + .5));
    m.renderOrder = 3;
    g.add(m);
  }
  return g;
}
