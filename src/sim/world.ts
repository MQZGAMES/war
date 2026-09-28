/* ================================================================
   MUNDO ABERTO — pontos de caça, bandos, grupos, convites, tática,
   PK, guerras de guilda, perfis e o ciclo caçar → cidade → caçar.
   [SYSTEM: WORLD_MAP] [SYSTEM: WORLD_SPAWN] [SYSTEM: WORLD_PARTY]
   [SYSTEM: WORLD_INVITE] [SYSTEM: AI_TATICA] [SYSTEM: AI_PERFIL]
   [SYSTEM: AI_GRUPO] [SYSTEM: AI_CICLO] [SYSTEM: WORLD_ZONE]
   ================================================================ */
import { BEASTS, FAUNA, KINDS, ST, TEAMS, VERMELHA_N, type AtqModo, type KindKey } from "./data";
import { avisoDe, fx, ui } from "./fx";
import { darItem, negociar, novoItem, pocaoItem, precisaNpc, querForjar, reservaIA, saldo, livres, temMelhoria, PRECO_HP } from "./items";
import { KIT, BASES, COFRE_N, MOCHILA_N } from "./itemsData";
import { CID_R, emPZ, nearestFree, npcDe, NPC_ALCANCE, portaoPara, QBUF, queryRadius } from "./map";
import { pzAtiva } from "./pk";
import { guerraAtiva, inimigo, odeia, PARTY_MAX, PK_DUR, querAtacar, rancor } from "./relations";
import { clamp, dist, dist2, ri, rnd, rr } from "./rng";
import { G, W } from "./state";
import { poder, recalcular } from "./stats";
import type { Bando, Party, Pt, Squad, Unit, Zona } from "./types";
import { goTo, makeUnit, setState } from "./unit";
import { unitThink, R_APOIO, R_FRENTE, R_FUNDO } from "./ai";
import { caveiraRelogio } from "./pk";
import { mercadoPasso } from "./mercado";

/* ---------- modelos de ponto de caça por faixa (1..7) ---------- */
export const ZONAS: { n: string; tier: number; sp: Partial<Record<KindKey, number>> }[] = [
  { n: "Pastagem", tier: 1, sp: { hen: 4, cow: 3 } },
  { n: "Brejo das cobras", tier: 2, sp: { snake: 4, rat: 2 } },
  { n: "Cemitério", tier: 3, sp: { skeleton: 4, snake: 1 } },
  { n: "Deserto", tier: 4, sp: { scorpion: 3, lion: 1 } },
  { n: "Cripta", tier: 6, sp: { vampire: 2, skeleton: 3 } },
  { n: "Pântano da hidra", tier: 7, sp: { hydra: 1, snake: 3 } },
  { n: "Covil do beemote", tier: 7, sp: { behemoth: 1, cyclops: 1 } },
  { n: "Toca de ratos", tier: 1, sp: { rat: 5 } },
  { n: "Ninhada", tier: 1, sp: { rat: 4, hen: 2 } },
  { n: "Alcateia", tier: 2, sp: { wolf: 5 } },
  { n: "Lameiro", tier: 2, sp: { boar: 3, rat: 3 } },
  { n: "Teia", tier: 3, sp: { spider: 5 } },
  { n: "Cerrado", tier: 3, sp: { boar: 4, wolf: 2 } },
  { n: "Covil", tier: 3, sp: { bear: 2, wolf: 3 } },
  { n: "Savana", tier: 4, sp: { lion: 3, boar: 2 } },
  { n: "Acampamento orc", tier: 4, sp: { orc: 4, wolf: 2 } },
  { n: "Urso do norte", tier: 4, sp: { bear: 3, spider: 2 } },
  { n: "Ruína antiga", tier: 5, sp: { orc: 3, troll: 2 } },
  { n: "Ermo", tier: 5, sp: { troll: 3, boar: 2 } },
  { n: "Horda orc", tier: 5, sp: { orc: 4, troll: 2 } },
  { n: "Colina do touro", tier: 6, sp: { minotaur: 2, orc: 2 } },
  { n: "Bosque negro", tier: 6, sp: { minotaur: 2, spider: 3 } },
  { n: "Penhasco", tier: 6, sp: { cyclops: 2, troll: 2 } },
  { n: "Vale calcinado", tier: 7, sp: { dragon: 1, cyclops: 2 } },
  { n: "Toca do dragão", tier: 7, sp: { dragon: 2, troll: 1 } },
  { n: "Fenda infernal", tier: 7, sp: { demon: 1, dragon: 1 } },
  { n: "Trono do ciclope", tier: 7, sp: { cyclops: 3, minotaur: 1 } },
];
export const COR_TIER = ["#8fd6a0", "#b5d67f", "#dccf6a", "#e6b43a", "#e68a3a", "#e65f3f", "#d13a5a"];
export function corTier(t: number) { return COR_TIER[clamp((t | 0) - 1, 0, 6)]; }
/* mais pontos fáceis perto da cidade: todo mundo começa no nível 1 */
const COTA_TIER = [.22, .2, .16, .13, .11, .1, .08];
function modeloDaZona(tier: number) {
  const L = ZONAS.filter((z) => z.tier === tier);
  return L[Math.floor(rnd() * L.length)];
}
export function criarZonas() {
  W.zones = [];
  const c = W.cidade, N = W.N;
  const alvo = clamp(Math.round(N * N / 470), 9, N > 150 ? 50 : 30);
  const dMax = Math.max(dist(c.x, c.y, 3, 3), dist(c.x, c.y, N - 3, 3), dist(c.x, c.y, 3, N - 3), dist(c.x, c.y, N - 3, N - 3));
  const cru: { x: number; y: number; r: number; dT: number }[] = [];
  for (let tent = 0; tent < alvo * 80 && cru.length < alvo; tent++) {
    const a = rnd() * 6.283, d = CID_R + 5 + Math.pow(rnd(), .85) * (dMax - CID_R - 8);
    const x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d;
    if (x < 5 || y < 5 || x > N - 5 || y > N - 5) continue;
    const k = clamp((d - CID_R - 5) / (dMax - CID_R - 8), 0, 1);
    const r = 2.8 + k * 3.2 + rnd() * 1.2;
    const gap = r + 5.5 + k * 3;
    let ok = true;
    for (const z of cru) if (dist(x, y, z.x, z.y) < gap + z.r) { ok = false; break; }
    if (ok) cru.push({ x, y, r, dT: d });
  }
  cru.sort((a, b) => a.dT - b.dT);
  let i = 0;
  for (let t = 0; t < 7; t++) {
    const n = t === 6 ? cru.length - i : Math.max(t < 3 ? 1 : 0, Math.round(cru.length * COTA_TIER[t]));
    for (let k = 0; k < n && i < cru.length; k++, i++) {
      const cz = cru[i], mod = modeloDaZona(t + 1);
      W.zones.push({ x: cz.x, y: cz.y, r: cz.r, tier: mod.tier, name: mod.n, sp: { ...mod.sp } as Record<string, number>,
        farto: 1 + cz.r * .12, pop: 0, alvoPop: 0, grupos: 0, repT: 0, id: W.zones.length });
    }
  }
  const nErr = clamp(Math.round(W.worldBeastCap * .06), 4, 24);
  let feitos = 0;
  for (let tent = 0; tent < nErr * 40 && feitos < nErr; tent++) {
    const x = rr(4, N - 4), y = rr(4, N - 4), d = dist(x, y, c.x, c.y);
    if (d < CID_R + 6) continue;
    let ok = true;
    for (const z of W.zones) if (dist(x, y, z.x, z.y) < z.r + 4) { ok = false; break; }
    if (!ok) continue;
    const k = clamp((d - CID_R - 5) / (dMax - CID_R - 8), 0, 1);
    const mod = modeloDaZona(clamp(1 + Math.floor(k * 5), 1, 5));
    let esp = ""; for (const s in mod.sp) { esp = s; break; }
    const sp: Record<string, number> = {}; sp[esp] = 1;
    W.zones.push({ x, y, r: 1.5, tier: mod.tier, name: mod.n, sp, farto: 1, pop: 0, alvoPop: 0, grupos: 0, repT: 0, id: W.zones.length, errante: 1 });
    feitos++;
  }
  garantirEspecies();
}
/* todo mundo tem as 20 criaturas, mesmo com "Poucos": a espécie que o
   sorteio deixou de fora entra no ponto de caça da faixa mais próxima */
function faixaDaEspecie(k: string) { let t = 7; for (const z of ZONAS) if (z.sp[k as KindKey] && z.tier < t) t = z.tier; return t; }
function garantirEspecies() {
  const fixas = W.zones.filter((z) => !z.errante);
  if (!fixas.length) return;
  for (const k of BEASTS) {
    if (W.zones.some((z) => z.sp[k])) continue;
    const t = faixaDaEspecie(k);
    let melhor = fixas[0], md = 1e9;
    for (const z of fixas) {
      const d = Math.abs(z.tier - t) * 10 + Object.keys(z.sp).length;
      if (d < md) { md = d; melhor = z; }
    }
    melhor.sp[k] = KINDS[k].matilha ? 2 : 1;
  }
}

/* ---------- [SYSTEM: WORLD_SPAWN] bandos de até 3 ---------- */
const BANDO: Partial<Record<KindKey, number>> = { bear: 2, lion: 2, troll: 2, scorpion: 2, minotaur: 2, vampire: 2, cyclops: 1, dragon: 1, hydra: 1, demon: 1, behemoth: 1 };
const BANDO_GAP = 4.2, BANDO_ROAM = 1.8, BANDO_COLEIRA = 7;
const REPOP_CD = 2.2;
function bandoMax(kind: KindKey) { return BANDO[kind] || 3; }
function pontoDeBando(z: Zona) {
  const R = z.r + 1.5;
  for (let tent = 0; tent < 60; tent++) {
    const gap = tent < 30 ? BANDO_GAP : BANDO_GAP * .75, g2 = gap * gap;
    const a = rnd() * 6.283, d = Math.sqrt(rnd()) * R;
    const x = z.x + Math.cos(a) * d, y = z.y + Math.sin(a) * d;
    const tx = x | 0, ty = y | 0;
    if (tx < 0 || ty < 0 || tx >= W.N || ty >= W.N || W.solid[ty * W.N + tx]) continue;
    if (dist(x, y, W.cidade.x, W.cidade.y) < CID_R + 5) continue;
    let ok = true;
    for (const b of W.bandos) if (dist2(x, y, b.x, b.y) < g2) { ok = false; break; }
    if (ok) return { x: tx + .5, y: ty + .5 };
  }
  const f = nearestFree(z.x + rr(-z.r, z.r), z.y + rr(-z.r, z.r));
  return { x: f[0] + .5, y: f[1] + .5 };
}
function soltarBando(b: Bando, n: number) {
  const z = b.z, K = KINDS[b.kind];
  for (let i = 0; i < n; i++) {
    const f = nearestFree(b.x + rr(-.9, .9), b.y + rr(-.9, .9));
    const u = makeUnit(FAUNA, b.kind, f[0] + .5, f[1] + .5);
    const nv = K.nv || [K.lvlM || 1, K.lvlM || 1], lv = ri(nv[0], nv[1]);
    const g = 1 + (lv - nv[0]) / Math.max(1, nv[1] - nv[0]) * .6;
    u.lvl = lv; u.xpMult = g;
    u.maxHp = Math.round(K.hp * g); u.hp = u.maxHp;
    u.bonus = K.dmg * (g - 1);
    u.home = { x: b.x, y: b.y };
    /* bicho grande pede mais chão para pastar sem trombar no bando */
    u.roam = z.errante ? 5 : Math.max(BANDO_ROAM, K.r * 4.5); u.coleira = z.errante ? 14 : Math.max(BANDO_COLEIRA, z.r * 1.4);
    u.zona = z; u.bando = b;
    u.fa = rnd() * 6.283; u.moveA = u.fa;
    W.units.push(u);
    z.pop++; b.pop++;
    fx({ t: "revive", u });
  }
}
export function povoarZonas() {
  W.bandos = [];
  let bruto = 0;
  for (const z of W.zones) for (const k in z.sp) bruto += z.sp[k] * z.farto;
  const f = bruto ? Math.min(2.2, W.worldBeastCap / bruto) : 1;
  /* cada espécie de cada ponto recebe ao menos 1; se o teto apertar,
     corta dos grupos maiores — nunca some uma criatura do mundo */
  const cotas: { z: Zona; k: string; n: number }[] = [];
  let soma = 0;
  for (const z of W.zones) for (const k in z.sp) { const n = Math.max(1, Math.round(z.sp[k] * z.farto * f)); cotas.push({ z, k, n }); soma += n; }
  while (soma > W.worldBeastCap) {
    let m = null as (typeof cotas)[number] | null;
    for (const c of cotas) if (c.n > 1 && (!m || c.n > m.n)) m = c;
    if (!m) break;
    m.n--; soma--;
  }
  for (const z of W.zones) { z.pop = 0; z.alvoPop = 0; z.bandos = []; }
  for (const c of cotas) {
    const z = c.z, k = c.k;
    {
      const n = c.n;
      z.alvoPop += n;
      const nb = Math.ceil(n / bandoMax(k as KindKey)), base = Math.floor(n / nb), sobra = n - base * nb;
      for (let i = 0; i < nb; i++) {
        const p = pontoDeBando(z);
        const b: Bando = { x: p.x, y: p.y, kind: k as KindKey, max: base + (i < sobra ? 1 : 0), pop: 0, repT: 0, z };
        W.bandos.push(b); z.bandos!.push(b);
        soltarBando(b, b.max);
      }
    }
  }
}
/* muda a quantidade de criaturas sem gerar outro mundo: refaz a cota de
   cada espécie de cada ponto; falta nasce aos poucos pelo repovoamento,
   sobra sai (só quem não está brigando) */
export function reajustarFauna() {
  let bruto = 0;
  for (const z of W.zones) for (const k in z.sp) bruto += z.sp[k] * z.farto;
  const f = bruto ? Math.min(2.2, W.worldBeastCap / bruto) : 1;
  const cotas: { z: Zona; k: string; n: number }[] = [];
  let soma = 0;
  for (const z of W.zones) for (const k in z.sp) { const n = Math.max(1, Math.round(z.sp[k] * z.farto * f)); cotas.push({ z, k, n }); soma += n; }
  while (soma > W.worldBeastCap) {
    let m = null as (typeof cotas)[number] | null;
    for (const c of cotas) if (c.n > 1 && (!m || c.n > m.n)) m = c;
    if (!m) break;
    m.n--; soma--;
  }
  for (const z of W.zones) z.alvoPop = 0;
  for (const c of cotas) {
    const z = c.z, bs = W.bandos.filter((b) => b.z === z && b.kind === c.k);
    const cap = bandoMax(c.k as KindKey);
    /* bandos novos se a cota passou do que os atuais comportam */
    while (bs.length * cap < c.n) {
      const p = pontoDeBando(z);
      const b: Bando = { x: p.x, y: p.y, kind: c.k as KindKey, max: 0, pop: 0, repT: 0, z };
      W.bandos.push(b); (z.bandos || (z.bandos = [])).push(b); bs.push(b);
    }
    const base = Math.floor(c.n / bs.length), sobra = c.n - base * bs.length;
    bs.forEach((b, i) => {
      b.max = base + (i < sobra ? 1 : 0);
      let excesso = b.pop - b.max;
      if (excesso <= 0) return;
      for (const u of W.units) {
        if (excesso <= 0) break;
        if (u.bando !== b || u.dead || (u.target && !u.target.dead) || u.hurt < 5) continue;
        u.dead = true; u.hp = 0; u.remover = true; u.morteT = W.simTime - 1;
        b.pop--; z.pop--; excesso--;
      }
    });
    z.alvoPop += c.n;
  }
}
function gentePerto(x: number, y: number, r: number) {
  const m = queryRadius(x, y, r);
  for (let i = 0; i < m; i++) { const e = QBUF[i]; if (!e.beast && !e.dead) return true; }
  return false;
}

/* ---------- esquadrão e aventureiro ---------- */
export function sqBase(t: number, home: Pt): Squad {
  return { team: t, stance: "PUSH", stanceT: 0, rally: { x: home.x, y: home.y }, home: { x: home.x, y: home.y },
    focus: null, focusT: 0, focusHp: 0, focusSc: 1e-3, espalhar: 0,
    alert: { target: null, x: 0, y: 0, source: null, time: 0, confidence: 0 }, isca: null,
    cx: home.x, cy: home.y, ex: home.x, ey: home.y, tick: 1e9, kills: 0, dmg: 0, mets: 0, lost: 0, start: 0 };
}
export function iniciaMundoUnit(u: Unit) {
  u.w = { goal: "cidade", dx: u.x, dy: u.y, t: 0, pkT: 0, alvoPk: null,
    pk: rnd(), social: rr(.15, 1), ousadia: rr(.7, 1.35), zona: null,
    ganancia: rr(.5, 1.4), cacaT: 0, presa: null, etapa: 0, pronto: false,
    perfil: "criaturas", perfilT: W.simTime + rr(10, 40), azar: 0 };
  u.mochila = new Array(MOCHILA_N).fill(null);
  u.cofre = new Array(COFRE_N).fill(null);
  u.eqp = { cab: null, amu: null, arm: null, arma: null, esc: null, cal: null, ane: null, bot: null };
  u.ouro = ri(60, 160); u.banco = 0;
  const k = clamp(1 + Math.floor((u.lvl - 1) / 3), 1, 3);
  for (const b of KIT[u.kind as keyof typeof KIT]) u.eqp[BASES[b].s!] = novoItem(b, k);
  darItem(u, pocaoItem("hp", 20));
  if (u.maxMp > 0) darItem(u, pocaoItem("mp", u.kind === "knight" ? 6 : 20));
  u.rep = null; u.pkKills = 0; u.convite = null; u.party = null;
  recalcular(u); u.hp = u.maxHp; u.mp = u.maxMp;
  return u.w;
}

/* ---------- [SYSTEM: WORLD_PARTY] ---------- */
export const TATICAS: Record<string, { n: string; pk: number; alvo?: string; zonaT: [number, number]; vant: number; isca: number; longe?: number; defende?: number }> = {
  cacadores: { n: "Caçadores", pk: 0, zonaT: [70, 150], vant: 9, isca: 1 },
  assassinos: { n: "Assassinos", pk: 1, alvo: "limpo", zonaT: [50, 110], vant: 1.15, isca: 1 },
  justiceiros: { n: "Justiceiros", pk: 1, alvo: "caveira", zonaT: [70, 150], vant: .7, isca: 1 },
  oportunistas: { n: "Oportunistas", pk: 1, alvo: "fraco", zonaT: [60, 120], vant: 1.0, isca: 1 },
  nomades: { n: "Nômades", pk: 0, zonaT: [35, 70], vant: 9, isca: 0, longe: 1 },
  campistas: { n: "Campistas", pk: 0, zonaT: [160, 260], vant: 9, isca: 1, defende: 1 },
};
export function novaParty(u: Unit): Party {
  const p: Party = { id: W.partyId++, team: u.team, sq: sqBase(u.team, W.cidade.nasce),
    membros: [u], lider: u, modo: "acampar", zona: null, t: W.simTime + rr(2, 5), zonaT: 0,
    pkAte: 0, alvo: null, poder: 0,
    tatica: "cacadores", eleicaoT: W.simTime + rr(30, 60), posto: { x: 0, y: 0 }, puxador: null,
    min: (!W.worldLivre && u.w && u.w.social > .62) ? 2 + Math.floor(rnd() * 2) : 1,
    paciencia: W.simTime + rr(10, 20) };
  u.party = p; W.parties.push(p);
  escolheTatica(p);
  return p;
}
function sairParty(u: Unit) {
  const p = u.party; if (!p) return;
  const i = p.membros.indexOf(u);
  if (i >= 0) p.membros.splice(i, 1);
  if (p.lider === u) p.lider = p.membros[0] || null;
  u.party = null;
}
export function entrarParty(u: Unit, p: Party) {
  if (p.membros.length >= PARTY_MAX) return false;
  sairParty(u);
  p.membros.push(u); u.party = p;
  if (!p.lider) p.lider = u;
  return true;
}
/* ---------- [SYSTEM: WORLD_INVITE] ---------- */
const CONVITE_ESPERA = 1.6;
export const EQUIPE_MAX = PARTY_MAX;
export function podeConvidar(a: Unit | null, b: Unit | null) {
  return !!(W.worldLivre && a && b && a !== b && !a.beast && !b.beast && !b.dead &&
    b.party !== a.party && (a.party ? a.party.membros.length : 1) < EQUIPE_MAX);
}
export function convidar(a: Unit, b: Unit) {
  if (!podeConvidar(a, b)) return false;
  if (b.convite && b.convite.t > W.simTime) return false;
  b.convite = { de: a, t: W.simTime + CONVITE_ESPERA };
  W.convitesPend.push(b);
  avisoDe(a, "Convite enviado a " + b.name, "#7fd6a0");
  fx({ t: "invite", u: b, ok: null });
  return true;
}
function aceitaConvite(b: Unit, a: Unit) {
  if (!a || a.dead || b.dead) return false;
  const w = b.w;
  if (!w) return false;
  if (rancor(b, a) > 0) return false;
  const meu = b.party ? b.party.membros.length : 1;
  if (meu > 1 && b.party!.lider === b) return false;
  let ch = w.social * .8 + .15;
  if (dist(a.x, a.y, b.x, b.y) > 14) ch *= .4;
  if (a.skull === "red") ch *= .25;
  else if (a.skull) ch *= .6;
  if (a.lvl > b.lvl + 4) ch += .2;
  return rnd() < clamp(ch, 0, .95);
}
function resolverConvites() {
  const L = W.convitesPend;
  for (let i = L.length - 1; i >= 0; i--) {
    const b = L[i];
    const c = b.convite;
    if (!c || c.t > W.simTime) continue;
    L.splice(i, 1);
    b.convite = null;
    const a = c.de;
    if (!a || a.dead || b.dead) continue;
    if (aceitaConvite(b, a)) {
      const p = a.party || novaParty(a);
      if (entrarParty(b, p)) {
        p.lider = p.lider && !p.lider.dead ? p.lider : a;
        if (a === G.ctrl) {
          p.lider = G.ctrl;
          if (!G.AUTO.lider) {
            G.AUTO.lider = 1;
            for (const o of p.membros) if (o !== G.ctrl) { o.think = 0; o.goalKey = ""; }
            avisoDe(G.ctrl, "Você lidera o grupo · desligue na aba Equipe", "#e0bd63");
          }
        }
        avisoDe(a, b.name + " entrou na equipe", "#7fd6a0");
        avisoDe(b, "Você entrou na equipe de " + (p.lider ? p.lider.name : a.name), "#7fd6a0");
        fx({ t: "invite", u: b, ok: true });
      }
    } else {
      avisoDe(a, b.name + " recusou o convite", "#c96a5a");
      fx({ t: "invite", u: b, ok: false });
    }
  }
}
/* auto agrupar do jogador: chama quem está livre por perto até completar */
function agruparJogador() {
  const c = G.ctrl;
  if (!G.AUTO.agrupar || !c || c.dead) return;
  const p = c.party;
  if (p && p.membros.length > 1 && p.lider !== c) return;
  if (p && p.membros.length >= EQUIPE_MAX) return;
  let melhor: Unit | null = null, bs = -1e9;
  const m = queryRadius(c.x, c.y, 14);
  for (let i = 0; i < m; i++) {
    const o = QBUF[i];
    if (o === c || o.beast || o.dead || !o.w || o.convite || (o.party && o.party.membros.length > 1)) continue;
    if (o.skull === "red" || rancor(o, c) > 0 || rancor(c, o) > 0 || (o.w.pkT > W.simTime)) continue;
    const sc = -Math.abs(o.lvl - c.lvl) * 1.5 - dist(c.x, c.y, o.x, o.y) * .2 + (o.kind !== c.kind ? 2 : 0) + o.w.social * 3;
    if (sc > bs) { bs = sc; melhor = o; }
  }
  if (melhor) convidar(c, melhor);
}
function conviteAutomatico() {
  if (!W.worldLivre || W.simTime < W.conviteIA) return;
  W.conviteIA = W.simTime + 2.5;
  agruparJogador();
  for (const u of W.units) {
    if (u.dead || u.beast || u === G.ctrl || !u.w) continue;
    if (u.party && u.party.membros.length >= EQUIPE_MAX) continue;
    if (u.w.social < .55 || rnd() > .18) continue;
    const m = queryRadius(u.x, u.y, 9);
    for (let i = 0; i < m; i++) {
      const o = QBUF[i];
      if (o === u || o.beast || o.dead || o === G.ctrl) continue;
      if (o.party === u.party || o.convite) continue;
      if (o.party && o.party.membros.length > 1) continue;
      if (rancor(u, o) > 0 || rancor(o, u) > 0) continue;
      convidar(u, o); break;
    }
  }
}
export function deixarEquipe(u: Unit) {
  const p = u.party;
  if (!p || p.membros.length < 2) return false;
  sairParty(u);
  novaParty(u);
  avisoDe(u, "Você deixou a equipe", "#8d9aa0");
  return true;
}
/* o líder tira alguém do grupo */
export function expulsar(lider: Unit, m: Unit) {
  const p = lider.party;
  if (!p || p.lider !== lider || m === lider || m.party !== p) return false;
  sairParty(m); novaParty(m);
  if (m.w) m.think = 0;
  avisoDe(lider, m.name + " saiu da equipe", "#8d9aa0");
  avisoDe(m, lider.name + " tirou você da equipe", "#c96a5a");
  return true;
}
/* [SYSTEM: KS] rancor por roubo de presa: o grupo briga pelo ponto se
   estiver mais forte e disposto; se não, procura outro lugar */
function reagirKs(p: Party) {
  const L = p.lider;
  if (!L || L.dead || L === G.ctrl || !L.w || !p.zona || p.modo !== "caçada") return;
  let ladrao: Unit | null = null, r = 0;
  const q = queryRadius(p.sq.cx, p.sq.cy, p.zona.r + 7);
  const lista: Unit[] = []; for (let i = 0; i < q; i++) lista.push(QBUF[i]);
  for (const e of lista) {
    if (e.beast || e.dead || e.pz || e.party === p) continue;
    let v = 0;
    for (const m of p.membros) if (!m.dead) v = Math.max(v, rancor(m, e));
    if (v > r) { r = v; ladrao = e; }
  }
  if (!ladrao || r < 2) return;
  const vant = poderParty(p) / ((ladrao.party ? poderParty(ladrao.party) : poder(ladrao)) + 1);
  const bravo = L.w.ousadia + L.w.pk * .6;
  if (vant > 1.1 && bravo > 1.05 && L.w.perfil !== "criaturas" || (vant > 1.4 && r >= 3 && bravo > .9)) {
    p.modo = "pk"; p.alvo = ladrao; p.pkAte = W.simTime + PK_DUR;
    for (const m of p.membros) { if (m.dead || m === G.ctrl || !m.w) continue; m.w.pkT = W.simTime + PK_DUR; m.w.alvoPk = ladrao; m.think = .05; }
    if (ladrao === G.ctrl || (G.ctrl && ladrao.party && ladrao.party === G.ctrl.party)) ui.banner("Briga pelo ponto", L.name + " cansou do KS", "alerta");
  } else if (vant < .8 || r >= 4) trocarZona(p, "o ponto está disputado");
}
export function poderParty(p: Party) { let s = 0; for (const m of p.membros) if (!m.dead) s += poder(m); return s; }
export function vivosParty(p: Party) { let n = 0; for (const m of p.membros) if (!m.dead) n++; return n; }

function escolheZona(p: Party, evitar: Zona | null = null) {
  let lv = 0, n = 0;
  for (const m of p.membros) { if (m.dead) continue; lv += m.lvl; n++; }
  lv = n ? lv / n : 1;
  const forca = poderParty(p), T = TATICAS[p.tatica || "cacadores"];
  let melhor: Zona | null = null, bs = -1e9;
  for (const z of W.zones) {
    if (z.errante) continue;
    const ideal = 1 + Math.min(5, Math.floor(lv / 2.2));
    let sc = -Math.abs(z.tier - ideal) * 3.2;
    if (z.tier > ideal + 1) sc -= 6;
    sc -= z.grupos * 2.4;
    if (z === evitar) sc -= 12;
    /* ponto esvaziado por outro grupo rende pouco */
    if (z.alvoPop && z.pop < z.alvoPop * .4) sc -= 3;
    if (z.grupos >= lotacaoZona(z)) sc -= 7;
    if (z.grupos >= lotacaoZona(z) && forca > 1.25 * z.tier * 260 * n) sc += 4;
    const dz = dist(p.sq.cx, p.sq.cy, z.x, z.y) / W.N;
    sc += T.longe ? dz * 3 : -dz * 4.5;
    sc += z.tier * 1.1 * (forca > 420 * n ? 1 : .4);
    sc += rnd() * 2.2;
    if (sc > bs) { bs = sc; melhor = z; }
  }
  if (p.zona) p.zona.grupos = Math.max(0, p.zona.grupos - 1);
  p.zona = melhor;
  if (melhor) { melhor.grupos++; postoDe(p, melhor); }
  p.zonaT = W.simTime + rr(T.zonaT[0], T.zonaT[1]) * 2.2;
  p.modo = "caçada"; p.lutaT = W.simTime; p.largou = null;
}
/* troca de ponto sem voltar à cidade: vazio, sem luta há muito tempo ou cansou */
function trocarZona(p: Party, motivo: string) {
  const velha = p.zona;
  if (velha) velha.grupos = Math.max(0, velha.grupos - 1);
  p.zona = null;
  escolheZona(p, velha);
  p.largou = velha;
  const nova = p.zona as Zona | null;
  if (G.ctrl && G.ctrl.party === p && p.lider && p.lider !== G.ctrl && nova) avisoDe(G.ctrl, p.lider.name + ": " + motivo + ", vamos para " + nova.name, "#9fd0ff");
}
function postoDe(p: Party, z: Zona) {
  const dx = p.sq.cx - z.x, dy = p.sq.cy - z.y, l = Math.hypot(dx, dy) || 1;
  const f = nearestFree(z.x + dx / l * (z.r + 3.5), z.y + dy / l * (z.r + 3.5));
  p.posto.x = f[0] + .5; p.posto.y = f[1] + .5;
  p.puxador = null;
  for (const m of p.membros) { if (!m.dead && m.isKnight && m !== G.ctrl && m.w) { p.puxador = m; m.w.puxa = "ir"; break; } }
}
function papelPorVocacao(u: Unit) { return u.isKnight ? R_FRENTE : u.isArcher ? R_FUNDO : R_APOIO; }
function partySq(p: Party) {
  const sq = p.sq, m = p.membros;
  let cx = 0, cy = 0, n = 0;
  for (const u of m) { if (u.dead) continue; cx += u.x; cy += u.y; n++; }
  if (!n) return;
  sq.cx = cx / n; sq.cy = cy / n;
  const d: Pt = (p.modo === "caçada" && p.zona) ? p.zona : (p.modo === "pk" && p.alvo && !p.alvo.dead) ? p.alvo : W.cidade.nasce;
  const f = nearestFree(d.x, d.y);
  sq.rally.x = f[0] + .5; sq.rally.y = f[1] + .5;
  let melhor: Unit | null = null, bc = 0;
  for (const u of m) {
    if (u.dead || !u.target || u.target.dead) continue;
    let c = 0;
    for (const o of m) if (!o.dead && o.target === u.target) c++;
    if (c > bc) { bc = c; melhor = u.target; }
  }
  sq.focus = bc >= 2 ? melhor : null;
  sq.ex = sq.focus ? sq.focus.x : sq.rally.x;
  sq.ey = sq.focus ? sq.focus.y : sq.rally.y;
  sq.espalhar = 0;
  let i = 0;
  for (const u of m) { if (u.dead) continue; u.ai.role = papelPorVocacao(u); u.slot = i++; u.flank = 0; }
  p.poder = poderParty(p);
}

/* ---------- [SYSTEM: AI_PERFIL] ---------- */
const ASSASSINO = .82;
function atualizaPerfil(u: Unit) {
  const w = u.w;
  if (!w || u === G.ctrl || W.simTime < w.perfilT) return;
  w.perfilT = W.simTime + rr(20, 45);
  const antes = w.perfil;
  const fraco = u.lvl <= 3 || u.hp < u.maxHp * .5 || (saldo(u) < PRECO_HP * 4 && u.potHp < 4);
  if (u.skull === "red") w.perfil = "todos";
  else if (u.injustas >= VERMELHA_N - 1 || fraco) w.perfil = "criaturas";
  else {
    const r = rnd();
    if (w.pk > .72 && u.lvl >= 5 && r < w.pk * .45) w.perfil = w.ganancia > 1.2 && rnd() < .3 ? "todos" : "maldoso";
    else if (w.ousadia > 1.05 && u.lvl >= 4 && r < .3) w.perfil = "justiceiro";
    else if (w.perfil !== "criaturas" && rnd() < .5) w.perfil = "criaturas";
  }
  if (w.perfil !== antes) u.think = 0;
}
/* ---------- [SYSTEM: AI_TATICA] ---------- */
function escolheTatica(p: Party) {
  const L = p.lider;
  if (!L || !L.w || L === G.ctrl || (G.ctrl && p.membros.indexOf(G.ctrl) >= 0)) { p.tatica = "cacadores"; return; }
  const w = L.w, pf: AtqModo = w.perfil;
  let t = "cacadores";
  if (pf === "maldoso" || pf === "todos") t = (w.ganancia > 1.1 && rnd() < .5) ? "oportunistas" : "assassinos";
  else if (pf === "justiceiro") t = "justiceiros";
  else if (w.ganancia > 1.15 && w.pk > .5 && rnd() < .4) t = "oportunistas";
  else if (w.ousadia > 1.15 && rnd() < .5) t = "nomades";
  else if (w.social > .7 && rnd() < .5) t = "campistas";
  p.tatica = t;
}
function meritoLider(u: Unit) { return u.lvl + u.kills * .25 + (u.pkKills || 0) * .5 + (u.w ? u.w.ousadia * 4 : 0) - (u.dead ? 50 : 0); }
function elegeLider(p: Party) {
  if (p.membros.length < 2 || p.lider === G.ctrl || (G.ctrl && p.membros.indexOf(G.ctrl) >= 0)) return;
  let melhor: Unit | null = null, bm = -1e9;
  for (const m of p.membros) { if (m.dead || !m.w) continue; const s = meritoLider(m); if (s > bm) { bm = s; melhor = m; } }
  if (!melhor || melhor === p.lider) return;
  const atual = p.lider && !p.lider.dead ? meritoLider(p.lider) : -1e9;
  if (bm > atual + 3) { p.lider = melhor; for (const m of p.membros) if (m.w) m.think = 0; }
}
function bichoAtras(u: Unit) {
  const m = queryRadius(u.x, u.y, 8);
  for (let i = 0; i < m; i++) { const e = QBUF[i]; if (e.beast && !e.dead && odeia(e, u)) return true; }
  return false;
}
function avaliaPk(p: Party) {
  if (p.modo === "pk" && p.pkAte > W.simTime) {
    if (!p.alvo || p.alvo.dead || p.alvo.pz || dist(p.sq.cx, p.sq.cy, p.alvo.x, p.alvo.y) > 34) encerraPk(p);
    return;
  }
  if (p.modo === "pk") encerraPk(p);
  const lider = p.lider, T = TATICAS[p.tatica || "cacadores"];
  if (!lider || lider.dead || lider === G.ctrl || lider.pz || !lider.w || !T.pk) return;
  const perfil: AtqModo = T.alvo === "caveira" ? "justiceiro" : T.alvo === "limpo" ? "maldoso" : "todos";
  let alvo: Unit | null = null, bsc = -1e9;
  const q = queryRadius(lider.x, lider.y, 15);
  const lista: Unit[] = []; for (let i = 0; i < q; i++) lista.push(QBUF[i]);
  for (const e of lista) {
    if (e.beast || e.dead || e.pz || !querAtacar(lider, e, perfil)) continue;
    let r = 0;
    for (const m of p.membros) if (!m.dead) r = Math.max(r, rancor(m, e));
    let sc = r * 3.2 - dist(lider.x, lider.y, e.x, e.y) * .35 + (e.skull === "red" ? 4 : 0) + (e.ouro > 140 ? 1.5 : 0);
    if (T.alvo === "fraco") {
      const fer = 1 - e.hp / e.maxHp;
      if (fer < .35 && e.ouro < 200) continue;
      sc += fer * 8 + Math.min(6, e.ouro / 80);
    }
    if (sc > bsc) { bsc = sc; alvo = e; }
  }
  if (!alvo) return;
  const vantagem = poderParty(p) / ((alvo.party ? poderParty(alvo.party) : poder(alvo)) + 1);
  const justo = !!alvo.skull || guerraAtiva(p.team, alvo.team);
  if (vantagem < (justo ? Math.min(T.vant, .7) : T.vant)) return;
  p.modo = "pk"; p.alvo = alvo; p.pkAte = W.simTime + PK_DUR;
  for (const m of p.membros) {
    if (m.dead || m === G.ctrl || !m.w) continue;
    m.w.pkT = W.simTime + PK_DUR; m.w.alvoPk = alvo; m.think = .05;
  }
  if (alvo === G.ctrl) ui.banner("Vêm atrás de você", lider.name + (vivosParty(p) > 1 ? " e o grupo · " + T.n : " · " + T.n), "alerta");
}
export function encerraPk(p: Party) {
  p.modo = p.zona ? "caçada" : "acampar";
  p.alvo = null;
  for (const m of p.membros) if (m.w) m.w.alvoPk = null;
}
/* ---------- [SYSTEM: AI_GRUPO] grupos da IA são livres ---------- */
function revisaGrupos() {
  for (let i = 0; i < W.parties.length; i++) {
    const p = W.parties[i], L = p.lider;
    if (p.membros.length < 2 || p.modo === "pk" || !L || L === G.ctrl) continue;
    let lv = 0, n = 0;
    for (const m of p.membros) if (!m.dead) { lv += m.lvl; n++; }
    if (!n) continue;
    lv /= n;
    const pl = L.w ? L.w.perfil : "criaturas";
    for (let k = p.membros.length - 1; k >= 0; k--) {
      const m = p.membros[k];
      if (m === G.ctrl || m === L || m.dead || !m.w || (m.target && !m.target.dead)) continue;
      let ch = .01 + (1 - m.w.social) * .02;
      if (Math.abs(m.lvl - lv) > 4) ch += .25;
      if (m.w.perfil === "criaturas" && (pl === "maldoso" || pl === "todos")) ch += .4;
      if (m.w.perfil === "justiceiro" && L.skull === "red") ch += .5;
      if (m.w.azar > 1.6) ch += .3;
      if (rnd() < ch) { deixarEquipe(m); m.w.azar = 0; }
    }
  }
}

/* ---------- [SYSTEM: AI_CICLO] caçar → cidade → caçar ---------- */
const ORDEM_NPC = ["comerciante", "ferreiro", "feiticeiro", "banqueiro"];
function precisaCidade(u: Unit) {
  const w = u.w!;
  if (w.goal === "cidade" && !w.pronto) return true;
  const conj = u.maxMp > 0 && u.kind !== "knight";
  if (saldo(u) >= PRECO_HP * 5 && (u.potHp < 4 || (conj && u.potMp < 4))) return true;
  if (livres(u.mochila) <= 1) return true;
  if (u.ouro > 1500 + u.lvl * 250) return true;
  /* dinheiro sobrando e algo para comprar ou forjar: vale a viagem */
  if (W.simTime > (w.lojaT || 0)) {
    w.lojaT = W.simTime + 45;
    const reserva = reservaIA(u);
    if (saldo(u) > reserva + 400 && (temMelhoria(u, reserva) || querForjar(u))) { w.lojaT = W.simTime + 180; return true; }
  }
  return false;
}
function irCidade(u: Unit) {
  const w = u.w!;
  if (w.goal !== "cidade") { w.goal = "cidade"; w.etapa = 0; w.pronto = false; }
  if (!u.pz) {
    if (pzAtiva(u)) {
      /* com trava, espera longe da cidade: ali ninguém renova a trava dele */
      const g = esconderijo(u);
      w.dx = g.x; w.dy = g.y;
      let perto: Unit | null = null, pd = 1e9;
      const m = queryRadius(u.x, u.y, 8);
      for (let i = 0; i < m; i++) {
        const e = QBUF[i];
        if (e === u || e.dead || (!inimigo(u, e) && !(e.beast && odeia(e, u)))) continue;
        const d = dist2(u.x, u.y, e.x, e.y);
        if (d < pd) { pd = d; perto = e; }
      }
      if (perto) {
        const fx0 = u.x - perto.x, fy0 = u.y - perto.y, l = Math.hypot(fx0, fy0) || 1;
        w.dx = clamp(u.x + fx0 / l * 8, 2, W.N - 2); w.dy = clamp(u.y + fy0 / l * 8, 2, W.N - 2);
      }
      return;
    }
    w.dx = W.cidade.nasce.x + u.driftX * .25; w.dy = W.cidade.nasce.y + u.driftY * .25;
    return;
  }
  while (w.etapa < ORDEM_NPC.length) {
    const id = ORDEM_NPC[w.etapa];
    if (!precisaNpc(u, id)) { w.etapa++; continue; }
    const n = npcDe(id);
    if (dist(u.x, u.y, n.x, n.y) > NPC_ALCANCE) { w.dx = n.x; w.dy = n.y; return; }
    negociar(u, id);
    w.etapa++;
  }
  w.pronto = true;
  const f = nearestFree(W.cidade.x + clamp(u.driftX, -4.5, 4.5), W.cidade.y + clamp(u.driftY, -4.5, 4.5));
  w.dx = f[0] + .5; w.dy = f[1] + .5;
}
const ESC = { x: 0, y: 0 };
function esconderijo(u: Unit) {
  const w = u.w!, c = W.cidade;
  const longe = c.r + 15;
  if (w.escX === undefined || dist(w.escX, w.escY!, c.x, c.y) < longe - 2) {
    let a = Math.atan2(u.y - c.y, u.x - c.x) + rr(-.6, .6), melhor: [number, number] | null = null, bs = -1e9;
    for (let k = 0; k < 10; k++) {
      const d = longe + rr(0, 10);
      const f = nearestFree(clamp(c.x + Math.cos(a) * d, 3, W.N - 3), clamp(c.y + Math.sin(a) * d, 3, W.N - 3), true);
      let sc = dist(f[0], f[1], c.x, c.y) * .3 - dist(f[0], f[1], u.x, u.y) * .15;
      const m = queryRadius(f[0] + .5, f[1] + .5, 7);
      for (let i = 0; i < m; i++) { const e = QBUF[i]; if (e !== u && !e.dead && (e.beast ? (e.K.aggro || 0) > 0 : !(u.party && e.party === u.party))) sc -= 2; }
      if (sc > bs) { bs = sc; melhor = f; }
      a += rr(-1.2, 1.2);
    }
    w.escX = melhor![0] + .5; w.escY = melhor![1] + .5;
  }
  ESC.x = w.escX!; ESC.y = w.escY!;
  return ESC;
}
function spotDePresa(u: Unit) {
  let melhor: Zona | null = null, bs = -1e9;
  for (const p of W.parties) {
    if (p.modo !== "caçada" || !p.zona || !p.lider || p.lider.dead) continue;
    if (p.team === u.team && !W.worldLivre) continue;
    if (p === u.party) continue;
    const forca = poderParty(p), minha = u.party ? poderParty(u.party) : poder(u);
    if (forca > minha * 1.25) continue;
    const d = dist(u.x, u.y, p.zona.x, p.zona.y);
    const sc = p.zona.tier * 1.4 - d / W.N * 7 + rnd() * 1.5 + (guerraAtiva(u.team, p.team) ? 3 : 0);
    if (sc > bs) { bs = sc; melhor = p.zona; }
  }
  return melhor;
}
function worldGoal(u: Unit) {
  const w = u.w!, vida = u.hp / u.maxHp, mana = u.maxMp ? u.mp / u.maxMp : 1, p = u.party;
  /* sem vida ou mana só volta se não tiver poção para repor: jogador de verdade bebe e segue */
  const semHp = vida < .42 && u.potHp <= 0, semMp = mana < .18 && u.potMp <= 0 && u.kind !== "knight";
  if (precisaCidade(u) || semHp || semMp || (p && p.modo === "acampar")) { irCidade(u); return; }
  if (w.escX !== undefined && !pzAtiva(u)) w.escX = undefined;
  if (p && p.modo === "pk" && p.alvo && !p.alvo.dead) {
    w.goal = "pk"; w.dx = p.alvo.x + u.driftX * .25; w.dy = p.alvo.y + u.driftY * .25; return;
  }
  if (w.pk > ASSASSINO && (!p || p.lider === u) && vida > .6) {
    if (W.simTime > w.cacaT) { w.cacaT = W.simTime + rr(6, 11); w.presa = spotDePresa(u); }
    if (w.presa) { w.goal = "emboscada"; w.dx = w.presa.x + u.driftX * .5; w.dy = w.presa.y + u.driftY * .5; return; }
  }
  if (p && p.modo === "caçada" && p.zona) {
    const z = p.zona, T = TATICAS[p.tatica || "cacadores"];
    w.goal = "caça"; w.zona = z;
    if (T.isca && p.puxador && !p.puxador.dead && vivosParty(p) >= 2) {
      if (u === p.puxador) {
        if (w.puxa === "voltar") { w.dx = p.posto.x + u.driftX * .15; w.dy = p.posto.y + u.driftY * .15; return; }
        w.dx = z.x + u.driftX * .2; w.dy = z.y + u.driftY * .2; return;
      }
      w.dx = p.posto.x + u.driftX * .4; w.dy = p.posto.y + u.driftY * .4; return;
    }
    const ang = (u.id * 1.7) % 6.283;
    w.dx = z.x + Math.cos(ang) * z.r * .6 + u.driftX * .25;
    w.dy = z.y + Math.sin(ang) * z.r * .6 + u.driftY * .25;
    return;
  }
  irCidade(u);
}
export function worldThink(u: Unit, sq: Squad) {
  const w = u.w || iniciaMundoUnit(u);
  if (W.simTime > w.t) { w.t = W.simTime + rr(1.0, 1.8); worldGoal(u); }
  unitThink(u, sq);
  const p = u.party;
  if (p && p.modo === "caçada" && w.goal === "caça" && p.puxador) {
    if (p.puxador === u) {
      const bravo = bichoAtras(u), dp = dist(u.x, u.y, p.posto.x, p.posto.y);
      if (w.puxa === "voltar") {
        if (dp < 2.2 || !bravo) w.puxa = "lutar";
        else { u.target = null; u.alvoManual = null; setState(u, ST.RETREAT); goTo(u, p.posto.x, p.posto.y, "puxa"); return; }
      }
      if (w.puxa === "lutar") { if (!bravo && !(u.target && !u.target.dead)) w.puxa = "ir"; }
      else if (bravo && dp > 3.5) {
        w.puxa = "voltar"; u.target = null; u.alvoManual = null;
        setState(u, ST.RETREAT); goTo(u, p.posto.x, p.posto.y, "puxa"); return;
      }
    } else if (u.target && u.target.beast && !u.target.dead && dist(u.x, u.y, u.target.x, u.target.y) > Math.max(6, u.K.range + 2)) {
      u.target = null;
    }
  }
  const viagem = w.goal === "cidade";
  if (viagem && u.target && !u.target.dead) {
    const d = dist(u.x, u.y, u.target.x, u.target.y);
    const agressor = u.ai.mem.lastDmgFrom === u.target && W.simTime - u.ai.mem.lastDmgT < 2.5;
    if (!(agressor && d <= u.K.range * 1.2)) { u.target = null; u.alvoManual = null; }
  }
  if (u.target && !u.target.dead) return;
  const d = dist(u.x, u.y, w.dx, w.dy);
  if (d > 1.2) {
    goTo(u, w.dx, w.dy, "w" + u.id);
    setState(u, viagem ? ST.REGROUP : (w.goal === "pk" || w.goal === "emboscada") ? ST.HUNT : ST.ADVANCE);
  } else {
    if (!viagem && rnd() < .25) { w.dx += rr(-2.2, 2.2); w.dy += rr(-2.2, 2.2); }
    goTo(u, w.dx, w.dy, "w" + u.id);
    setState(u, viagem ? ST.HEAL : ST.GRAZE);
  }
}

/* ---------- [SYSTEM: WORLD_ZONE] disputa de ponto ---------- */
function lotacaoZona(z: Zona) { return Math.max(1, Math.round(z.alvoPop / 5)); }
function disputaZona(p: Party) {
  const z = p.zona;
  if (!z || !p.lider || p.lider.dead) return;
  if (dist(p.sq.cx, p.sq.cy, z.x, z.y) > z.r + 3) return;
  let rival: Party | null = null, rp = 0;
  for (const o of W.parties) {
    if (o === p || o.zona !== z || !o.lider || o.lider.dead) continue;
    if (dist(o.sq.cx, o.sq.cy, z.x, z.y) > z.r + 3) continue;
    const f = poderParty(o);
    if (f > rp) { rp = f; rival = o; }
  }
  if (!rival) return;
  const nossa = poderParty(p);
  if (rival.team === p.team && !W.worldLivre) {
    if (z.grupos <= lotacaoZona(z)) return;
    if (nossa < rp) cederZona(p, z);
    return;
  }
  let sede = 0, n = 0;
  for (const m of p.membros) { if (m.dead || !m.w) continue; sede += m.w.pk; n++; }
  sede = n ? sede / n : 0;
  const pl = p.lider !== G.ctrl && p.lider.w ? p.lider.w.perfil : "justiceiro";
  if (nossa > rp * 1.12 && (((pl === "maldoso" || pl === "todos") && sede > .4) || guerraAtiva(p.team, rival.team))) {
    p.modo = "pk"; p.alvo = rival.lider; p.pkAte = W.simTime + PK_DUR;
    for (const m of p.membros) { if (m.dead || !m.w) continue; m.w.pkT = W.simTime + PK_DUR; m.w.alvoPk = rival.lider; m.think = .05; }
  } else if (nossa < rp * .9) {
    cederZona(p, z);
  }
}
function cederZona(p: Party, z: Zona) {
  z.grupos = Math.max(0, z.grupos - 1);
  p.zona = null; p.modo = "acampar"; p.t = W.simTime + rr(2, 6); p.paciencia = W.simTime + 8;
}

/* ---------- [SYSTEM: ZONA_AVISO] ---------- */
export function zonaEm(x: number, y: number) {
  for (const z of W.zones) { if (z.errante) continue; const r = z.r + 1.2; if (dist2(x, y, z.x, z.y) < r * r) return z; }
  return null;
}
export function faixaNivelZona(z: Zona) {
  if (z._nv) return z._nv;
  let lo = 99, hi = 0;
  for (const k in z.sp) { const nv = KINDS[k as KindKey].nv; if (!nv) continue; lo = Math.min(lo, nv[0]); hi = Math.max(hi, nv[1]); }
  return z._nv = hi ? "Lv " + lo + " a " + hi : "";
}
function anunciarZona(u: Unit) {
  const z = u.pz ? null : zonaEm(u.x, u.y);
  if (z === u.zonaAtual) return;
  u.zonaAtual = z;
  if (z) ui.banner(z.name, "faixa " + z.tier + " de 7 · " + faixaNivelZona(z), "zona");
}

/* ============================================================
   [SYSTEM: WORLD_PARTY] ciclo lento: grupos, guerras, fauna, caveiras
   ============================================================ */
export function worldStep() {
  resolverConvites();
  if (W.simTime < W.worldTick) return;
  W.worldTick = W.simTime + .5;
  conviteAutomatico();
  mercadoPasso();
  let j = 0;
  const U = W.units;
  for (let i = 0; i < U.length; i++) { const u = U[i]; if (!u.remover || W.simTime - u.morteT < .5) U[j++] = u; }
  if (j < U.length) {
    U.length = j;
    if (G.sel && G.sel.remover) G.sel = null;
    if (W.featured && W.featured.remover) W.featured = null;
  }
  if (W.simTime > W.grupoT) { W.grupoT = W.simTime + 5; revisaGrupos(); }
  if (!W.worldLivre && W.guildasN > 1 && rnd() < .008) {
    const a = Math.floor(rnd() * W.guildasN), b = Math.floor(rnd() * W.guildasN);
    if (a !== b && !guerraAtiva(a, b)) {
      const dur = rr(70, 150);
      W.guerra[a][b] = W.simTime + dur; W.guerra[b][a] = W.simTime + dur;
      if (G.ctrl && (G.ctrl.team === a || G.ctrl.team === b)) ui.banner("Guerra", TEAMS[a].name + " × " + TEAMS[b].name, "alerta");
    }
  }
  if (G.ctrl && !G.ctrl.dead) anunciarZona(G.ctrl);
  for (const u of U) {
    if (u.dead || u.beast) continue;
    caveiraRelogio(u);
    atualizaPerfil(u);
    if (u.w) u.w.azar *= .994;
    if (u.pz) { u.hp = Math.min(u.maxHp, u.hp + u.maxHp * .04); u.mp = Math.min(u.maxMp, u.mp + u.maxMp * .04); }
  }
  const PS = W.parties;
  for (let i = PS.length - 1; i >= 0; i--) {
    const p = PS[i];
    for (let k = p.membros.length - 1; k >= 0; k--) {
      const m = p.membros[k];
      if (m.remover || !m.w) { p.membros.splice(k, 1); if (m) m.party = null; }
    }
    if (!p.membros.length) {
      if (p.zona) p.zona.grupos = Math.max(0, p.zona.grupos - 1);
      PS.splice(i, 1); continue;
    }
    if (!p.lider || p.lider.dead) p.lider = p.membros.find((m) => !m.dead) || p.membros[0];
    partySq(p);
    if (W.simTime > p.eleicaoT) { p.eleicaoT = W.simTime + rr(40, 70); elegeLider(p); escolheTatica(p); }
    if (p.puxador && (p.puxador.dead || p.puxador.party !== p)) p.puxador = null;
    avaliaPk(p);
    if (p.modo === "pk") continue;
    const vivos = vivosParty(p);
    let feridos = 0, prontos = 0, cidadeJa = 0;
    for (const m of p.membros) {
      if (m.dead) continue;
      if (m.hp < m.maxHp * .45) feridos++;
      if (m !== G.ctrl && m.w!.goal !== "cidade" && precisaCidade(m)) cidadeJa++;
      if (m.hp > m.maxHp * .7 && (!m.maxMp || m.mp > m.maxMp * .4) && (m === G.ctrl || m.w!.pronto)) prontos++;
    }
    if (p.modo === "caçada") {
      disputaZona(p);
      reagirKs(p);
      if (p.modo !== "caçada") continue;
      const caidos = p.membros.length - vivos;
      /* luta recente de alguém do grupo */
      for (const m of p.membros) if (!m.dead && m.target && !m.target.dead && m.target.beast) { p.lutaT = W.simTime; break; }
      const noPonto = p.zona && dist(p.sq.cx, p.sq.cy, p.zona.x, p.zona.y) < p.zona.r + 5;
      const lider = p.lider && p.lider !== G.ctrl;
      if (lider && p.zona && vivos && !caidos && !cidadeJa) {
        if (noPonto && p.zona.pop <= Math.max(1, p.zona.alvoPop * .2)) { trocarZona(p, "o ponto esvaziou"); continue; }
        if (noPonto && W.simTime - (p.lutaT || 0) > 35) { trocarZona(p, "nada para caçar aqui"); continue; }
        if (W.simTime > p.zonaT) { trocarZona(p, "hora de mudar de ares"); continue; }
      }
      void feridos;
      if (!vivos || caidos > 0 || cidadeJa > 0) {
        if (p.zona) p.zona.grupos = Math.max(0, p.zona.grupos - 1);
        p.zona = null; p.modo = "acampar"; p.t = W.simTime + rr(2, 5);
        p.paciencia = W.simTime + rr(10, 20);
        p.min = (p.lider && p.lider.w && p.lider.w.social > .62) ? 2 + Math.floor(rnd() * 3) : 1;
      }
    } else {
      const lider = p.lider;
      if (!W.worldLivre && lider && !lider.dead && lider.pz && p.membros.length < PARTY_MAX && lider.w && lider.w.social > .3) {
        for (const o of PS) {
          if (o === p || o.team !== p.team || o.modo !== "acampar") continue;
          if (o.membros.length + p.membros.length > PARTY_MAX) continue;
          if (!o.lider || o.lider.dead || !o.lider.pz || o.lider === G.ctrl) continue;
          if (!o.lider.w || o.lider.w.social < .3) continue;
          for (const m of o.membros.slice()) entrarParty(m, p);
          break;
        }
      }
      if (vivos && prontos === vivos && W.simTime > p.t && (p.membros.length >= p.min || W.simTime > p.paciencia)) escolheZona(p);
    }
  }
  for (let i = 0; i < W.bandos.length; i++) {
    const b = W.bandos[i];
    if (b.pop >= b.max || W.simTime < b.repT) continue;
    b.repT = W.simTime + REPOP_CD * rr(2.2, 3.6);
    if (gentePerto(b.x, b.y, 2.6)) continue;
    soltarBando(b, 1);
  }
  if (!G.sel && !G.ctrl && (!W.featured || W.featured.dead || W.simTime > W.featT)) {
    let melhor: Unit | null = null, bs = -1;
    for (const u of U) {
      if (u.dead || u.beast) continue;
      let sc = rnd() * 2 + u.lvl * .2;
      if (u.target && !u.target.dead) sc += 3;
      if (u.w && u.w.pkT > W.simTime) sc += 4;
      if (sc > bs) { bs = sc; melhor = u; }
    }
    W.featured = melhor; W.featT = W.simTime + rr(16, 26);
  }
}
export { emPZ };
