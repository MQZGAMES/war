/* ================================================================
   Mapa, cidade, caminho (A*), linha de visão, colisão e grade espacial.
   `tileCol`: 0..3 grama, 4..5 calçada da cidade, 200 água.
   ================================================================ */
import { W, idx, inb, type Prop } from "./state";
import { clamp, dist, dist2, hash2, ri, rnd, rr, vnoise } from "./rng";
import type { Cidade, Npc, Pt, Unit } from "./types";
import { FAUNA } from "./data";

export function buildMap() {
  const N = W.N;
  W.solid = new Uint8Array(N * N);
  W.blockLOS = new Uint8Array(N * N);
  W.tileCol = new Uint8Array(N * N);
  W.pzMask = new Uint8Array(N * N);
  W.props = [];
  const { solid, blockLOS, tileCol, props } = W;
  const ox = rnd() * 900, oy = rnd() * 900;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const n = vnoise(x * .11 + ox, y * .11 + oy) * .66 + vnoise(x * .31 + ox, y * .31 + oy) * .34;
    let tom = Math.floor(n * 4.6);
    if (vnoise(x * .06 - ox, y * .06 - oy) > .66) tom++;
    tileCol[idx(x, y)] = clamp(tom, 0, 3);
  }
  // lagoas
  const pools = 1 + Math.round(N / 30);
  for (let p = 0; p < pools; p++) {
    const cx = ri(6, N - 7), cy = ri(6, N - 7), rx = rr(1.8, 3.6), ry = rr(1.6, 3.2);
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      if (!inb(x, y)) continue;
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d < 1 + vnoise(x * .5, y * .5) * .4) {
        solid[idx(x, y)] = 1; tileCol[idx(x, y)] = 200;
        props.push({ t: "water", x, y, s: hash2(x, y) });
      }
    }
  }
  // bosquetes
  const clusters = Math.round(N * N * .0026 * .62);
  for (let i = 0; i < clusters; i++) {
    const cx = ri(2, N - 3), cy = ri(2, N - 3), n = ri(2, 6);
    for (let k = 0; k < n; k++) {
      const x = cx + ri(-2, 2), y = cy + ri(-2, 2);
      if (!inb(x, y) || solid[idx(x, y)]) continue;
      solid[idx(x, y)] = 1; blockLOS[idx(x, y)] = 1;
      props.push({ t: "tree", x, y, s: hash2(x * 7, y * 13) });
    }
  }
  // pedras
  const rocks = Math.round(N * N * .004 * .45);
  for (let i = 0; i < rocks; i++) {
    const x = ri(1, N - 2), y = ri(1, N - 2);
    if (solid[idx(x, y)] || rnd() < .35) continue;
    solid[idx(x, y)] = 1; blockLOS[idx(x, y)] = 1;
    props.push({ t: "rock", x, y, s: hash2(x * 3, y * 5) });
  }
  /* o sorteio das antigas moitas continua: a mesma semente da v54 gera o
     mesmo mapa aqui */
  const bush = Math.round(N * N * .012);
  for (let i = 0; i < bush; i++) { ri(0, N - 1); ri(0, N - 1); }
}

/* ============================================================
   [SYSTEM: CIDADE] Zona de proteção inteira: ninguém fere nem é ferido,
   criatura não entra, quem tem trava também não; o obelisco é o
   renascimento. Três NPCs com a barraca atrás.
   ============================================================ */
export const CID_R = 7.5, NPC_ALCANCE = 2.1;
const NPC_TIPOS: { id: Npc["id"]; nome: string; icone: string; h: number; dx: number; dy: number }[] = [
  { id: "feiticeiro", nome: "Feiticeiro", icone: "⚗", h: 276, dx: 4.5, dy: -2.5 },
  { id: "comerciante", nome: "Comerciante", icone: "⚒", h: 28, dx: 3.6, dy: 3.6 },
  { id: "banqueiro", nome: "Banqueiro", icone: "◍", h: 46, dx: -2.5, dy: 4.5 },
];
export function emPZ(x: number, y: number) {
  const gx = x | 0, gy = y | 0, N = W.N;
  return gx >= 0 && gy >= 0 && gx < N && gy < N && W.pzMask[gy * N + gx] === 1;
}
export function construirCidade(paleta: (h: number, s: number) => { h: number; c: string; lo: string; hi: string }) {
  const N = W.N, { solid, blockLOS, tileCol, pzMask } = W;
  const m = Math.max(CID_R + 7, N * .16);
  const cx = Math.floor(rr(m, N - m)) + .5, cy = Math.floor(rr(m, N - m)) + .5;
  const R2 = CID_R + 2.2;
  W.props = W.props.filter((p) => dist(p.x + .5, p.y + .5, cx, cy) > R2);
  for (let y = Math.floor(cy - R2); y <= cy + R2; y++) for (let x = Math.floor(cx - R2); x <= cx + R2; x++) {
    if (!inb(x, y)) continue;
    const d = dist(x + .5, y + .5, cx, cy), i = idx(x, y);
    if (d > R2) continue;
    solid[i] = 0; blockLOS[i] = 0;
    if (tileCol[i] === 200) tileCol[i] = 1;
    if (d <= CID_R) { tileCol[i] = ((x + y) & 1) ? 4 : 5; pzMask[i] = 1; }
  }
  const ox = Math.floor(cx), oy = Math.floor(cy);
  solid[idx(ox, oy)] = 1; blockLOS[idx(ox, oy)] = 1;
  W.props.push({ t: "obelisco", x: ox, y: oy, s: hash2(ox, oy) });
  const npcs: Npc[] = [];
  for (const T of NPC_TIPOS) {
    const nx = Math.floor(cx + T.dx), ny = Math.floor(cy + T.dy);
    solid[idx(nx, ny)] = 1;
    const fa = Math.atan2(cy - (ny + .5), cx - (nx + .5));
    npcs.push({ id: T.id, nome: T.nome, icone: T.icone, placa: T.icone + " " + T.nome, x: nx + .5, y: ny + .5,
      fa, cor: paleta(T.h, 58), bob: rnd() * 6 });
    /* a barraca fica atrás do balcão, do lado de fora da praça */
    const bx = Math.floor(nx + .5 - Math.cos(fa) * 1.2), by = Math.floor(ny + .5 - Math.sin(fa) * 1.2);
    if (inb(bx, by) && !(bx === nx && by === ny)) { solid[idx(bx, by)] = 1; }
    W.props.push({ t: "barraca", x: nx, y: ny, s: fa, npc: T.id });
  }
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4 + .39;
    const lx = Math.floor(cx + Math.cos(a) * (CID_R - .7)), ly = Math.floor(cy + Math.sin(a) * (CID_R - .7));
    if (!solid[idx(lx, ly)]) W.props.push({ t: "lampiao", x: lx, y: ly, s: hash2(lx, ly) });
  }
  W.cidade = { x: cx, y: cy, r: CID_R, npcs, nasce: { x: cx + 1.9, y: cy + 1.9 } } as Cidade;
}
const PORTAO: Pt = { x: 0, y: 0 };
export function portaoPara(u: Unit) {
  const c = W.cidade, a = Math.atan2(u.y - c.y, u.x - c.x);
  const f = nearestFree(c.x + Math.cos(a) * (c.r + 1.6), c.y + Math.sin(a) * (c.r + 1.6));
  PORTAO.x = f[0] + .5; PORTAO.y = f[1] + .5;
  return PORTAO;
}
export function portaoAtual() { return PORTAO; }
export function npcPerto(u: Unit, id?: string) {
  for (const n of W.cidade.npcs)
    if ((!id || n.id === id) && dist(u.x, u.y, n.x, n.y) <= NPC_ALCANCE) return n;
  return null;
}
export function npcDe(id: string) { for (const n of W.cidade.npcs) if (n.id === id) return n; return null as unknown as Npc; }

function clearArea(cx: number, cy: number, r: number) {
  const { solid, blockLOS, tileCol } = W;
  for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
    if (!inb(x, y)) continue;
    if (dist(x, y, cx, cy) > r) continue;
    if (solid[idx(x, y)]) {
      solid[idx(x, y)] = 0; blockLOS[idx(x, y)] = 0;
      if (tileCol[idx(x, y)] >= 200) tileCol[idx(x, y)] = 1;
      W.props = W.props.filter((p) => !(p.x === x && p.y === y && p.t !== "obelisco" && p.t !== "barraca" && p.t !== "lampiao"));
    }
  }
}
/* garante que todo o campo é alcançável a partir do centro */
export function ensureConnected(spawns: Pt[]) {
  const N = W.N, { solid } = W;
  const seen = new Uint8Array(N * N);
  const sx = Math.round(spawns[0].x), sy = Math.round(spawns[0].y);
  const q = [idx(sx, sy)]; seen[q[0]] = 1;
  const DX = [1, -1, 0, 0], DY = [0, 0, 1, -1];
  while (q.length) {
    const i = q.pop()!, x = i % N, y = (i / N) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d], ny = y + DY[d];
      if (!inb(nx, ny)) continue;
      const j = idx(nx, ny);
      if (seen[j] || solid[j]) continue;
      seen[j] = 1; q.push(j);
    }
  }
  for (const s of spawns) {
    const i = idx(Math.round(s.x), Math.round(s.y));
    if (seen[i]) continue;
    let x = Math.round(s.x), y = Math.round(s.y);
    const tx = (N / 2) | 0, ty = (N / 2) | 0;
    for (let g = 0; g < N * 2; g++) {
      if (x === tx && y === ty) break;
      if (Math.abs(tx - x) > Math.abs(ty - y)) x += Math.sign(tx - x); else y += Math.sign(ty - y);
      clearArea(x, y, 1.4);
    }
  }
}

/* ============================================================
   CAMINHO (A*) com fila de prioridade em arrays tipados
   ============================================================ */
let gS = new Float32Array(0), came = new Int32Array(0), stamp = new Int32Array(0), stampV = 0;
export function initPath() { const n = W.N * W.N; gS = new Float32Array(n); came = new Int32Array(n); stamp = new Int32Array(n); stampV = 0; }
const HEAP_CAP = 1 << 15;
const HF = new Float32Array(HEAP_CAP), HI = new Int32Array(HEAP_CAP);
let hn = 0;
function hpush(id: number, fv: number) {
  if (hn >= HEAP_CAP) return;
  let c = hn++; HF[c] = fv; HI[c] = id;
  while (c > 0) {
    const p = (c - 1) >> 1; if (HF[p] <= HF[c]) break;
    const tf = HF[p]; HF[p] = HF[c]; HF[c] = tf; const ti = HI[p]; HI[p] = HI[c]; HI[c] = ti; c = p;
  }
}
function hpop() {
  const top = HI[0];
  hn--;
  if (hn > 0) {
    HF[0] = HF[hn]; HI[0] = HI[hn];
    let c = 0;
    for (;;) {
      const l = c * 2 + 1, r = l + 1; let m = c;
      if (l < hn && HF[l] < HF[m]) m = l;
      if (r < hn && HF[r] < HF[m]) m = r;
      if (m === c) break;
      const tf = HF[m]; HF[m] = HF[c]; HF[c] = tf; const ti = HI[m]; HI[m] = HI[c]; HI[c] = ti; c = m;
    }
  }
  return top;
}
const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];

export function nearestFree(x: number, y: number): [number, number] {
  const N = W.N, { solid } = W;
  x = clamp(Math.round(x), 0, N - 1); y = clamp(Math.round(y), 0, N - 1);
  if (!solid[idx(x, y)]) return [x, y];
  for (let r = 1; r < 9; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const nx = x + dx, ny = y + dy;
    if (inb(nx, ny) && !solid[idx(nx, ny)]) return [nx, ny];
  }
  return [x, y];
}
export function findPath(sx: number, sy: number, tx: number, ty: number): Pt[] | null {
  const N = W.N, { solid } = W;
  const s = nearestFree(sx, sy), t = nearestFree(tx, ty);
  const si = idx(s[0], s[1]), ti = idx(t[0], t[1]);
  if (si === ti) return [{ x: t[0] + .5, y: t[1] + .5 }];
  stampV++; hn = 0;
  gS[si] = 0; came[si] = -1; stamp[si] = stampV;
  const hx = t[0], hy = t[1];
  const oct = (x: number, y: number) => { const dx = Math.abs(x - hx), dy = Math.abs(y - hy); return (dx + dy) + (1.414 - 2) * Math.min(dx, dy); };
  hpush(si, oct(s[0], s[1]));
  let best = si, bestH = oct(s[0], s[1]), n = 0;
  const CAP = 2600;
  while (hn && n < CAP) {
    const cur = hpop(); n++;
    if (cur === ti) { best = ti; break; }
    const cx = cur % N, cy = (cur / N) | 0, g = gS[cur];
    const h = oct(cx, cy);
    if (h < bestH) { bestH = h; best = cur; }
    for (let k = 0; k < 8; k++) {
      const nx = cx + NB[k][0], ny = cy + NB[k][1];
      if (!inb(nx, ny)) continue;
      const j = idx(nx, ny);
      if (solid[j]) continue;
      if (k > 3 && (solid[idx(cx + NB[k][0], cy)] || solid[idx(cx, cy + NB[k][1])])) continue;
      const ng = g + NB[k][2];
      if (stamp[j] === stampV && gS[j] <= ng) continue;
      stamp[j] = stampV; gS[j] = ng; came[j] = cur;
      hpush(j, ng + oct(nx, ny) * 1.06);
    }
  }
  const out: Pt[] = []; let c = best, guard = 0;
  while (c !== -1 && c !== si && guard++ < 4000) { out.push({ x: (c % N) + .5, y: ((c / N) | 0) + .5 }); c = came[c]; }
  out.reverse();
  return out.length ? out : null;
}
/* testa `solid` (o que bloqueia o passo) */
export function losU2(x0: number, y0: number, x1: number, y1: number) {
  const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy);
  if (d < .6) return true;
  if (d > 14) return false;
  const steps = Math.ceil(d * 2.2);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const gx = (x0 + dx * t) | 0, gy = (y0 + dy * t) | 0;
    if (!inb(gx, gy) || W.solid[idx(gx, gy)]) return false;
  }
  return true;
}
export function los(x0: number, y0: number, x1: number, y1: number) {
  const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy);
  if (d < .6) return true;
  const steps = Math.ceil(d * 2.2);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const gx = (x0 + dx * t) | 0, gy = (y0 + dy * t) | 0;
    if (!inb(gx, gy) || W.blockLOS[idx(gx, gy)]) return false;
  }
  return true;
}
export function blockedPt(x: number, y: number, r: number) {
  const N = W.N;
  if (x < r || y < r || x > N - r || y > N - r) return true;
  const x0 = (x - r) | 0, x1 = (x + r) | 0, y0 = (y - r) | 0, y1 = (y + r) | 0, s = W.solid;
  if (!inb(x0, y0) || s[idx(x0, y0)]) return true;
  if (!inb(x1, y0) || s[idx(x1, y0)]) return true;
  if (!inb(x0, y1) || s[idx(x0, y1)]) return true;
  if (!inb(x1, y1) || s[idx(x1, y1)]) return true;
  return false;
}
/* [SYSTEM: LOS_CACHE] um slot por unidade, válido por 0,1 s */
export function losU(a: Unit, b: Unit) {
  if (a.losId === b.id && W.simTime - a.losT < .1) return a.losV;
  const v = los(a.x, a.y, b.x, b.y);
  a.losId = b.id; a.losT = W.simTime; a.losV = v;
  return v;
}

/* ============================================================
   [SYSTEM: SPATIAL] grade 2×2 e consulta por raio em dois buffers
   ============================================================ */
const CELL = 2;
let cellN = 0, cells: Unit[][] = [];
export function buildGrid() {
  cellN = Math.ceil(W.N / CELL);
  const need = cellN * cellN;
  if (cells.length !== need) { cells = new Array(need); for (let i = 0; i < need; i++) cells[i] = []; }
  else for (let i = 0; i < need; i++) cells[i].length = 0;
  for (const u of W.units) {
    if (u.dead) continue;
    const gx = clamp((u.x / CELL) | 0, 0, cellN - 1), gy = clamp((u.y / CELL) | 0, 0, cellN - 1);
    cells[gy * cellN + gx].push(u);
  }
}
export const QBUF: Unit[] = []; export let qN = 0;
export const QBUF2: Unit[] = []; export let q2N = 0;
export function queryRadius(x: number, y: number, r: number) {
  qN = 0;
  const span = Math.ceil(r / CELL), r2 = r * r;
  const gx = clamp((x / CELL) | 0, 0, cellN - 1), gy = clamp((y / CELL) | 0, 0, cellN - 1);
  const ay0 = Math.max(0, gy - span), ay1 = Math.min(cellN - 1, gy + span);
  const ax0 = Math.max(0, gx - span), ax1 = Math.min(cellN - 1, gx + span);
  for (let ay = ay0; ay <= ay1; ay++) for (let ax = ax0; ax <= ax1; ax++) {
    const b = cells[ay * cellN + ax];
    for (let k = 0; k < b.length; k++) { const o = b[k]; if (dist2(x, y, o.x, o.y) <= r2) QBUF[qN++] = o; }
  }
  return qN;
}
export function queryRadius2(x: number, y: number, r: number) {
  q2N = 0;
  const span = Math.ceil(r / CELL), r2 = r * r;
  const gx = clamp((x / CELL) | 0, 0, cellN - 1), gy = clamp((y / CELL) | 0, 0, cellN - 1);
  const ay0 = Math.max(0, gy - span), ay1 = Math.min(cellN - 1, gy + span);
  const ax0 = Math.max(0, gx - span), ax1 = Math.min(cellN - 1, gx + span);
  for (let ay = ay0; ay <= ay1; ay++) for (let ax = ax0; ax <= ax1; ax++) {
    const b = cells[ay * cellN + ax];
    for (let k = 0; k < b.length; k++) { const o = b[k]; if (dist2(x, y, o.x, o.y) <= r2) QBUF2[q2N++] = o; }
  }
  return q2N;
}
/* vizinhos de separação: as 3×3 células em volta */
export function cellsAround(u: Unit, fn: (o: Unit) => void) {
  const gx = clamp((u.x / CELL) | 0, 0, cellN - 1), gy = clamp((u.y / CELL) | 0, 0, cellN - 1);
  for (let ay = Math.max(0, gy - 1); ay <= Math.min(cellN - 1, gy + 1); ay++)
    for (let ax = Math.max(0, gx - 1); ax <= Math.min(cellN - 1, gx + 1); ax++) {
      const b = cells[ay * cellN + ax];
      for (let k = 0; k < b.length; k++) fn(b[k]);
    }
}

let aliveT: Unit[][] = [];
export function refreshAlive() {
  for (let t = 0; t <= FAUNA; t++) { if (!aliveT[t]) aliveT[t] = []; aliveT[t].length = 0; }
  for (const u of W.units) if (!u.dead) aliveT[u.team].push(u);
}
export function teamAlive(t: number) { return aliveT[t] || []; }
export type { Prop };
