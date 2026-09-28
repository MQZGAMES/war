/* [SYSTEM: HUD_EQUIP] Grade 3×4 no molde do Tibia e casas da mochila/cofre.
     Amuleto  Capacete  Mochila
     Arma     Armadura  Escudo
     Anel     Calça     Poções
     Nível    Bota      Ouro */
import type { Coisa, Item, Pocao, SlotKey, Unit } from "../sim/types";
import { BASES, MOCHILA_N, SLOT_NOME, STAT_CURTO, type StatKey } from "../sim/itemsData";
import { corItem, ehPocao, itemStat, livres } from "../sim/items";
import { IcoItem } from "./icons";
import { fmt } from "./comp";
import { tick } from "./store";

export type Sel = { onde: "eq" | "mo" | "co"; i: number | SlotKey } | null;
const GRADE = ["amu", "cab", "mochila", "arma", "arm", "esc", "ane", "cal", "pocoes", "nivel", "bot", "ouro"] as const;
const VAZIO: Record<SlotKey, string> = { cab: "elmo", amu: "amuleto", arm: "couraca", arma: "espada", esc: "escudo", cal: "calca", ane: "anel", bot: "bota" };

export function statCurto(it: Coisa) {
  const B = BASES[it.b];
  if (B.pocao) return "";
  let k: StatKey | null = null;
  for (const c in B.st) { k = c as StatKey; break; }
  if (!k) return "";
  return "+" + itemStat(it as Item, k) + (k === "spd" ? "% " : " ") + STAT_CURTO[k];
}
export function ItemEm({ it }: { it: Coisa }) {
  void tick.value;
  const B = BASES[it.b];
  return (
    <>
      <IcoItem ic={B.ic} cor={corItem(it)} />
      {B.raro ? <i class={"rar r" + B.raro} /> : null}
      {ehPocao(it) ? <span class="qn">{(it as Pocao).n}</span> : <><span class="lv">+{(it as Item).k}</span><span class="st">{statCurto(it)}</span></>}
    </>
  );
}
export function Grade({ u, peq, sel, aoTocar }: { u: Unit; peq?: boolean; sel?: Sel; aoTocar?: (s: SlotKey) => void }) {
  void tick.value;
  return (
    <div class={"eqg" + (peq ? " peq" : "")}>
      {GRADE.map((s) => {
        if (s === "mochila") return <div key={s} class="sl info"><IcoItem ic="mochila" cor="#8a6a3a" /><b>{MOCHILA_N - livres(u.mochila)}/{MOCHILA_N}</b></div>;
        if (s === "pocoes") return <div key={s} class="sl info"><small style={{ color: "#ff8a7a" }}>♥ {u.potHp}</small><small style={{ color: "#7fc0ef", marginTop: "4px" }}>✦ {u.potMp}</small></div>;
        if (s === "nivel") return <div key={s} class="sl info"><small>Nível</small><b>{u.lvl}</b></div>;
        if (s === "ouro") return <div key={s} class="sl info"><small>Ouro</small><b style={{ color: "#f2c53d", fontSize: "11px" }}>{fmt(u.ouro)}</b></div>;
        const it = u.eqp[s], e = u.eqp;
        const bloq = s === "esc" && e.arma && BASES[e.arma.b].duas;
        const marcado = sel && sel.onde === "eq" && sel.i === s;
        return (
          <button key={s} class={"sl" + (marcado ? " sel" : "") + (bloq ? " bloq" : "")} title={SLOT_NOME[s]} onClick={() => aoTocar && aoTocar(s)}>
            {it ? <ItemEm it={it} /> : <IcoItem ic={VAZIO[s]} cor="#9a9a9a" vazio />}
          </button>
        );
      })}
    </div>
  );
}
export function Casas({ arr, onde, sel, aoTocar }: { arr: (Coisa | null)[]; onde: "mo" | "co"; sel: Sel; aoTocar: (i: number) => void }) {
  void tick.value;
  return (
    <div class="mo">
      {arr.map((it, i) => (
        <button key={i} class={"sl" + (sel && sel.onde === onde && sel.i === i ? " sel" : "")} onClick={() => aoTocar(i)}>{it && <ItemEm it={it} />}</button>
      ))}
    </div>
  );
}
