/* ================================================================
   IA TÁTICA de cada aventureiro e IA da fauna — portadas da v54.
   [SYSTEM: AI_PERCEPTION] uma varredura por pensamento alimenta tudo
   [SYSTEM: AI_THREAT] modelo único de ameaça, normalizado
   [SYSTEM: AI_UTILITY] cada ação pontua; a maior vence
   [SYSTEM: AI_BEAST] [SYSTEM: AI_ODIO] fera só caça quem bateu nela
   ================================================================ */
import { AMEACA, BUMERANGUE, EXPLOSAO, CHUVA_ALCANCE, CHUVA_R, CUSTO, DWELL, HISTERESE, MARGEM, MEM_TTL, MET_ALCANCE, MET_QUEDA, MET_R, NEVASCA, POCAO, ST, STRAFE, TERREMOTO, UTIL, type Estado, type SpellKey } from "./data";
import { fx } from "./fx";
import { blockedPt, cellsAround, emPZ, los, losU, nearestFree, portaoAtual, portaoPara, QBUF, QBUF2, queryRadius, queryRadius2 } from "./map";
import { pzAtiva } from "./pk";
import { aliado, inimigo, odeia, PANICO_R } from "./relations";
import { clamp, dist, dist2, rnd, rr } from "./rng";
import { beberPocao, lancarBolaFogo, lancarBumerangue, lancarCerteiro, lancarChuva, lancarCura, lancarInvestida, lancarMeteoro, lancarNevasca, lancarRelampago, lancarTerremoto, lancarTrevas, lancarTriplo, lancarVeneno, podeMagia } from "./spells";
import { W } from "./state";
import { MAG_DANO, magiasDe, type VocKey } from "./data";
import { planejarMagia } from "./tatica";
import type { Pt, Squad, Unit } from "./types";
import { goTo, setState } from "./unit";

/* [SYSTEM: AI_ROLE] papéis por mérito */
export const R_FRENTE = 0, R_FUNDO = 1, R_APOIO = 2, R_FLANCO = 3, R_RESERVA = 4;
const ROLE_OFF = [2.2, -2.4, -4.0, 0, -5.0];

/* ---------- percepção ---------- */
interface Cand { e: Unit; d: number; sc: number; v: number }
const CAND: Cand[] = []; let candN = 0;
function candPush(e: Unit, d: number, sc: number) {
  const c = candN < CAND.length ? CAND[candN] : (CAND[candN] = { e, d, sc, v: -1 });
  c.e = e; c.d = d; c.sc = sc; c.v = -1; candN++;
}
function enxerga(u: Unit, c: Cand) {
  if (c.v < 0) c.v = los(u.x, u.y, c.e.x, c.e.y) ? 1 : 0;
  return c.v === 1;
}
export function perceber(u: Unit, sq: Squad) {
  const K = u.K, P = u.ai.p;
  P.enemyCount = 0; P.allyCount = 0; P.perto = 0; P.pertoAliado = 0;
  P.closest = null; P.closestD = 1e9;
  P.closestRanged = null; P.rangedD = 1e9;
  P.weakest = null; P.weakestHp = 1e9;
  P.ferido = null; P.feridoFrac = 1;
  P.danger = 0; P.rangedPressure = 0; P.surrounded = false;
  P.best = null; P.bestSc = -1e9;
  candN = 0;
  const raio = Math.max(K.sight, 7);
  const m = queryRadius(u.x, u.y, raio);
  for (let i = 0; i < m; i++) {
    const e = QBUF[i];
    if (e === u) continue;
    const d = dist(u.x, u.y, e.x, e.y);
    if (!inimigo(u, e)) {
      if (e.team !== u.team || e.beast !== u.beast) continue;
      P.allyCount++;
      if (d < 5) P.pertoAliado++;
      const fr = e.hp / e.maxHp;
      if (fr < P.feridoFrac && d < CHUVA_ALCANCE) { P.feridoFrac = fr; P.ferido = e; }
      continue;
    }
    if (d > K.sight) continue;
    if (e.beast && d > (u.isKnight ? K.sight : 6) && e.target !== u) continue;
    P.enemyCount++;
    if (d < 4.6) P.perto++;
    P.danger += e.K.threat * (e.hp / e.maxHp) / (1 + d * .35);
    if (e.K.keep) {
      if (d < P.rangedD) { P.rangedD = d; P.closestRanged = e; }
      if (d < e.K.range) P.rangedPressure += e.K.threat;
    }
    if (e.hp < P.weakestHp) { P.weakestHp = e.hp; P.weakest = e; }
    candPush(e, d, ameaca(u, e, d));
  }
  for (let i = 0; i < candN; i++) { const c = CAND[i]; if (c.d < P.closestD && enxerga(u, c)) { P.closestD = c.d; P.closest = c.e; } }
  for (let i = 0; i < candN; i++) { const c = CAND[i]; if (c.sc > P.bestSc && enxerga(u, c)) { P.bestSc = c.sc; P.best = c.e; } }
  if (!P.closest) P.closestD = 1e9;
  if (P.closest && sq && sq.alert) {
    const A = sq.alert;
    if (!A.target || A.target.dead || W.simTime - A.time > 1.5) {
      A.target = P.closest; A.x = P.closest.x; A.y = P.closest.y;
      A.source = u; A.time = W.simTime; A.confidence = 1;
    }
  }
  const M = u.ai.mem;
  if (P.closest) { M.lastSeen = P.closest; M.lastSeenT = W.simTime; M.lastX = P.closest.x; M.lastY = P.closest.y; }
  else if (M.lastSeen && (M.lastSeen.dead || W.simTime - M.lastSeenT > MEM_TTL)) M.lastSeen = null;
  P.cerco = false;
  if (P.closest && P.closestD < 4.6 && P.perto >= 3) {
    const e = escapar(u, 6);
    if (e && e.vao < 3.5) { P.cerco = true; P.saidaA = e.a; }
  }
  P.surrounded = P.cerco;
}
function ameaca(u: Unit, e: Unit, d: number) {
  const K = e.K;
  const dps = (K.dmg + (e.bonus || 0) + (e.magic || 0) * MAG_DANO) / K.cd;
  let s = 0;
  s += AMEACA.dps * Math.min(1, dps / 26);
  s += AMEACA.fragil * (1 - e.hp / e.maxHp);
  s += AMEACA.perto * (1 - Math.min(1, d / u.K.sight));
  if (K.keep) s += AMEACA.atirador * (K.range / 9);
  if (e.kind === "druid") s += AMEACA.curandeiro;
  const q = u.atkBy[e.id];
  if (q !== undefined && W.simTime - q < 14) s += AMEACA.ofensor;
  const sq = W.squads[e.team];
  switch (u.post.alvo) {
    case "ferido": s += (1 - e.hp / e.maxHp) * 1.1; break;
    case "fraco": s += Math.max(0, (240 - e.maxHp) / 240) * 1.1; break;
    case "ofensor": s += (q !== undefined && W.simTime - q < 14) ? 1.1 : 0; break;
    case "isolado": s += sq ? Math.min(1, dist(e.x, e.y, sq.cx, sq.cy) / 12) * 1.1 : 0; break;
  }
  return s;
}
/* inimigos de u em volta de e (e incluso) */
function vizinhos(u: Unit, e: Unit, r: number) {
  let n = 0;
  const k = queryRadius2(e.x, e.y, r);
  for (let j = 0; j < k; j++) if (inimigo(u, QBUF2[j])) n++;
  return n;
}
export function countNearP(rad: number) { let n = 0; for (let i = 0; i < candN; i++) if (CAND[i].d <= rad) n++; return n; }

/* ---------- utilidade ---------- */
const ACT = { k: 0, x: 0, y: 0, alvo: null as unknown, sc: -1e9 };
function propor(k: number, sc: number, x: number, y: number, alvo?: unknown) {
  if (sc <= ACT.sc) return;
  ACT.sc = sc; ACT.k = k; ACT.x = x; ACT.y = y; ACT.alvo = alvo ?? null;
}
const A_CURA = 1, A_POCAO = 2, A_AOE = 3, A_CERCO = 4, A_RECUAR = 5, A_KITE = 6, A_ISCA = 7,
  A_EMBOSCAR = 8, A_HABILIDADE = 9, A_GUARDAR = 10, A_FLANCO = 11, A_CERCAR = 12,
  A_ATACAR = 13, A_REAGRUPAR = 14, A_AVANCAR = 15, A_MEMORIA = 16;
const ACTM = { x: 0, y: 0 };
const ACT_ALVO: { u: Unit | null } = { u: null };

export function unitThink(u: Unit, sq: Squad) {
  const K = u.K;
  perceber(u, sq);
  const P = u.ai.p, M = u.ai.mem;
  const vida = u.hp / u.maxHp;
  ACT.sc = -1e9; ACT.alvo = null;
  const stick = (st: Estado) => (u.st === st && W.simTime - u.stSince < (DWELL[st.nome] || 0)) ? HISTERESE : 0;

  // --- sobrevivência ---
  {
    const limiar = Math.max(.38, (.52 + Math.min(.28, P.perto * .09)) * u.post.cura);
    if (vida < limiar && podeMagia(u, "cura") && u.mp >= CUSTO.cura) propor(A_CURA, UTIL.cura * (1 + (limiar - vida) * 2), 0, 0);
    if (vida < POCAO.limiar && u.potHp > 0) propor(A_POCAO, UTIL.pocao, 0, 0);
    if (u.maxMp > 0 && u.mp < u.maxMp * POCAO.limiarMp && u.potMp > 0) propor(A_POCAO, UTIL.pocao * .9, 0, 0, "mp");
  }
  // --- área caindo em cima ---
  for (const m of W.meteors) {
    if (m.src && !inimigo(m.src, u)) continue;
    const raio = m.gelo ? NEVASCA.raio : MET_R;
    if (dist2(u.x, u.y, m.x, m.y) < (raio + .6) * (raio + .6)) {
      const f = fugaSegura(u, m.x, m.y, raio + 3);
      propor(A_AOE, UTIL.aoe, f.x, f.y);
    }
  }
  if (P.cerco) propor(A_CERCO, UTIL.cerco, u.x + Math.cos(P.saidaA) * 6.5, u.y + Math.sin(P.saidaA) * 6.5);

  // --- recuo por moral, vida ou desvantagem ---
  let fl = K.flee * u.post.flee;
  if (u.isKnight) fl = Math.max(fl, .25);
  const seco = !!u.w && (u.potHp <= 0 || (u.maxMp > 0 && u.kind !== "knight" && u.potMp <= 0 && u.mp < u.maxMp * .2));
  if (seco) fl = Math.max(fl, .55);
  const outnum = P.perto > P.pertoAliado + 1;
  if (P.closest && (vida < fl || (vida < fl * 1.8 && outnum))) {
    const dx = u.x - P.closest.x, dy = u.y - P.closest.y, l = Math.hypot(dx, dy) || 1;
    propor(A_RECUAR, UTIL.recuar * (1 + (fl - vida)) * (seco ? 1.5 : 1) + stick(ST.RETREAT),
      u.x + dx / l * 7 + (sq.rally.x - u.x) * .5, u.y + dy / l * 7 + (sq.rally.y - u.y) * .5);
  }
  if (u.st === ST.RETREAT && (!P.closest || vida > fl * 1.9) && dist(u.x, u.y, sq.cx, sq.cy) > 5.5)
    propor(A_REAGRUPAR, UTIL.reagrupar + stick(ST.REGROUP), sq.rally.x, sq.rally.y);

  // --- alvo ---
  let tgt: Unit | null = null;
  if (u.isKnight) tgt = P.closest;
  else {
    if (!u.post.solo && sq.focus && !sq.focus.dead && dist(u.x, u.y, sq.focus.x, sq.focus.y) < K.sight + 3) tgt = sq.focus;
    if (!tgt) tgt = P.best;
    if (P.closest && P.closestD < K.range * .7) tgt = P.closest;
  }
  u.target = tgt;

  // --- isca e emboscada ---
  if (u.isca && sq.stance === "AMBUSH") {
    if (P.closest && P.closestD < 8) propor(A_ISCA, UTIL.isca, sq.rally.x, sq.rally.y);
    else propor(A_ISCA, UTIL.isca, sq.ex, sq.ey);
  }
  if (sq.stance === "AMBUSH" && (!P.closest || P.closestD > K.range + 1.5)) {
    const c = coverNear(u, sq.rally, P.closest);
    propor(A_EMBOSCAR, UTIL.emboscar + stick(ST.AMBUSH), c.x, c.y);
  }
  // --- cavaleiro protegendo os frágeis ---
  if (u.isKnight) {
    let need: Unit | null = null, nd = 1e9;
    const m = queryRadius(u.x, u.y, 7);
    for (let i = 0; i < m; i++) {
      const a = QBUF[i];
      if (!aliado(u, a) || a === u || a.isKnight) continue;
      const d = dist(u.x, u.y, a.x, a.y);
      if (d >= nd) continue;
      const k = queryRadius2(a.x, a.y, 2.6);
      for (let j = 0; j < k; j++) {
        const e = QBUF2[j];
        if (!e.isKnight || !inimigo(u, e)) continue;
        nd = d; need = e; break;
      }
    }
    if (need && (!tgt || dist(u.x, u.y, tgt.x, tgt.y) > 2.2))
      propor(A_GUARDAR, UTIL.guardar + stick(ST.GUARD), need.x, need.y, need);
  }
  // --- movimento em relação ao alvo ---
  if (tgt) {
    const d = dist(u.x, u.y, tgt.x, tgt.y);
    if (K.keep) {
      let limite = K.keep;
      if (tgt.K.keep) limite = Math.max(limite, Math.min(K.range * .98, tgt.K.range * 1.06));
      limite *= u.post.keep;
      if (P.closestD < 2.4) limite = Math.max(limite, K.keep + 1.5);
      if (d < limite && P.closest) {
        const alvoK = P.closestD < 2.4 ? P.closest : tgt;
        const p = pontoKite(u, alvoK, limite + 1.2);
        propor(A_KITE, UTIL.kite + (limite - d) * 2 + stick(ST.KITE), p.x, p.y);
      } else if (u.flank && d > K.range * .8) {
        const ax = sq.ex - sq.cx, ay = sq.ey - sq.cy, l = Math.hypot(ax, ay) || 1;
        const px = -ay / l * u.flank, py = ax / l * u.flank;
        propor(A_FLANCO, UTIL.flanco + stick(ST.FLANK), tgt.x + px * 6.5 - ax / l * 1.5, tgt.y + py * 6.5 - ay / l * 1.5);
      }
      if (d <= K.range && losU(u, tgt)) propor(A_ATACAR, UTIL.atacar + 6, 0, 0, tgt);
      else {
        const l2 = d || 1, keep = K.range * .92;
        propor(A_AVANCAR, UTIL.avancar, tgt.x - (tgt.x - u.x) / l2 * keep, tgt.y - (tgt.y - u.y) / l2 * keep, tgt);
      }
    } else {
      if (d <= K.range) propor(A_ATACAR, UTIL.atacar + 6, 0, 0, tgt);
      else if (u.slot > -90 && sq.focus === tgt && d < 9) {
        const rad = K.range * .82;
        propor(A_CERCAR, UTIL.cercar, tgt.x + Math.cos(u.slot) * rad, tgt.y + Math.sin(u.slot) * rad, tgt);
      } else propor(A_AVANCAR, UTIL.avancar, tgt.x, tgt.y, tgt);
    }
  } else if (sq.alert && sq.alert.target && !sq.alert.target.dead && sq.alert.confidence > .2 &&
    dist(u.x, u.y, sq.alert.x, sq.alert.y) > K.range) {
    propor(A_MEMORIA, UTIL.memoria + sq.alert.confidence * 4, sq.alert.x, sq.alert.y);
  } else if (M.lastSeen && W.simTime - M.lastSeenT < MEM_TTL) {
    propor(A_MEMORIA, UTIL.memoria, M.lastX, M.lastY);
  } else {
    const f = formacao(u, sq);
    propor(A_AVANCAR, UTIL.avancar * .8, f.x, f.y);
  }

  // --- magias: o planejador compara área, alvo único e custo de mana ---
  const reserva = (vida < .55) ? CUSTO.cura : 0;
  let hab: SpellKey | null = null, habSc = 0;
  ACT_ALVO.u = null;
  if (u.kind === "druid" && u.mp >= CUSTO.chuva && podeMagia(u, "chuva")) {
    const a = chuvaSpot(u);
    if (a) { hab = "chuva"; habSc = UTIL.habilidade * 1.35; ACTM.x = a.x; ACTM.y = a.y; }
  }
  if (!hab) {
    const alvoMagia = tgt || P.closest;
    const pl = planejarMagia(u, alvoMagia, magiasDe(u.kind as VocKey), reserva);
    if (pl) {
      hab = pl.k; habSc = UTIL.habilidade * (1 + Math.min(.6, pl.sc / 80));
      ACTM.x = pl.x; ACTM.y = pl.y; ACT_ALVO.u = pl.alvo;
    }
  }
  if (hab) propor(A_HABILIDADE, habSc, ACTM.x, ACTM.y, hab);
  executar(u, sq, tgt);
}

const FRM = { x: 0, y: 0 };
function formacao(u: Unit, sq: Squad) {
  const ax = sq.ex - sq.rally.x, ay = sq.ey - sq.rally.y, l = Math.hypot(ax, ay) || 1;
  const off = ROLE_OFF[u.ai.role] || 0;
  FRM.x = sq.rally.x + ax / l * off + u.driftX * .5;
  FRM.y = sq.rally.y + ay / l * off + u.driftY * .5;
  return FRM;
}
function fugaSegura(u: Unit, mx: number, my: number, raio: number) {
  let bx = u.x, by = u.y, bs = -1e9;
  for (let k = 0; k < 8; k++) {
    const a = Math.atan2(u.y - my, u.x - mx) + (k - 3.5) * .42;
    const x = clamp(u.x + Math.cos(a) * raio, 2, W.N - 2), y = clamp(u.y + Math.sin(a) * raio, 2, W.N - 2);
    if (blockedPt(x, y, u.K.r)) continue;
    let s = dist(x, y, mx, my);
    for (const o of W.meteors) {
      if (o.src && !inimigo(o.src, u)) continue;
      const r = o.gelo ? NEVASCA.raio : MET_R;
      const d = dist(x, y, o.x, o.y);
      if (d < r + 1) s -= (r + 1 - d) * 4;
    }
    if (s > bs) { bs = s; bx = x; by = y; }
  }
  return { x: bx, y: by };
}
const STRAFE_CD = 1.3;
const KP = { x: 0, y: 0 };
function pontoKite(u: Unit, alvo: Unit, limite: number) {
  if (!u.strafe) u.strafe = rnd() < .5 ? -1 : 1;
  for (let tent = 0; tent < 2; tent++) {
    const dx = u.x - alvo.x, dy = u.y - alvo.y, l = Math.hypot(dx, dy) || 1;
    const nx = dx / l, ny = dy / l, s = u.strafe;
    const x = clamp(alvo.x + (nx - ny * STRAFE * s) * limite, 2, W.N - 2);
    const y = clamp(alvo.y + (ny + nx * STRAFE * s) * limite, 2, W.N - 2);
    if (!blockedPt(x, y, u.K.r) || tent === 1) { KP.x = x; KP.y = y; return KP; }
    if (W.simTime - u.strafeT > STRAFE_CD) { u.strafe = -u.strafe; u.strafeT = W.simTime; }
    else { KP.x = x; KP.y = y; return KP; }
  }
  return KP;
}

function executar(u: Unit, sq: Squad, tgt: Unit | null) {
  switch (ACT.k) {
    case A_CURA: if (lancarCura(u)) { setState(u, ST.HEAL); return; } break;
    case A_POCAO: if (beberPocao(u, ACT.alvo === "mp" ? "mp" : "hp")) return; break;
    case A_HABILIDADE: {
      const k = ACT.alvo as SpellKey;
      const guardado = u.target;
      if (ACT_ALVO.u && !ACT_ALVO.u.dead) u.target = ACT_ALVO.u;
      let ok = false;
      if (k === "meteoro") ok = lancarMeteoro(u, ACT.x, ACT.y);
      else if (k === "nevasca") ok = lancarNevasca(u, ACT.x, ACT.y);
      else if (k === "chuva") ok = lancarChuva(u, ACT.x, ACT.y);
      else if (k === "trevas") ok = lancarTrevas(u);
      else if (k === "triplo") ok = lancarTriplo(u);
      else if (k === "certeiro") ok = lancarCerteiro(u);
      else if (k === "terremoto") ok = lancarTerremoto(u);
      else if (k === "investida") ok = lancarInvestida(u, 2.6, 7.5);
      else if (k === "bumerangue") ok = lancarBumerangue(u);
      else if (k === "veneno") ok = lancarVeneno(u);
      else if (k === "bolaFogo") ok = lancarBolaFogo(u);
      else if (k === "relampago") ok = lancarRelampago(u);
      ACT_ALVO.u = null;
      if (ok) { if (k === "meteoro") setState(u, ST.METEOR); else if (k === "investida") setState(u, ST.CHARGE); return; }
      u.target = guardado;
      break;
    }
    case A_AOE: case A_CERCO:
      setState(u, ST.RETREAT); goTo(u, ACT.x, ACT.y, "aoe"); return;
    case A_RECUAR:
      setState(u, ST.RETREAT); goTo(u, ACT.x, ACT.y, "flee"); u.target = null; return;
    case A_REAGRUPAR:
      setState(u, ST.REGROUP); goTo(u, ACT.x, ACT.y, "rally"); u.target = null; return;
    case A_ISCA:
      setState(u, u.ai.p.closest && u.ai.p.closestD < 8 ? ST.RETREAT : ST.ADVANCE);
      goTo(u, ACT.x, ACT.y, "isca"); u.target = null; return;
    case A_EMBOSCAR:
      setState(u, ST.AMBUSH); goTo(u, ACT.x, ACT.y, "cover"); u.target = null; return;
    case A_GUARDAR:
      setState(u, ST.GUARD); u.target = ACT.alvo as Unit; goTo(u, ACT.x, ACT.y, "guard"); return;
    case A_KITE:
      setState(u, ST.KITE); goTo(u, ACT.x, ACT.y, "kite"); return;
    case A_FLANCO:
      setState(u, ST.FLANK); goTo(u, ACT.x, ACT.y, "flank"); return;
    case A_CERCAR:
      setState(u, ST.SURROUND); goTo(u, ACT.x, ACT.y, "slot"); return;
    case A_ATACAR:
      setState(u, ST.ENGAGE); u.path = null; return;
    case A_MEMORIA:
      setState(u, ST.ADVANCE); goTo(u, ACT.x, ACT.y, "memoria"); return;
  }
  if (tgt && dist(u.x, u.y, tgt.x, tgt.y) <= u.K.range) { setState(u, ST.ENGAGE); u.path = null; return; }
  setState(u, sq.stance === "FALL" ? ST.REGROUP : ST.ADVANCE);
  goTo(u, ACT.k === A_AVANCAR ? ACT.x : sq.rally.x + u.driftX, ACT.k === A_AVANCAR ? ACT.y : sq.rally.y + u.driftY, "tgt");
}

const COV = { x: 0, y: 0 };
function coverNear(u: Unit, rally: Pt, ameacador: Unit | null) {
  let bs = -1e9, bx = rally.x, by = rally.y;
  for (let k = 0; k < 26; k++) {
    const a = rnd() * Math.PI * 2, r = rnd() * 5;
    const x = Math.round(rally.x + Math.cos(a) * r), y = Math.round(rally.y + Math.sin(a) * r);
    if (x < 0 || y < 0 || x >= W.N || y >= W.N || W.solid[y * W.N + x]) continue;
    let walls = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < W.N && ny < W.N && W.blockLOS[ny * W.N + nx]) walls++;
    }
    let s = walls * 2.2 - dist(x, y, u.x, u.y) * .5 - dist(x, y, rally.x, rally.y) * .35;
    if (ameacador && !los(x + .5, y + .5, ameacador.x, ameacador.y)) s += 5;
    if (s > bs) { bs = s; bx = x + .5; by = y + .5; }
  }
  COV.x = bx; COV.y = by; return COV;
}
const SPOT = { x: 0, y: 0 };
export function chuvaSpot(u: Unit) {
  let best: Unit | null = null, bs = 0;
  const m = queryRadius(u.x, u.y, CHUVA_ALCANCE);
  for (let i = 0; i < m; i++) {
    const a = QBUF[i];
    if (!aliado(u, a)) continue;
    let s = 0;
    const k = queryRadius2(a.x, a.y, CHUVA_R * .85);
    for (let j = 0; j < k; j++) { const o = QBUF2[j]; if (!aliado(u, o)) continue; s += Math.max(0, 1 - o.hp / o.maxHp); }
    if (s > bs) { bs = s; best = a; }
  }
  if (bs < .5 || !best) return null;
  SPOT.x = best.x; SPOT.y = best.y; return SPOT;
}
export function meteorSpot(u: Unit) {
  let best: Unit | null = null, bn = 1;
  const m = queryRadius(u.x, u.y, MET_ALCANCE);
  /* copia: o laço interno reusa o segundo buffer, e losU não consulta */
  for (let i = 0; i < m; i++) {
    const e = QBUF[i];
    if (!inimigo(u, e) || !losU(u, e)) continue;
    let n = 0;
    const k = queryRadius2(e.x, e.y, MET_R * .85);
    for (let j = 0; j < k; j++) if (inimigo(u, QBUF2[j])) n++;
    if (n > bn) { bn = n; best = e; }
  }
  if (!best) return null;
  SPOT.x = best.x; SPOT.y = best.y; return SPOT;
}
const ANG: number[] = [];
export function escapar(u: Unit, raio: number) {
  const ang = ANG; ang.length = 0;
  const m = queryRadius(u.x, u.y, raio);
  for (let i = 0; i < m; i++) {
    const e = QBUF[i];
    if (e === u || !inimigo(u, e)) continue;
    ang.push(Math.atan2(e.y - u.y, e.x - u.x));
  }
  if (u.x < MARGEM) ang.push(Math.PI);
  if (u.x > W.N - MARGEM) ang.push(0);
  if (u.y < MARGEM) ang.push(-Math.PI / 2);
  if (u.y > W.N - MARGEM) ang.push(Math.PI / 2);
  if (!ang.length) return null;
  ang.sort((a, b) => a - b);
  let melhor = ang[0], vao = -1;
  for (let i = 0; i < ang.length; i++) {
    const a = ang[i];
    const b = (i === ang.length - 1) ? ang[0] + Math.PI * 2 : ang[i + 1];
    const g = b - a;
    if (g > vao) { vao = g; melhor = a + g / 2; }
  }
  return { a: melhor, vao };
}

/* ============================================================
   [SYSTEM: AI_STUCK] preso: desvio, destino novo e, por fim, volta
   à origem (aventureiro ao obelisco, ou ao portão se travado)
   ============================================================ */
export function soltarPreso(u: Unit) {
  let casa: Pt, J = 2.5;
  if (u.beast) casa = u.home || { x: u.x, y: u.y };
  else if (pzAtiva(u)) { casa = portaoPara(u); J = .8; }
  else casa = W.cidade.nasce;
  let f = nearestFree(casa.x + rr(-J, J), casa.y + rr(-J, J));
  if (!u.beast && pzAtiva(u) && emPZ(f[0] + .5, f[1] + .5)) { const p = portaoAtual(); f = nearestFree(p.x, p.y); }
  u.x = f[0] + .5; u.y = f[1] + .5; u.px = u.x; u.py = u.y;
  u.path = null; u.pi = 0; u.goalKey = ""; u.repath = 0; u.target = null; u.travas = 0;
  u.travT = 0; u.travX = u.x; u.travY = u.y; u.desvio = 0;
  u.pz = !u.beast && emPZ(u.x, u.y);
  fx({ t: "ring", x: u.x, y: u.y, c: "#9fb4c4", life: .5 });
}

/* ============================================================
   [SYSTEM: AI_BEAST] a varredura procura só desafeto; presas fogem em
   pânico; territorial volta para casa; o resto pasta perto do bando
   ============================================================ */
export function beastThink(u: Unit) {
  const K = u.K;
  const alcance = Math.max(K.sight + 3, K.aggro || 0);
  let alvo: Unit | null = null, ad = 1e9, maisPerto: Unit | null = null, mpd = 1e9;
  const m = queryRadius(u.x, u.y, alcance);
  for (let i = 0; i < m; i++) {
    const e = QBUF[i];
    if (e.beast || e.dead || e.pz) continue;
    const d = dist(u.x, u.y, e.x, e.y);
    if (d < mpd) { mpd = d; maisPerto = e; }
    if (!odeia(u, e)) continue;
    if (d < ad) { ad = d; alvo = e; }
  }
  if (u.taunt && u.tauntAte > W.simTime && !u.taunt.dead && !u.taunt.pz) {
    const d = dist(u.x, u.y, u.taunt.x, u.taunt.y);
    if (d < K.sight + 6) { alvo = u.taunt; ad = d; }
  } else if (u.taunt && u.tauntAte <= W.simTime) u.taunt = null;
  const provocado = u.prov && !u.prov.dead && !u.prov.pz && odeia(u, u.prov);
  if (provocado && dist(u.x, u.y, u.prov!.x, u.prov!.y) < K.sight + 3) {
    alvo = u.prov; ad = dist(u.x, u.y, alvo!.x, alvo!.y);
  } else if (u.prov && (u.prov.dead || !odeia(u, u.prov))) {
    u.prov = alvo;
  }
  const caca = alvo && (ad <= Math.max(K.aggro || 0, K.sight) + 4) && (losU(u, alvo) || ad <= K.range * 1.6);
  if (caca && alvo) {
    u.target = alvo; u.packTgt = alvo;
    if (ad <= K.range) { setState(u, ST.ENGAGE); u.path = null; return; }
    const ang = (u.id % 7) / 7 * Math.PI * 2;
    const raio = K.range * .8;
    setState(u, ST.HUNT);
    goTo(u, alvo.x + Math.cos(ang) * raio, alvo.y + Math.sin(ang) * raio, "caça");
    return;
  }
  if (!K.aggro && maisPerto && (mpd < PANICO_R || u.hurt < 3)) {
    u.target = null;
    setState(u, ST.RETREAT);
    let fx0 = u.x - maisPerto.x, fy0 = u.y - maisPerto.y;
    if (u.kind === "cow") {
      let hx = 0, hy = 0, hn = 0;
      const k = queryRadius2(u.x, u.y, 6);
      for (let i = 0; i < k; i++) { const o = QBUF2[i]; if (o !== u && o.kind === "cow") { hx += o.x; hy += o.y; hn++; } }
      if (hn) { fx0 += (hx / hn - u.x) * .5; fy0 += (hy / hn - u.y) * .5; }
    }
    const l = Math.hypot(fx0, fy0) || 1;
    const corrida = u.kind === "hen" ? 4 : 7;
    goTo(u, u.x + fx0 / l * corrida, u.y + fy0 / l * corrida, "panico");
    return;
  }
  if (u.home && dist(u.x, u.y, u.home.x, u.home.y) > (u.coleira || u.roam * 1.8)) {
    u.target = null; u.packTgt = null; u.prov = null;
    setState(u, ST.ADVANCE);
    goTo(u, u.home.x, u.home.y, "território");
    return;
  }
  u.target = null;
  if (u.packT <= W.simTime) u.packTgt = null;
  setState(u, ST.GRAZE);
  const h = u.home || { x: u.x, y: u.y };
  if (u.wander < W.simTime) {
    u.wander = W.simTime + rr(3.5, 9);
    const a = rnd() * 6.283, r = rnd() * u.roam;
    goTo(u, h.x + Math.cos(a) * r, h.y + Math.sin(a) * r, "vagar");
  }
}
export { cellsAround };
