/* Atributos derivados: vida, mana, dano, acerto, defesa, regeneração.
   Build (1 ponto por nível) + equipamento, com tetos separados. */
import { ACERTO_BASE, ACERTO_DEX, ACERTO_MAX, CURA_FRAC, DEF_MAX, GEAR_DEF_MAX, MAG_CURA, MAG_DANO, PONTO, REGEN_PONTO, VIDA_NIVEL, PLANOS, type AttrKey, type VocKey } from "./data";
import { BASES, SLOTS, type StatKey } from "./itemsData";
import { rnd } from "./rng";
import type { Item, Unit } from "./types";

export function itemStat(it: Item, s: StatKey) {
  const v = BASES[it.b].st[s];
  return v ? Math.max(1, Math.round(v * it.k)) : 0;
}

const GS: Record<StatKey, number> = { str: 0, dex: 0, def: 0, mag: 0, hp: 0, mp: 0, spd: 0 };
export function somaGear(u: Unit) {
  for (const k in GS) GS[k as StatKey] = 0;
  const e = u.eqp;
  if (!e) return GS;
  for (const s of SLOTS) {
    const it = e[s];
    if (!it) continue;
    const st = BASES[it.b].st;
    for (const k in st) GS[k as StatKey] += itemStat(it, k as StatKey);
  }
  return GS;
}

function pv(tab: Record<string, number>, kind: string) { return tab[kind] || 0; }

export function recalcular(u: Unit, ganhaVida?: boolean) {
  const K = u.K, a = u.attr, g = somaGear(u);
  const hpAntes = u.maxHp, mpAntes = u.maxMp;
  u.maxHp = K.hp + (u.lvl - 1) * (VIDA_NIVEL[u.kind as VocKey] || 0) + a.hp * pv(PONTO.hp, u.kind) + g.hp;
  u.maxMp = K.mp + a.mp * pv(PONTO.mp, u.kind) + g.mp;
  u.bonus = (a.str + g.str) * pv(PONTO.str, u.kind);
  u.defesa = Math.min(DEF_MAX, a.def * pv(PONTO.def, u.kind)) + Math.min(GEAR_DEF_MAX, g.def * pv(PONTO.def, u.kind));
  u.magic = a.mag + g.mag;
  u.acerto = Math.min(ACERTO_MAX, ACERTO_BASE + (a.dex + g.dex) * ACERTO_DEX);
  u.velo = 1 + Math.min(.3, g.spd / 100);
  u.regHp = a.hp * REGEN_PONTO.hp; u.regMp = a.mp * REGEN_PONTO.mp;
  if (ganhaVida) { u.hp += Math.max(0, u.maxHp - hpAntes); u.mp += Math.max(0, u.maxMp - mpAntes); }
  u.hp = Math.min(u.hp, u.maxHp); u.mp = Math.min(u.mp, u.maxMp);
}
export function zerarBuild(u: Unit) {
  u.attr = { str: 0, dex: 0, def: 0, mag: 0, hp: 0, mp: 0 };
  u.pts = u.lvl - 1;
  recalcular(u);
}
export const dmgFis = (u: Unit) => u.K.dmg + u.bonus;
export const dmgMag = (u: Unit) => u.K.dmg + u.magic * MAG_DANO;
export const curaDe = (u: Unit) => u.maxHp * (CURA_FRAC + u.magic * MAG_CURA);

export function sorteiaPlano(kind: VocKey) { const L = PLANOS[kind]; return L[Math.floor(rnd() * L.length)]; }
export function pontoDoPlano(u: Unit): AttrKey {
  const w = u.plano!.w; let tot = 0;
  for (const k in w) tot += w[k as AttrKey]!;
  let r = rnd() * tot;
  for (const k in w) { r -= w[k as AttrKey]!; if (r <= 0) return k as AttrKey; }
  return "hp";
}
/* o atributo mais atrasado em relação à proporção guardada ao largar o comando */
export function pontoProporcional(u: Unit): AttrKey {
  const P = u.proporcao || u.attr, a = u.attr;
  let tp = 0, ta = 0;
  for (const k in P) { tp += P[k as AttrKey]; ta += a[k as AttrKey]; }
  if (tp <= 0) return pontoDoPlano(u);
  let melhor: AttrKey = "hp", bd = -1e9;
  for (const k in P) {
    const kk = k as AttrKey;
    if (!P[kk]) continue;
    const d = P[kk] / tp - (a[kk] + 1) / (ta + 1);
    if (d > bd) { bd = d; melhor = kk; }
  }
  return melhor;
}

/* [SYSTEM: AI_POWER] poder de combate real */
export function poder(u: Unit) {
  const K = u.K;
  const dps = (K.dmg + (u.bonus || 0) + (u.magic || 0) * MAG_DANO) / K.cd;
  const rec = u.maxMp ? Math.min(1, u.mp / Math.max(1, u.maxMp)) * .35 : 0;
  return u.hp * (1 + rec) + dps * 7 + K.range * 3.5;
}
