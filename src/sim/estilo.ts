/* ================================================================
   [SYSTEM: AI_ESTILO] a personalidade de cada aventureiro da IA: o
   jeito de jogar, escondido do jogador e nunca fixo. Ela puxa os
   traços que o resto da IA já usa (social, ousadia, ganância, sede
   de PK), escolhe o ponto de caça pelo gosto (subir rápido, juntar
   moeda, arriscar, jogar seguro) e muda com o que acontece: quem
   morre muito fica cauteloso ou procura grupo, quem enriquece vai ao
   Ferreiro, quem fica para trás corre atrás de nível.
   ================================================================ */
import type { AtqModo, VocKey } from "./data";
import { planoPorDefesa } from "./stats";
import { saldo } from "./items";
import { clamp, rnd, rr } from "./rng";
import { G, W } from "./state";
import type { Unit, WorldMind } from "./types";

export type Estilo = "grupo" | "solitario" | "ousado" | "cauteloso" | "powerlevel" | "acumulador"
  | "equipador" | "pkSolo" | "pkGrupo" | "justiceiro" | "nomade" | "campista";
export interface EstiloDef {
  n: string; peso: number;
  social: number; ousadia: number; ganancia: number; pk: number;
  /* como escolhe o ponto: pela faixa de sempre, por xp, por moeda */
  foco: "faixa" | "xp" | "ouro" | "misto";
  /* risco aceito na conta do rendimento (1 = o normal) */
  risco: number;
  /* perfil de ataque que prefere */
  perfil: AtqModo;
  /* teto da forja; quanto do ouro livre topa gastar em equipamento */
  forja: number; gasto: number;
  /* estoque de poções em relação ao normal; tempo no mesmo ponto */
  pocao: number; fica: number;
  tatica?: string;
}
export const ESTILOS: Record<Estilo, EstiloDef> = {
  grupo: { n: "gosta de grupo", peso: 14, social: .92, ousadia: 1.0, ganancia: .9, pk: .12, foco: "misto", risco: 1.1, perfil: "criaturas", forja: 7, gasto: .8, pocao: 1, fica: 1.1, tatica: "campistas" },
  solitario: { n: "caça sozinho", peso: 9, social: .08, ousadia: 1.05, ganancia: 1.0, pk: .3, foco: "misto", risco: .9, perfil: "criaturas", forja: 7, gasto: .8, pocao: 1.1, fica: 1 },
  ousado: { n: "arrisca criatura forte", peso: 8, social: .5, ousadia: 1.35, ganancia: 1.1, pk: .45, foco: "xp", risco: 1.55, perfil: "criaturas", forja: 8, gasto: .9, pocao: 1.2, fica: .9 },
  cauteloso: { n: "joga seguro", peso: 9, social: .6, ousadia: .75, ganancia: .8, pk: .05, foco: "misto", risco: .65, perfil: "criaturas", forja: 6, gasto: .7, pocao: 1.4, fica: 1.2 },
  powerlevel: { n: "power level", peso: 12, social: .55, ousadia: 1.1, ganancia: .6, pk: .1, foco: "xp", risco: 1.15, perfil: "criaturas", forja: 6, gasto: .5, pocao: 1.1, fica: .8, tatica: "cacadores" },
  acumulador: { n: "junta dinheiro", peso: 8, social: .4, ousadia: .95, ganancia: .55, pk: .25, foco: "ouro", risco: .95, perfil: "criaturas", forja: 5, gasto: .25, pocao: .8, fica: 1.2 },
  equipador: { n: "foca no equipamento", peso: 9, social: .5, ousadia: 1.05, ganancia: 1.45, pk: .2, foco: "ouro", risco: 1.0, perfil: "criaturas", forja: 10, gasto: 1, pocao: 1, fica: 1 },
  pkSolo: { n: "PK sozinho", peso: 4, social: .1, ousadia: 1.3, ganancia: 1.3, pk: .93, foco: "faixa", risco: 1.2, perfil: "maldoso", forja: 8, gasto: .9, pocao: 1.3, fica: .7 },
  pkGrupo: { n: "PK em grupo", peso: 4, social: .95, ousadia: 1.2, ganancia: 1.2, pk: .8, foco: "faixa", risco: 1.2, perfil: "maldoso", forja: 8, gasto: .9, pocao: 1.3, fica: .8, tatica: "assassinos" },
  justiceiro: { n: "caça caveira", peso: 6, social: .6, ousadia: 1.2, ganancia: 1.0, pk: .3, foco: "faixa", risco: 1.1, perfil: "justiceiro", forja: 8, gasto: .9, pocao: 1.2, fica: 1, tatica: "justiceiros" },
  nomade: { n: "explorador", peso: 7, social: .45, ousadia: 1.2, ganancia: 1.0, pk: .35, foco: "misto", risco: 1.1, perfil: "criaturas", forja: 7, gasto: .8, pocao: 1, fica: .5, tatica: "nomades" },
  campista: { n: "fica no mesmo ponto", peso: 7, social: .7, ousadia: .95, ganancia: .9, pk: .15, foco: "faixa", risco: 1.0, perfil: "criaturas", forja: 7, gasto: .8, pocao: 1.1, fica: 1.8, tatica: "campistas" },
};
const LISTA = Object.keys(ESTILOS) as Estilo[];
export const estiloDe = (w: WorldMind | null) => ESTILOS[(w && w.estilo) || "grupo"];

function sortear(pesos: Partial<Record<Estilo, number>> = {}) {
  let soma = 0;
  for (const e of LISTA) soma += ESTILOS[e].peso * (pesos[e] ?? 1);
  let r = rnd() * soma;
  for (const e of LISTA) { r -= ESTILOS[e].peso * (pesos[e] ?? 1); if (r <= 0) return e; }
  return "grupo" as Estilo;
}
/* traços puxados para o estilo, com um pouco de cada um */
export function aplicarEstilo(u: Unit, e: Estilo, primeira = false) {
  const w = u.w!, D = ESTILOS[e];
  const k = primeira ? 1 : .75;
  w.estilo = e;
  w.social = clamp(w.social + (D.social + rr(-.08, .08) - w.social) * k, .02, 1);
  w.ousadia = clamp(w.ousadia + (D.ousadia + rr(-.08, .08) - w.ousadia) * k, .6, 1.5);
  w.ganancia = clamp(w.ganancia + (D.ganancia + rr(-.1, .1) - w.ganancia) * k, .4, 1.6);
  w.pk = clamp(w.pk + (D.pk + rr(-.05, .05) - w.pk) * k, 0, 1);
  w.estiloT = W.simTime + rr(240, 600);
  w.perfilT = Math.min(w.perfilT, W.simTime + rr(2, 8));
  /* sem build à mão, os próximos pontos seguem o gosto: o cauteloso
     puxa vida e defesa; o ousado, o power level e o PK puxam ataque */
  if (!u.manual && !u.beast && rnd() < .6) {
    if (e === "cauteloso" || e === "grupo") u.plano = planoPorDefesa(u.kind as VocKey, true);
    else if (e === "ousado" || e === "powerlevel" || e === "pkSolo" || e === "pkGrupo") u.plano = planoPorDefesa(u.kind as VocKey, false);
  }
}
export function estiloInicial(u: Unit) {
  aplicarEstilo(u, sortear(), true);
}
/* de tempos em tempos a personalidade se refaz pelo que aconteceu */
let mediaNivel = 1, mediaT = -1;
function nivelMedio() {
  if (W.simTime - mediaT < 20) return mediaNivel;
  mediaT = W.simTime;
  let s = 0, n = 0;
  for (const o of W.units) if (!o.beast) { s += o.lvl; n++; }
  return mediaNivel = n ? s / n : 1;
}
export function reavaliarEstilo(u: Unit) {
  const w = u.w;
  if (!w || u === G.ctrl || u.dead || W.simTime < (w.estiloT || 0)) return;
  const antes = w.estilo;
  const P: Partial<Record<Estilo, number>> = {};
  /* quem gosta do próprio jeito tende a continuar nele (troca, em média,
     a cada 15 min, a não ser que algo empurre) */
  if (antes) P[antes] = 12;
  const mortes = w.mortes || 0;
  if (mortes >= 2) { P.cauteloso = 7; P.grupo = 5; P.ousado = .2; P.pkSolo = .3; }
  if (u.skull === "red") { P.pkSolo = 6; P.pkGrupo = 3; P.justiceiro = 0; }
  const pkAgora = u.pkKills || 0;
  if (pkAgora > (w.pkVisto || 0)) { P.pkSolo = (P.pkSolo || 1) * 2.5; P.pkGrupo = (P.pkGrupo || 1) * 2.5; }
  w.pkVisto = pkAgora;
  if (u.lvl < nivelMedio() - 4) { P.powerlevel = 6; P.grupo = (P.grupo || 1) * 2; }
  if (saldo(u) > 2500 + u.lvl * 300) { P.equipador = 5; P.acumulador = 2; }
  if (u.lvl <= 3) { P.pkSolo = 0; P.pkGrupo = 0; P.justiceiro = .3; }
  const novo = sortear(P);
  if (novo !== antes) aplicarEstilo(u, novo);
  else w.estiloT = W.simTime + rr(240, 600);
}
export function notarMorte(u: Unit) { if (u.w) u.w.mortes = (u.w.mortes || 0) + 1; }
