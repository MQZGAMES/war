/* ================================================================
   [SYSTEM: FICHA] [SYSTEM: SALVAR_MUNDO] [SYSTEM: SALVAR_LOCAL]
   [SYSTEM: PREFS] — o mesmo formato .json da v54 ("mesa-de-guerra"):
   fichas e mundos salvos na versão antiga abrem aqui.
   ================================================================ */
import { ATALHOS, NUM_SLOTS, KINDS, sexoDoNome, PERFIL_NOME, PLANOS, POCAO, PZ_LUTA, SPELLS, WORLD_REBORN, type AtqModo, type SpellKey, type VocKey } from "./data";
import { darItem, ehPocao, novoItem, pocaoItem, recontar, servePara } from "./items";
import { BASES, COFRE_N, MOCHILA_N, SLOTS } from "./itemsData";
import { emPZ, nearestFree } from "./map";
import { caveiraRelogio, pzAtiva } from "./pk";
import { clamp } from "./rng";
import { G, W } from "./state";
import { recalcular, sorteiaPlano } from "./stats";
import type { Coisa, Unit } from "./types";
import { CABELOS_N, PELES_N, corGuilda, corLivre, corPorMatiz, makeUnit } from "./unit";
import { entrarParty, iniciaMundoUnit, novaParty, povoarZonas, sqBase } from "./world";
import { atalhosPadrao } from "./spells";
import { FAUNA } from "./data";
import { SETUP, TAMANHO_ULTIMATE, prepararMundo, terminarInicio, assumir } from "./session";
import { soltarPreso } from "./ai";
import { MERCADO } from "./mercado";
import type { Item } from "./types";

/* ---------- preferências no aparelho ---------- */
export const PREF_CHAVE = "mesaDeGuerra3d.pref", MUNDO_CHAVE = "mesaDeGuerra3d.mundo";
export const PREF = {
  cam: "auto" as "auto" | "livre", efeitos: 1, ajudaVista: 0, nome: "", vocacao: "knight" as VocKey, sexo: "m" as "m" | "f",
  auto: null as unknown as typeof G.AUTO | null,
  qualidade: "auto" as "auto" | "baixa" | "media" | "alta",
  som: .8, musica: .45, vibrar: 1, diaNoite: 1,
};
export function lerLocal<T = unknown>(k: string): T | null { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } }
export function gravarLocal(k: string, v: unknown) { try { localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v)); return true; } catch { return false; } }
export function apagarLocal(k: string) { try { localStorage.removeItem(k); } catch { /* sem armazenamento */ } }
export function carregarPref() {
  const p = lerLocal<Partial<typeof PREF>>(PREF_CHAVE);
  if (!p || typeof p !== "object") return;
  if (p.cam === "livre" || p.cam === "auto") PREF.cam = p.cam;
  if (p.efeitos !== undefined) PREF.efeitos = p.efeitos ? 1 : 0;
  PREF.ajudaVista = p.ajudaVista ? 1 : 0;
  if (typeof p.nome === "string") PREF.nome = p.nome.slice(0, 18);
  if (p.sexo === "f" || p.sexo === "m") PREF.sexo = p.sexo;
  if (typeof p.vocacao === "string" && KINDS[p.vocacao as VocKey] && !KINDS[p.vocacao as VocKey].beast) PREF.vocacao = p.vocacao as VocKey;
  if (p.auto && typeof p.auto === "object") PREF.auto = p.auto as typeof G.AUTO;
  if (p.qualidade && ["auto", "baixa", "media", "alta"].includes(p.qualidade)) PREF.qualidade = p.qualidade;
  if (typeof p.som === "number") PREF.som = clamp(p.som, 0, 1);
  if (typeof p.musica === "number") PREF.musica = clamp(p.musica, 0, 1);
  if (p.vibrar !== undefined) PREF.vibrar = p.vibrar ? 1 : 0;
  if (p.diaNoite !== undefined) PREF.diaNoite = p.diaNoite ? 1 : 0;
  if (PREF.auto) aplicarAuto(PREF.auto);
}
export function aplicarAuto(a: Partial<typeof G.AUTO>) {
  if (a.cura) Object.assign(G.AUTO.cura, a.cura);
  if (a.ataque) Object.assign(G.AUTO.ataque, a.ataque);
  if (a.refil) Object.assign(G.AUTO.refil, a.refil);
  if (a.equip !== undefined) G.AUTO.equip = a.equip ? 1 : 0;
  if (a.agrupar !== undefined) G.AUTO.agrupar = a.agrupar ? 1 : 0;
  if (!PERFIL_NOME[G.AUTO.ataque.modo]) G.AUTO.ataque.modo = "criaturas";
}
export function salvarPref() {
  PREF.auto = { cura: { ...G.AUTO.cura }, ataque: { ...G.AUTO.ataque }, refil: { ...G.AUTO.refil }, equip: G.AUTO.equip, lider: 0, agrupar: G.AUTO.agrupar };
  gravarLocal(PREF_CHAVE, PREF);
}

/* ---------- ficha do personagem ---------- */
const FICHA_V = 2;
export function fichaDe(u: Unit) {
  const eqp: Record<string, unknown> = {}; for (const s of SLOTS) eqp[s] = u.eqp[s];
  return {
    jogo: "mesa-de-guerra", ficha: FICHA_V, quando: new Date().toISOString(),
    nome: u.name, vocacao: u.kind, cor: u.cor.h, sexo: u.sexo, pele: u.pele, cabelo: u.cabelo,
    lvl: u.lvl, xp: u.xp, pts: u.pts, manual: !!u.manual, proporcao: u.proporcao,
    attr: { ...u.attr }, plano: u.plano ? u.plano.n : null,
    eqp, mochila: u.mochila.slice(), cofre: u.cofre.slice(), ouro: u.ouro | 0, banco: u.banco | 0,
    slots: (u.slots || atalhosPadrao(u.kind as VocKey)).slice(), kills: u.kills | 0, pkKills: u.pkKills | 0,
    caveira: u.skull, brancaInj: !!u.brancaInj, injustas: u.injustas | 0,
    injustaUlt: u.injustaUlt || 0, vermelhaAte: u.vermelhaAte || 0,
    trava: Math.ceil(Math.max(0, u.pzLuta + PZ_LUTA - W.simTime)),
    travaMorte: Math.ceil(Math.max(0, (u.pzMorte || 0) - W.simTime)),
  };
}
export type Ficha = ReturnType<typeof fichaDe>;
/* eslint-disable @typescript-eslint/no-explicit-any */
function itemValido(o: any): Coisa | null {
  if (o && o.b === "besta") o = { b: "arco", k: o.k, q: o.q };
  if (!o || !BASES[o.b]) return null;
  if (BASES[o.b].pocao) { const n = clamp(o.n | 0, 0, POCAO.pilha); return n ? { b: o.b, n } : null; }
  return novoItem(o.b, (o.k | 0) || (o.q | 0) || 1);
}
export function aplicarFicha(u: Unit, f: any) {
  if (!f || f.jogo !== "mesa-de-guerra") throw new Error("arquivo não é uma ficha");
  if (!KINDS[f.vocacao as VocKey] || !ATALHOS[f.vocacao as VocKey]) throw new Error("vocação desconhecida");
  const kind = f.vocacao as VocKey;
  u.kind = kind; u.K = KINDS[kind];
  u.isKnight = kind === "knight"; u.isArcher = kind === "archer";
  u.name = String(f.nome || u.name).slice(0, 18);
  /* fichas antigas não têm sexo: vale o do nome */
  u.sexo = f.sexo === "f" || f.sexo === "m" ? f.sexo : sexoDoNome(u.name);
  if (typeof f.pele === "number") u.pele = clamp(f.pele | 0, 0, PELES_N - 1);
  if (typeof f.cabelo === "number") u.cabelo = clamp(f.cabelo | 0, 0, CABELOS_N - 1);
  u.lvl = clamp(f.lvl | 0, 1, 99); u.xp = Math.max(0, +f.xp || 0); u.pts = Math.max(0, f.pts | 0);
  u.manual = !!f.manual;
  u.attr = { str: 0, dex: 0, def: 0, mag: 0, hp: 0, mp: 0 };
  if (f.attr) for (const k in u.attr) u.attr[k as keyof typeof u.attr] = Math.max(0, f.attr[k] | 0);
  u.proporcao = f.proporcao && typeof f.proporcao === "object" ? Object.assign({ str: 0, dex: 0, def: 0, mag: 0, hp: 0, mp: 0 }, f.proporcao) : null;
  u.plano = PLANOS[kind].find((p) => p.n === f.plano) || sorteiaPlano(kind);
  if (W.worldLivre && typeof f.cor === "number") u.cor = corPorMatiz(f.cor);
  for (const s of SLOTS) {
    const it = itemValido(f.eqp && f.eqp[s]);
    u.eqp[s] = it && !ehPocao(it) && BASES[it.b].s === s && servePara(it, u.kind) ? it : null;
  }
  u.mochila.fill(null); u.cofre.fill(null);
  if (Array.isArray(f.mochila)) for (let i = 0; i < MOCHILA_N; i++) u.mochila[i] = itemValido(f.mochila[i]);
  if (Array.isArray(f.cofre)) for (let i = 0; i < COFRE_N; i++) u.cofre[i] = itemValido(f.cofre[i]);
  if (f.ficha === 1) {
    if (f.potHp) darItem(u, pocaoItem("hp", f.potHp | 0));
    if (f.potMp) darItem(u, pocaoItem("mp", f.potMp | 0));
  }
  u.ouro = Math.max(0, f.ouro | 0); u.banco = Math.max(0, f.banco | 0);
  const pad = atalhosPadrao(kind);
  const valida = (s: string) => SPELLS[s as SpellKey] && (!SPELLS[s as SpellKey].so || SPELLS[s as SpellKey].so === kind) ? s as SpellKey : null;
  u.slots = Array.isArray(f.slots) && f.slots.length >= 3 ? f.slots.slice(0, NUM_SLOTS).map(valida) as SpellKey[] : pad;
  /* ficha de 3 casas (versões antigas): a quarta recebe a magia nova da vocação */
  for (let i = 0; i < NUM_SLOTS; i++) if (!u.slots![i]) u.slots![i] = u.slots!.indexOf(pad[i]) < 0 ? pad[i] : pad.find((k) => u.slots!.indexOf(k) < 0) || pad[i];
  u.kills = Math.max(0, f.kills | 0); u.pkKills = Math.max(0, f.pkKills | 0);
  u.injustas = Math.max(0, f.injustas | 0); u.injustaUlt = +f.injustaUlt || 0; u.vermelhaAte = +f.vermelhaAte || 0;
  u.skull = f.caveira === "red" ? "red" : f.caveira === "white" ? "white" : null;
  u.brancaInj = !!f.brancaInj;
  const tr = Math.max(0, +f.trava || 0), tm = Math.max(0, +f.travaMorte || 0);
  u.pzLuta = tr ? W.simTime - PZ_LUTA + tr : (u.skull === "white" ? W.simTime : -1e9);
  u.pzMorte = tm ? W.simTime + tm : 0;
  caveiraRelogio(u);
  u.atkBy = {}; u.contrib = {}; u.ultimos[0] = u.ultimos[1] = null; u.pkJust = true;
  u.target = null; u.alvoManual = null; u.ordem = null; u.encomenda = null; u.npcAlvo = null; u.path = null; u.goalKey = "";
  u.exAte = {}; u.tiros = 0; u.slow = 0; u.paral = 0; u.pressa = 0;
  recontar(u); recalcular(u, true);
  u.hp = u.maxHp; u.mp = u.maxMp;
  if (u.pz && pzAtiva(u)) soltarPreso(u);
}

/* ---------- mundo inteiro ---------- */
const MUNDO_V = 1;
export function mundoDe() {
  const jogadores: any[] = [];
  for (const u of W.units) {
    if (u.beast) continue;
    const f: any = fichaDe(u);
    f.id = u.id; f.team = u.team; f.corObj = u.cor;
    f.x = Math.round(u.x * 100) / 100; f.y = Math.round(u.y * 100) / 100;
    f.hp = Math.round(u.hp); f.mp = Math.round(u.mp);
    f.morto = u.dead; f.volta = u.dead ? Math.max(1, Math.ceil(u.reborn - W.simTime)) : 0;
    const w = u.w!;
    f.w = { perfil: w.perfil, pk: w.pk, social: w.social, ousadia: w.ousadia, ganancia: w.ganancia };
    jogadores.push(f);
  }
  const grupos: any[] = [];
  for (const p of W.parties) if (p.membros.length > 1)
    grupos.push({ membros: p.membros.map((m) => m.id), lider: p.lider ? p.lider.id : 0, min: p.min });
  return {
    jogo: "mesa-de-guerra", mundo: MUNDO_V, quando: new Date().toISOString(),
    semente: W.semente,
    setup: { livre: W.worldLivre, guildas: W.guildasN, tamanho: W.worldSize, monstros: W.worldBeastCap },
    guerra: W.guerra.map((l) => l.map((v) => Math.max(0, Math.round(v - W.simTime)))),
    comando: G.ctrl ? G.ctrl.id : 0,
    auto: { cura: { ...G.AUTO.cura }, ataque: { ...G.AUTO.ataque }, refil: { ...G.AUTO.refil }, equip: G.AUTO.equip, lider: G.AUTO.lider, agrupar: G.AUTO.agrupar },
    jogadores, grupos,
    mercado: MERCADO.ofertas.map((o) => ({ item: o.item, preco: o.preco, vendedor: o.vendedor ? o.vendedor.id : 0, nome: o.nome, resta: Math.max(1, Math.round(o.ate - W.simTime)) })),
    local: 0, heroi: "", nivel: 0,
  };
}
export function carregarMundo(m: any) {
  if (!m || m.jogo !== "mesa-de-guerra" || !m.mundo) throw new Error("arquivo não é um mundo salvo");
  if (!Array.isArray(m.jogadores) || !m.jogadores.length) throw new Error("mundo sem aventureiros");
  const s = m.setup || {};
  SETUP.livre = s.livre !== false;
  SETUP.guildas = clamp(s.guildas | 0 || 2, 2, 4);
  SETUP.tamanho = clamp(s.tamanho | 0 || 72, 48, TAMANHO_ULTIMATE);
  SETUP.monstros = clamp(s.monstros | 0 || 220, 10, 1500);
  prepararMundo(m.semente >>> 0);
  const nT = W.worldLivre ? 1 : W.guildasN;
  for (let t = 0; t < nT; t++) W.squads.push(sqBase(t, W.cidade.nasce));
  for (let t = W.squads.length; t <= FAUNA; t++) W.squads[t] = sqBase(t, { x: W.N / 2, y: W.N / 2 });
  const porId = new Map<number, Unit>();
  let maxId = 0;
  for (const f of m.jogadores) {
    if (!KINDS[f.vocacao as VocKey] || KINDS[f.vocacao as VocKey].beast) continue;
    const team = W.worldLivre ? 0 : clamp(f.team | 0, 0, W.guildasN - 1);
    const fr = nearestFree(clamp(+f.x || W.cidade.x, 1, W.N - 2), clamp(+f.y || W.cidade.y, 1, W.N - 2));
    const u = makeUnit(team, f.vocacao, fr[0] + .5, fr[1] + .5);
    u.pz = emPZ(u.x, u.y);
    iniciaMundoUnit(u);
    aplicarFicha(u, f);
    if (f.corObj && f.corObj.c && f.corObj.lo && f.corObj.hi) u.cor = { h: +f.corObj.h || 0, c: f.corObj.c, lo: f.corObj.lo, hi: f.corObj.hi };
    else u.cor = W.worldLivre ? corLivre() : corGuilda(team);
    if (f.w && u.w) {
      u.w.perfil = PERFIL_NOME[f.w.perfil as AtqModo] && f.w.perfil !== "desligado" ? f.w.perfil : "criaturas";
      for (const k of ["pk", "social", "ousadia", "ganancia"] as const) if (typeof f.w[k] === "number") u.w[k] = f.w[k];
    }
    u.hp = clamp(+f.hp || u.maxHp, 1, u.maxHp); u.mp = clamp(+f.mp || 0, 0, u.maxMp);
    if (f.morto) { u.dead = true; u.hp = 0; u.reborn = W.simTime + clamp(+f.volta || 3, 1, WORLD_REBORN); }
    if (f.id > 0 && !porId.has(f.id)) u.id = f.id | 0;
    maxId = Math.max(maxId, u.id);
    porId.set(u.id, u); W.units.push(u); W.squads[team].start++;
  }
  W.uid = Math.max(W.uid, maxId + 1);
  povoarZonas();
  for (const g of (Array.isArray(m.grupos) ? m.grupos : [])) {
    const ms = (g.membros || []).map((id: number) => porId.get(id)).filter((u: Unit | undefined) => u && !u.party) as Unit[];
    if (ms.length < 2) continue;
    const p = novaParty(ms[0]);
    for (let i = 1; i < ms.length; i++) entrarParty(ms[i], p);
    const L = porId.get(g.lider);
    p.lider = L && p.membros.indexOf(L) >= 0 ? L : ms[0];
    p.min = g.min || 1;
  }
  for (const u of W.units) if (!u.beast && !u.party) novaParty(u);
  MERCADO.ofertas = [];
  if (Array.isArray(m.mercado)) for (const o of m.mercado) {
    const it = itemValido(o.item);
    if (!it || ehPocao(it) || !(+o.preco > 0)) continue;
    MERCADO.ofertas.push({ id: MERCADO.id++, item: it as Item, preco: Math.round(+o.preco), vendedor: porId.get(o.vendedor | 0) || null, nome: String(o.nome || "?").slice(0, 18), ate: W.simTime + clamp(+o.resta || 600, 1, 900) });
  }
  if (Array.isArray(m.guerra)) for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
    const v = m.guerra[a] ? +m.guerra[a][b] : 0;
    W.guerra[a][b] = v > 0 ? W.simTime + v : 0;
  }
  terminarInicio();
  const c = porId.get(m.comando | 0);
  if (c && !c.dead) assumir(c);
  if (m.auto) {
    aplicarAuto(m.auto);
    G.AUTO.lider = c && !c.dead ? (+m.auto.lider || 0) : 0;
  }
  return porId.size;
}
/* a nuvem (net/nuvem.ts) se pendura aqui sem a simulação depender dela */
export const ganchoSave: { aoSalvar: ((m: ReturnType<typeof mundoDe>, forcar: boolean) => void) | null } = { aoSalvar: null };
export function salvarLocalMundo(forcar = false) {
  if (!G.running || !G.ctrl) return false;
  try {
    const m = mundoDe();
    m.local = 1; m.heroi = G.ctrl.name; m.nivel = G.ctrl.lvl;
    ganchoSave.aoSalvar?.(m, forcar);
    const s = JSON.stringify(m);
    if (s.length > 4e6) return false;
    localStorage.setItem(MUNDO_CHAVE, s);
    return true;
  } catch { return false; }
}
export function temMundoLocal(): any {
  const m = lerLocal<any>(MUNDO_CHAVE);
  return (m && m.jogo === "mesa-de-guerra" && m.mundo && Array.isArray(m.jogadores)) ? m : null;
}
export function baixarJson(obj: unknown, nome: string) {
  const blob = new Blob([JSON.stringify(obj, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = nome;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
