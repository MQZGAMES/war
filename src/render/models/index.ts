/* Catálogo de modelos com cache: a espécie monta uma vez; o herói monta
   por cor e pelo nível do que veste (o metal muda com o equipamento). */
import type { Unit } from "../../sim/types";
import { modeloHeroi, modeloMonstroHumano, modeloNpc, type EquipVisual } from "./humanos";
import { modeloAranha, modeloDragao, modeloGalinha, modeloQuad } from "./bichos";
import { modeloCobra, modeloEscorpiao, modeloHidra } from "./bestiario";
import type { ModeloBase } from "./rig";

const cache = new Map<string, ModeloBase>();
export function equipVisual(u: Unit): EquipVisual {
  const e = u.eqp;
  return { arma: e.arma ? e.arma.k : 1, armadura: e.arm ? e.arm.k : 1, cabeca: e.cab ? e.cab.k : 1, escudo: e.esc ? e.esc.k : 0 };
}
const faixa = (k: number) => (k >= 9 ? 3 : k >= 7 ? 2 : k >= 4 ? 1 : 0);
export function chaveModelo(u: Unit) {
  if (u.beast) return u.kind;
  const q = equipVisual(u);
  return u.kind + "|" + u.cor.c + "|" + faixa(q.arma) + faixa(q.armadura) + faixa(q.cabeca) + (q.escudo ? faixa(q.escudo) + 1 : 0);
}
export function modeloDe(u: Unit): ModeloBase {
  const k = chaveModelo(u);
  let m = cache.get(k);
  if (m) return m;
  if (!u.beast) m = modeloHeroi(u.kind, u.cor, equipVisual(u));
  else if (u.kind === "hen") m = modeloGalinha();
  else if (u.kind === "spider") m = modeloAranha();
  else if (u.kind === "dragon") m = modeloDragao();
  else if (u.kind === "snake") m = modeloCobra();
  else if (u.kind === "scorpion") m = modeloEscorpiao();
  else if (u.kind === "hydra") m = modeloHidra();
  else if (["orc", "troll", "minotaur", "cyclops", "demon", "skeleton", "vampire", "behemoth"].includes(u.kind)) m = modeloMonstroHumano(u.kind);
  else m = modeloQuad(u.kind);
  cache.set(k, m);
  /* o cache de heróis não cresce sem fim: cores e níveis mudam */
  if (cache.size > 160) { for (const kk of cache.keys()) { if (kk.includes("|") && !kk.startsWith("npc") && !kk.startsWith("vit")) { cache.delete(kk); break; } } }
  return m;
}
export function modeloDoNpc(id: string, cor: { c: string; lo: string; hi: string }) {
  const k = "npc|" + id;
  let m = cache.get(k);
  if (!m) { m = modeloNpc(id, cor); cache.set(k, m); }
  return m;
}
/* retrato e cartas de vocação usam um herói de vitrine */
export function modeloVitrine(kind: string, cor: { c: string; lo: string; hi: string }) {
  const k = "vit|" + kind + "|" + cor.c;
  let m = cache.get(k);
  if (!m) { m = modeloHeroi(kind, cor, { arma: 1, armadura: 1, cabeca: 1, escudo: kind === "knight" ? 1 : 0 }); cache.set(k, m); }
  return m;
}
