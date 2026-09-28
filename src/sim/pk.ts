/* ================================================================
   [SYSTEM: WORLD_PZ] Trava de PZ e [SYSTEM: CAVEIRA] caveiras.
     · a trava nasce só de agressão: bater em quem não te atacou.
       Criatura e revide não criam trava;
     · com trava ativa, QUALQUER golpe dado ou recebido renova 30 s;
     · matar por agressão (ou de forma injusta) trava 2 min;
     · com trava a cidade fecha e nenhum NPC atende.
   Caveiras: branca = a própria trava; vermelha = 3 mortes injustas em
   1 h de relógio real; amarela = quem ataca alguém de caveira sem ter
   apanhado dele, visível só para a vítima.
   ================================================================ */
import { EXA, HORA_MS, PZ_LUTA, PZ_MORTE, REVIDE, VERMELHA_N } from "./data";
import { avisoDe } from "./fx";
import { W } from "./state";
import type { Unit } from "./types";

export function pzRestante(u: Unit) {
  const luta = Math.max(0, u.pzLuta + PZ_LUTA - W.simTime);
  const morte = Math.max(0, (u.pzMorte || 0) - W.simTime);
  return Math.max(luta, morte);
}
export const pzAtiva = (u: Unit) => pzRestante(u) > 0;
export const pzMorte = (u: Unit) => (u.pzMorte || 0) > W.simTime;
export function travaLuta(u: Unit) { if (!u.beast) u.pzLuta = W.simTime; }
export function travaMorte(u: Unit) { if (!u.beast) u.pzMorte = W.simTime + PZ_MORTE; }
export function renovaTrava(u: Unit | null) { if (u && !u.beast && !u.dead && pzAtiva(u)) u.pzLuta = W.simTime; }
export function agrediu(a: Unit, b: Unit) {
  const m = a.agrediu;
  if (!m) return false;
  const t = m[b.id];
  return t !== undefined && W.simTime - t < REVIDE;
}

export function amareloPara(v: Unit, a: Unit) {
  const m = v.amarela;
  if (!m || !m[a.id]) return false;
  if (a.dead || v.dead || !pzAtiva(a)) { delete m[a.id]; return false; }
  return true;
}
export function esquecerAmarelas(u: Unit) {
  u.amarela = null; u.agrediu = null;
  for (const o of W.units) if (o.amarela && o.amarela[u.id]) delete o.amarela[u.id];
}
export function caveiraPasso(u: Unit) {
  if (u.skull === "white" && !pzAtiva(u)) { u.skull = null; u.brancaInj = false; }
}
export function caveiraRelogio(u: Unit) {
  const agora = Date.now();
  if (u.injustas > 0 && agora - u.injustaUlt > HORA_MS) u.injustas = 0;
  if (u.skull === "red" && agora >= u.vermelhaAte && !pzAtiva(u)) {
    u.skull = null;
    avisoDe(u, "A caveira vermelha caiu", "#7fd6a0");
  }
}
export function morteInjusta(c: Unit) {
  const agora = Date.now();
  travaMorte(c);
  if (c.injustas > 0 && agora - c.injustaUlt > HORA_MS) c.injustas = 0;
  c.injustas++; c.injustaUlt = agora;
  if (c.skull === "red" || c.injustas >= VERMELHA_N) {
    if (c.skull !== "red") avisoDe(c, "Caveira vermelha: dura 1 h a partir desta morte", "#e2394f");
    c.skull = "red"; c.vermelhaAte = agora + HORA_MS; c.brancaInj = false;
  } else {
    c.skull = "white"; c.brancaInj = true;
    avisoDe(c, "Morte injusta " + c.injustas + "/" + VERMELHA_N + " · caveira branca por 2 min sem lutar", "#f2eee2");
  }
}
/* golpe justo: a vítima já tem caveira, atacou primeiro, ou está de amarela */
export function justo(src: Unit, t: Unit) {
  if (t.skull) return true;
  const q = src.atkBy[t.id];
  if (q !== undefined && W.simTime - q < REVIDE) return true;
  return amareloPara(src, t);
}
/* Todo golpe passa por aqui, acertando ou não. */
export function marcar(src: Unit, t: Unit) {
  renovaTrava(src); renovaTrava(t);
  if (!t.beast) t.atkBy[src.id] = W.simTime;
  if (src.beast || t.beast) return;
  const q = src.atkBy[t.id];
  const revide = (q !== undefined && W.simTime - q < REVIDE) || amareloPara(src, t);
  if (!revide) {
    travaLuta(src);
    (src.agrediu || (src.agrediu = {}))[t.id] = W.simTime;
    if (t.skull) (t.amarela || (t.amarela = {}))[src.id] = true;
  }
  const j = justo(src, t);
  t.pkJust = j;
  if (!j && src.skull !== "red") src.skull = "white";
}

/* Exaustão: guardo o instante em que libera, nada a decrementar */
export function exaustoEm(u: Unit, k: string) { const t = (u.exAte && u.exAte[k]) || 0; return t > W.simTime ? t - W.simTime : 0; }
export function marcaExaustao(u: Unit, k: string) { (u.exAte || (u.exAte = {}))[k] = W.simTime + (EXA[k] || 0); }
