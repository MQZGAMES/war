/* [SYSTEM: ITENS] Economia no molde do Tibia: todo item é comum e evolui
   por nível, de +1 a +10 ("Espada +3"). Item = {b, k}; poção = {b, n}.
     st   quanto CADA nível soma (força, destreza, defesa e magia em
          pontos de build; vida e mana em valor cheio; spd em %)
     voc  vocações que podem usar (null = todas)
     duas arma de duas mãos: bloqueia o escudo */
import type { VocKey } from "./data";
import type { SlotKey } from "./types";

export type StatKey = "str" | "dex" | "def" | "mag" | "hp" | "mp" | "spd";
export interface BaseDef {
  n: string; s?: SlotKey; voc?: VocKey[] | null; st: Partial<Record<StatKey, number>>;
  preco: number; ic: string; cor: string; duas?: 1; pocao?: "hp" | "mp";
}

export const SLOTS: SlotKey[] = ["cab", "amu", "arm", "arma", "esc", "cal", "ane", "bot"];
export const SLOT_NOME: Record<SlotKey, string> = { cab: "Capacete", amu: "Amuleto", arm: "Armadura", arma: "Arma", esc: "Escudo", cal: "Calça", ane: "Anel", bot: "Bota" };
export const NIVEL_MAX = 10, PRECO_POCAO = 30, MOCHILA_N = 20, COFRE_N = 50;

const K_: VocKey[] = ["knight"], A_: VocKey[] = ["archer"], M_: VocKey[] = ["mage", "druid"], KA: VocKey[] = ["knight", "archer"];
const METAL = "#c9cfd3", COURO = "#b0814f", MADEIRA = "#b58a52", PANO = "#9a7ad8", DOURADO = "#e6c25a";

export const BASES: Record<string, BaseDef> = {
  espada: { n: "Espada", s: "arma", voc: K_, st: { str: 1 }, preco: 60, ic: "espada", cor: METAL },
  montante: { n: "Montante", s: "arma", voc: K_, st: { str: 1.6 }, preco: 90, ic: "montante", cor: METAL, duas: 1 },
  arco: { n: "Arco longo", s: "arma", voc: A_, st: { str: 1.3, dex: .6 }, preco: 90, ic: "arco", cor: MADEIRA, duas: 1 },
  varinha: { n: "Varinha", s: "arma", voc: M_, st: { mag: 1 }, preco: 60, ic: "varinha", cor: "#7fb6ff" },
  cajado: { n: "Cajado", s: "arma", voc: M_, st: { mag: 1.6, mp: 6 }, preco: 90, ic: "cajado", cor: "#7fb6ff", duas: 1 },
  escudo: { n: "Escudo", s: "esc", voc: K_, st: { def: 1 }, preco: 50, ic: "escudo", cor: METAL },
  grimorio: { n: "Grimório", s: "esc", voc: M_, st: { mag: .5, def: .5 }, preco: 50, ic: "livro", cor: "#a8643f" },
  elmo: { n: "Elmo", s: "cab", voc: K_, st: { def: .6, hp: 5 }, preco: 40, ic: "elmo", cor: METAL },
  capuz: { n: "Capuz", s: "cab", voc: A_, st: { dex: .5, def: .4 }, preco: 40, ic: "capuz", cor: COURO },
  chapeu: { n: "Chapéu de mago", s: "cab", voc: M_, st: { mag: .5, mp: 6 }, preco: 40, ic: "chapeu", cor: PANO },
  couraca: { n: "Couraça", s: "arm", voc: K_, st: { def: 1.2, hp: 10 }, preco: 70, ic: "couraca", cor: METAL },
  gibao: { n: "Gibão", s: "arm", voc: KA, st: { def: .8, dex: .4 }, preco: 60, ic: "gibao", cor: COURO },
  manto: { n: "Manto", s: "arm", voc: M_, st: { def: .5, mp: 10, mag: .3 }, preco: 60, ic: "manto", cor: PANO },
  grevas: { n: "Grevas", s: "cal", voc: K_, st: { def: .8, hp: 6 }, preco: 50, ic: "grevas", cor: METAL },
  calcaCouro: { n: "Calça de couro", s: "cal", voc: null, st: { def: .6, hp: 4 }, preco: 45, ic: "calca", cor: COURO },
  botas: { n: "Botas", s: "bot", voc: null, st: { spd: 1.5, def: .3 }, preco: 40, ic: "bota", cor: COURO },
  colar: { n: "Amuleto", s: "amu", voc: null, st: { hp: 10, mp: 8 }, preco: 55, ic: "amuleto", cor: DOURADO },
  anelForca: { n: "Anel de força", s: "ane", voc: KA, st: { str: .8 }, preco: 55, ic: "anel", cor: "#e0685a" },
  anelArcano: { n: "Anel arcano", s: "ane", voc: M_, st: { mag: .8 }, preco: 55, ic: "anel", cor: "#7fb6ff" },
  anelPrecisao: { n: "Anel de precisão", s: "ane", voc: null, st: { dex: 1 }, preco: 55, ic: "anel", cor: "#7fd68f" },
  pvida: { n: "Poção de vida", pocao: "hp", st: {}, preco: PRECO_POCAO, ic: "pvida", cor: "#e0685a" },
  pmana: { n: "Poção de mana", pocao: "mp", st: {}, preco: PRECO_POCAO, ic: "pmana", cor: "#6fb5e6" },
};
export const BASES_EQUIP = Object.keys(BASES).filter((k) => BASES[k].s);
export const STAT_NOME: Record<StatKey, string> = { str: "força", dex: "destreza", def: "defesa", mag: "magia", hp: "vida", mp: "mana", spd: "% veloc." };
export const STAT_CURTO: Record<StatKey, string> = { str: "atk", dex: "des", def: "def", mag: "mag", hp: "hp", mp: "mp", spd: "vel" };
export const STAT_LONGO: Record<StatKey, string> = { str: "força", dex: "destreza", def: "defesa", mag: "magia", hp: "vida", mp: "mana", spd: "veloc." };

/* kit de partida por vocação; veterano sai melhor */
export const KIT: Record<VocKey, string[]> = {
  knight: ["espada", "escudo", "elmo", "couraca"], archer: ["arco", "capuz", "gibao"],
  mage: ["cajado", "chapeu", "manto"], druid: ["cajado", "chapeu", "manto"],
};

/* peso de cada status por vocação: é o que a IA e o Auto equipar comparam */
export const PESO: Record<VocKey, Record<StatKey, number>> = {
  knight: { str: 1.2, dex: .5, def: 1.1, mag: .1, hp: .05, mp: .01, spd: .25 },
  archer: { str: 1, dex: 1, def: .8, mag: .1, hp: .04, mp: .02, spd: .35 },
  mage: { str: .05, dex: .25, def: .7, mag: 1.3, hp: .04, mp: .03, spd: .25 },
  druid: { str: .05, dex: .25, def: .7, mag: 1.3, hp: .04, mp: .03, spd: .25 },
};
