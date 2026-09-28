/* ================================================================
   [SYSTEM: INPUT_TOUCH] Toque de verdade, multitoque:
     · com herói no comando, o primeiro dedo no mapa é o MANCHE
       INVISÍVEL: nasce onde o polegar cai e a origem escorrega atrás
       do dedo numa arrastada longa;
     · encostar e soltar rápido é TOQUE: mira alvo, anda, lança magia;
     · sem comando (ou câmera livre) o dedo arrasta a câmera;
     · dois dedos são sempre pinça de zoom.
   [SYSTEM: INPUT_KB] WASD/setas, 1 2 3, Q E, F, M, Esc/Espaço.
   ================================================================ */
import { G, W, hooks } from "../sim/state";
import { engine, telaParaChao, telaParaDirecao, mundoParaTela, ZOOM_MIN, ZOOM_MAX } from "../render/engine";
import { manche } from "../render/overlay";
import { alturaEm } from "../render/terrain";
import { alturaCabeca } from "../render/units3d";
import { clamp, dist } from "../sim/rng";
import { NPC_ALCANCE } from "../sim/map";
import { pzAtiva } from "../sim/pk";
import { podeAtacarManual, declararPk } from "../sim/relations";
import { convidar } from "../sim/world";
import { avisoPz, mirarMagia, pausaRefil } from "../sim/player";
import { avisoDe, fx } from "../sim/fx";
import type { Unit } from "../sim/types";
import { iniciarAudio } from "../audio/sfx";

const JOY_MORTA = 11, TOQUE_MS = 240, TOQUE_PX = 14;
interface Dedo { x0: number; y0: number; x: number; y: number; cx: number; cy: number; t0: number; moveu: number; papel: "joy" | "cam"; sec: boolean }
const dedos = new Map<number, Dedo>();
let joyId = -1;
let pinca: { d: number; z: number } | null = null;
export const entrada = { acoes: null as null | Acoes };
export interface Acoes {
  aoTocarNpc: (id: string) => void;
  atalho: (k: string) => void;
  voltar: () => void;
  noJogo: () => boolean;
  painelAberto: () => boolean;
  fecharPainel: () => void;
  atualizar: () => void;
}

export function iniciarEntrada(cv: HTMLCanvasElement) {
  cv.addEventListener("contextmenu", (e) => e.preventDefault());
  cv.addEventListener("pointerdown", (e) => {
    iniciarAudio();
    const A = entrada.acoes;
    if (A && A.painelAberto()) { A.fecharPainel(); return; }
    cv.setPointerCapture(e.pointerId);
    const sec = e.pointerType === "mouse" && e.button !== 0;
    const comCtrl = !!G.ctrl && !G.ctrl.dead && !pinca && !sec && G.autoCam;
    const papel: Dedo["papel"] = comCtrl && joyId < 0 ? "joy" : "cam";
    dedos.set(e.pointerId, { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, cx: engine.cam.x, cy: engine.cam.y, t0: performance.now(), moveu: 0, papel, sec });
    if (papel === "joy") { joyId = e.pointerId; manche.ox = e.clientX; manche.oy = e.clientY; manche.x = e.clientX; manche.y = e.clientY; manche.on = false; }
  });
  cv.addEventListener("pointermove", (e) => {
    const d = dedos.get(e.pointerId);
    if (!d) return;
    d.x = e.clientX; d.y = e.clientY;
    d.moveu = Math.max(d.moveu, Math.hypot(d.x - d.x0, d.y - d.y0));
    if (d.papel === "joy" && joyId === e.pointerId && !pinca) {
      manche.x = d.x; manche.y = d.y;
      const dx = manche.x - manche.ox, dy = manche.y - manche.oy, l = Math.hypot(dx, dy);
      if (!manche.on && l > JOY_MORTA) manche.on = true;
      if (l > manche.R) { const k = (l - manche.R) / l; manche.ox += dx * k; manche.oy += dy * k; }
    } else if (d.papel === "cam" && d.moveu > 6 && !pinca) {
      if (G.autoCam) hooks.setCam(false);
      /* arrasto move o chão com o dedo */
      const a = telaParaChao(d.x0, d.y0), b = telaParaChao(d.x, d.y);
      if (a && b) { engine.cam.x = d.cx - (b.x - a.x); engine.cam.y = d.cy - (b.y - a.y); limitarCamera(); }
    }
  });
  const soltar = (e: PointerEvent, cancel: boolean) => {
    const d = dedos.get(e.pointerId);
    if (!d) return;
    dedos.delete(e.pointerId);
    if (joyId === e.pointerId) { joyId = -1; manche.on = false; }
    if (cancel || pinca || d.sec) return;
    const rapido = performance.now() - d.t0 < TOQUE_MS;
    if (d.moveu < TOQUE_PX && (d.papel === "cam" ? d.moveu < 8 : rapido)) tocar(d.x, d.y);
  };
  cv.addEventListener("pointerup", (e) => soltar(e, false));
  cv.addEventListener("pointercancel", (e) => soltar(e, true));
  cv.addEventListener("wheel", (e) => {
    e.preventDefault();
    engine.cam.tzoom = clamp(engine.cam.tzoom * (e.deltaY < 0 ? .88 : 1.14), ZOOM_MIN, ZOOM_MAX);
  }, { passive: false });
  cv.addEventListener("touchstart", (e) => {
    if (e.touches.length === 2) {
      const a = e.touches[0], b = e.touches[1];
      pinca = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z: engine.cam.tzoom };
      joyId = -1; manche.on = false;
    }
  }, { passive: true });
  cv.addEventListener("touchmove", (e) => {
    if (pinca && e.touches.length === 2) {
      const a = e.touches[0], b = e.touches[1];
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      engine.cam.tzoom = clamp(pinca.z * (pinca.d / Math.max(10, d)), ZOOM_MIN, ZOOM_MAX);
    }
  }, { passive: true });
  cv.addEventListener("touchend", (e) => { if (e.touches.length < 2) pinca = null; }, { passive: true });

  document.addEventListener("keydown", (e) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
    iniciarAudio();
    const k = e.key.toLowerCase(), A = entrada.acoes;
    if (!A) return;
    if (k === "escape") { e.preventDefault(); A.voltar(); return; }
    if (k === " ") { e.preventDefault(); A.voltar(); return; }
    if (!A.noJogo()) return;
    if (G.ctrl && !e.repeat && ["1", "2", "3", "q", "e", "f", "tab", "m"].includes(k)) { e.preventDefault(); A.atalho(k); return; }
    if (DIR[k] && G.ctrl) { e.preventDefault(); teclas.add(k); }
  });
  document.addEventListener("keyup", (e) => teclas.delete(e.key.toLowerCase()));
  window.addEventListener("blur", () => { teclas.clear(); dedos.clear(); joyId = -1; manche.on = false; });
}
export function limitarCamera() {
  const N = W.N || 72;
  engine.cam.x = clamp(engine.cam.x, -4, N + 4); engine.cam.y = clamp(engine.cam.y, -4, N + 4);
}

/* teclado e manche entram no mesmo canal: um vetor de tela que vira rumo no chão */
const teclas = new Set<string>();
const DIR: Record<string, [number, number]> = { w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0], arrowup: [0, -1], arrowdown: [0, 1], arrowleft: [-1, 0], arrowright: [1, 0] };
export function lerEntrada() {
  let sx = 0, sy = 0;
  for (const k of teclas) { const v = DIR[k]; if (v) { sx += v[0]; sy += v[1]; } }
  if (manche.on) {
    const jx = manche.x - manche.ox, jy = manche.y - manche.oy, l = Math.hypot(jx, jy);
    if (l > JOY_MORTA) { sx = jx / l; sy = jy / l; }
  }
  G.tvn = (sx || sy) && G.ctrl && !G.ctrl.dead ? 1 : 0;
  if (!G.tvn) return;
  const d = telaParaDirecao(sx, sy);
  G.tvx = d.x; G.tvy = d.y;
}

/* ---------- toque no mapa ---------- */
const P = { x: 0, y: 0, vis: false };
function unidadeNaTela(px: number, py: number): Unit | null {
  let best: Unit | null = null, bd = 1e9;
  for (const u of W.units) {
    if (u.dead) continue;
    if (Math.abs(u.x - engine.cam.x) > 30 || Math.abs(u.y - engine.cam.y) > 30) continue;
    const h = alturaEm(u.x, u.y), a = alturaCabeca(u);
    mundoParaTela(u.x, u.y, h + a * .5, P);
    if (!P.vis) continue;
    const r = Math.max(26, a * 28 / engine.cam.zoom);
    const d = Math.hypot(P.x - px, (P.y - py) * .85);
    if (d < r && d < bd) { bd = d; best = u; }
  }
  return best;
}
function chaoNaTela(px: number, py: number) {
  let p = telaParaChao(px, py, 0);
  if (!p) return null;
  for (let i = 0; i < 2; i++) { const h = alturaEm(p.x, p.y); const q = telaParaChao(px, py, h); if (q) p = q; }
  return p;
}
function tocar(px: number, py: number) {
  const A = entrada.acoes;
  const best = unidadeNaTela(px, py);
  let npc: (typeof W.cidade.npcs)[number] | null = null, nd = 34;
  if (W.cidade) for (const n of W.cidade.npcs) {
    mundoParaTela(n.x, n.y, alturaEm(n.x, n.y) + .7, P);
    const d = Math.hypot(P.x - px, P.y - py);
    if (d < nd) { nd = d; npc = n; }
  }
  const c = G.ctrl;
  if (c && !c.dead) {
    const g = chaoNaTela(px, py);
    const gx = g ? clamp(g.x, .5, W.N - .5) : c.x, gy = g ? clamp(g.y, .5, W.N - .5) : c.y;
    if (G.convidando) {
      G.convidando = false;
      if (best && !best.beast && best !== c && !convidar(c, best)) avisoDe(c, best.name + " não pode entrar na equipe agora", "#c96a5a");
      A && A.atualizar(); return;
    }
    if (c.refil) pausaRefil(c, best && podeAtacarManual(c, best) ? "volta quando o alvo cair" : "volta quando você parar");
    if (G.mirandoSlot >= 0) {
      const ok = best && podeAtacarManual(c, best);
      mirarMagia(c, G.mirandoSlot, ok ? best!.x : gx, ok ? best!.y : gy);
      G.mirandoSlot = -1; A && A.atualizar(); return;
    }
    if (npc && (!best || nd < 26)) {
      c.ordem = null; c.alvoManual = null; c.target = null; c.encomenda = null; c.goalKey = ""; c.think = 0;
      if (dist(c.x, c.y, npc.x, npc.y) <= NPC_ALCANCE) { c.npcAlvo = null; A && A.aoTocarNpc(npc.id); }
      else if (pzAtiva(c) && !c.pz) avisoPz(c);
      else c.npcAlvo = npc;
      A && A.atualizar(); return;
    }
    if (best && podeAtacarManual(c, best)) {
      if (c.alvoManual === best) { c.alvoManual = null; c.target = null; }
      else { declararPk(c, best); c.alvoManual = best; c.target = best; c.ordem = null; c.npcAlvo = null; }
    } else {
      c.ordem = { x: gx, y: gy }; c.goalKey = ""; c.encomenda = null; c.npcAlvo = null;
      marcaChao(gx, gy);
    }
    c.think = 0; A && A.atualizar();
    return;
  }
  G.sel = best === G.sel ? null : best;
  if (G.sel) hooks.setCam(true);
  A && A.atualizar();
}
/* marca de destino no chão (efeito curto) */
function marcaChao(x: number, y: number) { fx({ t: "ring", x, y, c: "#f5db8f", life: .45, r: .55 }); }
