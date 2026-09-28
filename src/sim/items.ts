/* ================================================================
   Itens, mochila, equipamento, loja e cofre — portado da v54.
   [SYSTEM: MOCHILA] 20 casas; poção empilha 50 por casa.
   [SYSTEM: EQUIPAR] oito casas; duas mãos bloqueia o escudo.
   [SYSTEM: NPC_LOJA] toda compra debita do saldo (mochila + banco).
   [SYSTEM: AI_COFRE] o que a IA guarda, vende e compra.
   ================================================================ */
import { KINDS, POCAO, type VocKey } from "./data";
import { avisoDe, fx } from "./fx";
import { BASES, BASES_EQUIP, COFRE_N, MOCHILA_N, NIVEL_MAX, PESO, PRECO_POCAO, SLOTS, STAT_NOME, type StatKey } from "./itemsData";
import { pzAtiva } from "./pk";
import { clamp, rnd } from "./rng";
import { G } from "./state";
import { itemStat, recalcular } from "./stats";
import type { Coisa, Item, Pocao, SlotKey, Unit } from "./types";

export { itemStat };
export function novoItem(b: string, k: number): Item { return { b, k: clamp(k | 0, 1, NIVEL_MAX) }; }
export function pocaoItem(tipo: "hp" | "mp", n: number): Pocao { return { b: tipo === "hp" ? "pvida" : "pmana", n }; }
export function ehPocao(it: Coisa): it is Pocao { return !!BASES[it.b].pocao; }
export function nomeItem(it: Coisa) {
  const B = BASES[it.b];
  return B.pocao ? (it as Pocao).n + "× " + B.n : B.n + " +" + (it as Item).k;
}
export function corItem(it: Coisa) {
  const B = BASES[it.b];
  return B.pocao ? (B.pocao === "hp" ? "#e0685a" : "#6fb5e6") : B.cor;
}
export function precoItem(it: Coisa) {
  const B = BASES[it.b];
  if (B.pocao) return B.preco * ((it as Pocao).n || 1);
  const k = (it as Item).k;
  return Math.round(B.preco * Math.pow(1.55, k - 1) * Math.sqrt(k));
}
export const precoVenda = (it: Coisa) => Math.floor(precoItem(it) * .5);
export function servePara(it: Coisa, kind: string) { const v = BASES[it.b].voc; return !v || v.indexOf(kind as VocKey) >= 0; }
export function vocNome(it: Coisa) { const v = BASES[it.b].voc; return v ? v.map((k) => KINDS[k].pt).join(", ") : "todas as vocações"; }

/* [SYSTEM: LOOT] a faixa do ponto de caça puxa o nível do item */
export function nivelLoot(tier: number) {
  const c = 1 + (tier - 1) * 1.35;
  let k = Math.round(c + (rnd() + rnd() - 1) * 1.4);
  if (rnd() < .1) k += 1 + (rnd() < .35 ? 1 : 0);
  return clamp(k, 1, NIVEL_MAX);
}
export function itemAleatorio(tier: number) { return novoItem(BASES_EQUIP[Math.floor(rnd() * BASES_EQUIP.length)], nivelLoot(tier)); }
export function descreveStats(it: Coisa) {
  const B = BASES[it.b];
  if (B.pocao) return "+" + (B.pocao === "hp" ? POCAO.hp + " vida" : POCAO.mp + " mana") + " por gole";
  let s = "";
  for (const k in STAT_NOME) {
    if (!B.st[k as StatKey]) continue;
    s += (s ? " · " : "") + "+" + itemStat(it as Item, k as StatKey) + (k === "spd" ? "" : " ") + STAT_NOME[k as StatKey];
  }
  return s + (B.duas ? " · duas mãos" : "");
}

/* ---------- mochila ---------- */
export function livres(arr: (Coisa | null)[]) { let n = 0; for (let i = 0; i < arr.length; i++) if (!arr[i]) n++; return n; }
export function espacoEm(arr: (Coisa | null)[], b: string) {
  let n = 0;
  for (const s of arr) { if (!s) n += POCAO.pilha; else if (s.b === b) n += POCAO.pilha - (s as Pocao).n; }
  return n;
}
export function espacoPocao(u: Unit, b: string) { return espacoEm(u.mochila, b); }
export function cabe(u: Unit, it: Coisa) {
  if (!u.mochila) return false;
  return ehPocao(it) ? espacoPocao(u, it.b) > 0 : livres(u.mochila) > 0;
}
export function empilhar(arr: (Coisa | null)[], b: string, n: number) {
  let foi = 0;
  for (let i = 0; i < arr.length && n > 0; i++) {
    const s = arr[i] as Pocao | null;
    if (s && s.b === b && s.n < POCAO.pilha) { const k = Math.min(n, POCAO.pilha - s.n); s.n += k; n -= k; foi += k; }
  }
  for (let i = 0; i < arr.length && n > 0; i++)
    if (!arr[i]) { const k = Math.min(n, POCAO.pilha); arr[i] = { b, n: k }; n -= k; foi += k; }
  return foi;
}
export function darItem(u: Unit, it: Coisa) {
  if (ehPocao(it)) { const foi = empilhar(u.mochila, it.b, it.n); recontar(u); return foi > 0; }
  const i = u.mochila.indexOf(null);
  if (i < 0) return false;
  u.mochila[i] = it;
  return true;
}
export function recontar(u: Unit) {
  let h = 0, m = 0;
  for (const it of u.mochila) {
    if (!it) continue;
    if (it.b === "pvida") h += (it as Pocao).n; else if (it.b === "pmana") m += (it as Pocao).n;
  }
  u.potHp = h; u.potMp = m;
}
export function tirarPocao(u: Unit, tipo: "hp" | "mp") {
  const b = tipo === "hp" ? "pvida" : "pmana", M = u.mochila;
  let k = -1, mn = 1e9;
  for (let i = 0; i < M.length; i++) { const it = M[i] as Pocao | null; if (it && it.b === b && it.n < mn) { mn = it.n; k = i; } }
  if (k < 0) return false;
  const p = M[k] as Pocao;
  if (--p.n <= 0) M[k] = null;
  if (tipo === "hp") u.potHp--; else u.potMp--;
  return true;
}

/* ---------- equipar ---------- */
export function podeEquipar(u: Unit, it: Coisa) { return !!BASES[it.b].s && servePara(it, u.kind); }
export function equipar(u: Unit, i: number) {
  const it = u.mochila[i];
  if (!it || !podeEquipar(u, it)) return false;
  const B = BASES[it.b], s = B.s!, e = u.eqp;
  const sai1 = e[s];
  let sai2: SlotKey | null = null;
  if (B.duas && e.esc) sai2 = "esc";
  if (s === "esc" && e.arma && BASES[e.arma.b].duas) sai2 = "arma";
  if (sai2 && sai1 && livres(u.mochila) < 1) return false;
  u.mochila[i] = sai1 || null;
  if (sai2) { const j = u.mochila.indexOf(null); u.mochila[j] = e[sai2]; e[sai2] = null; }
  e[s] = it as Item;
  recalcular(u);
  return true;
}
export function desequipar(u: Unit, s: SlotKey) {
  const it = u.eqp[s];
  if (!it) return false;
  const j = u.mochila.indexOf(null);
  if (j < 0) return false;
  u.mochila[j] = it; u.eqp[s] = null;
  recalcular(u);
  return true;
}
export function valorPara(u: Unit, it: Coisa | null) {
  if (!it) return 0;
  if (!servePara(it, u.kind)) return -1;
  const P = PESO[u.kind as VocKey], st = BASES[it.b].st;
  let s = 0;
  for (const k in st) s += itemStat(it as Item, k as StatKey) * (P[k as StatKey] || 0);
  return s;
}
export function ganhoDe(u: Unit, it: Coisa) {
  const B = BASES[it.b], e = u.eqp;
  if (B.s === "esc" && e.arma && BASES[e.arma.b].duas) return -1;
  let atual = valorPara(u, e[B.s!]);
  if (B.duas) atual += valorPara(u, e.esc);
  return valorPara(u, it) - atual;
}
export function autoEquipar(u: Unit) {
  if (!u.mochila) return 0;
  let n = 0;
  for (let i = 0; i < u.mochila.length; i++) {
    const it = u.mochila[i];
    if (it && !ehPocao(it) && servePara(it, u.kind) && ganhoDe(u, it) > .01 && equipar(u, i)) n++;
  }
  return n;
}
export function equiparSeQuiser(u: Unit) {
  if (u !== G.ctrl) autoEquipar(u);
  else if (G.AUTO.equip && autoEquipar(u)) { avisoDe(u, "Auto equipar: vestiu o melhor da mochila", "#7fd6a0"); fx({ t: "ui", s: "equip" }); }
}

/* ---------- loja e banco ---------- */
export const saldo = (u: Unit) => u.ouro + u.banco;
export function pagar(u: Unit, v: number) {
  if (saldo(u) < v) return false;
  const a = Math.min(u.ouro, v);
  u.ouro -= a; u.banco -= v - a;
  return true;
}
export function comprarPocoes(u: Unit, tipo: "hp" | "mp", n: number) {
  const b = tipo === "hp" ? "pvida" : "pmana";
  n = Math.min(n, espacoPocao(u, b), Math.floor(saldo(u) / PRECO_POCAO));
  if (n <= 0 || !pagar(u, n * PRECO_POCAO)) return 0;
  darItem(u, { b, n });
  return n;
}
export function comprarItem(u: Unit, b: string, k: number) {
  const it = novoItem(b, k);
  if (livres(u.mochila) < 1 || !pagar(u, precoItem(it))) return false;
  darItem(u, it);
  return true;
}
export function venderItem(u: Unit, i: number) {
  const it = u.mochila[i];
  if (!it) return 0;
  const v = precoVenda(it);
  u.mochila[i] = null; u.ouro += v;
  if (ehPocao(it)) recontar(u);
  return v;
}
export function depositarOuro(u: Unit, v: number) { v = Math.min(v, u.ouro); u.ouro -= v; u.banco += v; return v; }
export function sacarOuro(u: Unit, v: number) { v = Math.min(v, u.banco); u.banco -= v; u.ouro += v; return v; }
export function depositarItem(u: Unit, i: number, n?: number) {
  const it = u.mochila[i];
  if (!it) return 0;
  if (ehPocao(it)) {
    const foi = empilhar(u.cofre, it.b, Math.min(n || it.n, it.n));
    it.n -= foi; if (it.n <= 0) u.mochila[i] = null;
    recontar(u);
    return foi;
  }
  const j = u.cofre.indexOf(null);
  if (j < 0) return 0;
  u.cofre[j] = it; u.mochila[i] = null;
  return 1;
}
export function sacarItem(u: Unit, j: number, n?: number) {
  const it = u.cofre[j];
  if (!it) return 0;
  if (ehPocao(it)) {
    const foi = empilhar(u.mochila, it.b, Math.min(n || it.n, it.n));
    it.n -= foi; if (it.n <= 0) u.cofre[j] = null;
    recontar(u);
    return foi;
  }
  const i = u.mochila.indexOf(null);
  if (i < 0) return 0;
  u.mochila[i] = it; u.cofre[j] = null;
  return 1;
}

/* A melhor compra de uma casa dentro da verba (mesma conta da IA e do auto refil) */
export const ITEM_TMP: Item = { b: "espada", k: 1 };
export function melhorDaCasa(u: Unit, s: SlotKey, verba: number) {
  let mb: string | null = null, mk = 0, mg = .01;
  for (const b of BASES_EQUIP) {
    const B = BASES[b];
    if (B.s !== s || (B.voc && B.voc.indexOf(u.kind as VocKey) < 0)) continue;
    for (let k = 1; k <= NIVEL_MAX; k++) {
      ITEM_TMP.b = b; ITEM_TMP.k = k;
      if (precoItem(ITEM_TMP) > verba) break;
      const g = ganhoDe(u, ITEM_TMP);
      if (g > mg) { mg = g; mb = b; mk = k; }
    }
  }
  if (!mb) return false;
  ITEM_TMP.b = mb; ITEM_TMP.k = mk;
  return true;
}
export function temMelhoria(u: Unit, reserva: number) {
  const verba = saldo(u) - reserva;
  if (verba < 40 || livres(u.mochila) < 1) return false;
  for (const s of SLOTS) if (melhorDaCasa(u, s, verba)) return true;
  return false;
}
export function comprarMelhorias(u: Unit, reserva: number) {
  let n = 0;
  for (const s of SLOTS) {
    if (!melhorDaCasa(u, s, saldo(u) - reserva)) continue;
    const b = ITEM_TMP.b, k = ITEM_TMP.k;
    if (!comprarItem(u, b, k)) continue;
    for (let i = 0; i < u.mochila.length; i++) {
      const it = u.mochila[i] as Item | null;
      if (it && it.b === b && it.k === k) { if (equipar(u, i)) n++; break; }
    }
  }
  return n;
}

/* ---------- [SYSTEM: AI_COFRE] ---------- */
export const COFRE_VALIOSO = 8;
export function reservaNoCofre(u: Unit, s: SlotKey) {
  let k = -1, v = -1;
  for (let j = 0; j < u.cofre.length; j++) {
    const it = u.cofre[j];
    if (!it || ehPocao(it) || BASES[it.b].s !== s || !servePara(it, u.kind)) continue;
    const vv = valorPara(u, it);
    if (vv > v) { v = vv; k = j; }
  }
  return k;
}
function duplicataNoCofre(u: Unit, it: Item) {
  for (const c of u.cofre) if (c && c.b === it.b && !ehPocao(c) && (c as Item).k >= it.k) return true;
  return false;
}
export function mantem(u: Unit, it: Coisa) {
  if (ehPocao(it)) return true;
  const B = BASES[it.b];
  if (B.s && servePara(it, u.kind)) {
    const r = reservaNoCofre(u, B.s);
    if (r < 0 || valorPara(u, it) > valorPara(u, u.cofre[r]) + .01) return true;
  }
  return (it as Item).k >= COFRE_VALIOSO && !duplicataNoCofre(u, it as Item);
}
export function guardarNoCofre(u: Unit) {
  let n = 0;
  for (const s of SLOTS) {
    const j = reservaNoCofre(u, s);
    if (j < 0) continue;
    const it = u.cofre[j]!;
    if ((!u.eqp[s] || ganhoDe(u, it) > .01) && sacarItem(u, j)) {
      const i = u.mochila.indexOf(it);
      if (i >= 0) equipar(u, i);
    }
  }
  for (let i = 0; i < u.mochila.length; i++) {
    const it = u.mochila[i];
    if (!it || ehPocao(it)) continue;
    const B = BASES[it.b];
    if (B.s && servePara(it, u.kind)) {
      const r = reservaNoCofre(u, B.s);
      if (r < 0) { if (depositarItem(u, i)) n++; continue; }
      if (valorPara(u, it) > valorPara(u, u.cofre[r]) + .01) {
        const velha = u.cofre[r]; u.cofre[r] = it; u.mochila[i] = velha; n++; continue;
      }
    }
    if ((it as Item).k >= COFRE_VALIOSO && !duplicataNoCofre(u, it as Item) && depositarItem(u, i)) n++;
  }
  return n;
}
export function iaCofre(u: Unit) {
  guardarNoCofre(u);
  if (u.ouro > 80) depositarOuro(u, u.ouro - 80);
}
export function pocaoAlvo(u: Unit) { return clamp(12 + u.lvl * 2, 12, 70); }
export function custoPocoes(u: Unit) {
  const a = pocaoAlvo(u), conj = u.maxMp > 0 && u.kind !== "knight";
  return PRECO_POCAO * (Math.max(0, a - u.potHp) + (conj ? Math.max(0, a - u.potMp) : 0));
}
export function reservaIA(u: Unit) { return custoPocoes(u) + PRECO_POCAO * 10; }
export function precisaNpc(u: Unit, id: string) {
  if (id === "feiticeiro") {
    const conj = u.maxMp > 0 && u.kind !== "knight", a = pocaoAlvo(u);
    return saldo(u) >= PRECO_POCAO && (u.potHp < a || (conj && u.potMp < a));
  }
  if (id === "comerciante") {
    for (const it of u.mochila) if (it && !ehPocao(it) && !mantem(u, it)) return true;
    return temMelhoria(u, reservaIA(u));
  }
  if (u.ouro > 150) return true;
  for (const it of u.mochila) if (it && !ehPocao(it) && mantem(u, it)) return true;
  for (const s of SLOTS) if (!u.eqp[s] && reservaNoCofre(u, s) >= 0) return true;
  return false;
}
function iaComerciante(u: Unit) {
  autoEquipar(u);
  for (let i = 0; i < u.mochila.length; i++) { const it = u.mochila[i]; if (it && !mantem(u, it)) venderItem(u, i); }
  comprarMelhorias(u, reservaIA(u));
  for (let i = 0; i < u.mochila.length; i++) { const it = u.mochila[i]; if (it && !mantem(u, it)) venderItem(u, i); }
}
function iaFeiticeiro(u: Unit) {
  const conj = u.maxMp > 0 && u.kind !== "knight";
  const minMp = conj ? 8 : (u.maxMp ? 2 : 0);
  if (u.potHp < 8) comprarPocoes(u, "hp", 8 - u.potHp);
  if (u.potMp < minMp) comprarPocoes(u, "mp", minMp - u.potMp);
  const alvo = pocaoAlvo(u), verba = Math.floor(saldo(u) * .7 / PRECO_POCAO);
  let hp = Math.max(0, alvo - u.potHp);
  let mp = conj ? Math.max(0, alvo - u.potMp) : 0;
  if (hp + mp > verba) { const k = verba / (hp + mp); hp = Math.floor(hp * k); mp = Math.floor(mp * k); }
  if (hp) comprarPocoes(u, "hp", hp);
  if (mp) comprarPocoes(u, "mp", mp);
}
export function negociar(u: Unit, id: string) {
  if (pzAtiva(u)) return;
  if (id === "comerciante") iaComerciante(u);
  else if (id === "feiticeiro") iaFeiticeiro(u);
  else iaCofre(u);
}
export function semFrasco(u: Unit) {
  const precisaMana = u.maxMp > 0 && u.kind !== "knight";
  return u.potHp <= 0 || (precisaMana && u.potMp <= 0);
}
export { MOCHILA_N, COFRE_N, PRECO_POCAO, NIVEL_MAX, SLOTS };
