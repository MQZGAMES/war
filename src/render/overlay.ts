/* ================================================================
   Sobreposição 2D em escala de tela: nome e nível, barras, caveira,
   convite, seta do alvo, placas dos NPCs, números de dano e de cura
   (dano sempre vermelho, cura sempre verde, como na v54) e o manche.
   ================================================================ */
import { G, W } from "../sim/state";
import type { Unit } from "../sim/types";
import { amareloPara } from "../sim/pk";
import { podeConvidar } from "../sim/world";
import { engine, mundoParaTela } from "./engine";
import { alturaEm } from "./terrain";
import { alturaCabeca } from "./units3d";

/* [SYSTEM: RESILIENCIA] roundRect chegou em 2023 (iOS 16); antes disso, arcos */
if (typeof CanvasRenderingContext2D !== "undefined" && !CanvasRenderingContext2D.prototype.roundRect) {
  (CanvasRenderingContext2D.prototype as unknown as { roundRect: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect = function (this: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath();
  };
}
let cv: HTMLCanvasElement, g: CanvasRenderingContext2D;
let dpr = 1;
const FF = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const F_NOME = "600 11px " + FF, F_LV = "700 9px " + FF, F_DMG = "800 15px " + FF, F_DMG_G = "900 20px " + FF,
  F_NPC = "700 11.5px " + FF, F_ERR = "700 11px " + FF;

export function criarOverlay(host: HTMLElement) {
  cv = document.createElement("canvas");
  cv.id = "ov";
  host.appendChild(cv);
  g = cv.getContext("2d")!;
  redimensionarOverlay();
}
export function redimensionarOverlay() {
  if (!cv) return;
  dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(engine.W * dpr); cv.height = Math.round(engine.H * dpr);
  cv.style.width = engine.W + "px"; cv.style.height = engine.H + "px";
}

/* ---------- números que sobem ---------- */
interface Num { x: number; y: number; h: number; txt: string; cor: string; vida: number; max: number; grande: boolean; dx: number; dy: number }
const NUMS: Num[] = [];
function num(x: number, y: number, h: number, txt: string, cor: string, grande = false, vida = .95) {
  if (NUMS.length > 80) NUMS.shift();
  /* números no mesmo ponto em sequência sobem em degraus: não se atropelam */
  let dy = 0;
  for (const n of NUMS) if (n.max - n.vida < .35 && Math.abs(n.x - x) < .3 && Math.abs(n.y - y) < .3) dy = Math.max(dy, n.dy + 15);
  NUMS.push({ x, y, h, txt, cor, vida, max: vida, grande, dx: (Math.random() - .5) * 26, dy: Math.min(dy, 45) });
}
export const numeros = {
  dano(u: Unit, v: number, pesado: boolean) {
    num(u.x, u.y, alturaEm(u.x, u.y) + alturaCabeca(u) * .9, String(v), u === G.ctrl ? "#ff5a4a" : "#ff4f45", pesado, pesado ? 1.1 : .95);
  },
  cura(u: Unit, v: number) { num(u.x, u.y, alturaEm(u.x, u.y) + alturaCabeca(u) * .9, "+" + v, "#6fe08b"); },
  curaEm(x: number, y: number, v: number) { num(x, y, alturaEm(x, y) + 1, "+" + v, "#6fe08b"); },
  errou(u: Unit) { num(u.x, u.y, alturaEm(u.x, u.y) + alturaCabeca(u) * .9, "errou", "#c8d0d4", false, .7); },
};

/* ---------- manche ---------- */
export const overlayCfg = { rotulos: false };
export const manche = { on: false, ox: 0, oy: 0, x: 0, y: 0, R: 56 };

const P = { x: 0, y: 0, vis: false };
const LV: string[] = []; for (let i = 0; i <= 120; i++) LV.push("Lv " + i);
const larg = new Map<string, number>();
function medir(fonte: string, t: string) {
  const k = fonte + "|" + t;
  let w = larg.get(k);
  if (w === undefined) { g.font = fonte; w = g.measureText(t).width; if (larg.size > 3000) larg.clear(); larg.set(k, w); }
  return w;
}
function caveira(x: number, y: number, c: string) {
  g.fillStyle = "rgba(6,10,12,.85)"; g.beginPath(); g.arc(x, y - .6, 5, 0, 7); g.fill();
  g.fillStyle = c;
  g.beginPath(); g.arc(x, y - 1.2, 3.6, Math.PI, 0); g.fill();
  g.fillRect(x - 3.6, y - 1.2, 7.2, 2.6); g.fillRect(x - 2.1, y + 1.2, 4.2, 1.8);
  g.fillStyle = "rgba(6,10,12,.95)";
  g.beginPath(); g.arc(x - 1.5, y - 1.2, 1.15, 0, 7); g.fill();
  g.beginPath(); g.arc(x + 1.5, y - 1.2, 1.15, 0, 7); g.fill();
}
function barra(x: number, y: number, w: number, h: number, f: number, cor: string) {
  g.fillStyle = "rgba(0,0,0,.66)";
  g.fillRect(x - w / 2 - 1, y - 1, w + 2, h + 2);
  g.fillStyle = cor;
  g.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, f)), h);
}
function rotulado(u: Unit) {
  if (u === G.ctrl || u === G.sel) return true;
  const c = G.ctrl;
  if (c && (c.target === u || (c.party && u.party === c.party))) return true;
  if (!u.beast) return engine.cam.zoom < 2.2;
  if (u.hp < u.maxHp - .5) return true;
  if (c && Math.abs(u.x - c.x) + Math.abs(u.y - c.y) < 4.5) return true;
  return engine.cam.zoom < .8;
}

export function desenharOverlay(dt: number, alpha: number, t: number) {
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, engine.W, engine.H);
  if (!G.running || !overlayCfg.rotulos) return;
  const zoom = engine.cam.zoom;
  const escala = Math.max(.78, Math.min(1.1, 1.25 - zoom * .25));
  g.textAlign = "center"; g.textBaseline = "alphabetic";
  const c = G.ctrl;
  /* placas dos NPCs */
  if (W.cidade) for (const n of W.cidade.npcs) {
    mundoParaTela(n.x, n.y, alturaEm(n.x, n.y) + 1.65, P);
    if (!P.vis || P.x < -60 || P.x > engine.W + 60 || P.y < -20 || P.y > engine.H + 20) continue;
    const w = medir(F_NPC, n.placa) + 16;
    g.fillStyle = "rgba(12,16,20,.86)";
    g.beginPath(); g.roundRect(P.x - w / 2, P.y - 16, w, 20, 10); g.fill();
    g.strokeStyle = "rgba(219,182,94,.7)"; g.lineWidth = 1; g.stroke();
    g.font = F_NPC; g.fillStyle = "#f0cf6e"; g.fillText(n.placa, P.x, P.y - 2);
  }
  /* rótulos das unidades */
  for (const u of W.units) {
    if (u.dead) continue;
    const x = u.px + (u.x - u.px) * alpha, y = u.py + (u.y - u.py) * alpha;
    if (Math.abs(x - engine.cam.x) > 24 * zoom + 8 || Math.abs(y - engine.cam.y) > 24 * zoom + 8) continue;
    if (!rotulado(u)) continue;
    mundoParaTela(x, y, alturaEm(x, y) + alturaCabeca(u) + .12, P);
    if (!P.vis || P.x < -40 || P.x > engine.W + 40 || P.y < -30 || P.y > engine.H + 30) continue;
    g.save();
    g.translate(P.x, P.y);
    g.scale(escala, escala);
    let ty = 0;
    const bw = u.beast ? 30 : 34;
    if (u.maxMp > 0 && !u.beast) { barra(0, ty, bw, 2.5, u.mp / u.maxMp, "#5fa8e8"); ty -= 5.5; }
    const fr = u.hp / u.maxHp;
    barra(0, ty, bw, 3.5, fr, fr > .6 ? "#4fc46a" : fr > .3 ? "#e6b43a" : "#e6483f");
    ty -= 6;
    const mostraNome = !u.beast || zoom < 1.6 || (c && c.target === u);
    if (mostraNome) {
      const nome = u.name, lv = LV[Math.min(u.lvl | 0, 120)];
      const wn = medir(F_NOME, nome), wl = medir(F_LV, lv);
      const cav = u.skull ? (u.skull === "red" ? "#e2394f" : "#f2eee2")
        : (c && c.amarela && !u.beast && amareloPara(c, u) ? "#f2d23c" : null);
      const desl = -(wl + 4) * .5 + (cav ? -5 : 0);
      g.lineJoin = "round";
      g.font = F_NOME; g.lineWidth = 3; g.strokeStyle = "rgba(6,10,12,.92)";
      g.strokeText(nome, desl, ty - 2);
      g.fillStyle = u.beast ? "rgba(238,231,212,.95)" : u.cor.hi;
      g.fillText(nome, desl, ty - 2);
      g.textAlign = "left"; g.font = F_LV; g.lineWidth = 2.6;
      g.strokeText(lv, desl + wn * .5 + 3, ty - 2);
      g.fillStyle = "rgba(255,226,160,.95)"; g.fillText(lv, desl + wn * .5 + 3, ty - 2);
      g.textAlign = "center";
      if (cav) caveira(desl + wn * .5 + wl + 10, ty - 6, cav);
      ty -= 14;
    }
    if (u.convite && u.convite.t > W.simTime) {
      g.font = "800 12px " + FF; g.fillStyle = "#7fd6a0"; g.fillText("?", 0, ty); ty -= 12;
    }
    if (G.convidando && c && u !== c && !u.beast && (!u.party || u.party.membros.length < 2) && !u.convite && podeConvidar(c, u)) {
      const pul = 8 + Math.sin(t * 5) * 1.3;
      g.fillStyle = "rgba(127,214,160,.95)"; g.beginPath(); g.arc(0, ty - 8, pul, 0, 7); g.fill();
      g.fillStyle = "#0c1a12"; g.fillRect(-4.5, ty - 9, 9, 2.2); g.fillRect(-1.1, ty - 12.5, 2.2, 9);
      ty -= 20;
    }
    if (c && c.target === u) {
      const sob = Math.sin(t * 6) * 2;
      g.fillStyle = "#ff6a4a";
      g.beginPath(); g.moveTo(0, ty + sob); g.lineTo(-6, ty - 9 + sob); g.lineTo(6, ty - 9 + sob); g.closePath(); g.fill();
      g.strokeStyle = "rgba(6,10,12,.8)"; g.lineWidth = 1.2; g.stroke();
    }
    g.restore();
  }
  /* números */
  for (let i = NUMS.length - 1; i >= 0; i--) {
    const n = NUMS[i];
    n.vida -= dt;
    if (n.vida <= 0) { NUMS.splice(i, 1); continue; }
    const k = 1 - n.vida / n.max;
    mundoParaTela(n.x, n.y, n.h, P);
    if (!P.vis) continue;
    const pop = k < .12 ? 1.6 - (k / .12) * .6 : 1;
    g.save();
    g.translate(P.x + n.dx * (.35 + k * .65), P.y - 8 - n.dy - k * 34);
    g.scale(pop, pop);
    g.globalAlpha = Math.min(1, (1 - k) * 2.2);
    g.font = n.txt === "errou" ? F_ERR : n.grande ? F_DMG_G : F_DMG;
    g.lineWidth = 3.4; g.lineJoin = "round"; g.strokeStyle = "rgba(6,10,12,.9)";
    g.strokeText(n.txt, 0, 0);
    g.fillStyle = n.cor; g.fillText(n.txt, 0, 0);
    g.restore();
  }
  g.globalAlpha = 1;
  /* manche: só aparece depois da zona morta */
  if (manche.on) {
    const dx = manche.x - manche.ox, dy = manche.y - manche.oy;
    const l = Math.min(manche.R, Math.hypot(dx, dy)), a = Math.atan2(dy, dx);
    const hx = manche.ox + Math.cos(a) * l, hy = manche.oy + Math.sin(a) * l;
    g.globalAlpha = .28; g.fillStyle = "#e9e2d0"; g.beginPath(); g.arc(manche.ox, manche.oy, manche.R, 0, 7); g.fill();
    g.globalAlpha = .5; g.strokeStyle = "#f5e8c4"; g.lineWidth = 2; g.stroke();
    g.globalAlpha = .75; g.fillStyle = "#f2ecda"; g.beginPath(); g.arc(hx, hy, 22, 0, 7); g.fill();
    g.globalAlpha = .9; g.strokeStyle = "#c8a54a"; g.lineWidth = 2.4; g.stroke();
    g.globalAlpha = 1;
  }
}
export function limparOverlay() { NUMS.length = 0; }
