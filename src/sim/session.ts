/* ================================================================
   PARTIDA — regras do mundo, mundo novo, herói novo, assumir e largar
   o comando. Mundo novo e mundo carregado passam pelo mesmo caminho: a
   semente entra e o gerador roda sem nada consumir o sorteio antes.
   ================================================================ */
import { FAUNA, KINDS, VOCS, type VocKey } from "./data";
import { avisoDe, fx, FX } from "./fx";
import { buildGrid, buildMap, construirCidade, emPZ, ensureConnected, initPath, nearestFree, refreshAlive } from "./map";
import { clamp, reseed, rnd, rr } from "./rng";
import { G, W, hooks } from "./state";
import { pontoDoPlano, pontoProporcional, recalcular } from "./stats";
import type { Unit } from "./types";
import { corGuilda, corLivre, makeUnit, paleta, resetNames } from "./unit";
import { criarZonas, iniciaMundoUnit, novaParty, povoarZonas, sqBase } from "./world";
import { atalhosPadrao } from "./spells";

export type Cfg = Record<VocKey, number>;
export const SETUP = {
  livre: true, guildas: 2, tamanho: 72, monstros: 220,
  cfgLivre: { knight: 4, archer: 4, mage: 4, druid: 4 } as Cfg,
  cfgGuilda: [0, 1, 2, 3].map(() => ({ knight: 1, archer: 1, mage: 1, druid: 1 })) as Cfg[],
  sujo: false,
};
export const somaCfg = (c: Cfg) => VOCS.reduce((a, k) => a + c[k], 0);
export function distribuirTotal(n: number) {
  const c: Cfg = { knight: 0, archer: 0, mage: 0, druid: 0 };
  for (let i = 0; i < n; i++) c[VOCS[i % 4]]++;
  SETUP.cfgLivre = c;
}
function sortearCfg(n: number): Cfg {
  const c: Cfg = { knight: 0, archer: 0, mage: 0, druid: 0 };
  for (let i = 0; i < n; i++) c[VOCS[Math.floor(Math.random() * VOCS.length)]]++;
  return c;
}
export function sortearVocacoes() {
  if (SETUP.livre) SETUP.cfgLivre = sortearCfg(Math.max(1, somaCfg(SETUP.cfgLivre)));
  else for (let t = 0; t < SETUP.guildas; t++) SETUP.cfgGuilda[t] = sortearCfg(Math.max(1, somaCfg(SETUP.cfgGuilda[t])));
}

export function prepararMundo(seed: number) {
  if (G.ctrl) largar();
  reseed(seed);
  W.semente = seed >>> 0;
  W.worldLivre = SETUP.livre; W.guildasN = SETUP.guildas; W.worldSize = SETUP.tamanho; W.worldBeastCap = SETUP.monstros;
  W.simTime = 0; W.uid = 1; W.worldTick = 0; W.grupoT = 0; W.featured = null; W.featT = 0;
  W.projs = []; W.meteors = []; W.ondas = [];
  G.sel = null; G.ctrl = null; G.mirandoSlot = -1; SETUP.sujo = false;
  W.units = []; W.squads = []; W.parties = []; W.partyId = 1; W.convitesPend = [];
  FX.length = 0;
  W.N = clamp(W.worldSize, 48, 180);
  buildMap();
  construirCidade(paleta);
  initPath();
  ensureConnected([W.cidade, { x: W.N / 2, y: W.N / 2 }]);
  criarZonas();
  W.guerra = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  W.mapaVersao++;
}
function cfgDe(t: number) { return W.worldLivre ? SETUP.cfgLivre : SETUP.cfgGuilda[t]; }
export function buildWorldArmies() {
  W.units = []; W.squads = []; W.parties = []; W.partyId = 1; W.convitesPend = []; resetNames();
  const nT = W.worldLivre ? 1 : W.guildasN;
  for (let t = 0; t < nT; t++) {
    W.squads.push(sqBase(t, W.cidade.nasce));
    const c = cfgDe(t);
    for (const k of VOCS) for (let i = 0; i < c[k]; i++) {
      const f = nearestFree(W.cidade.x + rr(-5, 5), W.cidade.y + rr(-5, 5));
      const u = makeUnit(t, k, f[0] + .5, f[1] + .5);
      u.cor = W.worldLivre ? corLivre() : corGuilda(t);
      const lv = 1 + Math.floor(rnd() * rnd() * 9);
      for (let m = 1; m < lv; m++) { u.lvl++; u.attr[pontoDoPlano(u)]++; }
      iniciaMundoUnit(u);
      u.pz = emPZ(u.x, u.y);
      u.fa = rnd() * 6.283; u.moveA = u.fa;
      W.units.push(u);
      W.squads[t].start++;
    }
  }
  for (let t = W.squads.length; t <= FAUNA; t++) W.squads[t] = sqBase(t, { x: W.N / 2, y: W.N / 2 });
  povoarZonas();
  for (const u of W.units) if (!u.beast) novaParty(u);
  W.guerra = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
}
export function terminarInicio() {
  refreshAlive(); buildGrid();
  G.paused = false;
  hooks.setCam(true);
  G.running = true;
  hooks.centrarEm(W.cidade);
}
export function startWorld() {
  if (SETUP.livre && !somaCfg(SETUP.cfgLivre)) SETUP.cfgLivre.knight = 1;
  if (!SETUP.livre) for (let t = 0; t < SETUP.guildas; t++) if (!somaCfg(SETUP.cfgGuilda[t])) SETUP.cfgGuilda[t].knight = 1;
  prepararMundo((Date.now() ^ (Math.random() * 1e9)) >>> 0);
  buildWorldArmies();
  terminarInicio();
}

/* ---------- [SYSTEM: HEROI] herói novo nasce no obelisco ---------- */
export function criarHeroi(kind: VocKey, nome: string) {
  if (!KINDS[kind] || KINDS[kind].beast) kind = "knight";
  if (G.ctrl) largar();
  const t = 0;
  const f = nearestFree(W.cidade.x + rr(-2.5, 2.5), W.cidade.y + rr(-2.5, 2.5));
  const u = makeUnit(t, kind, f[0] + .5, f[1] + .5);
  u.cor = W.worldLivre ? corLivre() : corGuilda(t);
  if (nome) u.name = nome;
  iniciaMundoUnit(u);
  u.pz = emPZ(u.x, u.y);
  u.fa = rnd() * 6.283; u.moveA = u.fa;
  W.units.push(u);
  if (W.squads[t]) W.squads[t].start++;
  novaParty(u);
  refreshAlive(); buildGrid();
  assumir(u);
  fx({ t: "revive", u });
  return u;
}
export function assumir(u: Unit | null) {
  if (!u || u.beast) return;
  G.ctrl = u; u.ordem = null; u.target = null; u.path = null; u.goalKey = ""; u.encomenda = null; u.npcAlvo = null;
  G.ctrlDesde = W.simTime; G.mirandoSlot = -1;
  G.AUTO.cura.ligado = 1;
  if (!u.slots) u.slots = atalhosPadrao(u.kind as VocKey);
  G.convidando = false; G.sel = null;
  hooks.setCam(true);
  hooks.onAssumir(u);
  avisoDe(u, "Você comanda " + u.name, u.cor.hi);
}
export function largar() {
  const u = G.ctrl;
  if (u) {
    u.ordem = null; u.target = null; u.alvoManual = null; u.encomenda = null; u.npcAlvo = null; u.refil = null;
    u.goalKey = ""; u.path = null; u.think = 0;
    if (u.w) u.w.t = 0;
    if (u.manual) {
      u.proporcao = Object.assign({}, u.attr);
      while (u.pts > 0) { u.attr[pontoProporcional(u)]++; u.pts--; }
      recalcular(u, true);
    }
  }
  if (G.AUTO.lider) { G.AUTO.lider = 0; for (const o of W.units) if (!o.beast) { o.think = 0; o.goalKey = ""; } }
  G.ctrl = null; G.mirandoSlot = -1; G.convidando = false;
  hooks.onLargar();
}
