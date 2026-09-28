/* ================================================================
   MAGIA — a IA e os botões do jogador chamam os mesmos lançadores.
   Cada lançador devolve se a magia saiu, para a interface poder
   recusar o toque e a IA tentar outra coisa no mesmo pensamento.
   ================================================================ */
import { ATALHOS, CHUVA_ALCANCE, CHUVA_CURA, CUSTO, ESPECIAL, INVESTIDA_PRESSA, MAG_DANO, MET_ALCANCE, MET_DANO, MET_QUEDA, MET_R, NEVASCA, POCAO, PROVOCA_T, SPELLS, ST, TERREMOTO, TREVAS, type SpellKey, type VocKey } from "./data";
import { fx } from "./fx";
import { tirarPocao } from "./items";
import { los, queryRadius, QBUF } from "./map";
import { exaustoEm, marcaExaustao } from "./pk";
import { inimigo, odiar } from "./relations";
import { dist } from "./rng";
import { W } from "./state";
import { curaDe, dmgFis, dmgMag } from "./stats";
import type { Unit } from "./types";
import { setState } from "./unit";
import { fxCura, golpe, novoMeteoro, presosNaArea, shoot } from "./combat";

export const podeMagia = (u: Unit, k: SpellKey) => exaustoEm(u, k) <= 0 && u.mp >= CUSTO[k];
export function atalhosPadrao(kind: VocKey) { return ATALHOS[kind].slice(); }
export function slotDe(u: Unit, i: number): SpellKey {
  if (!u.slots) u.slots = atalhosPadrao(u.kind as VocKey);
  return u.slots[i];
}
export interface MagiaInfo { chave: SpellKey; nome: string; custo: number; ex: number; mira: boolean; alc: number }
export function magiaDe(u: Unit, chave?: SpellKey): MagiaInfo {
  const k = chave || ESPECIAL[u.kind as VocKey];
  const m = SPELLS[k];
  return { chave: k, nome: m.nome, custo: CUSTO[k], ex: exaustoEm(u, k), mira: m.mira, alc: m.alc || MET_ALCANCE };
}
function marcaCast(u: Unit, k: SpellKey) { u.castT = W.simTime; u.castK = k; fx({ t: "cast", u, k }); }

export function lancarInvestida(u: Unit, minD?: number, maxD?: number) {
  const t = u.target;
  if (!t || t.dead || u.charge > 0 || !podeMagia(u, "investida")) return false;
  const d = dist(u.x, u.y, t.x, t.y);
  if (d < (minD || 1.6) || d > (maxD || 8.5) || !los(u.x, u.y, t.x, t.y)) return false;
  u.mp -= CUSTO.investida; marcaExaustao(u, "investida"); u.charge = .85; u.path = null;
  u.pressa = INVESTIDA_PRESSA;
  u.cvx = (t.x - u.x) / d; u.cvy = (t.y - u.y) / d;
  setState(u, ST.CHARGE);
  marcaCast(u, "investida");
  return true;
}
export function lancarTriplo(u: Unit) {
  const t = u.target;
  if (!t || t.dead || !podeMagia(u, "triplo")) return false;
  if (dist(u.x, u.y, t.x, t.y) > u.K.range || !los(u.x, u.y, t.x, t.y)) return false;
  u.mp -= CUSTO.triplo; marcaExaustao(u, "triplo"); u.tiros = 3; u.tiroT = 0;
  marcaCast(u, "triplo");
  return true;
}
export function lancarCerteiro(u: Unit) {
  const t = u.target;
  if (!t || t.dead || !podeMagia(u, "certeiro")) return false;
  if (dist(u.x, u.y, t.x, t.y) > u.K.range || !los(u.x, u.y, t.x, t.y)) return false;
  u.mp -= CUSTO.certeiro; marcaExaustao(u, "certeiro");
  shoot(u, t, "arrow", dmgFis(u), 0, true);
  u.swing = .26; u.swMax = .26; u.lunge = .12;
  marcaCast(u, "certeiro");
  return true;
}
export function lancarMeteoro(u: Unit, x: number, y: number) {
  if (!podeMagia(u, "meteoro")) return false;
  if (dist(u.x, u.y, x, y) > MET_ALCANCE) return false;
  u.mp -= CUSTO.meteoro; marcaExaustao(u, "meteoro");
  novoMeteoro({ x, y, team: u.team, src: u, t: 0, dur: MET_QUEDA, dano: MET_DANO + u.magic * MAG_DANO * 1.4, alvos: presosNaArea(u, x, y, MET_R) });
  setState(u, ST.METEOR);
  marcaCast(u, "meteoro");
  return true;
}
/* [SYSTEM: PROVOCACAO] o estrondo puxa o ódio de toda a bicharada */
export function provocar(bicho: Unit, quem: Unit, ate: number) {
  if (!bicho.beast || !quem || quem.beast) return;
  odiar(bicho, quem);
  bicho.taunt = quem; bicho.tauntAte = ate;
  bicho.target = quem; bicho.packTgt = quem; bicho.prov = quem;
  bicho.think = Math.min(bicho.think, .05);
}
export function lancarTerremoto(u: Unit) {
  if (!podeMagia(u, "terremoto")) return false;
  u.mp -= CUSTO.terremoto; marcaExaustao(u, "terremoto"); u.lunge = .3;
  const base = dmgFis(u), R = TERREMOTO.raio;
  const ate = W.simTime + PROVOCA_T;
  let puxou = 0;
  const q = queryRadius(u.x, u.y, R);
  /* copia: golpe pode disparar novas consultas no mesmo buffer */
  const alvos: Unit[] = [];
  for (let i = 0; i < q; i++) alvos.push(QBUF[i]);
  for (const e of alvos) {
    if (!inimigo(u, e)) continue;
    const d = dist(u.x, u.y, e.x, e.y);
    golpe(u, e, base * (1 - d / R * .4), false, true);
    if (e.beast && !e.dead) { provocar(e, u, ate); puxou++; }
  }
  marcaCast(u, "terremoto");
  fx({ t: "impact", x: u.x, y: u.y, kind: "terremoto" });
  fx({ t: "crack", x: u.x, y: u.y, r: R });
  if (puxou) fx({ t: "ring", x: u.x, y: u.y, c: "#e0bd63", life: .7, r: R });
  return true;
}
export function lancarTrevas(u: Unit) {
  const t = u.target;
  if (!t || t.dead || !podeMagia(u, "trevas")) return false;
  if (dist(u.x, u.y, t.x, t.y) > u.K.range + 1 || !los(u.x, u.y, t.x, t.y)) return false;
  u.mp -= CUSTO.trevas; marcaExaustao(u, "trevas");
  u.lunge = .2; u.swing = .36; u.swMax = .36;
  marcaCast(u, "trevas");
  shoot(u, t, "dark", TREVAS.dano + u.magic * MAG_DANO * 1.4);
  return true;
}
export function lancarNevasca(u: Unit, x: number, y: number) {
  if (!podeMagia(u, "nevasca")) return false;
  if (dist(u.x, u.y, x, y) > NEVASCA.alcance) return false;
  u.mp -= CUSTO.nevasca; marcaExaustao(u, "nevasca");
  novoMeteoro({ x, y, team: u.team, src: u, t: 0, dur: MET_QUEDA, gelo: 1, dano: dmgMag(u) * NEVASCA.fator, alvos: presosNaArea(u, x, y, NEVASCA.raio) });
  setState(u, ST.METEOR);
  marcaCast(u, "nevasca");
  return true;
}
export function lancarChuva(u: Unit, x: number, y: number) {
  if (!podeMagia(u, "chuva")) return false;
  if (dist(u.x, u.y, x, y) > CHUVA_ALCANCE) return false;
  u.mp -= CUSTO.chuva; marcaExaustao(u, "chuva");
  novoMeteoro({ x, y, team: u.team, src: u, t: 0, dur: MET_QUEDA, cura: 1, dano: u.maxHp * CHUVA_CURA + u.magic * MAG_DANO * 1.4 });
  setState(u, ST.METEOR);
  marcaCast(u, "chuva");
  return true;
}
export function beberPocao(u: Unit, tipo: "hp" | "mp") {
  if (exaustoEm(u, "pocao") > 0) return false;
  if (tipo === "hp") {
    if (u.potHp <= 0 || u.hp >= u.maxHp || !tirarPocao(u, "hp")) return false;
    const antes = u.hp; u.hp = Math.min(u.maxHp, u.hp + POCAO.hp);
    fxCura(u, u.hp - antes);
  } else {
    if (u.potMp <= 0 || u.mp >= u.maxMp || !tirarPocao(u, "mp")) return false;
    u.mp = Math.min(u.maxMp, u.mp + POCAO.mp);
  }
  fx({ t: "potion", u, tipo });
  marcaExaustao(u, "pocao");
  return true;
}
export function lancarCura(u: Unit, exigeFerido?: boolean | number) {
  if (!podeMagia(u, "cura") || (exigeFerido && u.hp >= u.maxHp)) return false;
  u.mp -= CUSTO.cura; marcaExaustao(u, "cura");
  const antes = u.hp; u.hp = Math.min(u.maxHp, u.hp + curaDe(u));
  fxCura(u, u.hp - antes);
  marcaCast(u, "cura");
  setState(u, ST.HEAL);
  return true;
}
/* o lançador genérico de cada chave; mira = ponto no chão */
export function lancar(u: Unit, k: SpellKey, x?: number, y?: number): boolean {
  switch (k) {
    case "investida": return lancarInvestida(u);
    case "triplo": return lancarTriplo(u);
    case "certeiro": return lancarCerteiro(u);
    case "meteoro": return lancarMeteoro(u, x!, y!);
    case "trevas": return lancarTrevas(u);
    case "terremoto": return lancarTerremoto(u);
    case "nevasca": return lancarNevasca(u, x!, y!);
    case "chuva": return lancarChuva(u, x!, y!);
    case "cura": return lancarCura(u, 1);
  }
  return false;
}
