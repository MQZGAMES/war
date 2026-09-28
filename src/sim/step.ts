/* ================================================================
   SIMULAÇÃO por passo fixo (1/60 s) — mover, virar, regenerar, pensar,
   atacar; renascimento; projéteis, ondas, meteoros.
   ================================================================ */
import { PARAL_MULT, ST, VIGOR_MULT } from "./data";
import { fx, ui } from "./fx";
import { beastAttack, beastBaque, beastInvestida, envenenar, golpe, hit, shoot, updateMeteors, updateOndas, updateProjectiles } from "./combat";
import { blockedPt, buildGrid, cellsAround, desviarTroncos, separacao, emPZ, empurraTroncos, findPath, los, losU, nearestFree, refreshAlive, retaLivre } from "./map";
import { caveiraPasso, pzAtiva } from "./pk";
import { clamp, dist, dist2, rnd, rr } from "./rng";
import { G, W, hooks } from "./state";
import { dmgFis, dmgMag, recalcular } from "./stats";
import type { Unit } from "./types";
import { goTo, novaPostura, setState, TRAVA_MIN, TRAVA_TESTE, TRAVA_VOLTA } from "./unit";
import { beastThink, soltarPreso } from "./ai";
import { ctrlThink, lideraSobre, pausaRefil, seguirLider, avisoPz } from "./player";
import { encerraPk, worldStep, worldThink } from "./world";
import { esquecerMorto } from "./relations";

export const DT = 1 / 60;
let pathBudget = 0;
/* criatura, e quem tem trava fora da cidade, não pisam no calçamento:
   a rota já desvia da PZ em vez de esbarrar nela */
export const barrado = (u: Unit) => !u.pz && (u.beast || pzAtiva(u));
const EMP = { x: 0, y: 0 }, SEP = { x: 0, y: 0 };
/* medição em desenvolvimento: onde vai o tempo do passo */
export const PERF = { pensar: 0, rota: 0, rotas: 0, total: 0, mundo: 0, mover: 0, fim: 0, grade: 0, atacar: 0 };
const medir = import.meta.env.DEV;
let quadro = 0;
export function novoQuadro() { pathBudget = 8; }

/* [SYSTEM: PERF] mapa do que importa: células de 12 ladrilhos perto de
   algum aventureiro vivo ou da câmera. Fora delas nada acontece que
   alguém veja, então a fauna calma pode ser simulada com menos passos */
const CEL_Q = 12;
let quenteN = 0, quente = new Uint8Array(0);
export const OLHO = { x: -1e9, y: -1e9, r: 0 };
function marcarQuente() {
  const n = Math.ceil(W.N / CEL_Q);
  if (quenteN !== n) { quenteN = n; quente = new Uint8Array(n * n); }
  quente.fill(0);
  const marca = (x: number, y: number, r: number) => {
    const x0 = Math.max(0, Math.floor((x - r) / CEL_Q)), x1 = Math.min(n - 1, Math.floor((x + r) / CEL_Q));
    const y0 = Math.max(0, Math.floor((y - r) / CEL_Q)), y1 = Math.min(n - 1, Math.floor((y + r) / CEL_Q));
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) quente[cy * n + cx] = 1;
  };
  for (const u of W.units) if (!u.beast && !u.dead) marca(u.x, u.y, 22);
  if (OLHO.r > 0) marca(OLHO.x, OLHO.y, OLHO.r);
}

export function step() {
  const t00 = medir ? performance.now() : 0;
  W.simTime += DT; quadro++;
  const tg = medir ? performance.now() : 0;
  refreshAlive();
  buildGrid();
  if (medir) PERF.grade += performance.now() - tg;
  const tm = medir ? performance.now() : 0;
  worldStep();
  if (medir) PERF.mundo += performance.now() - tm;
  const simTime = W.simTime;
  if ((quadro & 3) === 0 || quenteN === 0) marcarQuente();
  for (const u of W.units) {
    u.px = u.x; u.py = u.y;
    if (u.dead) continue;
    /* bicho sossegado longe de todos anda e pensa em passos de 4 */
    let dtu = DT;
    if (u.beast && !(u.target && !u.target.dead) && !quente[((u.y / CEL_Q) | 0) * quenteN + ((u.x / CEL_Q) | 0)]) {
      if (((u.id + quadro) & 3) !== 0) continue;
      dtu = DT * 4;
    }
    const sq = (u.party && u.party.sq) || W.squads[u.team];
    u.cd -= dtu; u.think -= dtu; u.repath -= dtu; u.hurt += dtu; u.tagT -= dtu;
    if (u.beast && u.K.atk) { u.cdA -= dtu; u.cdB -= dtu; u.cdI -= dtu; }

    // para onde vira
    {
      let want = u.moveA;
      const t0 = u.target;
      if (u.charge > 0) want = Math.atan2(u.cvy, u.cvx);
      else if (u.st === ST.RETREAT || u.st === ST.REGROUP) { /* segue o passo */ }
      else if (t0 && !t0.dead) {
        const d0 = dist(u.x, u.y, t0.x, t0.y);
        if (u.st === ST.ENGAGE || u.st === ST.KITE || u.swing > 0 || d0 < u.K.range * 1.25) want = Math.atan2(t0.y - u.y, t0.x - u.x);
      }
      let df = want - u.fa;
      while (df > Math.PI) df -= Math.PI * 2;
      while (df < -Math.PI) df += Math.PI * 2;
      u.fa += clamp(df, -7 * dtu, 7 * dtu);
      u.dirx = Math.cos(u.fa); u.diry = Math.sin(u.fa);
    }
    if (u.venAte > 0) {
      if (simTime >= u.venTick) {
        u.venTick = simTime + 1;
        const src = u.venSrc && !u.venSrc.dead ? u.venSrc : null;
        fx({ t: "bits", x: u.x, y: u.y, c: "#7fe05a", n: 6, spd: .8, h: .6 });
        hit(src, u, u.venDps, true);
        if (u.dead) continue;
      }
      if (simTime >= u.venAte) { u.venAte = 0; u.venSrc = null; }
    }
    if (u.slow > 0) u.slow -= dtu;
    if (u.pressa > 0) u.pressa -= dtu;
    if (u.paral > 0) u.paral -= dtu;
    if (u.lunge > 0) u.lunge -= dtu;
    if (u.swing > 0) u.swing -= dtu;
    if (u.flash > 0) u.flash -= dtu; if (u.squash > 0) u.squash -= dtu;
    u.moving = 0;
    if (!u.beast && simTime > u.postT) novaPostura(u);
    if (!u.beast) caveiraPasso(u);
    {
      const calm = u.hurt > 4 ? 2.2 : 1;
      if (u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + (u.K.rHp + u.regHp) * calm * dtu);
      if (u.mp < u.maxMp) u.mp = Math.min(u.maxMp, u.mp + (u.K.rMp + u.regMp) * calm * dtu);
    }
    {
      const t1 = u.target;
      const want = (u.kind !== "knight" && !u.beast && t1 && !t1.dead && dist(u.x, u.y, t1.x, t1.y) <= u.K.range * 1.2) ? 1 : 0;
      u.aim += clamp(want - u.aim, -3.2 * dtu, 3.2 * dtu);
    }
    if (u.draw > 0) {
      u.draw -= dtu;
      if (u.draw <= 0) {
        const t2 = u.pending;
        if (t2 && !t2.dead && dist(u.x, u.y, t2.x, t2.y) <= u.K.range + 1.3 && los(u.x, u.y, t2.x, t2.y)) {
          shoot(u, t2, "arrow", dmgFis(u));
          u.swing = .3; u.swMax = .3;
        }
        u.pending = null;
      }
    }
    if (u.think <= 0) {
      const tp = medir ? performance.now() : 0;
      u.think = .28 + rnd() * .14;
      if (u.beast) beastThink(u);
      else if (u === G.ctrl) ctrlThink(u, sq);
      else if (G.AUTO.lider && G.ctrl && lideraSobre(u)) seguirLider(u, sq);
      else worldThink(u, sq);
      if (medir) PERF.pensar += performance.now() - tp;
    }
    // investida do cavaleiro
    if (u.charge > 0) {
      u.charge -= dtu;
      const s = u.K.spd * 3.6 * dtu;
      moveBy(u, u.cvx * s, u.cvy * s);
      u.moving = 1; u.bob += s * 11;
      const t = u.target;
      if (t && !t.dead && dist(u.x, u.y, t.x, t.y) < 1.35) {
        golpe(u, t, dmgFis(u) * 1.55, false, true); t.slow = 1.1; u.charge = 0;
        fx({ t: "ring", x: t.x, y: t.y, c: u.cor.hi, life: .4 });
        fx({ t: "impact", x: t.x, y: t.y, kind: "baque" });
      }
      continue;
    }
    // andar
    const tmv = medir ? performance.now() : 0;
    let dx = 0, dy = 0;
    if (u === G.ctrl && G.tvn) {
      dx = G.tvx; dy = G.tvy; u.ordem = null; u.path = null; u.alvoManual = null; u.npcAlvo = null;
      if (u.refil) pausaRefil(u, "volta quando você parar");
      u.refilEspera = simTime + 1.5;
    } else if (u.st !== ST.ENGAGE && u.goal) {
      const semPz = barrado(u);
      if (u.repath <= 0) {
        if (retaLivre(u.x, u.y, u.goal.x, u.goal.y, u.K.r, semPz)) { u.path = null; u.pi = 0; u.repath = .35 + rnd() * .25; }
        else if (pathBudget > 0) {
          u.repath = .55 + rnd() * .5; pathBudget--;
          const tr = medir ? performance.now() : 0;
          u.path = findPath(u.x, u.y, u.goal.x, u.goal.y, semPz); u.pi = 0;
          if (medir) { PERF.rota += performance.now() - tr; PERF.rotas++; }
        }
      }
      if (u.path && u.pi < u.path.length) {
        while (u.pi < u.path.length - 1 && dist(u.x, u.y, u.path[u.pi].x, u.path[u.pi].y) < .45) u.pi++;
        /* corta caminho: mira o ponto mais adiante que já dá para ver */
        if (((u.id + quadro) & 7) === 0)
          for (let k = Math.min(u.path.length - 1, u.pi + 4); k > u.pi; k--)
            if (retaLivre(u.x, u.y, u.path[k].x, u.path[k].y, u.K.r, semPz)) { u.pi = k; break; }
        const p = u.path[u.pi];
        const l = dist(u.x, u.y, p.x, p.y);
        if (l < .42) u.pi++;
        else { dx += (p.x - u.x) / l; dy += (p.y - u.y) / l; }
      } else if (u.goal) {
        const l = dist(u.x, u.y, u.goal.x, u.goal.y);
        if (l > .4) { dx += (u.goal.x - u.x) / l; dy += (u.goal.y - u.y) / l; }
      }
    }
    // separação
    /* separação: cada corpo pede o espaço do próprio porte; o menor
       cede mais. O empurrão é suave, sem disparar a corrida */
    let sx = 0, sy = 0;
    const querAndar = Math.hypot(dx, dy) > .02;
    {
      separacao(u, SEP); sx = SEP.x; sy = SEP.y;
      /* troncos: desviar de lado antes de encostar; de perto, afastar */
      if (querAndar) { desviarTroncos(u, u.K.r, dx, dy, EMP); dx += EMP.x; dy += EMP.y; }
      empurraTroncos(u.x, u.y, u.K.r + .15, EMP);
      sx += EMP.x * .8; sy += EMP.y * .8;
    }
    dx += sx * 1.8; dy += sy * 1.8;
    let l = Math.hypot(dx, dy);
    if (l > .02 && u.desvio > 0) {
      u.desvio -= dtu;
      const c = Math.cos(u.desvioA), s = Math.sin(u.desvioA);
      const nx = dx * c - dy * s, ny = dx * s + dy * c;
      dx = nx; dy = ny; l = Math.hypot(dx, dy);
    }
    if (l > .02) {
      const ritmo = querAndar ? 1 : Math.min(1, l * 1.6);
      const sp = u.K.spd * u.velo * ritmo * (u.paral > 0 ? PARAL_MULT : u.slow > 0 ? .5 : 1) * (u.pressa > 0 ? VIGOR_MULT : 1) * dtu;
      moveBy(u, dx / l * sp, dy / l * sp);
      if (querAndar || ritmo > .35) { u.bob += sp * 11; u.moving = 1; u.moveA = Math.atan2(dy, dx); }
      if (querAndar) u.travT += dtu;
      if (u.travT >= TRAVA_TESTE) {
        const andou = dist(u.x, u.y, u.travX, u.travY);
        if (andou < TRAVA_MIN) {
          u.travas++;
          u.desvioA = (u.travas % 2 ? 1 : -1) * (1.1 + rnd() * .9);
          u.desvio = 1.4;
          u.path = null; u.pi = 0; u.repath = 0; u.goalKey = "";
          if (u.travas >= TRAVA_VOLTA) soltarPreso(u);
          else if (u.travas >= 2) {
            const a = rnd() * 6.283, r = 3 + rnd() * 4;
            goTo(u, u.x + Math.cos(a) * r, u.y + Math.sin(a) * r, "destrava" + u.travas);
          }
        } else u.travas = 0;
        u.travT = 0; u.travX = u.x; u.travY = u.y;
      }
    } else { u.travT = 0; u.travX = u.x; u.travY = u.y; u.travas = 0; }

    if (medir) PERF.mover += performance.now() - tmv;
    // atacar
    const tat = medir ? performance.now() : 0;
    const t = u.target;
    if (t && !t.dead) {
      const d = dist(u.x, u.y, t.x, t.y);
      if (u.beast && u.K.atk) {
        beastInvestida(u, t, d);
        if (beastAttack(u, t, d)) u.cd = Math.max(u.cd, .35);
      }
      if (d <= u.K.range + .15 && u.cd <= 0 && losU(u, t)) {
        u.cd = u.K.cd * rr(.9, 1.12);
        if (u.kind === "archer") { u.lunge = .14; u.draw = u.drawMax; u.pending = t; }
        else if (u.kind === "mage" || u.kind === "druid") {
          u.lunge = .2; u.swing = .36; u.swMax = .36;
          shoot(u, t, u.kind === "druid" ? "ice" : "fire", dmgMag(u));
        } else {
          u.lunge = .3; u.swing = .42; u.swMax = .42;
          const dano = dmgFis(u) * rr(.85, 1.15);
          fx({ t: "swing", u, heavy: !!u.beast && u.K.threat > 1 });
          const acertou = golpe(u, t, dano, false, true);
          if (u.beast && u.K.atk) {
            const A = u.K.atk;
            beastBaque(u, t, dano);
            if (A.veneno && !t.dead) t.slow = Math.max(t.slow, A.veneno.lento);
            if (acertou && A.peconha && !t.dead) envenenar(u, t, A.peconha.dps * (1 + (u.xpMult - 1) * .8), A.peconha.dur);
            if (acertou && A.drena) { u.hp = Math.min(u.maxHp, u.hp + dano * A.drena * .6); fx({ t: "bits", x: u.x, y: u.y, c: "#c0303a", n: 6, spd: .8, h: .9 }); }
          }
        }
      }
      if (u.tiros > 0 && simTime - u.tiroT > .18) {
        u.tiroT = simTime; u.tiros--;
        if (dist(u.x, u.y, t.x, t.y) <= u.K.range + 1 && los(u.x, u.y, t.x, t.y)) {
          shoot(u, t, "arrow", dmgFis(u) * .75); u.swing = .22; u.swMax = .22;
        }
      }
    }
    if (medir) PERF.atacar += performance.now() - tat;
  }
  const tf = medir ? performance.now() : 0;
  for (const u of W.units) if (u.dead && !u.beast && u.reborn && u.reborn <= simTime) reviveUnit(u);
  updateProjectiles(DT);
  updateOndas(DT);
  updateMeteors(DT);
  if (medir) { PERF.fim += performance.now() - tf; PERF.total += performance.now() - t00; }
}

/* [SYSTEM: CIDADE] barreira da PZ: criatura e quem tem trava não pisam
   no calçamento — conta o corpo inteiro (os quatro cantos) */
let avisoPzT = 0;
function pzCantos(x: number, y: number, r: number) {
  return (emPZ(x - r, y - r) ? 1 : 0) + (emPZ(x + r, y - r) ? 1 : 0) + (emPZ(x - r, y + r) ? 1 : 0) + (emPZ(x + r, y + r) ? 1 : 0);
}
export function moveBy(u: Unit, mx: number, my: number) {
  const r = u.K.r;
  const PZ_LONGE = (W.cidade.r + 3) * (W.cidade.r + 3);
  const barra = !u.pz && (u.beast || pzAtiva(u)) && dist2(u.x, u.y, W.cidade.x, W.cidade.y) < PZ_LONGE;
  const c0 = barra ? pzCantos(u.x, u.y, r) : 0;
  const nx = u.x + mx;
  if (!blockedPt(nx, u.y, r)) { if (barra && pzCantos(nx, u.y, r) > c0) barrou(u); else u.x = nx; }
  const c1 = barra ? pzCantos(u.x, u.y, r) : 0;
  const ny = u.y + my;
  if (!blockedPt(u.x, ny, r)) { if (barra && pzCantos(u.x, ny, r) > c1) barrou(u); else u.y = ny; }
  empurraTroncos(u.x, u.y, r, EMP);
  if (EMP.x || EMP.y) {
    const qx = u.x + EMP.x * .35, qy = u.y + EMP.y * .35;
    if (!blockedPt(qx, qy, r) && !(barra && pzCantos(qx, qy, r) > pzCantos(u.x, u.y, r))) { u.x = qx; u.y = qy; }
  }
  u.x = clamp(u.x, r, W.N - r); u.y = clamp(u.y, r, W.N - r);
  /* quem está barrado não vira "dentro da cidade" por uma quina do calçamento */
  if (!u.beast) u.pz = emPZ(u.x, u.y) && (u.pz || !barra);
}
function barrou(u: Unit) {
  if (u === G.ctrl && W.simTime > avisoPzT) { avisoPzT = W.simTime + 2.5; avisoPz(u); }
}

/* Só aventureiro renasce; a fauna morta sai e o gerador repõe. */
export function reviveUnit(u: Unit) {
  const c = W.cidade.nasce;
  const f = nearestFree(c.x + rr(-1.6, 1.6), c.y + rr(-1.6, 1.6));
  u.x = f[0] + .5; u.y = f[1] + .5; u.px = u.x; u.py = u.y; u.dead = false; u.pz = emPZ(u.x, u.y);
  u.path = null; u.pi = 0; u.target = null; u.slow = 0; u.charge = 0; u.exAte = {}; u.tiros = 0;
  u.hurt = 99; u.repath = 0; u.goalKey = ""; u.st = ST.ADVANCE; u.reborn = 0; u.draw = 0; u.pending = null; u.aim = 0; u.swing = 0;
  esquecerMorto(u);
  u.encomenda = null; u.alvoManual = null; u.npcAlvo = null; u.refil = null;
  u.travX = u.x; u.travY = u.y; u.travT = 0; u.travas = 0; u.desvio = 0;
  if (u.skull === "white") { u.skull = null; u.brancaInj = false; }
  u.atkBy = {}; u.contrib = {}; u.pkJust = true; u.ultimos[0] = u.ultimos[1] = null;
  u.pzLuta = -1e9; u.pzMorte = 0;
  if (u.lvl > 1) {
    u.lvl--;
    if (u.pts > 0) u.pts--;
    else {
      let alvo: keyof typeof u.attr | null = null, v = 0;
      for (const k in u.attr) { const kk = k as keyof typeof u.attr; if (u.attr[kk] > v) { v = u.attr[kk]; alvo = kk; } }
      if (alvo) u.attr[alvo]--;
    }
  }
  u.xp = 0;
  recalcular(u);
  u.pressa = 0; u.paral = 0; u.venAte = 0; u.venSrc = null; u.hp = u.maxHp; u.mp = u.maxMp;
  u.fa = Math.atan2(W.cidade.y - u.y, W.cidade.x - u.x) + Math.PI; u.moveA = u.fa;
  if (u === G.ctrl) { hooks.setCam(true); hooks.centrarEm(u); }
  if (u.w) {
    u.w.goal = "cidade"; u.w.pkT = 0; u.w.alvoPk = null; u.w.t = 0; u.w.etapa = 0; u.w.pronto = false;
    if (u.party && u.party.modo === "pk") encerraPk(u.party);
  }
  fx({ t: "revive", u });
  if (u === G.ctrl) ui.banner("De volta ao obelisco", "nível " + u.lvl, "");
}
