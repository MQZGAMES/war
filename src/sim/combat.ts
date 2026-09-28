/* ================================================================
   COMBATE — acerto, dano, morte, espólio, experiência, loot,
   projéteis, meteoros, ondas de fogo e o que cada monstro faz.
   ================================================================ */
import { ACERTO_MAX, BUMERANGUE, CHUVA_R, ESQUIVA, MET_R, NEVASCA, VENENO, WORLD_REBORN, type KindDef } from "./data";
import { avisoDe, ferirVisual, fx, tremer, ui } from "./fx";
import { cabe, corItem, darItem, equiparSeQuiser, itemAleatorio, nomeItem, pocaoItem, recontar } from "./items";
import { blockedPt, losU, queryRadius, queryRadius2, QBUF, QBUF2 } from "./map";
import { agrediu, esquecerAmarelas, marcar, morteInjusta, travaMorte } from "./pk";
import { aliado, anotarRancor, esquecerMorto, inimigo, KS_JANELA, odiar, registrarKs } from "./relations";
import { clamp, dist, ri, rnd, rr } from "./rng";
import { G, W, type Meteoro, type Projetil } from "./state";
import { pontoDoPlano, pontoProporcional, recalcular } from "./stats";
import type { Item, Unit } from "./types";
import { BASES, RARO_COR, RARO_NOME, SLOTS } from "./itemsData";

export function acerta(src: Unit, t: Unit) {
  const c = clamp(src.acerto - t.defesa * ESQUIVA, .25, ACERTO_MAX);
  return rnd() < c;
}
export function golpe(src: Unit, t: Unit, dano: number, magico: boolean, corpo?: boolean) {
  if (acerta(src, t)) { hit(src, t, dano, magico, corpo); return true; }
  fx({ t: "miss", u: t }); marcar(src, t);
  return false;
}
/* veneno por segundo (flecha envenenada, cobra, escorpião, hidra) */
export function envenenar(src: Unit | null, t: Unit, dps: number, dur: number) {
  if (t.dead || t.pz) return;
  if (t.venAte > W.simTime && t.venDps > dps) return;
  t.venDps = dps; t.venAte = W.simTime + dur; t.venTick = W.simTime + 1; t.venSrc = src;
  fx({ t: "bits", x: t.x, y: t.y, c: "#7fe05a", n: 10, spd: 1.3, h: .7 });
}
export function fxCura(u: Unit, v: number) { if (v >= 1) fx({ t: "heal", x: u.x, y: u.y, v: Math.round(v), u }); }

let impactoN = 0;
export function presosNaArea(src: Unit, x: number, y: number, r: number) {
  const L: Unit[] = [];
  const q = queryRadius2(x, y, r);
  for (let i = 0; i < q; i++) { const e = QBUF2[i]; if (e !== src && !e.dead && inimigo(src, e)) L.push(e); }
  return L;
}

export function hit(src: Unit | null, t: Unit, dmg: number, magico: boolean, corpo?: boolean) {
  if (t.dead || t.pz || (src && src.pz)) return;
  const d = dmg * (1 - t.K.armor * (magico ? .45 : 1)) * (1 - t.defesa);
  t.hp -= d; t.hurt = 0;
  ferirVisual(t, d, src);
  if (!src) { fx({ t: "dmg", u: t, v: Math.max(1, Math.round(d)), heavy: d > t.maxHp * .15 }); if (t.hp <= 0) kill(t, null); return; }
  src.dmg += d;
  if (t.hp < t.maxHp * .45 && t.think > .06) t.think = .06;
  if (t.beast && !src.beast) {
    t.prov = src; odiar(t, src); t.think = Math.min(t.think, .05);
    /* dono da presa: o primeiro que bateu; outro de fora que bate é KS */
    const dono = t.dono;
    if (!dono || dono.dead || W.simTime - t.donoT > KS_JANELA || dist(dono.x, dono.y, t.x, t.y) > 11) { t.dono = src; t.donoT = W.simTime; }
    else if (dono !== src && !aliado(dono, src)) registrarKs(dono, src);
    else if (aliado(dono, src)) t.donoT = W.simTime;
    if (t.dono === src) t.donoT = W.simTime;
  }
  if (t.ai) { t.ai.mem.lastDmgFrom = src; t.ai.mem.lastDmgT = W.simTime; }
  marcar(src, t);
  if (t === G.ctrl) revidarHook(t, src);
  if (!src.beast) {
    const c = t.contrib[src.id] || (t.contrib[src.id] = { u: src, d: 0 });
    c.d += d;
    if (!t.beast && t.ultimos[0] !== src) { t.ultimos[1] = t.ultimos[0]; t.ultimos[0] = src; }
  }
  fx({ t: "blood", u: t, n: t.beast ? 4 : 5, src });
  fx({ t: "dmg", u: t, v: Math.max(1, Math.round(d)), heavy: d > t.maxHp * .15 });
  if (t.hp <= 0) kill(t, src);
}
/* o revide imediato mora na IA do jogador; registrado para evitar ciclo */
let revidarHook: (u: Unit, src: Unit) => void = () => {};
export function setRevidarHook(f: (u: Unit, src: Unit) => void) { revidarHook = f; }

/* ---------- experiência ---------- */
export const XP_MUNDO = .55, MOEDA_BICHO = .7;
export function fatorXp(meu: number, alvo: number) {
  const d = meu - alvo;
  if (d <= 0) return Math.min(1.6, 1 + (-d) * .12);
  return clamp(1 - d * .19, .03, 1);
}
export const xpNeed = (lvl: number) => 55 * lvl;
export function gainXp(u: Unit, v: number) {
  if (u.beast) return;
  u.xp += v;
  const need = xpNeed(u.lvl);
  if (u.xp < need) return;
  u.xp -= need; u.lvl++; u.pts++;
  if (!u.manual) { u.attr[pontoDoPlano(u)]++; u.pts--; }
  else if (u !== G.ctrl) { u.attr[pontoProporcional(u)]++; u.pts--; }
  recalcular(u, true);
  fx({ t: "levelup", u });
  if (u === G.ctrl) ui.banner("Nível " + u.lvl, u.pts ? u.pts + " ponto" + (u.pts > 1 ? "s" : "") + " para distribuir" : "", "nivel");
}
function ganharDespojo(u: Unit, alvo: Unit, peso: number) {
  if (!alvo.beast) return;
  const m = Math.max(1, Math.round(peso * MOEDA_BICHO * (alvo.K.ouro || 1) * rr(.85, 1.15)));
  u.ouro += m;
  if (u === G.ctrl) ui.popOuro(m);
}
const LISTA_XP: { u: Unit; d: number }[] = [];
function repartirXp(t: Unit) {
  const base = (t.beast ? (t.K.xpVal || 0) * (t.xpMult || 1) : Math.round(t.maxHp * .55) + 45) * (t.skull === "red" ? 2 : 1);
  const nivelAlvo = t.lvl;
  const lista = LISTA_XP; lista.length = 0;
  let tot = 0;
  for (const k in t.contrib) {
    const c = t.contrib[k];
    if (!c.u || c.u.dead || c.u.beast) continue;
    lista.push(c); tot += c.d;
  }
  t.contrib = {};
  if (!lista.length || tot <= 0) return;
  for (const c of lista) {
    const f = fatorXp(c.u.lvl, nivelAlvo) * XP_MUNDO;
    const parte = Math.max(f < .2 ? 0 : 1, Math.round(base * c.d / tot * f));
    if (parte) gainXp(c.u, parte);
    ganharDespojo(c.u, t, base * c.d / tot);
    if (parte && c.u === G.ctrl) ui.popXp(parte);
  }
  if (t.beast) largarLoot(t, lista, tot);
}

/* ---------- [SYSTEM: LOOT] ---------- */
const LOOT_POCAO = .18, LOOT_ITEM_BASE = .035, LOOT_ITEM_TIER = .015;
function sorteiaDono(lista: { u: Unit; d: number }[], tot: number) {
  let r = rnd() * tot;
  for (const c of lista) { r -= c.d; if (r <= 0) return c.u; }
  return lista[0].u;
}
function largarLoot(t: Unit, lista: { u: Unit; d: number }[], tot: number) {
  const tier = (t.zona && t.zona.tier) || 1;
  if ((t.K.xpVal || 0) < 30 && rnd() < .6) return;
  if (rnd() < LOOT_POCAO) entregar(lista, tot, pocaoItem(rnd() < .55 ? "hp" : "mp", ri(1, 2 + (tier >> 1))), t);
  /* criatura forte solta mais e melhor: força 0..1 pela experiência que vale */
  const forca = Math.min(1, (t.K.xpVal || 0) * (t.xpMult || 1) / 2000), lt = t.K.loot || 1;
  if (rnd() < (LOOT_ITEM_BASE + tier * LOOT_ITEM_TIER + forca * .25) * lt) entregar(lista, tot, itemAleatorio(tier, forca), t);
  if (forca > .5 && rnd() < forca * .25 * lt) entregar(lista, tot, itemAleatorio(tier, forca), t);
}
function entregar(lista: { u: Unit; d: number }[], tot: number, it: Item | { b: string; n: number }, t: Unit) {
  let u: Unit | null = sorteiaDono(lista, tot);
  if (!cabe(u, it)) {
    u = null;
    for (const c of lista) if (cabe(c.u, it)) { u = c.u; break; }
  }
  if (!u) return false;
  darItem(u, it);
  const rar = BASES[it.b].raro || 0;
  if (!BASES[it.b].pocao) avisoDe(u, "Loot: " + nomeItem(it) + (rar >= 2 ? " (" + RARO_NOME[rar] + ")" : ""), rar ? RARO_COR[rar] : corItem(it));
  fx({ t: "loot", u, it });
  equiparSeQuiser(u);
  return true;
}

/* ---------- morte ---------- */
export const MORTE_FADE = .5, CORPO_BICHO = 14;
const CULPA: Unit[] = [];
export function kill(t: Unit, src: Unit | null) {
  if (t.dead) return;
  t.dead = true; t.hp = 0; t.morteT = W.simTime;
  if (t.beast) { if (t.zona) t.zona.pop--; if (t.bando) t.bando.pop--; t.remover = true; t.reborn = 0; }
  else {
    t.reborn = W.simTime + WORLD_REBORN; t.refil = null;
    if (t.w) t.w.azar = (t.w.azar || 0) + 1;
    if (src && !src.beast) {
      src.pkKills = (src.pkKills || 0) + 1;
      anotarRancor(t, src);
      if (agrediu(src, t)) { travaMorte(src); avisoDe(src, "Você matou " + t.name + " · trava de 2 min", "#e0b93a"); }
      else avisoDe(src, "Você matou " + t.name + " em legítima defesa", "#7fd6a0");
    }
    espolio(t, src);
    if (t.party && t.party.modo !== "pk" && t.party.lider === t) t.party.modo = "acampar";
    if (t === G.ctrl) ui.banner("Você morreu", (src ? "para " + (src.beast ? src.K.pt.toLowerCase() : src.name) + " · " : "") + "volta ao obelisco em " + WORLD_REBORN + " s", "morte");
  }
  t.moving = 0; t.swing = 0; t.lunge = 0; t.draw = 0;
  fx({ t: "death", u: t, src });
  if (t === G.ctrl) tremer(7);
  esquecerMorto(t);
  repartirXp(t);
  if (src) src.kills++;
  if (!t.beast && !t.pkJust) {
    const culpados = CULPA; culpados.length = 0;
    for (const c of t.ultimos) if (c && !c.beast && c !== t && culpados.indexOf(c) < 0) culpados.push(c);
    if (src && !src.beast && culpados.indexOf(src) < 0) culpados.push(src);
    for (const c of culpados) morteInjusta(c);
  }
  if (!t.beast) esquecerAmarelas(t);
}
/* [SYSTEM: MORTE] mochila e ouro fora do banco se perdem; 10% de chance
   de um item vestido; caveira vermelha perde tudo o que veste.
   [SYSTEM: WORLD_LOOT] morto por jogador, os autores dos 2 últimos
   golpes dividem o espólio. Morto por criatura, se perde. */
const ESPOLIO: (Item | { b: string; n: number })[] = [], PARTIC: Unit[] = [], RECEB: Unit[] = [];
function espolio(t: Unit, src: Unit | null) {
  const perdidos = ESPOLIO; perdidos.length = 0;
  const e = t.eqp;
  if (t.skull === "red") {
    const quem = PARTIC; quem.length = 0;
    for (const k in t.contrib) { const c = t.contrib[k]; if (c.u && !c.u.dead && !c.u.beast && c.u !== t) quem.push(c.u); }
    for (const s of SLOTS) {
      const it = e[s]; if (!it) continue;
      e[s] = null;
      if (quem.length) entregarAleatorio(quem, it);
    }
    avisoDe(t, "Caveira vermelha: todo o equipamento se perdeu", "#e2394f");
  } else if (rnd() < .10) {
    let n = 0, esc: (typeof SLOTS)[number] | null = null;
    for (const s of SLOTS) if (e[s] && rnd() < 1 / (++n)) esc = s;
    if (esc) { perdidos.push(e[esc]!); avisoDe(t, "Perdeu " + nomeItem(e[esc]!), "#e0685a"); e[esc] = null; }
  }
  for (let i = 0; i < t.mochila.length; i++) if (t.mochila[i]) { perdidos.push(t.mochila[i]!); t.mochila[i] = null; }
  const ouro = t.ouro; t.ouro = 0;
  recontar(t); recalcular(t);
  if (ouro > 0 && t === G.ctrl) ui.popOuro(-ouro);
  if (!src || src.beast) return;
  const rec = RECEB; rec.length = 0;
  for (const c of t.ultimos) if (c && !c.dead && !c.beast && c !== t && rec.indexOf(c) < 0) rec.push(c);
  if (!rec.length && !src.dead) rec.push(src);
  if (!rec.length) return;
  const parte = Math.floor(ouro / rec.length);
  for (let i = 0; i < rec.length; i++) {
    const v = i === 0 ? ouro - parte * (rec.length - 1) : parte;
    if (v <= 0) continue;
    rec[i].ouro += v;
    if (rec[i] === G.ctrl) ui.popOuro(v);
    avisoDe(rec[i], "+" + v + " de ouro de " + t.name, "#f2c53d");
  }
  let k = 0;
  for (const it of perdidos) {
    for (let j = 0; j < rec.length; j++) {
      const r = rec[(k + j) % rec.length];
      if (cabe(r, it)) { darItem(r, it); avisoDe(r, "Espólio: " + nomeItem(it), "#e0bd63"); fx({ t: "loot", u: r, it }); break; }
    }
    k++;
  }
  for (const r of rec) equiparSeQuiser(r);
}
function entregarAleatorio(lista: Unit[], it: Item) {
  const n = lista.length, i0 = Math.floor(rnd() * n);
  for (let j = 0; j < n; j++) {
    const u = lista[(i0 + j) % n];
    if (!cabe(u, it)) continue;
    darItem(u, it);
    avisoDe(u, "Espólio: " + nomeItem(it), "#e0bd63");
    equiparSeQuiser(u);
    return true;
  }
  return false;
}

/* ============================================================
   PROJÉTEIS: corrigem a rota a cada passo e convergem no alvo.
   ============================================================ */
const projPool: Projetil[] = [];
let projId = 1;
export function alturaTiro(K: KindDef) { return K.alt * (K.beast ? .75 : .72); }
export function shoot(u: Unit, t: Unit, kind: Projetil["kind"], dmg: number, raio = 0, certo = false) {
  const bolao = kind === "bola" || kind === "bolaGelo" || kind === "bolaTrevas";
  const sp = kind === "arrow" || kind === "veneno" ? 22 : bolao || kind === "bolaFogo" ? 14 : kind === "lamina" ? 12 : kind === "raio" ? 24 : 16;
  const d = Math.max(.5, dist(u.x, u.y, t.x, t.y));
  const p = projPool.pop() || ({} as Projetil);
  p.x = u.x; p.y = u.y; p.tx = t.x; p.ty = t.y; p.d0 = d; p.sp = sp;
  p.dirx = (t.x - u.x) / d; p.diry = (t.y - u.y) / d;
  p.kind = kind; p.dmg = dmg; p.team = u.team; p.src = u; p.tgt = t; p.z = 0; p.raio = raio;
  p.certo = certo ? 1 : 0; p.volta = 0; p.giro = 0;
  if (p.ja) p.ja.length = 0; else p.ja = [];
  p.h0 = bolao ? alturaTiro(u.K) * 1.05 : alturaTiro(u.K);
  p.h1 = t.K.alt * .55;
  p.id = projId++;
  W.projs.push(p);
  fx({ t: "shoot", u, kind });
}
export function updateProjectiles(DT: number) {
  const P = W.projs;
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i];
    const t = p.tgt;
    if (t && !t.dead) { p.tx = t.x; p.ty = t.y; }
    const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
    const passo = p.sp * DT;
    if (d > .001) { p.dirx = dx / d; p.diry = dy / d; }
    p.z = Math.sin(Math.PI * clamp(1 - d / p.d0, 0, 1)) * (p.kind === "arrow" ? .5 : .3);
    /* lâmina voltando: corta quem estiver no caminho, uma vez cada */
    if (p.kind === "lamina" && p.volta && p.src) {
      const m = queryRadius(p.x, p.y, .75);
      for (let k = 0; k < m; k++) {
        const e = QBUF[k];
        if (e === p.src || e.dead || !inimigo(p.src, e) || p.ja.indexOf(e.id) >= 0) continue;
        p.ja.push(e.id);
        golpe(p.src, e, p.dmg, false, true);
      }
    }
    if (d <= passo || d < .35) {
      if (p.kind === "lamina" && !p.volta && p.src && !p.src.dead) {
        if (t && !t.dead) { p.ja.push(t.id); golpe(p.src, t, p.dmg, false, true); fx({ t: "bits", x: t.x, y: t.y, c: "#e8eef2", n: 8, spd: 2.2, h: .7 }); }
        p.volta = 1; p.tgt = p.src; p.dmg *= BUMERANGUE.volta;
        p.d0 = Math.max(.5, dist(p.x, p.y, p.src.x, p.src.y));
        const h = p.h0; p.h0 = p.h1; p.h1 = h;
        continue;
      }
      if (p.kind === "bola" || p.kind === "bolaFogo" || p.kind === "raio" || p.kind === "bolaGelo" || p.kind === "bolaTrevas") {
        const gelo = p.kind === "bolaGelo", trevas = p.kind === "bolaTrevas";
        const m = queryRadius(p.x, p.y, p.raio);
        for (let k = 0; k < m; k++) {
          const e = QBUF[k];
          if (p.src && !inimigo(p.src, e)) continue;
          const dd = dist(e.x, e.y, p.x, p.y);
          hit(p.src, e, p.dmg * (1 - dd / p.raio * .45), true);
          /* a bola de neve do yeti deixa quem pega mais lento */
          if (gelo && !e.dead) e.slow = Math.max(e.slow, 2.2);
        }
        const raio = p.kind === "raio";
        fx({ t: "impact", x: p.x, y: p.y, kind: p.kind === "bola" ? "bola" : raio ? "raio" : gelo ? "gelo" : trevas ? "trevas" : "bolaFogo" });
        fx({ t: "boom", x: p.x, y: p.y, c: raio ? "#bfe4ff" : gelo ? "#dff4ff" : trevas ? "#8a5ad8" : "#ff8a2a", r: p.raio, life: .5, kind: raio || gelo ? "ice" : trevas ? "dark" : "fire" });
        if (!raio && !gelo && !trevas) fx({ t: "scorch", x: p.x, y: p.y, life: 3, r: p.raio * .7 });
      } else if (p.kind === "lamina") {
        /* voltou para a mão */
      } else if (p.kind === "veneno" && t && !t.dead && p.src) {
        if (acerta(p.src, t)) {
          hit(p.src, t, p.dmg, false);
          if (!t.dead) envenenar(p.src, t, p.dmg * VENENO.fator / VENENO.dur, VENENO.dur);
        } else { fx({ t: "miss", u: t }); marcar(p.src, t); }
      } else if (t && !t.dead && p.src) {
        if (p.certo) { marcar(p.src, t); hit(p.src, t, p.dmg, false); }
        else golpe(p.src, t, p.dmg, p.kind !== "arrow");
        if (p.kind === "fire" || p.kind === "ice" || p.kind === "dark")
          fx({ t: "boom", x: t.x, y: t.y, c: p.kind === "fire" ? "#ff9a3c" : p.kind === "ice" ? "#a9e2ff" : "#8a5ad8", r: .6, life: .3, kind: p.kind === "ice" ? "ice" : p.kind === "dark" ? "dark" : "fire" });
      }
      p.src = null; p.tgt = null; projPool.push(p);
      P[i] = P[P.length - 1]; P.pop(); continue;
    }
    p.x += p.dirx * passo; p.y += p.diry * passo;
  }
}

/* ---------- [SYSTEM: MAGIA_CERTA] meteoro, nevasca e chuva ---------- */
let meteoroId = 1;
export function novoMeteoro(m: Omit<Meteoro, "id">) { (m as Meteoro).id = meteoroId++; W.meteors.push(m as Meteoro); }
function nevascaEm(m: Meteoro, e: Unit, d: number) {
  if (m.src) hit(m.src, e, m.dano * (1 - Math.min(d, NEVASCA.raio) / NEVASCA.raio * .35), true);
  if (!e.dead) e.paral = Math.max(e.paral, NEVASCA.paral);
}
function meteoroEm(m: Meteoro, e: Unit, d: number) {
  hit(m.src, e, m.dano * (1 - Math.min(d, MET_R) / MET_R * .5), true);
}
export function updateMeteors(DT: number) {
  const M = W.meteors;
  for (let i = M.length - 1; i >= 0; i--) {
    const m = M[i];
    m.t += DT;
    if (m.t < m.dur) continue;
    if (m.gelo) {
      const marca = ++impactoN;
      const q = queryRadius(m.x, m.y, NEVASCA.raio);
      for (let k = 0; k < q; k++) {
        const e = QBUF[k];
        if (m.src && !inimigo(m.src, e)) continue;
        e._imp = marca;
        nevascaEm(m, e, dist(e.x, e.y, m.x, m.y));
      }
      if (m.alvos) for (const e of m.alvos) {
        if (e.dead || e._imp === marca || (m.src && !inimigo(m.src, e))) continue;
        e._imp = marca; nevascaEm(m, e, NEVASCA.raio);
      }
      fx({ t: "impact", x: m.x, y: m.y, kind: "nevasca" });
      M[i] = M[M.length - 1]; M.pop(); continue;
    }
    if (m.cura) {
      const q = queryRadius(m.x, m.y, CHUVA_R);
      for (let k = 0; k < q; k++) {
        const a = QBUF[k];
        if (a.beast || (m.src ? !aliado(m.src, a) : a.team !== m.team)) continue;
        const d = dist(a.x, a.y, m.x, m.y);
        const antes = a.hp; a.hp = Math.min(a.maxHp, a.hp + m.dano * (1 - d / CHUVA_R * .4));
        fxCura(a, a.hp - antes);
        fx({ t: "ring", x: a.x, y: a.y, c: "#8fe6a8", life: .5 });
      }
      fx({ t: "impact", x: m.x, y: m.y, kind: "chuva" });
      M[i] = M[M.length - 1]; M.pop(); continue;
    }
    const marca = ++impactoN;
    const q = queryRadius(m.x, m.y, MET_R);
    for (let k = 0; k < q; k++) {
      const e = QBUF[k];
      if ((m.src && !inimigo(m.src, e)) || (!m.src && e.team === m.team)) continue;
      e._imp = marca;
      meteoroEm(m, e, dist(e.x, e.y, m.x, m.y));
    }
    if (m.alvos) for (const e of m.alvos) {
      if (e.dead || e._imp === marca || (m.src && !inimigo(m.src, e))) continue;
      e._imp = marca; meteoroEm(m, e, MET_R);
    }
    fx({ t: "impact", x: m.x, y: m.y, kind: "meteoro" });
    fx({ t: "scorch", x: m.x, y: m.y, life: 3.4, r: MET_R * .8 });
    M[i] = M[M.length - 1]; M.pop();
  }
}

/* ============================================================
   [SYSTEM: BEAST_ATTACK] bola, onda, baque, veneno e investida
   ============================================================ */
const ondaPool: import("./state").Onda[] = [];
let ondaId = 1;
function lancarOnda(u: Unit, t: Unit, cfg: { dmg: number; rng: number; larg: number; vel: number }) {
  const d = Math.max(.5, dist(u.x, u.y, t.x, t.y));
  const o = ondaPool.pop() || ({} as import("./state").Onda);
  o.x = u.x; o.y = u.y; o.dx = (t.x - u.x) / d; o.dy = (t.y - u.y) / d;
  o.and = 0; o.alc = cfg.rng; o.larg = cfg.larg; o.dmg = cfg.dmg; o.vel = cfg.vel || 9;
  o.team = u.team; o.src = u; o.id = ondaId++; o.t = 0;
  W.ondas.push(o);
  fx({ t: "cast", u, k: "onda" });
}
export function updateOndas(DT: number) {
  const O = W.ondas;
  for (let i = O.length - 1; i >= 0; i--) {
    const o = O[i];
    const passo = o.vel * DT;
    o.and += passo; o.t += DT;
    o.x += o.dx * passo; o.y += o.dy * passo;
    if (o.and >= o.alc || blockedPt(o.x, o.y, .1)) {
      fx({ t: "bits", x: o.x, y: o.y, c: "#ff9a3c", n: 6, spd: 1.6 });
      o.src = null; ondaPool.push(o);
      O[i] = O[O.length - 1]; O.pop(); continue;
    }
    const m = queryRadius(o.x, o.y, o.larg + .7);
    for (let k = 0; k < m; k++) {
      const e = QBUF[k];
      if (e.wHit === o.id) continue;
      if (o.src && !inimigo(o.src, e)) continue;
      const vx = e.x - o.x, vy = e.y - o.y;
      if (Math.abs(vx * o.dx + vy * o.dy) > .9) continue;
      if (Math.abs(vx * -o.dy + vy * o.dx) > o.larg) continue;
      e.wHit = o.id;
      hit(o.src, e, o.dmg * rr(.9, 1.1), true);
    }
    if ((o.and % 1) < passo) fx({ t: "scorch", x: o.x, y: o.y, life: 1.8, r: .7 });
  }
}
export function beastAttack(u: Unit, t: Unit, d: number) {
  const atk = u.K.atk;
  if (!atk) return false;
  if (atk.onda && u.cdB <= 0 && d <= atk.onda.rng && d > 1.2 && losU(u, t)) {
    u.cdB = atk.onda.cd * rr(.85, 1.15);
    u.fogoT = W.simTime + .35; u.swing = .5; u.swMax = .5; u.lunge = .18;
    lancarOnda(u, t, atk.onda);
    return true;
  }
  if (atk.bola && u.cdA <= 0 && d <= atk.bola.rng && d > 1.0 && losU(u, t)) {
    u.cdA = atk.bola.cd * rr(.85, 1.15);
    u.fogoT = W.simTime + .3; u.swing = .4; u.swMax = .4;
    const tp = atk.bola.tipo;
    fx({ t: "cast", u, k: tp === "gelo" ? "nevasca" : tp === "trevas" ? "trevas" : "bola" });
    shoot(u, t, tp === "gelo" ? "bolaGelo" : tp === "trevas" ? "bolaTrevas" : "bola", atk.bola.dmg * rr(.9, 1.1), atk.bola.raio);
    return true;
  }
  return false;
}
export function beastInvestida(u: Unit, t: Unit, d: number) {
  const iv = u.K.atk && u.K.atk.investida;
  if (!iv || u.cdI > 0 || d < iv.min || d > iv.max || !losU(u, t)) return;
  u.cdI = iv.cd * rr(.9, 1.2);
  u.pressa = Math.max(u.pressa, iv.dur);
  fx({ t: "charge", u });
}
export function beastBaque(u: Unit, t: Unit, dano: number) {
  const bq = u.K.atk && u.K.atk.baque;
  if (!bq) return;
  const m = queryRadius(t.x, t.y, bq.raio);
  for (let k = 0; k < m; k++) {
    const e = QBUF[k];
    if (e === t || !inimigo(u, e)) continue;
    golpe(u, e, dano * bq.frac, false, true);
  }
  fx({ t: "impact", x: t.x, y: t.y, kind: "baque" });
}
