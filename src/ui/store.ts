/* ================================================================
   Estado da interface e a ponte com a simulação.
   [SYSTEM: ESTADOS] máquina de telas: título → herói → jogo ⇄ menu;
   ajuda, mundo e ajustes por cima. `paused` é derivado daqui.
   ================================================================ */
import { signal } from "@preact/signals";
import { G, W, hooks } from "../sim/state";
import { ui, fx, avisoDe } from "../sim/fx";
import { NPC_ALCANCE } from "../sim/map";
import { pzAtiva, pzRestante } from "../sim/pk";
import { entrada } from "../game/input";
import { laco } from "../game/loop";
import { salvarLocalMundo, salvarPref, PREF } from "../sim/save";
import { pausarAudio } from "../audio/sfx";
import { magiaDe, slotDe, beberPocao, lancar } from "../sim/spells";
import { alvoMaisProximo, pausaRefil, mirarMagia } from "../sim/player";
import { declararPk } from "../sim/relations";
import { retratoDe } from "../render/portrait";
import { overlayCfg } from "../render/overlay";
import type { Unit } from "../sim/types";

export type Tela = "titulo" | "heroi" | "jogo" | "menu" | "ajuda" | "mundo" | "ajustes" | "conta";
export type Painel = "" | "equip" | "atrib" | "magias" | "cura" | "ataque" | "equipe" | "ficha" | "npc";
export const tela = signal<Tela>("titulo");
export const volta = signal<Tela>("titulo");
export const tick = signal(0);
export const painel = signal<Painel>("");
export const painelUlt = signal<Painel>("equip");
export const npcAberto = signal<string | null>(null);
export const retrato = signal<string>("");
export const cheio = signal(false);

export interface Aviso { id: number; txt: string; cor: string; ate: number }
export const avisos = signal<Aviso[]>([]);
export interface Faixa { id: number; tit: string; sub: string; cls: string }
export const faixa = signal<Faixa | null>(null);
export const popXp = signal({ v: 0, id: 0 });
export const popOuro = signal({ v: 0, id: 0 });

let avisoId = 1;
export function aviso(txt: string, cor = "#e9e2d0") {
  const agora = performance.now();
  const l = avisos.value.filter((a) => a.ate > agora);
  /* o mesmo texto ainda na tela não empilha de novo: só ganha tempo */
  const ja = l.find((a) => a.txt === txt);
  if (ja) { ja.ate = agora + 2800; avisos.value = l; return; }
  while (l.length > 3) l.shift();
  l.push({ id: avisoId++, txt, cor, ate: agora + 2800 });
  avisos.value = l;
}
let faixaT = 0;
function banner(tit: string, sub = "", cls = "") {
  faixa.value = { id: avisoId++, tit, sub, cls };
  clearTimeout(faixaT);
  faixaT = window.setTimeout(() => { faixa.value = null; }, 3300);
}
let xpT = 0, ouroT = 0;
function pXp(v: number) { const t = performance.now(); const acc = t - xpT > 700 ? 0 : popXp.value.v; xpT = t; popXp.value = { v: acc + v, id: avisoId++ }; }
function pOuro(v: number) { const t = performance.now(); const acc = t - ouroT > 700 ? 0 : popOuro.value.v; ouroT = t; popOuro.value = { v: acc + v, id: avisoId++ }; }

/* ---------- telas ---------- */
export function irPara(nome: Tela) {
  const antes = tela.value;
  if ((nome === "ajuda" || nome === "mundo" || nome === "ajustes" || nome === "conta") && !["ajuda", "mundo", "ajustes", "conta"].includes(antes)) volta.value = antes;
  tela.value = nome;
  overlayCfg.rotulos = nome !== "titulo" && nome !== "heroi";
  let pausa = false;
  if (nome === "menu") pausa = true;
  else if (nome === "ajuda" || nome === "mundo" || nome === "ajustes" || nome === "conta") pausa = volta.value === "menu";
  else if ((nome === "titulo" || nome === "heroi") && G.ctrl) pausa = true;
  G.paused = pausa;
  laco.pausadoPorTela = true;
  pausarAudio(false);
  if (nome === "menu") { fecharDeck(); G.mirandoSlot = -1; G.convidando = false; if (G.ctrl) salvarLocalMundo(true); }
  if (nome === "ajuda") { PREF.ajudaVista = 1; salvarPref(); }
  atualizar();
}
export function teclaVoltar() {
  const t = tela.value;
  if (t === "jogo") { if (painel.value) { fecharDeck(); return; } if (G.mirandoSlot >= 0) { G.mirandoSlot = -1; atualizar(); return; } irPara("menu"); }
  else if (t === "menu") irPara("jogo");
  else if (t === "ajuda" || t === "mundo" || t === "ajustes" || t === "conta") irPara(volta.value);
  else if (t === "heroi") irPara("titulo");
}

/* ---------- folha de painéis ---------- */
export function abrirDeck(k?: Painel) {
  npcAberto.value = null;
  const p = k || (painel.value && painel.value !== "npc" ? painel.value : painelUlt.value);
  painel.value = p; painelUlt.value = p;
  G.mirandoSlot = -1;
  atualizar();
}
export function fecharDeck() {
  painel.value = ""; npcAberto.value = null; cheio.value = false;
  atualizar();
}
export function abrirNpc(id: string) {
  const c = G.ctrl;
  if (!c) return;
  if (pzAtiva(c)) { avisoDe(c, "Com trava de PZ nenhum NPC atende · " + Math.ceil(pzRestante(c)) + " s", "#e0b93a"); return; }
  npcAberto.value = id; painel.value = "npc";
  atualizar();
}
export function atualizar() { tick.value++; }

/* ---------- ações do HUD ---------- */
export function atacar() {
  const u = G.ctrl; if (!u || u.dead) return false;
  if (u.alvoManual && !u.alvoManual.dead) { u.alvoManual = null; u.target = null; u.think = 0; atualizar(); return true; }
  const a = alvoMaisProximo(u);
  if (!a) { fx({ t: "ui", s: "nega" }); return false; }
  if (u.refil) pausaRefil(u, "volta quando o alvo cair");
  declararPk(u, a);
  u.alvoManual = a; u.target = a; u.ordem = null; u.npcAlvo = null; u.think = 0;
  fecharDeck();
  return true;
}
export function usarSlot(i: number) {
  const c = G.ctrl; if (!c || c.dead) return false;
  const k = slotDe(c, i), m = magiaDe(c, k);
  if (m.mira) {
    const t = c.alvoManual && !c.alvoManual.dead ? c.alvoManual : null;
    if (t && k !== "chuva") { G.mirandoSlot = -1; mirarMagia(c, i, t.x, t.y); atualizar(); return true; }
    G.mirandoSlot = G.mirandoSlot === i ? -1 : i;
    if (G.mirandoSlot >= 0) fecharDeck();
    atualizar(); return true;
  }
  const ok = lancar(c, k);
  if (!ok) fx({ t: "ui", s: "nega" });
  atualizar();
  return ok;
}
export function beber(tipo: "hp" | "mp") {
  const c = G.ctrl; if (!c) return false;
  const ok = beberPocao(c, tipo);
  if (!ok) fx({ t: "ui", s: "nega" });
  atualizar();
  return ok;
}

/* ---------- liga a simulação à interface ---------- */
export function ligarInterface() {
  ui.aviso = aviso;
  ui.banner = banner;
  ui.popXp = pXp;
  ui.popOuro = pOuro;
  hooks.fecharDeck = fecharDeck;
  hooks.abrirNpc = abrirNpc;
  hooks.onAssumir = (u: Unit) => { painel.value = ""; retrato.value = retratoDe(u); atualizar(); };
  hooks.onLargar = () => { painel.value = ""; npcAberto.value = null; retrato.value = ""; atualizar(); };
  hooks.setCam = (a: boolean) => { G.autoCam = a; atualizar(); };
  laco.aoTick = () => {
    tick.value++;
    /* o balcão fecha se o herói se afasta ou ganha trava */
    const c = G.ctrl;
    if (painel.value === "npc" && (!c || c.dead || !npcAberto.value || !npcPerto(c, npcAberto.value))) { painel.value = ""; npcAberto.value = null; }
  };
  entrada.acoes = {
    aoTocarNpc: (id) => abrirNpc(id),
    atalho: (k) => {
      if (k === "1" || k === "2" || k === "3" || k === "4") usarSlot(+k - 1);
      else if (k === "q") beber("hp");
      else if (k === "e") beber("mp");
      else if (k === "f" || k === "tab") atacar();
      else if (k === "m") { if (painel.value) fecharDeck(); else abrirDeck("equip"); }
    },
    voltar: teclaVoltar,
    noJogo: () => tela.value === "jogo",
    painelAberto: () => !!painel.value,
    fecharPainel: fecharDeck,
    atualizar,
  };
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) return;
    if (tela.value === "jogo") irPara("menu");
    else if (G.ctrl) salvarLocalMundo(true);
    pausarAudio(true);
  });
  window.addEventListener("pagehide", () => { if (G.ctrl && G.running) salvarLocalMundo(true); });
  void W;
}
function npcPerto(u: Unit, id: string) {
  const n = W.cidade.npcs.find((q) => q.id === id);
  if (!n || pzAtiva(u)) return false;
  return Math.hypot(u.x - n.x, u.y - n.y) <= NPC_ALCANCE + 1.3;
}
