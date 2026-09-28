/* Criação de unidade, cores, nomes e utilidades de estado. */
import { ACERTO_BASE, ACERTO_BICHO, FAUNA, FIRST_NAMES, GUILDA_H, KINDS, POSTURAS, ST, TEAMS, type Estado, type KindKey, type Paleta, type VocKey } from "./data";
import { clamp, rnd, rr } from "./rng";
import { W } from "./state";
import { sorteiaPlano } from "./stats";
import { nearestFree } from "./map";
import { pzAtiva } from "./pk";
import type { Unit } from "./types";

/* ---------- [SYSTEM: COR] ---------- */
export function hsl2hex(h: number, s: number, l: number) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const v = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(v * 255).toString(16).padStart(2, "0");
  };
  return "#" + f(0) + f(8) + f(4);
}
export function paleta(h: number, s: number, dl = 0): Paleta {
  return { h: Math.round(h), c: hsl2hex(h, s, 55 + dl), lo: hsl2hex(h, s * .9, 24 + dl * .5), hi: hsl2hex(h, Math.min(100, s + 8), 74 + dl * .4) };
}
/* roupas sem matiz: branca com preto e preta com detalhes brancos.
   `h` fora de 0..359 identifica a paleta ao salvar e ao carregar */
export const BRANCO_PRETO: Paleta = { h: 400, c: "#e8e5dc", lo: "#1c1c21", hi: "#ffffff" };
export const PRETO_BRANCO: Paleta = { h: 401, c: "#26262c", lo: "#131317", hi: "#f2f0ea" };
export const CORES_FICHA = [...[0, 18, 36, 52, 78, 120, 158, 184, 204, 226, 252, 280, 308, 334].map((h) => paleta(h, 68)), BRANCO_PRETO, PRETO_BRANCO];
export function corLivre() {
  const r = rnd();
  if (r < .05) return BRANCO_PRETO;
  if (r < .1) return PRETO_BRANCO;
  return paleta(Math.floor(rnd() * 360), 58 + rnd() * 20, rr(-4, 4));
}
export function corGuilda(t: number) { return paleta((GUILDA_H[t] + rr(-12, 12) + 360) % 360, 60 + rr(-8, 10), rr(-7, 7)); }
export function corPorMatiz(h: number) { return h === 400 ? BRANCO_PRETO : h === 401 ? PRETO_BRANCO : paleta(h, 68); }

/* ---------- nomes: repetido só depois de esgotar a lista ---------- */
let namePool: string[] = [], nameI = 0;
export function resetNames() {
  namePool = FIRST_NAMES.slice();
  for (let i = namePool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = namePool[i]; namePool[i] = namePool[j]; namePool[j] = t; }
  nameI = 0;
}
export function nextName() {
  if (!namePool.length) resetNames();
  const n = namePool[nameI % namePool.length];
  const volta = Math.floor(nameI / namePool.length);
  nameI++;
  return volta ? n + " " + (volta + 1) : n;
}

export const TRAVA_TESTE = 3, TRAVA_MIN = .45, TRAVA_VOLTA = 8;

export function makeUnit(team: number, kind: KindKey, x: number, y: number): Unit {
  const K = KINDS[kind];
  const beast = !!K.beast;
  return {
    id: W.uid++, team, kind, K, name: beast ? K.pt : nextName(),
    cor: beast ? TEAMS[FAUNA] : (TEAMS[team] || TEAMS[0]),
    swing: 0, swMax: 1, moving: 0, dirx: 0, diry: 1, reborn: 0, fa: 0, moveA: 0,
    draw: 0, drawMax: .36, pending: null, aim: 0,
    x, y, px: x, py: y, hp: K.hp, maxHp: K.hp, bob: rnd() * 6,
    st: ST.ADVANCE, stSince: 0,
    path: null, pi: 0, repath: rnd() * .6, goal: null, goalKey: "", gkx: 0, gky: 0, _g: null,
    target: null, cd: rr(0, K.cd), think: rnd() * .35,
    slot: -1, flank: 0, charge: 0, cvx: 0, cvy: 0,
    tiros: 0, tiroT: 0, exAte: {}, ordem: null, encomenda: null, npcAlvo: null,
    potHp: 0, potMp: 0, pressa: 0, paral: 0, alvoManual: null,
    mp: K.mp, maxMp: K.mp, lvl: 1, xp: 0, bonus: 0, velo: 1, regHp: 0, regMp: 0,
    attr: { str: 0, dex: 0, def: 0, mag: 0, hp: 0, mp: 0 }, pts: 0, manual: false, proporcao: null, magic: 0, defesa: 0,
    plano: beast ? null : sorteiaPlano(kind as VocKey),
    post: POSTURAS[Math.floor(rnd() * POSTURAS.length)], postT: rr(6, 22),
    driftX: rr(-5, 5), driftY: rr(-5, 5),
    acerto: beast ? ACERTO_BICHO : ACERTO_BASE,
    beast, home: null, roam: 5, wander: 0, prov: null, isca: 0,
    packTgt: null, packT: 0, strafe: 0, strafeT: 0, odio: null, taunt: null, tauntAte: 0,
    cdA: rr(1, 4), cdB: rr(2, 6), cdI: 0, fogoT: 0, wHit: 0,
    travX: x, travY: y, travT: rnd() * TRAVA_TESTE, travas: 0, desvio: 0, desvioA: 0,
    isKnight: kind === "knight", isArcher: kind === "archer",
    ai: {
      p: { enemyCount: 0, allyCount: 0, perto: 0, pertoAliado: 0, closest: null, closestD: 1e9,
        closestRanged: null, rangedD: 1e9, weakest: null, weakestHp: 0, ferido: null, feridoFrac: 1,
        danger: 0, rangedPressure: 0, surrounded: false, cerco: false, saidaA: 0, best: null, bestSc: 0 },
      mem: { lastSeen: null, lastSeenT: -1e9, lastX: 0, lastY: 0, lastDmgFrom: null, lastDmgT: -1e9 },
      role: 0,
    },
    losId: -1, losT: -1e9, losV: false,
    mochila: [], cofre: [], eqp: { cab: null, amu: null, arm: null, arma: null, esc: null, cal: null, ane: null, bot: null },
    ouro: 0, banco: 0,
    skull: null, brancaInj: false, injustas: 0, injustaUlt: 0, vermelhaAte: 0,
    atkBy: {}, contrib: {}, pkJust: true, ultimos: [null, null], amarela: null, agrediu: null,
    pzLuta: -1e9, pzMorte: 0, pz: false,
    slow: 0, hurt: 99, kills: 0, pkKills: 0, dmg: 0, lunge: 0, dead: false,
    tagT: 0, flash: 0, squash: 0, morteT: -1e9, zonaAtual: null,
    w: null, party: null, rep: null, convite: null, slots: null,
    refil: null, refilEspera: 0, refilAvisoT: 0,
    xpMult: 1, zona: null, bando: null, coleira: 0, remover: false, _imp: 0,
    hitX: 0, hitY: 0, castT: 0, castK: "",
    venDps: 0, venAte: 0, venTick: 0, venSrc: null,
  };
}

export function setState(u: Unit, s: Estado) { if (u.st !== s) { u.st = s; u.stSince = W.simTime; u.tagT = 1.6; } }
export function novaPostura(u: Unit) {
  u.post = POSTURAS[Math.floor(rnd() * POSTURAS.length)];
  u.postT = W.simTime + rr(12, 28);
  u.driftX = rr(-5, 5); u.driftY = rr(-5, 5);
}
/* o destino reaproveita o mesmo objeto; `goalKey=""` força rota nova */
export function goTo(u: Unit, x: number, y: number, key: string) {
  const g = u._g || (u._g = { x: 0, y: 0 });
  g.x = clamp(x, .6, W.N - .6); g.y = clamp(y, .6, W.N - .6);
  /* destino na água, ou no calçamento para quem não pode entrar, vira o
     ponto livre mais próximo: segue até a margem em vez de empacar */
  const i = (g.y | 0) * W.N + (g.x | 0);
  const semPz = !u.pz && (u.beast || pzAtiva(u));
  if (W.solid[i] || (semPz && W.pzMask[i])) {
    const f = nearestFree(g.x, g.y, semPz);
    g.x = f[0] + .5; g.y = f[1] + .5;
  }
  u.goal = g;
  const kx = (g.x * .6) | 0, ky = (g.y * .6) | 0;
  if (key !== u.goalKey || kx !== u.gkx || ky !== u.gky) { u.goalKey = key; u.gkx = kx; u.gky = ky; u.repath = 0; }
}
