/* ================================================================
   Quem é aliado, quem pode ser atacado e quem é hostil.
   [SYSTEM: WORLD_PARTY] aliado = grupo (cada um por si) ou guilda.
   [SYSTEM: WORLD_PK] hostilidade sob demanda: ninguém nasce inimigo.
   [SYSTEM: AI_PERFIL] os cinco modos de ataque filtram a presa.
   [SYSTEM: AI_ODIO] nenhum bicho ataca de graça: guarda quem bateu.
   [SYSTEM: WORLD_REP] rancor pessoal de quem morreu.
   ================================================================ */
import { REVIDE, type AtqModo } from "./data";
import { avisoDe } from "./fx";
import { G, W } from "./state";
import type { Unit } from "./types";

export const PK_DUR = 26, PARTY_MAX = 4;
export const PACK_ALERTA = 8, PACK_PRAZO = 9, PANICO_R = 4.5;

export function aliado(a: Unit, b: Unit) {
  if (a.beast || b.beast) return false;
  if (a === b) return true;
  if (W.worldLivre) return !!a.party && a.party === b.party;
  return a.team === b.team;
}
export function podeAtacarManual(a: Unit, b: Unit | null): b is Unit {
  if (!b || a === b || b.dead) return false;
  if (a.pz || b.pz) return false;
  if (b.beast || a.beast) return true;
  if (a.party && a.party === b.party) return false;
  return W.worldLivre ? true : a.team !== b.team;
}
export function declararPk(a: Unit, b: Unit) {
  if (!a.w || b.beast || inimigo(a, b)) return;
  a.w.pkT = W.simTime + PK_DUR; a.w.alvoPk = b;
}
export function perfilDe(u: Unit): AtqModo { return u === G.ctrl ? G.AUTO.ataque.modo : (u.w ? u.w.perfil : "justiceiro"); }
export function querAtacar(u: Unit, e: Unit, m: AtqModo) {
  if (e.dead || e === u || e.pz || u.pz) return false;
  if (e.beast) return m === "criaturas" || m === "justiceiro" || m === "todos";
  if (!podeAtacarManual(u, e)) return false;
  if (m === "justiceiro") return !!e.skull;
  if (m === "maldoso") return !e.skull;
  return m === "todos";
}
export function inimigo(a: Unit, b: Unit): boolean {
  if (a === b || a.pz || b.pz) return false;
  /* [SYSTEM: PVP] PvP desligado: quem está no comando não fere
     personagem nenhum (nem com magia de área) */
  if (a === G.ctrl && !b.beast && !G.AUTO.ataque.pvp) return false;
  if (a.beast) return !b.beast;
  if (b.beast) {
    if (a === G.ctrl) return true;
    const m = perfilDe(a);
    if (m === "criaturas" || m === "justiceiro" || m === "todos") return true;
    return odeia(b, a) || (a.ai.mem.lastDmgFrom === b && W.simTime - a.ai.mem.lastDmgT < REVIDE);
  }
  return worldHostil(a, b) || querAtacar(a, b, perfilDe(a));
}
export function guerraAtiva(a: number, b: number) {
  return a !== b && !!W.guerra[a] && W.guerra[a][b] > W.simTime;
}
export function worldHostil(a: Unit, b: Unit) {
  if (a.beast || b.beast) return a.team !== b.team;
  if (a.party && a.party === b.party) return false;
  if (!W.worldLivre && a.team === b.team) return false;
  const ma = a.ai && a.ai.mem, mb = b.ai && b.ai.mem;
  if (ma && ma.lastDmgFrom === b && W.simTime - ma.lastDmgT < REVIDE) return true;
  if (mb && mb.lastDmgFrom === a && W.simTime - mb.lastDmgT < REVIDE) return true;
  if ((b.skull && rancor(a, b) >= RANCOR_HOSTIL) || (a.skull && rancor(b, a) >= RANCOR_HOSTIL)) return true;
  if (a.skull === "red" || b.skull === "red") return true;
  if (guerraAtiva(a.team, b.team)) return true;
  if (pkContra(a, b) || pkContra(b, a)) return true;
  return false;
}
export function pkContra(a: Unit, b: Unit) {
  const w = a.w;
  if (!w || w.pkT <= W.simTime || !w.alvoPk) return false;
  return w.alvoPk === b || (!!b.party && w.alvoPk.party === b.party);
}

/* ---------- ódio da fauna ---------- */
export function odiar(bicho: Unit, quem: Unit | null) {
  if (!bicho.beast || !quem || quem.beast) return;
  (bicho.odio || (bicho.odio = {}))[quem.id] = quem;
  bicho.prov = quem; bicho.packTgt = quem; bicho.packT = W.simTime + PACK_PRAZO;
}
export function odeia(bicho: Unit, quem: Unit) { return !!(bicho.odio && bicho.odio[quem.id]); }
export function esquecerMorto(u: Unit) {
  if (u.beast) { u.odio = null; u.prov = null; u.packTgt = null; u.taunt = null; return; }
  for (const o of W.units) {
    if (!o.beast || !o.odio) continue;
    if (o.odio[u.id]) {
      delete o.odio[u.id];
      if (o.prov === u) o.prov = null;
      if (o.taunt === u) o.taunt = null;
      if (o.packTgt === u) o.packTgt = null;
      if (o.target === u) o.target = null;
    }
  }
}

/* ---------- rancor ---------- */
export const RANCOR_HOSTIL = 3, RANCOR_TTL = 200, RANCOR_MAX = 6;
export function rancor(a: Unit, b: Unit) {
  if (!a.rep) return 0;
  const r = a.rep[b.id];
  if (!r || r.t < W.simTime) return 0;
  return r.v;
}
export function somaRancor(a: Unit, b: Unit, v: number) {
  if (a === b || a.beast || b.beast) return;
  const R = a.rep || (a.rep = {});
  const r = R[b.id] || (R[b.id] = { v: 0, t: 0, nome: b.name });
  if (r.t < W.simTime) r.v = 0;
  r.v += v; r.t = W.simTime + RANCOR_TTL; r.nome = b.name;
  const ks = Object.keys(R);
  if (ks.length > RANCOR_MAX) {
    let pior: string | null = null, pv = 1e9;
    for (const k of ks) { const x = R[+k]; if (x.t < W.simTime || x.v < pv) { pv = x.v; pior = k; } }
    if (pior) delete R[+pior];
  }
}
/* [SYSTEM: KS] bater no monstro que outro aventureiro já estava matando
   irrita o dono: vira rancor, e rancor pode virar briga pelo ponto */
export const KS_JANELA = 12;
const ksAviso = new Map<string, number>();
/* o jogador só fica sabendo quando o KS vira hábito, e no máximo a
   cada 2 min por pessoa: o rancor continua valendo em silêncio */
const ksAvisado = new Map<number, number>();
export function registrarKs(dono: Unit, ladrao: Unit) {
  if (dono === ladrao || dono.dead || ladrao.dead || aliado(dono, ladrao)) return;
  const k = dono.id + ":" + ladrao.id, ult = ksAviso.get(k) || -1e9;
  if (W.simTime - ult < 6) return;
  ksAviso.set(k, W.simTime);
  if (ksAviso.size > 400) ksAviso.clear();
  somaRancor(dono, ladrao, 1);
  if (dono.party) for (const m of dono.party.membros) if (m !== dono && !m.beast) somaRancor(m, ladrao, .5);
  if (dono === G.ctrl && rancor(dono, ladrao) >= 3 && W.simTime - (ksAvisado.get(ladrao.id) ?? -1e9) > 120) {
    ksAvisado.set(ladrao.id, W.simTime);
    if (ksAvisado.size > 60) ksAvisado.clear();
    avisoDe(dono, "KS: " + ladrao.name + " vive pegando seus monstros", "#e0b93a");
  }
}
export function anotarRancor(vitima: Unit, algoz: Unit) {
  const antes = rancor(vitima, algoz);
  somaRancor(vitima, algoz, vitima.pkJust ? 2 : 4);
  if (vitima.party) for (const m of vitima.party.membros) if (m !== vitima && !m.beast) somaRancor(m, algoz, 1);
  if (antes < RANCOR_HOSTIL && rancor(vitima, algoz) >= RANCOR_HOSTIL)
    avisoDe(algoz, vitima.name + " jurou vingança contra você", "#e0685a");
}
