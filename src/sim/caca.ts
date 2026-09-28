/* ================================================================
   [SYSTEM: CACA_RENDE] quanto um ponto de caça rende para quem vai
   caçar lá: experiência e moedas por minuto, com o risco e a viagem
   na conta. É a conta do "power level" (não importa a criatura,
   importa subir rápido) e também a do acumulador (importa a moeda).
   ================================================================ */
import { KINDS, type KindKey } from "./data";
import { fatorXp, MOEDA_BICHO, XP_MUNDO } from "./combat";
import { dist } from "./rng";
import { W } from "./state";
import { dmgFis, dmgMag } from "./stats";
import type { Unit, Zona } from "./types";

/* o grupo (ou o aventureiro sozinho) visto como uma força só */
export interface Forca { lvl: number; dps: number; hp: number; def: number; n: number; x: number; y: number; vel: number }
const F: Forca = { lvl: 1, dps: 1, hp: 1, def: 0, n: 1, x: 0, y: 0, vel: 2 };
export function forcaDe(ms: Unit[]): Forca {
  let lvl = 0, dps = 0, soma = 0, maior = 0, def = 0, n = 0, x = 0, y = 0, vel = 9;
  for (const u of ms) {
    if (u.dead || u.beast) continue;
    const magico = u.kind === "mage" || u.kind === "druid";
    /* magias somam uns 30% ao ataque básico ao longo da caçada */
    dps += (magico ? dmgMag(u) : dmgFis(u)) * u.acerto / u.K.cd * 1.3;
    /* poção na mochila é vida extra: cada uma cura perto de 30% */
    const hp = u.maxHp * (1 + Math.min(u.potHp, 25) * .06);
    soma += hp; maior = Math.max(maior, hp);
    def += u.defesa; lvl += u.lvl; x += u.x; y += u.y; n++;
    vel = Math.min(vel, u.K.spd * u.velo);
  }
  if (!n) { F.n = 1; F.lvl = 1; F.dps = 1; F.hp = 1; F.def = 0; return F; }
  /* a criatura bate em um de cada vez: o que aguenta é o mais forte do
     grupo, com uma parte do resto (cura, troca de alvo) */
  F.n = n; F.lvl = lvl / n; F.dps = dps; F.hp = maior + (soma - maior) * .3; F.def = def / n; F.x = x / n; F.y = y / n; F.vel = vel;
  return F;
}

export interface Rende { xp: number; ouro: number; risco: number }
const R: Rende = { xp: 0, ouro: 0, risco: 0 };
/* uma espécie: tempo para matar, dano levado no caminho e o que sobra
   por minuto para cada membro */
function rendeEspecie(k: KindKey, f: Forca) {
  const K = KINDS[k];
  const nv = K.nv || [K.lvlM || 1, K.lvlM || 1];
  const lv = (nv[0] + nv[1]) / 2, g = 1.3;
  const tMata = K.hp * g / Math.max(1, f.dps * (1 - K.armor));
  /* bicho de bando chega junto: o dano que entra é maior */
  const bando = K.matilha ? 1.8 : 1.25;
  const dpsB = (K.dmg * g) / K.cd * .85 * (1 - f.def) * bando;
  const dano = dpsB * tMata;
  const risco = dano / Math.max(1, f.hp);
  const xp = (K.xpVal || 0) * g * fatorXp(f.lvl, lv) * XP_MUNDO / f.n;
  const ouro = (K.xpVal || 0) * g * MOEDA_BICHO * (K.ouro || 1) / f.n;
  /* um ciclo: matar, andar até o próximo e respirar o que doeu */
  const ciclo = tMata + 3.5 + Math.min(20, risco * 14);
  return { xp: xp / ciclo * 60, ouro: ouro / ciclo * 60, risco };
}
export function rendeZona(z: Zona, f: Forca): Rende {
  let xp = 0, ouro = 0, risco = 0, peso = 0;
  for (const k in z.sp) {
    const w = z.sp[k];
    const e = rendeEspecie(k as KindKey, f);
    xp += e.xp * w; ouro += e.ouro * w; risco = Math.max(risco, e.risco); peso += w;
  }
  if (!peso) { R.xp = R.ouro = R.risco = 0; return R; }
  xp /= peso; ouro /= peso;
  /* ponto esvaziado ou cheio de gente rende menos */
  const cheio = z.alvoPop ? Math.max(.3, Math.min(1, z.pop / z.alvoPop)) : .6;
  const lota = 1 / (1 + z.grupos * .55);
  /* a viagem pesa contra: uns 2,5 min de caçada por ida */
  const viagem = dist(f.x, f.y, z.x, z.y) / Math.max(1, f.vel);
  const fica = 150 / (150 + viagem);
  R.xp = xp * cheio * lota * fica;
  R.ouro = ouro * cheio * lota * fica;
  R.risco = risco;
  return R;
}
/* a nota do ponto para cada gosto: "xp" sobe rápido, "ouro" junta
   moeda; `ousadia` alarga o risco aceito (1 = o normal) */
export function notaZona(z: Zona, f: Forca, foco: "xp" | "ouro" | "misto", ousadia = 1) {
  const r = rendeZona(z, f);
  /* risco = dano levado por morte / (vida + poções): até 35% é caça
     tranquila; perto de 80% cada criatura custa poção demais */
  const teto = .35 * ousadia, limite = .8 * ousadia;
  if (r.risco > limite) return -1e6 + r.xp;
  let v = foco === "xp" ? r.xp : foco === "ouro" ? r.ouro * .5 + r.xp * .15 : r.xp * .7 + r.ouro * .2;
  if (r.risco > teto) v *= Math.max(.15, 1 - (r.risco - teto) / (limite - teto) * .85);
  return v;
}
/* o melhor ponto para essa força; `evitar` perde a vez (acabou de sair) */
export function melhorZona(f: Forca, foco: "xp" | "ouro" | "misto" = "xp", ousadia = 1, evitar: Zona | null = null) {
  let melhor: Zona | null = null, bs = -1e9;
  for (const z of W.zones) {
    if (z.errante) continue;
    let s = notaZona(z, f, foco, ousadia);
    if (z === evitar) s *= .4;
    if (s > bs) { bs = s; melhor = z; }
  }
  return melhor;
}
