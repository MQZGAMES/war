/* ================================================================
   O personagem sob comando e quem o segue.
   [SYSTEM: AUTO_ATAQUE] [SYSTEM: AUTO_NIVEL] [SYSTEM: MAGIA_MIRA]
   [SYSTEM: ALVO_TRAVADO] [SYSTEM: AUTO_REFIL] [SYSTEM: GRUPO_REFIL]
   [SYSTEM: LIDER] — mesma lógica da v54.
   ================================================================ */
import { CHUVA_ALCANCE, CUSTO, MET_ALCANCE, SPELLS, ST, type SpellKey } from "./data";
import { avisoDe, fx } from "./fx";
import { comprarMelhorias, comprarPocoes, depositarOuro, ehPocao, guardarNoCofre, livres, mantem, saldo, semFrasco, venderItem, PRECO_POCAO } from "./items";
import { dist, clamp, dist2 } from "./rng";
import { los, losU, NPC_ALCANCE, npcDe, QBUF, queryRadius } from "./map";
import { pzAtiva, pzRestante } from "./pk";
import { aliado, declararPk, inimigo, odeia, podeAtacarManual, querAtacar } from "./relations";
import { beberPocao, lancar, lancarChuva, lancarCura, magiaDe, podeMagia, slotDe } from "./spells";
import { G, W, hooks } from "./state";
import { dmgFis } from "./stats";
import type { Squad, Unit } from "./types";
import { goTo, setState } from "./unit";
import { perceber } from "./ai";
import { worldThink } from "./world";

/* ---------- [SYSTEM: AUTO_NIVEL] janela de nível da presa ---------- */
const JAN = { lo: 1, hi: 8 };
export function janelaNivel(u: Unit) {
  const A = G.AUTO.ataque;
  if (!A.nivelAuto) { JAN.lo = A.nivelMin; JAN.hi = Math.max(A.nivelMin, A.nivelMax); return JAN; }
  const forca = u.lvl + Math.max(0, (u.maxHp - u.K.hp) / 60) + Math.max(0, dmgFis(u) - u.K.dmg) / 8;
  JAN.lo = Math.max(1, Math.floor(forca * .55));
  JAN.hi = Math.max(JAN.lo + 1, Math.round(forca * 1.25 + 2));
  return JAN;
}
export function valeAuto(u: Unit, e: Unit) {
  const m = G.AUTO.ataque.modo;
  if (m === "desligado" || !querAtacar(u, e, m)) return false;
  if (!e.beast) return true;
  const J = janelaNivel(u);
  return G.AUTO.ataque.nivelAuto ? e.lvl <= J.hi + 3 : (e.lvl >= J.lo && e.lvl <= J.hi);
}
export function notaPresa(u: Unit, e: Unit, d2: number) {
  if (!e.beast) return 500 - Math.sqrt(d2) * 3;
  const J = janelaNivel(u), lv = e.lvl;
  let s;
  if (lv >= J.lo && lv <= J.hi) s = 1000 + lv * 12;
  else if (lv < J.lo) s = 400 - (J.lo - lv) * 15;
  else s = -200 - (lv - J.hi) * 60;
  return s - Math.sqrt(d2) * 4;
}
function alvoAuto(u: Unit) {
  let melhor: Unit | null = null, ms = -1e9;
  const R2 = u.K.sight * u.K.sight * 16;
  for (const e of W.units) {
    if (e.dead || !valeAuto(u, e)) continue;
    const d2 = dist2(u.x, u.y, e.x, e.y);
    if (d2 > R2) continue;
    const s = notaPresa(u, e, d2);
    if (s > ms) { ms = s; melhor = e; }
  }
  const t = u.target;
  if (t && !t.dead && valeAuto(u, t) && notaPresa(u, t, dist2(u.x, u.y, t.x, t.y)) >= ms - 80) return t;
  return melhor;
}
function agressorAuto(u: Unit) {
  if (!G.AUTO.ataque.revidar) return null;
  let melhor: Unit | null = null, md = 1e9;
  for (const e of W.units) {
    if (e.dead || !podeAtacarManual(u, e)) continue;
    const q = u.atkBy[e.id];
    if (q === undefined || W.simTime - q > 8) continue;
    const d = dist2(u.x, u.y, e.x, e.y);
    if (d < md && d <= u.K.sight * u.K.sight) { md = d; melhor = e; }
  }
  return melhor;
}
function aliadoFerido(u: Unit) {
  let alvo: Unit | null = null, pior = 1;
  for (const a of W.units) {
    if (a.dead || !aliado(u, a)) continue;
    if (dist(u.x, u.y, a.x, a.y) > CHUVA_ALCANCE) continue;
    const f = a.hp / a.maxHp;
    if (f < pior) { pior = f; alvo = a; }
  }
  return pior <= G.AUTO.cura.pctAliado ? alvo : null;
}
export function autoCuraPasso(u: Unit) {
  const C = G.AUTO.cura;
  if (!C.ligado) return false;
  if (u.hp < u.maxHp * C.pct) {
    if (lancarCura(u, 1)) return true;
    if (beberPocao(u, "hp")) return true;
  }
  if (u.maxMp > 0 && u.mp < u.maxMp * C.pctMana && beberPocao(u, "mp")) return true;
  if (C.aliados && u.kind === "druid") {
    const a = aliadoFerido(u);
    if (a && lancarChuva(u, a.x, a.y)) return true;
  }
  return false;
}
function autoEspecial(u: Unit) {
  if (!u.target || u.target.dead) return;
  const apertado = G.AUTO.cura.ligado && u.hp < u.maxHp * Math.min(.95, G.AUTO.cura.pct + .25);
  for (let i = 0; i < 3; i++) {
    const k = slotDe(u, i);
    if (k === "cura" || k === "chuva") continue;
    const m = magiaDe(u, k);
    if (m.ex > 0) continue;
    if (u.mp < m.custo + (apertado ? CUSTO.cura : 0)) continue;
    if (m.mira ? lancar(u, k, u.target.x, u.target.y) : lancar(u, k)) return;
  }
}
function autoAtaque(u: Unit) {
  const caca = G.AUTO.ataque.modo === "desligado" ? null : alvoAuto(u);
  const alvo = caca || agressorAuto(u);
  u.target = alvo;
  if (!alvo) { u.path = null; u.goal = null; setState(u, ST.ADVANCE); return; }
  if (!alvo.beast) declararPk(u, alvo);
  autoEspecial(u);
  if (!caca) {
    u.path = null; u.goal = null;
    setState(u, dist(u.x, u.y, alvo.x, alvo.y) <= u.K.range ? ST.ENGAGE : ST.ADVANCE);
    return;
  }
  const d = dist(u.x, u.y, alvo.x, alvo.y), limite = u.K.keep || 0;
  if (limite && d < limite) {
    setState(u, ST.KITE);
    const dx = u.x - alvo.x, dy = u.y - alvo.y, l = Math.hypot(dx, dy) || 1;
    goTo(u, alvo.x + dx / l * (limite + 1.2), alvo.y + dy / l * (limite + 1.2), "auto");
  } else if (d <= u.K.range * .92 && los(u.x, u.y, alvo.x, alvo.y)) {
    setState(u, ST.ENGAGE); u.path = null;
  } else {
    setState(u, ST.ADVANCE); goTo(u, alvo.x, alvo.y, "auto");
  }
}

/* ---------- [SYSTEM: MAGIA_MIRA] magia de área vira encomenda ---------- */
export function mirarMagia(u: Unit, slot: number, x: number, y: number): boolean {
  const k = slotDe(u, slot), m = magiaDe(u, k);
  if (!m.mira) return lancar(u, k);
  u.encomenda = { slot, k, x, y, ate: W.simTime + 12 };
  u.ordem = null; u.think = 0;
  tentarEncomenda(u);
  return true;
}
function tentarEncomenda(u: Unit) {
  const e = u.encomenda;
  if (!e) return false;
  const m = SPELLS[e.k];
  if (W.simTime > e.ate || !m || !m.mira) { u.encomenda = null; return false; }
  const alc = m.alc || MET_ALCANCE;
  const d = dist(u.x, u.y, e.x, e.y);
  if (d <= alc * .96) {
    if (!podeMagia(u, e.k)) return false;
    if (lancar(u, e.k, e.x, e.y)) { u.encomenda = null; u.goalKey = ""; return true; }
    u.encomenda = null; return false;
  }
  const l = Math.max(.001, d);
  const px = u.x + (e.x - u.x) / l * (d - alc * .85), py = u.y + (e.y - u.y) / l * (d - alc * .85);
  setState(u, ST.ADVANCE);
  goTo(u, px, py, "encomenda");
  return true;
}

/* ---------- [SYSTEM: ALVO_TRAVADO] ---------- */
export function distDeTiro(u: Unit) { const r = u.K.range; return r <= 2.2 ? r * .85 : r * .75; }
function aproximarDoAlvo(u: Unit, alvo: Unit, chave: string) {
  const d = dist(u.x, u.y, alvo.x, alvo.y);
  const limite = u.K.keep || 0;
  if (limite && d < limite) {
    setState(u, ST.KITE);
    const dx = u.x - alvo.x, dy = u.y - alvo.y, l = Math.hypot(dx, dy) || 1;
    goTo(u, alvo.x + dx / l * (limite + 1.2), alvo.y + dy / l * (limite + 1.2), chave);
    return;
  }
  const ideal = distDeTiro(u);
  if (d <= ideal && losU(u, alvo)) { setState(u, ST.ENGAGE); u.path = null; return; }
  if (d <= u.K.range * .95 && losU(u, alvo)) { setState(u, ST.ENGAGE); u.path = null; return; }
  const dx = alvo.x - u.x, dy = alvo.y - u.y, l = Math.hypot(dx, dy) || 1;
  setState(u, ST.ADVANCE);
  goTo(u, alvo.x - dx / l * ideal * .9, alvo.y - dy / l * ideal * .9, chave);
}
export function alvoTravado(u: Unit) {
  const t = u.alvoManual;
  return (t && !t.dead && podeAtacarManual(u, t)) ? t : null;
}
/* Revidar é imediato; não gira entre dois agressores; em refil ninguém revida */
export function revidarJa(u: Unit, src: Unit) {
  if (u.refil || !G.AUTO.ataque.revidar || !src || src.dead || src === u || !podeAtacarManual(u, src)) return;
  const t = u.alvoManual && !u.alvoManual.dead ? u.alvoManual : u.target;
  if (t === src) return;
  if (t && !t.dead) { const q = u.atkBy[t.id]; if (q !== undefined && W.simTime - q < 3) return; }
  u.alvoManual = src; u.target = src; u.think = 0; u.npcAlvo = null;
}

/* ============================================================
   [SYSTEM: AUTO_REFIL] poção zerada ou mochila cheia: cidade em
   etapas (vender → poções → equipamento → banco). Ordem sua pausa.
   ============================================================ */
const REFIL_ESPERA = 20, RESERVA_REFIL = 20;
function faltaPocao(u: Unit) {
  const R = G.AUTO.refil;
  return !!R.pocoes && ((R.hp > 0 && u.potHp <= 0) || (R.mp > 0 && u.maxMp > 0 && u.potMp <= 0));
}
function precisaRefil(u: Unit) {
  const R = G.AUTO.refil;
  if (faltaPocao(u)) return "Poção acabou";
  if ((R.vender || R.banco) && livres(u.mochila) <= 1) return "Mochila cheia";
  return "";
}
function reservaRefil(u: Unit) {
  const R = G.AUTO.refil;
  let n = RESERVA_REFIL;
  if (R.pocoes) n += Math.max(0, R.hp - u.potHp) + (u.maxMp > 0 ? Math.max(0, R.mp - u.potMp) : 0);
  return PRECO_POCAO * n;
}
export function pausaRefil(u: Unit | null, motivo: string) {
  if (!u || !u.refil) return;
  u.refil = null; u.path = null;
  avisoDe(u, "Auto refil pausado · " + motivo, "#8d9aa0");
}
function refilSuspenso(u: Unit) {
  return !!(alvoTravado(u) || u.ordem || u.npcAlvo || u.encomenda || (u === G.ctrl && G.tvn) || W.simTime < (u.refilEspera || 0));
}
function iniciaRefil(u: Unit, motivo: string) {
  const trava = pzAtiva(u), R = G.AUTO.refil;
  const rota: string[] = [];
  if (R.vender || (R.comprar && G.AUTO.equip)) rota.push("comerciante");
  if (R.pocoes) rota.push("feiticeiro");
  if (R.banco) rota.push("banqueiro");
  u.refil = { fase: trava ? "isolar" : "rota", i: 0, rota, x: u.x, y: u.y, t: 0 };
  u.alvoManual = null; u.target = null; u.ordem = null; u.encomenda = null; u.npcAlvo = null; u.goalKey = "";
  const n = chamaGrupo(u);
  avisoDe(u, (motivo || "Poção acabou") + (trava ? " · com trava de PZ: me afastando da briga" : " · indo à cidade") + (n ? " · o grupo vem junto" : ""), "#e0bd63");
}
function vaiComprar(m: Unit) {
  const w = m.w;
  if (!w) return;
  w.goal = "cidade"; w.etapa = 0; w.pronto = false; w.compraLider = true; w.t = 0;
  m.alvoManual = null; m.think = 0;
}
function chamaGrupo(u: Unit) {
  const p = u.party;
  if (!p || p.lider !== u) return 0;
  let n = 0;
  for (const m of p.membros) {
    if (m === u || m.dead || !m.w) continue;
    if (!(m.w.compraLider && !m.w.pronto)) vaiComprar(m);
    n++;
  }
  return n;
}
function grupoComprando(u: Unit) {
  const p = u.party;
  if (!p || p.lider !== u) return false;
  for (const m of p.membros) if (m !== u && !m.dead && m.w && m.w.compraLider && !m.w.pronto) return true;
  return false;
}
function compraDoGrupo(u: Unit, sq: Squad) {
  const w = u.w;
  if (!w) return false;
  if (!w.compraLider && !u.pz && semFrasco(u) && saldo(u) >= PRECO_POCAO * 8) vaiComprar(u);
  if (!w.compraLider) return false;
  if (!w.pronto) { worldThink(u, sq); return true; }
  const c = G.ctrl;
  const r = c && !c.dead ? c.refil : null;
  if (r && r.fase !== "voltar" && u.pz) {
    u.target = null;
    if (dist(u.x, u.y, w.dx, w.dy) > 1.2) { setState(u, ST.REGROUP); goTo(u, w.dx, w.dy, "w" + u.id); }
    else { u.path = null; u.goal = null; setState(u, ST.HEAL); }
    return true;
  }
  w.compraLider = false; w.goal = "caça"; w.reencontro = W.simTime + 90;
  return false;
}
function balcaoRefil(u: Unit, id: string) {
  const R = G.AUTO.refil;
  if (id === "comerciante") {
    if (R.vender) {
      let v = 0, k = 0;
      for (let i = 0; i < u.mochila.length; i++) { const it = u.mochila[i]; if (it && !ehPocao(it) && !mantem(u, it)) { v += venderItem(u, i); k++; } }
      if (k) { avisoDe(u, "Vendeu " + k + (k > 1 ? " itens" : " item") + " · +" + v.toLocaleString("pt-BR") + " de ouro", "#f2c53d"); fx({ t: "coins", u, v }); }
    }
    if (R.comprar && G.AUTO.equip) {
      const k = comprarMelhorias(u, reservaRefil(u));
      if (k) avisoDe(u, k + (k > 1 ? " itens melhores vestidos" : " item melhor vestido"), "#8fe6a8");
    }
  } else if (id === "feiticeiro") {
    const hp = R.hp > u.potHp ? comprarPocoes(u, "hp", R.hp - u.potHp) : 0;
    const mp = u.maxMp > 0 && R.mp > u.potMp ? comprarPocoes(u, "mp", R.mp - u.potMp) : 0;
    if (hp || mp) avisoDe(u, "Poções: +" + hp + " vida · +" + mp + " mana", "#8fe6a8");
    else if (saldo(u) < PRECO_POCAO) avisoDe(u, "Sem ouro para poções", "#e0b93a");
  } else {
    const g = guardarNoCofre(u), o = depositarOuro(u, u.ouro);
    if (g || o) avisoDe(u, "Banco: " + (o ? "+" + o.toLocaleString("pt-BR") + " de ouro" : "") + (g ? (o ? " · " : "") + g + (g > 1 ? " itens guardados" : " item guardado") : ""), "#f2c53d");
  }
}
function passoRefil(u: Unit) {
  const r = u.refil!;
  u.target = null;
  if (r.fase === "isolar") {
    if (pzAtiva(u)) {
      let perto: Unit | null = null, pd = 1e9;
      const m = queryRadius(u.x, u.y, 9);
      for (let i = 0; i < m; i++) {
        const e = QBUF[i];
        if (e === u || e.dead) continue;
        if (!inimigo(u, e) && !(e.beast && odeia(e, u))) continue;
        const d = dist2(u.x, u.y, e.x, e.y);
        if (d < pd) { pd = d; perto = e; }
      }
      if (perto) {
        const fx0 = u.x - perto.x, fy0 = u.y - perto.y, l = Math.hypot(fx0, fy0) || 1;
        setState(u, ST.RETREAT);
        goTo(u, clamp(u.x + fx0 / l * 8, 2, W.N - 2), clamp(u.y + fy0 / l * 8, 2, W.N - 2), "isolar");
      } else { u.path = null; u.goal = null; setState(u, ST.HEAL); }
      return;
    }
    r.fase = "rota";
    avisoDe(u, "Trava livre · indo à cidade", "#e0bd63");
  }
  if (r.fase === "rota") {
    while (r.i < r.rota.length) {
      const id = r.rota[r.i], n = npcDe(id);
      if (dist(u.x, u.y, n.x, n.y) > NPC_ALCANCE) { setState(u, ST.ADVANCE); goTo(u, n.x, n.y, "refil" + r.i); return; }
      balcaoRefil(u, id); r.i++;
    }
    r.fase = "esperar"; r.t = W.simTime + REFIL_ESPERA;
  }
  if (r.fase === "esperar") {
    if (W.simTime < r.t && grupoComprando(u)) { u.path = null; u.goal = null; setState(u, ST.HEAL); return; }
    r.fase = "voltar";
    if (u.party && u.party.lider === u && vivos(u) > 1) avisoDe(u, "Grupo pronto · de volta à caça", "#8fe6a8");
  }
  if (dist(u.x, u.y, r.x, r.y) < 1.6) { u.refil = null; u.path = null; avisoDe(u, "De volta à caça", "#8fe6a8"); return; }
  setState(u, ST.ADVANCE); goTo(u, r.x, r.y, "volta");
}
function vivos(u: Unit) { let n = 0; if (u.party) for (const m of u.party.membros) if (!m.dead) n++; return n; }
export const REFIL_TXT: Record<string, string> = { comerciante: "no Comerciante", feiticeiro: "comprando poções", banqueiro: "no banco" };

export function ctrlThink(u: Unit, sq: Squad) {
  autoCuraPasso(u);
  const motivo = (!u.refil && G.AUTO.refil.ligado && !u.pz && !refilSuspenso(u)) ? precisaRefil(u) : "";
  if (motivo) {
    if (motivo !== "Poção acabou" || saldo(u) >= PRECO_POCAO) iniciaRefil(u, motivo);
    else if (W.simTime > (u.refilAvisoT || 0)) { u.refilAvisoT = W.simTime + 30; avisoDe(u, "Poção acabou e não há ouro para repor", "#e0b93a"); }
  }
  if (u.refil) { passoRefil(u); return; }
  if (u.npcAlvo) {
    const n = u.npcAlvo;
    if (dist(u.x, u.y, n.x, n.y) <= NPC_ALCANCE) {
      u.npcAlvo = null; u.path = null; u.goal = null; setState(u, ST.ADVANCE); hooks.abrirNpc(n.id); return;
    }
    if (pzAtiva(u) && !u.pz) { u.npcAlvo = null; avisoPz(u); }
    else { u.target = null; setState(u, ST.ADVANCE); goTo(u, n.x, n.y, "npc"); return; }
  }
  if (u.encomenda && tentarEncomenda(u)) { u.target = alvoTravado(u); return; }
  const travado = alvoTravado(u);
  if (travado) {
    u.target = travado;
    if (u.ordem) {
      if (dist(u.x, u.y, u.ordem.x, u.ordem.y) < .8) { u.ordem = null; u.path = null; }
      else { setState(u, ST.ADVANCE); goTo(u, u.ordem.x, u.ordem.y, "ordem"); return; }
    }
    autoEspecial(u);
    aproximarDoAlvo(u, travado, "travado");
    return;
  }
  if (u.alvoManual && (u.alvoManual.dead || !podeAtacarManual(u, u.alvoManual))) u.alvoManual = null;
  if (u.ordem) { u.target = null; playerThink(u); return; }
  if (u.pz) { u.target = null; u.path = null; u.goal = null; setState(u, ST.ADVANCE); return; }
  if (G.AUTO.ataque.modo !== "desligado" || G.AUTO.ataque.revidar) { autoAtaque(u); return; }
  playerThink(u);
}
export function avisoPz(u: Unit) {
  avisoDe(u, "Trava de PZ: a cidade abre em " + Math.ceil(pzRestante(u)) + " s", "#e0b93a");
}

/* ============================================================
   [SYSTEM: LIDER] o grupo segue quem está no comando: cavaleiros
   à frente, o resto atrás, todos no alvo do líder
   ============================================================ */
const LIDER_FRENTE = 2.6, LIDER_ATRAS = 3.0, LIDER_LONGE = 26, LIDER_COLEIRA = 7.5;
export function lideraSobre(u: Unit) {
  const c = G.ctrl;
  if (!c || u === c || u.beast || u.dead) return false;
  if (W.worldLivre) return !!c.party && u.party === c.party;
  return u.team === c.team;
}
export function seguirLider(u: Unit, sq: Squad) {
  const L = G.ctrl!;
  autoCuraPasso(u);
  if (compraDoGrupo(u, sq)) return;
  if (dist(u.x, u.y, L.x, L.y) > LIDER_LONGE && !(u.w && (u.w.reencontro || 0) > W.simTime)) { worldThink(u, sq); return; }
  perceber(u, sq);
  const alvo = L.target && !L.target.dead && podeAtacarManual(u, L.target) ? L.target : null;
  u.alvoManual = alvo; u.target = alvo;
  if (alvo) {
    autoEspecial(u);
    if (!u.isKnight && dist(u.x, u.y, L.x, L.y) > LIDER_COLEIRA) {
      if (dist(u.x, u.y, alvo.x, alvo.y) <= u.K.range * .95 && losU(u, alvo)) { setState(u, ST.ENGAGE); u.path = null; return; }
      const dx = alvo.x - L.x, dy = alvo.y - L.y, l = Math.hypot(dx, dy) || 1;
      const r = Math.min(LIDER_COLEIRA * .8, distDeTiro(u));
      setState(u, ST.ADVANCE); goTo(u, L.x + dx / l * r, L.y + dy / l * r, "lider");
      return;
    }
    aproximarDoAlvo(u, alvo, "lider");
    return;
  }
  const fa = L.fa;
  const fx0 = Math.cos(fa), fy0 = Math.sin(fa);
  const lado = ((u.id % 5) - 2) * 1.15;
  const r = u.isKnight ? LIDER_FRENTE : LIDER_ATRAS;
  const s = u.isKnight ? 1 : -1;
  const px = L.x + fx0 * r * s - fy0 * lado, py = L.y + fy0 * r * s + fx0 * lado;
  setState(u, dist(u.x, u.y, px, py) > 1.4 ? ST.ADVANCE : ST.REGROUP);
  goTo(u, px, py, "posto");
}
function playerThink(u: Unit) {
  const t = u.target;
  if (t && !t.dead && podeAtacarManual(u, t)) {
    const d = dist(u.x, u.y, t.x, t.y);
    if (d <= u.K.range * .92 && losU(u, t)) { setState(u, ST.ENGAGE); u.path = null; }
    else { setState(u, ST.ADVANCE); goTo(u, t.x, t.y, "ordem"); }
    return;
  }
  u.target = null;
  if (u.ordem) {
    if (dist(u.x, u.y, u.ordem.x, u.ordem.y) < .8) { u.ordem = null; u.path = null; }
    else { setState(u, ST.ADVANCE); goTo(u, u.ordem.x, u.ordem.y, "ordem"); return; }
  }
  u.path = null; u.goal = null; u.target = null;
  setState(u, ST.ADVANCE);
}

/* O botão grande: o inimigo mais próximo que o modo permita */
export function alvoMaisProximo(u: Unit) {
  let melhor: Unit | null = null, ms = -1e9;
  const m = queryRadius(u.x, u.y, Math.max(u.K.sight + 4, 10));
  const filtra = G.AUTO.ataque.modo !== "desligado";
  const lista: Unit[] = [];
  for (let i = 0; i < m; i++) lista.push(QBUF[i]);
  for (const e of lista) {
    if (!podeAtacarManual(u, e) || !losU(u, e)) continue;
    if (filtra && !valeAuto(u, e)) continue;
    if (e.beast && !e.K.aggro && !odeia(e, u)) continue;
    const d2 = dist2(u.x, u.y, e.x, e.y);
    const s = filtra ? notaPresa(u, e, d2) : -d2;
    if (s > ms) { ms = s; melhor = e; }
  }
  return melhor;
}
export type { SpellKey };
