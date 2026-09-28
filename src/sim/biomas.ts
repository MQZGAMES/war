/* ================================================================
   [SYSTEM: BIOMAS] o mapa Ultimate é um continente: campos em volta da
   cidade e, para fora, seis regiões em fatias (floresta, pântano,
   deserto, neve, montanhas e terras malditas), com terras vulcânicas
   nas pontas mais distantes. A faixa de perigo sobe com a distância;
   o bioma escolhe quais criaturas moram em cada ponto de caça.
   Nos mapas menores tudo é campo: nada muda para eles.
   ================================================================ */
import { W, idx, inb } from "./state";
import { clamp, dist, hash2, ri, rnd, rr, vnoise } from "./rng";

export const BIO = { CAMPO: 0, FLORESTA: 1, PANTANO: 2, DESERTO: 3, NEVE: 4, MONTANHA: 5, VULCAO: 6, MALDITO: 7 } as const;
export type Bioma = (typeof BIO)[keyof typeof BIO];
export const BIO_NOME = ["Campos", "Floresta", "Pântano", "Deserto", "Neve", "Montanhas", "Terras vulcânicas", "Terras malditas"];
/* cor de base do chão por bioma (o terreno e o minimapa usam as mesmas) */
export const BIO_COR = ["#5f9343", "#3f7534", "#465834", "#d6c088", "#e6edf1", "#85847e", "#3e3533", "#4f4a56"];
export const BIO_COR2 = ["#76a64e", "#4c8440", "#55683c", "#c8aa6c", "#d3dee6", "#9a988e", "#5a2e24", "#5f5968"];

/* o Ultimate começa aqui: mapas deste tamanho para cima ganham biomas e a cidade murada */
export const TAMANHO_ULTIMATE = 336;
export const ehUltimate = () => W.N >= 300;

export function biomaEm(x: number, y: number): number {
  const b = W.bioma;
  if (!b || !b.length) return BIO.CAMPO;
  const gx = clamp(x | 0, 0, W.N - 1), gy = clamp(y | 0, 0, W.N - 1);
  return b[gy * W.N + gx];
}

/* chances por bioma: lagoa, bosque, pedra (e o tamanho do bosque) */
const LAGOA = [.22, .3, 1, .04, .14, .1, 0, .28];
const BOSQUE = [.3, 1, .55, .3, .55, .22, .15, .4];
const TAM_BOSQUE: [number, number][] = [[2, 6], [4, 9], [2, 5], [1, 3], [3, 7], [1, 3], [1, 3], [2, 5]];
const PEDRA = [.2, .25, .15, .45, .5, 1, .6, .55];

export function construirBiomas() {
  const N = W.N;
  W.solid = new Uint8Array(N * N);
  W.tronco = new Uint8Array(N * N);
  W.blockLOS = new Uint8Array(N * N);
  W.tileCol = new Uint8Array(N * N);
  W.pzMask = new Uint8Array(N * N);
  W.bioma = new Uint8Array(N * N);
  W.props = [];
  const { solid, tronco, blockLOS, tileCol, bioma, props } = W;
  /* a cidade fica perto do meio do continente */
  const cx = Math.floor(N / 2 + rr(-8, 8)) + .5, cy = Math.floor(N / 2 + rr(-8, 8)) + .5;
  W.centro = { x: cx, y: cy };
  const setores = [BIO.FLORESTA, BIO.PANTANO, BIO.DESERTO, BIO.MONTANHA, BIO.NEVE, BIO.MALDITO] as number[];
  for (let i = setores.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = setores[i]; setores[i] = setores[j]; setores[j] = t; }
  const giro = rnd() * 6.283, ox = rnd() * 900, oy = rnd() * 900;
  const dMax = Math.max(dist(cx, cy, 0, 0), dist(cx, cy, N, 0), dist(cx, cy, 0, N), dist(cx, cy, N, N));
  const fatia = 6.283 / setores.length;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x;
    const dx = x + .5 - cx, dy = y + .5 - cy;
    /* fronteiras tortas: o ângulo e a distância ondulam com ruído */
    let a = Math.atan2(dy, dx) - giro + (vnoise(x * .022 + ox, y * .022 + oy) - .5) * 1.3;
    a = ((a % 6.283) + 6.283) % 6.283;
    const d = Math.hypot(dx, dy) + (vnoise(x * .045 + oy, y * .045 + ox) - .5) * 24;
    let b = setores[Math.floor(a / fatia) % setores.length];
    if (d < 46) b = BIO.CAMPO;
    else if (d < 62 && b !== BIO.FLORESTA && vnoise(x * .09 + 3, y * .09 + 7) < .5) b = BIO.CAMPO;
    if (d > dMax * .7 && (b === BIO.DESERTO || b === BIO.MONTANHA)) b = BIO.VULCAO;
    bioma[i] = b;
    const n = vnoise(x * .11 + ox, y * .11 + oy) * .66 + vnoise(x * .31 + ox, y * .31 + oy) * .34;
    tileCol[i] = clamp(Math.floor(n * 4.6), 0, 3);
  }
  const longeDaCidade = (x: number, y: number, m: number) => Math.max(Math.abs(x + .5 - cx), Math.abs(y + .5 - cy)) > m;
  /* lagoas: muitas no pântano, quase nenhuma no deserto */
  for (let t = 0, feitas = 0; t < 2400 && feitas < Math.round(N / 2.6); t++) {
    const px = ri(6, N - 7), py = ri(6, N - 7), b = bioma[idx(px, py)];
    if (rnd() > LAGOA[b] || !longeDaCidade(px, py, 32)) continue;
    const pant = b === BIO.PANTANO;
    const rx = pant ? rr(1.2, 2.8) : rr(1.8, 3.8), ry = pant ? rr(1.1, 2.6) : rr(1.6, 3.4);
    for (let y = Math.floor(py - ry - 1); y <= py + ry + 1; y++) for (let x = Math.floor(px - rx - 1); x <= px + rx + 1; x++) {
      if (!inb(x, y)) continue;
      const d = ((x - px) / rx) ** 2 + ((y - py) / ry) ** 2;
      if (d < 1 + vnoise(x * .5, y * .5) * .4) {
        solid[idx(x, y)] = 1; tileCol[idx(x, y)] = 200;
        props.push({ t: "water", x, y, s: hash2(x, y) });
      }
    }
    feitas++;
  }
  /* bosques: a floresta fecha, o deserto tem cacto aqui e ali */
  const alvoB = Math.round(N * N * .0026 * .62 * 1.6);
  for (let t = 0, feitos = 0; t < alvoB * 5 && feitos < alvoB; t++) {
    const px = ri(2, N - 3), py = ri(2, N - 3), b = bioma[idx(px, py)];
    if (rnd() > BOSQUE[b] || !longeDaCidade(px, py, 25)) continue;
    const n = ri(TAM_BOSQUE[b][0], TAM_BOSQUE[b][1]), esp = b === BIO.FLORESTA ? 3 : 2;
    for (let k = 0; k < n; k++) {
      const x = px + ri(-esp, esp), y = py + ri(-esp, esp);
      if (!inb(x, y) || solid[idx(x, y)] || tronco[idx(x, y)]) continue;
      tronco[idx(x, y)] = 1; blockLOS[idx(x, y)] = 1;
      props.push({ t: "tree", x, y, s: hash2(x * 7, y * 13) });
    }
    feitos++;
  }
  /* pedras: montanha cheia, campo quase limpo */
  const alvoP = Math.round(N * N * .004 * .45 * 1.6);
  for (let t = 0, feitas = 0; t < alvoP * 5 && feitas < alvoP; t++) {
    const x0 = ri(1, N - 2), y0 = ri(1, N - 2), b = bioma[idx(x0, y0)];
    if (rnd() > PEDRA[b] || !longeDaCidade(x0, y0, 25)) continue;
    /* na montanha as pedras vêm em penedos de 2 a 4 */
    const n = b === BIO.MONTANHA ? ri(2, 4) : b === BIO.MALDITO ? ri(1, 3) : 1;
    for (let k = 0; k < n; k++) {
      const x = x0 + (k ? ri(-2, 2) : 0), y = y0 + (k ? ri(-2, 2) : 0);
      if (!inb(x, y) || solid[idx(x, y)] || tronco[idx(x, y)]) continue;
      tronco[idx(x, y)] = 2; blockLOS[idx(x, y)] = 1;
      props.push({ t: "rock", x, y, s: hash2(x * 3, y * 5) });
    }
    feitas++;
  }
}

/* ============================================================
   [SYSTEM: CIDADE_GRANDE] cidade murada no estilo do Tibia: quatro
   portões, avenidas em cruz, a praça do templo com o obelisco, as
   quatro lojas viradas para a praça, anel de ruas e quarteirões de
   casas. Tudo dentro dos muros é zona de proteção.
   ============================================================ */
export const CID_MEIA = 22;
export interface Casa { x0: number; y0: number; x1: number; y1: number; loja: string; estilo: number; alt: number; porta: number }
/* lotes de um quadrante (x, y ≥ 2), girados 90° para os outros três:
   A é a loja da praça; B e C, casas do miolo; D a H, o anel de fora */
const LOTES: [number, number, number, number][] = [
  [8, 11, 2, 5], [8, 11, 8, 11], [2, 5, 8, 11],
  [15, 19, 2, 6], [15, 19, 8, 12], [15, 19, 15, 19], [8, 12, 15, 19], [2, 6, 15, 19],
];
/* girar um ponto do quadrante 0 para o quadrante q */
export function girarQ(q: number, x: number, y: number): [number, number] {
  return q === 0 ? [x, y] : q === 1 ? [-y, x] : q === 2 ? [-x, -y] : [y, -x];
}
export const LOJA_DO_QUADRANTE = ["feiticeiro", "comerciante", "ferreiro", "banqueiro"];

export function planoCidadeGrande(ox: number, oy: number) {
  const H = CID_MEIA, N = W.N, { solid, tronco, blockLOS, tileCol, pzMask, bioma } = W;
  const M = H + 4;
  W.props = W.props.filter((p) => Math.max(Math.abs(p.x - ox), Math.abs(p.y - oy)) > M);
  for (let dy = -M; dy <= M; dy++) for (let dx = -M; dx <= M; dx++) {
    const x = ox + dx, y = oy + dy;
    if (!inb(x, y)) continue;
    const i = y * N + x;
    solid[i] = 0; tronco[i] = 0; blockLOS[i] = 0;
    if (tileCol[i] >= 200) tileCol[i] = 1;
    if (bioma.length) bioma[i] = BIO.CAMPO;
    const c = Math.max(Math.abs(dx), Math.abs(dy));
    if (c > H) continue;
    const portao = Math.abs(dx) <= 1 || Math.abs(dy) <= 1;
    if (c === H && !portao) { solid[i] = 1; blockLOS[i] = 1; tileCol[i] = 7; continue; }
    pzMask[i] = 1; tileCol[i] = ((x + y) & 1) ? 4 : 5;
  }
  const casas: Casa[] = [];
  for (let q = 0; q < 4; q++) LOTES.forEach((L, k) => {
    const [ax, ay] = girarQ(q, L[0], L[2]), [bx, by] = girarQ(q, L[1], L[3]);
    const x0 = ox + Math.min(ax, bx), x1 = ox + Math.max(ax, bx), y0 = oy + Math.min(ay, by), y1 = oy + Math.max(ay, by);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * N + x; solid[i] = 1; blockLOS[i] = 1; tileCol[i] = 6; pzMask[i] = 0; }
    /* porta no lado virado para o centro da cidade */
    const mx = (x0 + x1) / 2 - ox, my = (y0 + y1) / 2 - oy;
    /* 0: vira para -x, 1: -y, 2: +x, 3: +y */
    const porta = Math.abs(mx) > Math.abs(my) ? (mx > 0 ? 0 : 2) : (my > 0 ? 1 : 3);
    const h = hash2(x0 * 3 + q, y0 * 5 + k);
    casas.push({ x0, y0, x1, y1, loja: k === 0 ? LOJA_DO_QUADRANTE[q] : "", estilo: Math.floor(h * 4), alt: k === 0 ? 1.55 : k === 1 ? 1.95 : 1.25 + h * .45, porta });
  });
  /* canteiros com árvore nos cantos da praça */
  const canteiros: [number, number][] = [];
  for (const [sx, sy] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
    const x = ox + sx * 4, y = oy + sy * 4, i = y * N + x;
    solid[i] = 1; blockLOS[i] = 0; canteiros.push([x, y]);
  }
  return { casas, canteiros };
}
