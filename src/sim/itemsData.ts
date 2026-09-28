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
  /* raridade: 0 comum (loja), 1 incomum, 2 raro, 3 épico — só no loot */
  raro?: 1 | 2 | 3;
}
export const RARO_NOME = ["comum", "incomum", "raro", "épico"];
export const RARO_COR = ["#cfd6da", "#7fd68f", "#6fb5ff", "#c68bff"];
export const RARO_PRECO = [1, 1.7, 2.8, 4.8];

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
  /* ---------- incomuns ---------- */
  machado: { n: "Machado de guerra", s: "arma", voc: K_, st: { str: 1.25, def: .25 }, preco: 80, ic: "machado", cor: METAL, raro: 1 },
  coleteEscamas: { n: "Colete de escamas", s: "arm", voc: KA, st: { def: 1.0, dex: .5, hp: 4 }, preco: 75, ic: "gibao", cor: "#6f9a6a", raro: 1 },
  varinhaBrasas: { n: "Varinha de brasas", s: "arma", voc: M_, st: { mag: 1.3 }, preco: 80, ic: "varinha", cor: "#ff8a4a", raro: 1 },
  calcaMalha: { n: "Calça de malha", s: "cal", voc: KA, st: { def: 1.0, hp: 7 }, preco: 65, ic: "grevas", cor: "#9aa4ab", raro: 1 },
  calcaMistica: { n: "Calça mística", s: "cal", voc: M_, st: { def: .6, mp: 10, mag: .3 }, preco: 65, ic: "calca", cor: PANO, raro: 1 },
  anelVida: { n: "Anel de vida", s: "ane", voc: null, st: { hp: 16, def: .2 }, preco: 70, ic: "anel", cor: "#e0685a", raro: 1 },
  /* ---------- raros ---------- */
  martelo: { n: "Martelo de guerra", s: "arma", voc: K_, st: { str: 2.1, hp: 4 }, preco: 120, ic: "martelo", cor: METAL, duas: 1, raro: 2 },
  escudoTorre: { n: "Escudo torre", s: "esc", voc: K_, st: { def: 1.5, hp: 8 }, preco: 90, ic: "escudo", cor: "#8e949a", raro: 2 },
  armaduraPlacas: { n: "Armadura de placas", s: "arm", voc: K_, st: { def: 1.6, hp: 14 }, preco: 110, ic: "couraca", cor: "#dfe6ea", raro: 2 },
  besta: { n: "Besta pesada", s: "arma", voc: A_, st: { str: 1.9, dex: .3 }, preco: 120, ic: "besta", cor: MADEIRA, duas: 1, raro: 2 },
  capuzSombra: { n: "Capuz das sombras", s: "cab", voc: A_, st: { dex: .9, def: .4, spd: .6 }, preco: 80, ic: "capuz", cor: "#4a4a58", raro: 2 },
  mantoArcano: { n: "Manto arcano", s: "arm", voc: M_, st: { def: .7, mp: 16, mag: .6 }, preco: 100, ic: "manto", cor: "#5a7ad8", raro: 2 },
  tiara: { n: "Tiara de safira", s: "cab", voc: M_, st: { mag: .8, mp: 10 }, preco: 80, ic: "tiara", cor: "#6fb5e6", raro: 2 },
  orbe: { n: "Orbe de cristal", s: "esc", voc: M_, st: { mag: 1.0, mp: 6 }, preco: 90, ic: "orbe", cor: "#9fdcff", raro: 2 },
  botasVelozes: { n: "Botas velozes", s: "bot", voc: null, st: { spd: 3, def: .3 }, preco: 90, ic: "bota", cor: "#e6c25a", raro: 2 },
  amuletoGuarda: { n: "Amuleto da guarda", s: "amu", voc: null, st: { def: .8, hp: 10 }, preco: 90, ic: "amuleto", cor: "#9fb4c4", raro: 2 },
  /* ---------- épicos: só de criatura forte ---------- */
  laminaRunica: { n: "Lâmina rúnica", s: "arma", voc: K_, st: { str: 1.6, mag: .5, hp: 6 }, preco: 160, ic: "espada", cor: "#8fd0ff", raro: 3 },
  escamasDragao: { n: "Couraça de dragão", s: "arm", voc: KA, st: { def: 1.8, hp: 18, str: .3 }, preco: 170, ic: "couraca", cor: "#c0453a", raro: 3 },
  arcoElfico: { n: "Arco élfico", s: "arma", voc: A_, st: { str: 1.4, dex: 1.2, spd: .8 }, preco: 170, ic: "arco", cor: "#d8f0a0", duas: 1, raro: 3 },
  cajadoAncestral: { n: "Cajado ancestral", s: "arma", voc: M_, st: { mag: 2.3, mp: 12 }, preco: 170, ic: "cajado", cor: "#c68bff", duas: 1, raro: 3 },
  colarDragao: { n: "Colar do dragão", s: "amu", voc: null, st: { hp: 20, mp: 16, str: .3, mag: .3 }, preco: 160, ic: "amuleto", cor: "#ff7a4a", raro: 3 },
  elmoAlado: { n: "Elmo alado", s: "cab", voc: K_, st: { def: 1.0, hp: 10, spd: .8 }, preco: 150, ic: "elmo", cor: "#f0d88a", raro: 3 },
  pvida: { n: "Poção de vida", pocao: "hp", st: {}, preco: PRECO_POCAO, ic: "pvida", cor: "#e0685a" },
  pmana: { n: "Poção de mana", pocao: "mp", st: {}, preco: PRECO_POCAO, ic: "pmana", cor: "#6fb5e6" },
};
export const BASES_EQUIP = Object.keys(BASES).filter((k) => BASES[k].s);
/* a loja do Comerciante só tem o comum; o resto vem das criaturas */
export const BASES_LOJA = BASES_EQUIP.filter((k) => !BASES[k].raro);
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
