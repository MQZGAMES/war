/* ================================================================
   Barramento de efeitos. A simulação só anuncia o que aconteceu; o
   renderizador transforma em partícula, luz, decalque e som, e a
   interface em aviso, faixa e número que sobe. Nada aqui desenha.
   ================================================================ */
import type { SpellKey } from "./data";
import { G } from "./state";
import type { Coisa, Unit } from "./types";

export type FxEv =
  | { t: "dmg"; u: Unit; v: number; heavy: boolean }
  | { t: "heal"; x: number; y: number; v: number; u?: Unit }
  | { t: "miss"; u: Unit }
  | { t: "ring"; x: number; y: number; c: string; life: number; r?: number }
  | { t: "boom"; x: number; y: number; c: string; r: number; life: number; kind: "fire" | "ice" | "heal" | "earth" | "dust" | "dark" }
  | { t: "bits"; x: number; y: number; c: string; n: number; spd: number; h?: number }
  | { t: "blood"; u: Unit; n: number; src?: Unit | null }
  | { t: "levelup"; u: Unit }
  | { t: "death"; u: Unit; src: Unit | null }
  | { t: "revive"; u: Unit }
  | { t: "scorch"; x: number; y: number; life: number; r: number }
  | { t: "crack"; x: number; y: number; r: number }
  | { t: "cast"; u: Unit; k: SpellKey | "bola" | "onda" }
  | { t: "shoot"; u: Unit; kind: string }
  | { t: "swing"; u: Unit; heavy: boolean }
  | { t: "potion"; u: Unit; tipo: "hp" | "mp" }
  | { t: "coins"; u: Unit; v: number }
  | { t: "loot"; u: Unit; it: Coisa }
  | { t: "invite"; u: Unit; ok: boolean | null }
  | { t: "charge"; u: Unit }
  | { t: "impact"; x: number; y: number; kind: "meteoro" | "nevasca" | "chuva" | "bola" | "terremoto" | "baque" | "bolaFogo" | "raio" | "gelo" | "trevas" }
  | { t: "shake"; f: number }
  | { t: "ui"; s: "click" | "nega" | "compra" | "venda" | "equip" };

export const FX: FxEv[] = [];
export function fx(e: FxEv) { if (FX.length < 900) FX.push(e); }

/* ---------- interface ---------- */
export const ui = {
  aviso: (_txt: string, _cor?: string) => {},
  banner: (_tit: string, _sub?: string, _cls?: string) => {},
  popXp: (_v: number) => {},
  popOuro: (_v: number) => {},
};
export function avisoDe(u: Unit | null | undefined, txt: string, cor?: string) {
  if (u && u === G.ctrl) ui.aviso(txt, cor);
}

/* [SYSTEM: GAME_FEEL] tremor: só entra na câmera, a simulação não vê */
export function tremer(f: number) { fx({ t: "shake", f }); }
export function ferirVisual(t: Unit, d: number, src: Unit | null) {
  t.flash = .16; t.squash = .18;
  if (src) { t.hitX = t.x - src.x; t.hitY = t.y - src.y; }
}
