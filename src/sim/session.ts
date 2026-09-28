/* ================================================================
   PARTIDA — regras do mundo, mundo novo, herói novo, assumir e largar
   o comando. Mundo novo e mundo carregado passam pelo mesmo caminho: a
   semente entra e o gerador roda sem nada consumir o sorteio antes.
   ================================================================ */
import { FAUNA, KINDS, VOCS, sexoDoNome, type VocKey } from "./data";
import { avisoDe, fx, FX } from "./fx";
import { buildGrid, buildMap, construirCidade, emPZ, ensureConnected, initPath, nearestFree, refreshAlive } from "./map";
import { clamp, reseed, rnd, rr } from "./rng";
import { G, W, hooks } from "./state";
import { pontoDoPlano, pontoProporcional, recalcular, temProporcao } from "./stats";
import type { Unit } from "./types";
import { corGuilda, corLivre, makeUnit, paleta, resetNames } from "./unit";
import { criarZonas, iniciaMundoUnit, novaParty, povoarZonas, reajustarFauna, sqBase } from "./world";
import { atalhosPadrao } from "./spells";
import { MERCADO } from "./mercado";

export type Cfg = Record<VocKey, number>;
/* Mega: o maior mapa que ainda roda liso no celular (grama e árvores em
   blocos recortados pela câmera; a simulação pesa pelos bichos, não pelo chão) */
export const TAMANHO_MEGA = 192;
export { TAMANHO_ULTIMATE } from "./biomas";
import { TAMANHO_ULTIMATE } from "./biomas";
export const SETUP = {
  livre: true, guildas: 2, tamanho: 192, monstros: 220,
  cfgLivre: { knight: 8, archer: 8, mage: 8, druid: 8 } as Cfg,
  cfgGuilda: [0, 1, 2, 3].map(() => ({ knight: 4, archer: 4, mage: 4, druid: 4 })) as Cfg[],
  sujo: false,
};
export const somaCfg = (c: Cfg) => VOCS.reduce((a, k) => a + c[k], 0);
function repartir(n: number): Cfg {
  const c: Cfg = { knight: 0, archer: 0, mage: 0, druid: 0 };
  for (let i = 0; i < n; i++) c[VOCS[i % 4]]++;
  return c;
}
export function distribuirTotal(n: number) { SETUP.cfgLivre = repartir(n); }
export function distribuirGuilda(t: number, n: number) { SETUP.cfgGuilda[t] = repartir(n); }
/* números exatos, de 10 em 10 (a partir de qualquer valor, cai na dezena) */
export const JOGADORES_MAX = 150, GUILDA_MAX = 60, MONSTROS_MIN = 10, MONSTROS_MAX = 1500;
export const sobe10 = (v: number, max: number) => Math.min(max, Math.floor(v / 10) * 10 + 10);
export const desce10 = (v: number, min: number) => Math.max(min, Math.ceil(v / 10) * 10 - 10);
/* Poucos, Normal e Muitos acompanham o tamanho do mapa */
export function presetsMonstros(t: number): [number, number, number] { return t >= TAMANHO_ULTIMATE ? [360, 600, 840] : [120, 220, 340]; }
export function mudarTamanho(t: number) {
  const i = presetsMonstros(SETUP.tamanho).indexOf(SETUP.monstros);
  SETUP.tamanho = t;
  if (i >= 0) SETUP.monstros = presetsMonstros(t)[i];
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
  MERCADO.ofertas = [];
  G.sel = null; G.ctrl = null; G.mirandoSlot = -1; SETUP.sujo = false;
  W.units = []; W.squads = []; W.parties = []; W.partyId = 1; W.convitesPend = [];
  FX.length = 0;
  W.N = clamp(W.worldSize, 48, TAMANHO_ULTIMATE);
  buildMap();
  construirCidade(paleta);
  initPath();
  /* murada: liga o obelisco aos quatro portões (o meio do mapa cai dentro da cidade) */
  ensureConnected(W.cidade.portoes ? [W.cidade.nasce, ...W.cidade.portoes] : [W.cidade, { x: W.N / 2, y: W.N / 2 }]);
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
      /* todo mundo começa do zero: nível 1, kit básico */
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
/* o que só um mundo novo resolve: mapa, regra e guildas */
export function mudancasDeMundo(): string[] {
  const L: string[] = [];
  if (SETUP.tamanho !== W.worldSize) L.push("tamanho do mapa");
  if (SETUP.livre !== W.worldLivre) L.push("regra do mundo");
  else if (!SETUP.livre && SETUP.guildas !== W.guildasN) L.push("número de guildas");
  return L;
}
/* aplica no mundo em andamento: aventureiros da IA e criaturas.
   Quem sobra sai (primeiro quem está na cidade, e o de menor nível);
   quem falta nasce no obelisco, nível 1. Seu personagem e o seu grupo ficam. */
export function aplicarNoAtual() {
  if (mudancasDeMundo().length) return null;
  const nT = W.worldLivre ? 1 : W.guildasN;
  let entraram = 0, sairam = 0;
  const meus = G.ctrl && G.ctrl.party ? G.ctrl.party.membros : [];
  for (let t = 0; t < nT; t++) {
    const c = cfgDe(t);
    for (const k of VOCS) {
      const lista = W.units.filter((u) => !u.beast && !u.remover && u.team === t && u.kind === k && u !== G.ctrl);
      let falta = c[k] - lista.length;
      if (falta < 0) {
        lista.sort((a, b) => (Number(b.pz) - Number(a.pz)) || (a.lvl - b.lvl));
        for (const u of lista) {
          if (falta >= 0) break;
          if (meus.indexOf(u) >= 0) continue;
          if (u.party) { const p = u.party; const i = p.membros.indexOf(u); if (i >= 0) p.membros.splice(i, 1); if (p.lider === u) p.lider = p.membros[0] || null; u.party = null; }
          fx({ t: "revive", u });
          u.dead = true; u.hp = 0; u.remover = true; u.morteT = W.simTime - 1; u.reborn = 0;
          falta++; sairam++;
        }
      }
      for (; falta > 0; falta--) {
        const f = nearestFree(W.cidade.x + rr(-5, 5), W.cidade.y + rr(-5, 5));
        const u = makeUnit(t, k, f[0] + .5, f[1] + .5);
        u.cor = W.worldLivre ? corLivre() : corGuilda(t);
        iniciaMundoUnit(u);
        u.pz = emPZ(u.x, u.y);
        u.fa = rnd() * 6.283; u.moveA = u.fa;
        W.units.push(u);
        if (W.squads[t]) W.squads[t].start++;
        novaParty(u);
        fx({ t: "revive", u });
        entraram++;
      }
    }
  }
  W.worldBeastCap = SETUP.monstros;
  reajustarFauna();
  SETUP.sujo = false;
  refreshAlive(); buildGrid();
  return { entraram, sairam };
}
export function startWorld() {
  if (SETUP.livre && !somaCfg(SETUP.cfgLivre)) SETUP.cfgLivre.knight = 1;
  if (!SETUP.livre) for (let t = 0; t < SETUP.guildas; t++) if (!somaCfg(SETUP.cfgGuilda[t])) SETUP.cfgGuilda[t].knight = 1;
  prepararMundo((Date.now() ^ (Math.random() * 1e9)) >>> 0);
  buildWorldArmies();
  terminarInicio();
}

/* ---------- [SYSTEM: HEROI] herói novo nasce no obelisco ---------- */
export function criarHeroi(kind: VocKey, nome: string, sexo?: "m" | "f") {
  if (!KINDS[kind] || KINDS[kind].beast) kind = "knight";
  if (G.ctrl) largar();
  const t = 0;
  const f = nearestFree(W.cidade.x + rr(-2.5, 2.5), W.cidade.y + rr(-2.5, 2.5));
  const u = makeUnit(t, kind, f[0] + .5, f[1] + .5);
  u.cor = W.worldLivre ? corLivre() : corGuilda(t);
  if (nome) u.name = nome;
  u.sexo = sexo || sexoDoNome(u.name);
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
    /* ao largar, os pontos livres seguem a proporção de quem jogou (ou,
       sem nada posto à mão, o plano) */
    if (u.manual && !temProporcao(u)) u.proporcao = Object.assign({}, u.attr);
    if (u.pts > 0) {
      while (u.pts > 0) { u.attr[temProporcao(u) ? pontoProporcional(u) : pontoDoPlano(u)]++; u.pts--; }
      recalcular(u, true);
    }
  }
  if (G.AUTO.lider) { G.AUTO.lider = 0; for (const o of W.units) if (!o.beast) { o.think = 0; o.goalKey = ""; } }
  G.ctrl = null; G.mirandoSlot = -1; G.convidando = false;
  hooks.onLargar();
}
