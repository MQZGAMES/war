/* ================================================================
   [SYSTEM: AI_MAGIA] qual magia vale a pena agora. Cada opção vira um
   número: o dano que ela realmente causa (em área soma cada alvo,
   limitado à vida que ele ainda tem; abate vale um bônus), menos o que
   a mana custa — mana cara quando está acabando. Vence a maior, e só
   se superar meio ataque básico: nada de gastar mana andando.
   IA do mundo e automático do jogador usam a mesma conta.
   ================================================================ */
import { BUMERANGUE, CUSTO, EXPLOSAO, MAG_DANO, MET_ALCANCE, MET_DANO, MET_R, NEVASCA, TERREMOTO, TREVAS, VENENO, ST, type SpellKey } from "./data";
import { los, queryRadius, queryRadius2, QBUF, QBUF2 } from "./map";
import { inimigo } from "./relations";
import { dist } from "./rng";
import { W } from "./state";
import { dmgFis, dmgMag } from "./stats";
import type { Unit } from "./types";
import { podeMagia } from "./spells";

export interface PlanoMagia { k: SpellKey; x: number; y: number; alvo: Unit | null; sc: number }
const PL: PlanoMagia = { k: "cura", x: 0, y: 0, alvo: null, sc: 0 };

/* dano que sobra depois da armadura, limitado à vida; abate conta mais */
function efetivo(e: Unit, d: number, magico: boolean) {
  const real = d * (1 - e.K.armor * (magico ? .45 : 1)) * (1 - e.defesa);
  const v = Math.min(real, Math.max(0, e.hp));
  const abate = real >= e.hp ? e.maxHp * .12 + (e.beast ? 0 : 25) : 0;
  /* inimigo perigoso vale mais cada ponto de dano */
  return (v + abate) * (.85 + Math.min(1.2, e.K.threat) * .25);
}
/* soma do dano de área em volta de (x, y) */
function area(u: Unit, x: number, y: number, r: number, d: number, magico: boolean, queda: number) {
  let s = 0, n = 0;
  const k = queryRadius2(x, y, r);
  for (let j = 0; j < k; j++) {
    const e = QBUF2[j];
    if (e.dead || !inimigo(u, e)) continue;
    const dd = dist(e.x, e.y, x, y);
    s += efetivo(e, d * (1 - Math.min(dd, r) / r * queda), magico); n++;
  }
  return { s, n };
}
/* melhor ponto para magia de chão: centrada num inimigo à vista */
function melhorPonto(u: Unit, alc: number, r: number, d: number, queda: number) {
  let bx = 0, by = 0, bs = 0, bn = 0;
  const m = queryRadius(u.x, u.y, alc);
  const L: Unit[] = []; for (let i = 0; i < m; i++) L.push(QBUF[i]);
  for (const e of L) {
    if (e.dead || !inimigo(u, e) || !los(u.x, u.y, e.x, e.y)) continue;
    const a = area(u, e.x, e.y, r, d, true, queda);
    if (a.s > bs) { bs = a.s; bn = a.n; bx = e.x; by = e.y; }
  }
  return { x: bx, y: by, s: bs, n: bn };
}

export function planejarMagia(u: Unit, alvo: Unit | null, lista: SpellKey[], reservaCura: number): PlanoMagia | null {
  const mpFrac = u.maxMp ? u.mp / u.maxMp : 0;
  const base = (u.kind === "mage" || u.kind === "druid" ? dmgMag(u) : dmgFis(u)) * .5;
  const valeT = alvo && !alvo.dead && inimigo(u, alvo) ? alvo : null;
  const dT = valeT ? dist(u.x, u.y, valeT.x, valeT.y) : 1e9;
  const vejo = valeT ? los(u.x, u.y, valeT.x, valeT.y) : false;
  let melhor: PlanoMagia | null = null, ms = base;
  const propor = (k: SpellKey, valor: number, x: number, y: number, a: Unit | null) => {
    const sc = valor - CUSTO[k] * (1.5 - mpFrac) * .55;
    if (sc > ms) { ms = sc; PL.k = k; PL.x = x; PL.y = y; PL.alvo = a; PL.sc = sc; melhor = PL; }
  };
  for (const k of lista) {
    if (k === "cura" || k === "chuva") continue;
    if (!podeMagia(u, k) || u.mp - CUSTO[k] < reservaCura) continue;
    switch (k) {
      case "terremoto": {
        /* só com inimigo encostado: nada de tremer o chão andando */
        const a = area(u, u.x, u.y, TERREMOTO.raio, dmgFis(u), false, .4);
        if (!a.n) break;
        let bichos = 0;
        const q = queryRadius2(u.x, u.y, TERREMOTO.raio);
        for (let j = 0; j < q; j++) { const e = QBUF2[j]; if (e.beast && !e.dead && inimigo(u, e) && e.target !== u) bichos++; }
        propor(k, a.s + bichos * 8 + (a.n >= 2 ? 10 : 0), u.x, u.y, null);
        break;
      }
      case "investida":
        if (valeT && vejo && dT > 2.6 && dT < 7.5 && u.charge <= 0) propor(k, efetivo(valeT, dmgFis(u) * 1.55, false) + (valeT.K.keep ? 18 : 6), 0, 0, valeT);
        break;
      case "bumerangue": {
        if (!valeT || !vejo || dT <= u.K.range + .4 || dT > BUMERANGUE.alcance) break;
        propor(k, efetivo(valeT, dmgFis(u) * BUMERANGUE.fator, false) + 6, 0, 0, valeT);
        break;
      }
      case "triplo":
        if (valeT && vejo && dT <= u.K.range) propor(k, efetivo(valeT, dmgFis(u) * .75 * 3 * u.acerto, false), 0, 0, valeT);
        break;
      case "certeiro":
        if (valeT && vejo && dT <= u.K.range) propor(k, efetivo(valeT, dmgFis(u), false) + (valeT.hp < dmgFis(u) * 1.2 ? 10 : 0), 0, 0, valeT);
        break;
      case "veneno":
        /* veneno rende em quem vai durar: alvo já envenenado ou quase morto não compensa */
        if (valeT && vejo && dT <= u.K.range + .5 && valeT.venAte <= W.simTime && valeT.hp > dmgFis(u) * 1.5)
          propor(k, efetivo(valeT, dmgFis(u) * (1 + VENENO.fator) * u.acerto, false), 0, 0, valeT);
        break;
      case "trevas":
        if (valeT && vejo && dT <= u.K.range + 1) propor(k, efetivo(valeT, TREVAS.dano + u.magic * MAG_DANO * 1.4, true), 0, 0, valeT);
        break;
      case "bolaFogo": case "relampago": {
        if (!valeT || !vejo || dT > u.K.range + 1) break;
        const a = area(u, valeT.x, valeT.y, EXPLOSAO.raio, EXPLOSAO.dano + u.magic * EXPLOSAO.mag, true, EXPLOSAO.queda);
        propor(k, a.s, 0, 0, valeT);
        break;
      }
      case "meteoro": {
        const p = melhorPonto(u, MET_ALCANCE, MET_R, MET_DANO + u.magic * MAG_DANO * 1.4, .5);
        /* meteoro é caro: só com gente junta ou alvo que aguente */
        if (p.n >= 2 || (p.n === 1 && mpFrac > .7)) propor(k, p.s * .95, p.x, p.y, null);
        break;
      }
      case "nevasca": {
        const p = melhorPonto(u, NEVASCA.alcance, NEVASCA.raio, dmgMag(u) * NEVASCA.fator, .35);
        if (!p.n) break;
        /* prender vale: quem foge, quem corre atrás de mim ou de um aliado */
        let prende = 0;
        const q = queryRadius2(p.x, p.y, NEVASCA.raio);
        for (let j = 0; j < q; j++) {
          const e = QBUF2[j];
          if (e.dead || !inimigo(u, e) || e.paral > 0) continue;
          prende += (e.st === ST.RETREAT || e.st === ST.REGROUP) ? 22 : e.moving ? 9 : 4;
        }
        propor(k, p.s + prende, p.x, p.y, null);
        break;
      }
    }
  }
  return melhor;
}
