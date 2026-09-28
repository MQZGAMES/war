/* ================================================================
   AJUSTE — todo o equilíbrio do jogo, portado da v54 sem mudar número.
   Vocações, bestiário, magias, exaustão, trava de PZ, caveiras, poções,
   atributos, planos da IA, posturas e a tabela de utilidade.
   ================================================================ */

export type VocKey = "knight" | "archer" | "mage" | "druid";
export type BeastKey =
  | "hen" | "rat" | "cow" | "wolf" | "boar" | "spider" | "bear" | "orc"
  | "lion" | "troll" | "minotaur" | "cyclops" | "dragon" | "demon";
export type KindKey = VocKey | BeastKey;

export interface BeastAtk {
  investida?: { cd: number; min: number; max: number; dur: number };
  veneno?: { lento: number };
  baque?: { raio: number; frac: number };
  bola?: { dmg: number; cd: number; rng: number; raio: number };
  onda?: { dmg: number; cd: number; rng: number; larg: number; vel: number };
}

export interface KindDef {
  key: KindKey;
  pt: string;
  icon?: string;
  hp: number; spd: number; range: number; dmg: number; cd: number; armor: number;
  threat: number; flee: number; sight: number; r: number;
  mp: number; rHp: number; rMp: number;
  keep?: number; proj?: "arrow" | "fire" | "ice";
  beast?: boolean;
  lvlM?: number; nv?: [number, number]; matilha?: number;
  aggro?: number; roam?: number; xpVal?: number;
  atk?: BeastAtk;
  /* porte visual (altura aproximada em unidades de mundo), usado pelo
     rótulo, pelo projétil e pela sombra */
  alt: number;
}

const RITMO = 2.0; // todo ataque básico sai a cada 2 s

export const KINDS: Record<KindKey, KindDef> = {
  knight: { key: "knight", pt: "Cavaleiro", icon: "⚔", hp: 155, spd: 2.02, range: 1.25, dmg: 34, cd: RITMO, armor: .12,
    threat: 1.0, flee: .16, sight: 12, r: .34, mp: 70, rHp: 3.2, rMp: 1.5, alt: 1.15 },
  archer: { key: "archer", pt: "Arqueiro", icon: "🏹", hp: 112, spd: 2.25, range: 5, dmg: 27, cd: RITMO, armor: .09,
    threat: 1.55, flee: .34, sight: 13, r: .29, keep: 2.9, proj: "arrow", mp: 85, rHp: 2.2, rMp: 2.2, alt: 1.1 },
  mage: { key: "mage", pt: "Mago", icon: "✦", hp: 96, spd: 1.76, range: 5, dmg: 25, cd: RITMO, armor: .05,
    threat: 1.85, flee: .38, sight: 12, r: .3, keep: 3.1, proj: "fire", mp: 125, rHp: 1.2, rMp: 3.6, alt: 1.3 },
  druid: { key: "druid", pt: "Druida", icon: "☘", hp: 104, spd: 1.76, range: 5, dmg: 23, cd: RITMO, armor: .05,
    threat: 1.7, flee: .38, sight: 12, r: .3, keep: 3.1, proj: "ice", mp: 125, rHp: 1.2, rMp: 3.6, alt: 1.15 },

  /* [SYSTEM: BESTIARY] a ordem é a ordem de força */
  hen: { key: "hen", pt: "Galinha", beast: true, lvlM: 2, nv: [1, 3], hp: 20, spd: 1.70, matilha: 1, range: .8, dmg: 2, cd: 1.4, armor: 0,
    threat: .15, flee: .99, sight: 7, r: .20, mp: 0, rHp: .6, rMp: 0, aggro: 0, roam: 4, xpVal: 18, alt: .45 },
  rat: { key: "rat", pt: "Rato", beast: true, lvlM: 3, nv: [2, 4], hp: 34, spd: 2.30, matilha: 1, range: .85, dmg: 5, cd: 1.2, armor: 0,
    threat: .22, flee: .7, sight: 8, r: .20, mp: 0, rHp: .8, rMp: 0, aggro: 4, roam: 5, xpVal: 26, alt: .35 },
  cow: { key: "cow", pt: "Vaca", beast: true, lvlM: 4, nv: [3, 5], hp: 95, spd: 1.10, matilha: 1, range: 1.0, dmg: 7, cd: 1.8, armor: .10,
    threat: .30, flee: .99, sight: 8, r: .38, mp: 0, rHp: 1.4, rMp: 0, aggro: 0, roam: 5, xpVal: 55, alt: .95 },
  wolf: { key: "wolf", pt: "Lobo", beast: true, lvlM: 5, nv: [4, 7], hp: 70, spd: 2.75, matilha: 1, range: 1.0, dmg: 11, cd: .9, armor: .08,
    threat: .60, flee: .2, sight: 11, r: .28, mp: 0, rHp: 1.6, rMp: 0, aggro: 7, roam: 7, xpVal: 80, alt: .75 },
  boar: { key: "boar", pt: "Javali", beast: true, lvlM: 7, nv: [6, 9], hp: 120, spd: 2.35, matilha: 1, range: 1.05, dmg: 15, cd: 1.1, armor: .14,
    threat: .66, flee: .18, sight: 10, r: .34, mp: 0, rHp: 1.8, rMp: 0, aggro: 7, roam: 6, xpVal: 120, alt: .7,
    atk: { investida: { cd: 6.5, min: 2.6, max: 6.5, dur: .9 } } },
  spider: { key: "spider", pt: "Aranha", beast: true, lvlM: 9, nv: [8, 11], hp: 88, spd: 2.55, matilha: 1, range: 1.0, dmg: 14, cd: 1.0, armor: .06,
    threat: .70, flee: .25, sight: 11, r: .32, mp: 0, rHp: 1.5, rMp: 0, aggro: 8, roam: 6, xpVal: 135, alt: .6,
    atk: { veneno: { lento: 2.2 } } },
  bear: { key: "bear", pt: "Urso", beast: true, lvlM: 11, nv: [10, 13], hp: 200, spd: 1.85, range: 1.35, dmg: 22, cd: 1.3, armor: .25,
    threat: .85, flee: .12, sight: 10, r: .42, mp: 0, rHp: 2.2, rMp: 0, aggro: 8, roam: 6, xpVal: 200, alt: 1.1 },
  orc: { key: "orc", pt: "Orc", beast: true, lvlM: 13, nv: [11, 15], hp: 175, spd: 2.15, matilha: 1, range: 1.30, dmg: 24, cd: 1.15, armor: .22,
    threat: .90, flee: .16, sight: 12, r: .34, mp: 0, rHp: 2.0, rMp: 0, aggro: 9, roam: 7, xpVal: 240, alt: 1.3 },
  lion: { key: "lion", pt: "Leão", beast: true, lvlM: 15, nv: [13, 17], hp: 240, spd: 2.90, range: 1.25, dmg: 28, cd: 1.05, armor: .20,
    threat: 1.00, flee: .10, sight: 13, r: .40, mp: 0, rHp: 2.4, rMp: 0, aggro: 10, roam: 8, xpVal: 290, alt: 1.05,
    atk: { investida: { cd: 5.0, min: 3.0, max: 7.5, dur: .85 } } },
  troll: { key: "troll", pt: "Troll", beast: true, lvlM: 17, nv: [15, 19], hp: 340, spd: 1.60, matilha: 1, range: 1.5, dmg: 33, cd: 1.5, armor: .28,
    threat: 1.10, flee: .10, sight: 11, r: .46, mp: 0, rHp: 3.4, rMp: 0, aggro: 9, roam: 7, xpVal: 340, alt: 1.55 },
  minotaur: { key: "minotaur", pt: "Minotauro", beast: true, lvlM: 20, nv: [18, 23], hp: 480, spd: 2.30, range: 1.6, dmg: 42, cd: 1.25, armor: .32,
    threat: 1.35, flee: .06, sight: 13, r: .52, mp: 0, rHp: 4.0, rMp: 0, aggro: 11, roam: 8, xpVal: 560, alt: 1.85,
    atk: { baque: { raio: 1.7, frac: .5 } } },
  cyclops: { key: "cyclops", pt: "Ciclope", beast: true, lvlM: 23, nv: [21, 26], hp: 720, spd: 1.45, range: 2.0, dmg: 58, cd: 1.7, armor: .38,
    threat: 1.60, flee: .04, sight: 12, r: .66, mp: 0, rHp: 5.2, rMp: 0, aggro: 11, roam: 8, xpVal: 820, alt: 2.4,
    atk: { baque: { raio: 2.3, frac: .6 } } },
  dragon: { key: "dragon", pt: "Dragão", beast: true, lvlM: 27, nv: [24, 30], hp: 900, spd: 1.95, range: 1.9, dmg: 52, cd: 1.35, armor: .36,
    threat: 1.90, flee: .04, sight: 15, r: .62, mp: 0, rHp: 5.6, rMp: 0, aggro: 13, roam: 9, xpVal: 1150, alt: 2.1,
    atk: { bola: { dmg: 46, cd: 4.2, rng: 9.5, raio: 1.7 }, onda: { dmg: 34, cd: 8.0, rng: 7.0, larg: 1.5, vel: 9 } } },
  demon: { key: "demon", pt: "Demônio", beast: true, lvlM: 32, nv: [28, 36], hp: 1400, spd: 2.05, range: 2.2, dmg: 70, cd: 1.4, armor: .44,
    threat: 2.40, flee: 0, sight: 16, r: .78, mp: 0, rHp: 7.0, rMp: 0, aggro: 14, roam: 9, xpVal: 2000, alt: 2.8,
    atk: { bola: { dmg: 72, cd: 3.4, rng: 11.5, raio: 2.1 }, onda: { dmg: 55, cd: 6.2, rng: 8.5, larg: 2.0, vel: 10 }, baque: { raio: 2.0, frac: .45 } } },
};

export const VOCS: VocKey[] = ["knight", "archer", "mage", "druid"];
export const BEASTS: BeastKey[] = ["hen", "rat", "cow", "wolf", "boar", "spider", "bear", "orc", "lion", "troll", "minotaur", "cyclops", "dragon", "demon"];

/* ---------- magia ---------- */
export type SpellKey = "cura" | "investida" | "meteoro" | "triplo" | "chuva" | "certeiro" | "terremoto" | "trevas" | "nevasca"
  | "bumerangue" | "veneno" | "bolaFogo" | "relampago";
export const CUSTO: Record<SpellKey, number> = {
  cura: 32, investida: 26, meteoro: 55, triplo: 34, chuva: 42, certeiro: 16, terremoto: 24, trevas: 38, nevasca: 45,
  bumerangue: 20, veneno: 22, bolaFogo: 30, relampago: 30,
};
/* Exaustão é de cada magia, com relógio próprio: uma nunca bloqueia a
   outra. Especial 10 s, curas 1 s, demais 2 s, poção 1 s. */
export const EXA: Record<string, number> = {
  investida: 10, triplo: 10, meteoro: 10, nevasca: 10,
  cura: 1, chuva: 1,
  terremoto: 2, trevas: 2, certeiro: 2,
  bumerangue: 2, veneno: 2, bolaFogo: 2, relampago: 2,
  pocao: 1,
};
export interface SpellDef { nome: string; mira: boolean; alc?: number; so?: VocKey; desc: string }

export const WORLD_REBORN = 9;
export const PZ_LUTA = 30, PZ_MORTE = 120, REVIDE = 60;
export const BRANCA_T = PZ_LUTA, BRANCA_INJ_T = PZ_MORTE, VERMELHA_N = 3, HORA_MS = 3600000;
export const MARGEM = 1.2;
export const MET_R = 2.6, MET_DANO = 26, MET_CD = 12, MET_QUEDA = .45, MET_ALCANCE = 8.6;
export const CURA_FRAC = .30;
export const ESQUIVA = .35;
export const CHUVA_R = 3.4, CHUVA_CURA = .45, CHUVA_CD = 9, CHUVA_ALCANCE = 8.6;
export const TERREMOTO = { cd: 13, raio: 2.6 };
export const TREVAS = { cd: 5, dano: 32 };
export const NEVASCA = { cd: 8, raio: 3.4, fator: .5, paral: 4, alcance: 8.6 };
export const PARAL_MULT = .22;
export const FOCO_T = 5, ALERTA_TTL = 6, AMBUSH_MAX = 18;
export const ESPALHA_R = 1.75;
export const STRAFE = .55;
export const POCAO = { hp: 100, mp: 50, pilha: 50, limiar: .34, limiarMp: .22 };
export const VIGOR_MULT = 1.45;
export const INVESTIDA_PRESSA = 3, INVESTIDA_CD = 22;
export const PROVOCA_T = 5;
/* magias de 2 s: lâmina que vai e volta, flecha envenenada e as duas
   explosões pequenas (raio menor que o Meteoro, dano menor que Trevas) */
export const BUMERANGUE = { alcance: 6, fator: 1.1, volta: .55 };
export const VENENO = { fator: .95, dur: 6, tick: 1 };
export const EXPLOSAO = { raio: 1.5, dano: 22, mag: 3.0, queda: .4 };

export const SPELLS: Record<SpellKey, SpellDef> = {
  investida: { nome: "Investida", mira: false, so: "knight", desc: "Carga veloz até o alvo: golpe forte que atordoa." },
  triplo: { nome: "Tiro triplo", mira: false, so: "archer", desc: "Três flechas extras logo atrás do disparo." },
  meteoro: { nome: "Meteoro", mira: true, alc: MET_ALCANCE, so: "mage", desc: "Rocha em chamas cai numa área e nunca erra." },
  trevas: { nome: "Trevas", mira: false, so: "mage", desc: "Esfera negra de alto dano num alvo único." },
  terremoto: { nome: "Terremoto", mira: false, so: "knight", desc: "Fere todos em volta e puxa o ódio das feras." },
  nevasca: { nome: "Nevasca", mira: true, alc: NEVASCA.alcance, so: "druid", desc: "Área de gelo que quase paralisa quem pega." },
  chuva: { nome: "Chuva de cura", mira: true, alc: CHUVA_ALCANCE, so: "druid", desc: "Cura o grupo numa área." },
  cura: { nome: "Cura", mira: false, desc: "Restaura parte da própria vida." },
  certeiro: { nome: "Tiro certo", mira: false, so: "archer", desc: "Um disparo extra, barato, que nunca erra." },
  bumerangue: { nome: "Lâmina bumerangue", mira: false, so: "knight", desc: "Arremessa a arma girando até 6 sqm: fere o alvo e quem estiver no caminho da volta." },
  veneno: { nome: "Flecha envenenada", mira: false, so: "archer", desc: "Flecha com o dano normal que ainda envenena: tira vida a cada segundo por 6 s." },
  bolaFogo: { nome: "Bola de fogo", mira: false, so: "mage", desc: "Explode no alvo e queima quem está em volta (área menor que o Meteoro)." },
  relampago: { nome: "Relâmpago", mira: false, so: "druid", desc: "Um raio cai no alvo e a descarga elétrica atinge quem está perto." },
};
export const SPELL_ORDER: SpellKey[] = ["investida", "triplo", "meteoro", "trevas", "terremoto", "nevasca", "chuva", "bumerangue", "veneno", "bolaFogo", "relampago", "cura", "certeiro"];
export const NUM_SLOTS = 4;
export const ESPECIAL: Record<VocKey, SpellKey> = { knight: "investida", archer: "triplo", mage: "meteoro", druid: "nevasca" };
export const ATALHOS: Record<VocKey, SpellKey[]> = {
  knight: ["investida", "cura", "terremoto", "bumerangue"],
  archer: ["triplo", "cura", "certeiro", "veneno"],
  mage: ["meteoro", "cura", "trevas", "bolaFogo"],
  druid: ["nevasca", "cura", "chuva", "relampago"],
};
export function magiasDe(kind: VocKey): SpellKey[] {
  return SPELL_ORDER.filter((k) => !SPELLS[k].so || SPELLS[k].so === kind);
}

/* ---------- atributos ---------- */
export type AttrKey = "str" | "dex" | "def" | "mag" | "hp" | "mp";
export const ATRIB: [AttrKey, string][] = [["str", "Força"], ["dex", "Destreza"], ["def", "Defesa"], ["mag", "Magia"], ["hp", "Vida"], ["mp", "Mana"]];
export const PONTO = {
  str: { knight: 2.9, archer: 2.3, mage: 1.1, druid: 1.1 },
  def: { knight: .045, archer: .038, mage: .032, druid: .032 },
  hp: { knight: 46, archer: 30, mage: 20, druid: 20 },
  mp: { knight: 5, archer: 9, mage: 16, druid: 16 },
} as const;
export const VIDA_NIVEL: Record<VocKey, number> = { knight: 22, archer: 13, mage: 11, druid: 11 };
export const DEF_MAX = .60, GEAR_DEF_MAX = .30;
export const ACERTO_BASE = .80, ACERTO_DEX = .024, ACERTO_MAX = .97, ACERTO_BICHO = .85;
export const MAG_DANO = 2.6, MAG_CURA = .022;
export const REGEN_PONTO = { hp: .05, mp: .06 };

export interface Plano { n: string; w: Partial<Record<AttrKey, number>> }
export const PLANOS: Record<VocKey, Plano[]> = {
  knight: [
    { n: "força bruta", w: { str: 5, hp: 3, dex: 2 } },
    { n: "muralha", w: { def: 5, hp: 4, str: 2 } },
    { n: "duelista", w: { dex: 5, str: 3, def: 2 } },
    { n: "templário", w: { mag: 4, hp: 3, def: 2, mp: 2 } },
  ],
  archer: [
    { n: "atirador", w: { dex: 6, str: 2, hp: 2 } },
    { n: "caçador", w: { str: 5, dex: 3, hp: 2 } },
    { n: "batedor", w: { hp: 4, def: 3, dex: 3 } },
    { n: "guardião do bosque", w: { mag: 4, mp: 3, dex: 3 } },
  ],
  druid: [
    { n: "curandeiro", w: { mag: 6, mp: 3, hp: 1 } },
    { n: "guardião", w: { mp: 5, mag: 4, hp: 1 } },
    { n: "xamã", w: { hp: 3, def: 3, mag: 2, mp: 2 } },
    { n: "druida de batalha", w: { mag: 4, hp: 3, dex: 3 } },
  ],
  mage: [
    { n: "arcanista", w: { mag: 6, mp: 3, hp: 1 } },
    { n: "conjurador", w: { mp: 5, mag: 4, hp: 1 } },
    { n: "místico", w: { hp: 3, def: 3, mag: 2, mp: 2 } },
    { n: "feiticeiro de batalha", w: { mag: 4, hp: 3, def: 3 } },
  ],
};

/* Postura: o temperamento do momento; muda a cada 12 a 28 s */
export interface Postura { n: string; flee: number; keep: number; cura: number; alvo: "perto" | "ferido" | "fraco" | "ofensor" | "isolado"; solo: number }
export const POSTURAS: Postura[] = [
  { n: "disciplinado", flee: 1.0, keep: 1.00, cura: 1.00, alvo: "perto", solo: 0 },
  { n: "agressivo", flee: .55, keep: 0.75, cura: 0.85, alvo: "perto", solo: 0 },
  { n: "cauteloso", flee: 1.6, keep: 1.30, cura: 1.25, alvo: "perto", solo: 0 },
  { n: "oportunista", flee: 1.0, keep: 1.00, cura: 1.00, alvo: "ferido", solo: 1 },
  { n: "carniceiro", flee: .85, keep: 0.95, cura: 0.95, alvo: "fraco", solo: 1 },
  { n: "vingativo", flee: 1.1, keep: 1.00, cura: 1.00, alvo: "ofensor", solo: 1 },
  { n: "caçador", flee: 1.0, keep: 1.15, cura: 1.05, alvo: "isolado", solo: 1 },
];

/* ---------- estados de tropa ---------- */
export interface EstadoDef { t: string; nome: string }
export const ST = {
  ADVANCE: { t: "avançando", nome: "ADVANCE" },
  ENGAGE: { t: "atacando", nome: "ENGAGE" },
  SURROUND: { t: "cercando", nome: "SURROUND" },
  FLANK: { t: "flanqueando", nome: "FLANK" },
  KITE: { t: "na distância", nome: "KITE" },
  RETREAT: { t: "fugindo", nome: "RETREAT" },
  HEAL: { t: "se curando", nome: "HEAL" },
  GRAZE: { t: "pastando", nome: "GRAZE" },
  HUNT: { t: "caçando", nome: "HUNT" },
  REGROUP: { t: "reagrupando", nome: "REGROUP" },
  METEOR: { t: "conjurando", nome: "METEOR" },
  GUARD: { t: "protegendo", nome: "GUARD" },
  CHARGE: { t: "investindo", nome: "CHARGE" },
  AMBUSH: { t: "à espreita", nome: "AMBUSH" },
} satisfies Record<string, EstadoDef>;
export type Estado = (typeof ST)[keyof typeof ST];

/* ---------- utilidade da IA ---------- */
export const UTIL = {
  aoe: 100, cerco: 88, cura: 84, pocao: 78, recuar: 70, isca: 64, emboscar: 60,
  habilidade: 56, guardar: 52, kite: 48, flanco: 34, cercar: 30, atacar: 26,
  reagrupar: 20, avancar: 14, memoria: 12, vaguear: 4,
};
export const DWELL: Record<string, number> = { RETREAT: 1.1, KITE: .7, FLANK: 1.4, REGROUP: 1.2, AMBUSH: 1.6, GUARD: 1.0 };
export const HISTERESE = 8;
export const AMEACA = { dps: 1.15, fragil: 1.30, perto: 1.10, atirador: .85, curandeiro: 1.05, ofensor: 1.20, foco: .55 };
export const MEM_TTL = 5;

/* ---------- automação do personagem sob comando ---------- */
export type AtqModo = "desligado" | "criaturas" | "justiceiro" | "maldoso" | "todos";
export const ATQ_MODOS: [AtqModo, string][] = [["desligado", "Desligado"], ["criaturas", "Criaturas"],
  ["justiceiro", "Justiceiro"], ["maldoso", "Maldoso"], ["todos", "Todos"]];
export const ATQ_DICA: Record<AtqModo, string> = {
  desligado: "Nenhum alvo é escolhido sozinho: só ataca quem você tocar.",
  criaturas: "Só criaturas. Nenhum personagem vira alvo sem ter atacado você.",
  justiceiro: "Criaturas e personagens com caveira. Caçar quem tem caveira não suja a sua, mas atacar primeiro trava a cidade por 30 s.",
  maldoso: "Só personagens sem caveira: o modo PK. Cada morte dessas é injusta — três em uma hora trazem a caveira vermelha.",
  todos: "Todas as criaturas e todos os personagens fora do seu grupo. Atacar quem está limpo dá caveira.",
};
export const PERFIL_NOME: Record<AtqModo, string> = { desligado: "Desligado", criaturas: "Criaturas", justiceiro: "Justiceiro", maldoso: "Maldoso", todos: "Todos" };
export const ATQ_ICONE: Record<AtqModo, string> = { desligado: "⊘", criaturas: "🐾", justiceiro: "⚖", maldoso: "☠", todos: "⚔" };

export interface AutoCfg {
  cura: { ligado: number; pct: number; pctMana: number; aliados: number; pctAliado: number };
  ataque: { modo: AtqModo; revidar: number; nivelAuto: number; nivelMin: number; nivelMax: number };
  refil: { ligado: number; hp: number; mp: number; vender: number; pocoes: number; comprar: number; banco: number };
  equip: number;
  lider: number;
}
export function autoPadrao(): AutoCfg {
  return {
    cura: { ligado: 0, pct: .5, pctMana: .5, aliados: 1, pctAliado: .6 },
    ataque: { modo: "criaturas", revidar: 1, nivelAuto: 1, nivelMin: 1, nivelMax: 8 },
    refil: { ligado: 1, hp: 50, mp: 50, vender: 1, pocoes: 1, comprar: 1, banco: 1 },
    equip: 1,
    lider: 0,
  };
}

/* ---------- guildas e nomes ---------- */
export interface Paleta { h: number; c: string; lo: string; hi: string }
export const TEAMS: (Paleta & { name: string })[] = [
  { name: "Escarlate", h: 352, c: "#e2394f", lo: "#7a1220", hi: "#ff7285" },
  { name: "Azurita", h: 214, c: "#3f8ce8", lo: "#12335f", hi: "#84baff" },
  { name: "Ocre", h: 38, c: "#e5a331", lo: "#6f4710", hi: "#ffca6d" },
  { name: "Verdete", h: 162, c: "#2fb590", lo: "#0d4738", hi: "#71e2ba" },
  { name: "Fauna", h: 45, c: "#9a8f6a", lo: "#4a442f", hi: "#d8caa0" },
];
export const FAUNA = 4;
export const GUILDA_H = [352, 214, 38, 162];

export const FIRST_NAMES = ["Afonso", "Aldo", "Bento", "Brandão", "Corvo", "Duarte", "Egas", "Fernão", "Garcia", "Gil",
  "Hugo", "Ivo", "Jorge", "Lopo", "Martim", "Nuno", "Osório", "Paio", "Ramiro", "Rui", "Sancho", "Tristão",
  "Vasco", "Álvaro", "Bermudo", "Diogo", "Estêvão", "Godinho", "Henrique", "Leonel", "Mendo", "Ordonho",
  "Rodrigo", "Simão", "Teobaldo", "Urbano", "Vimara", "Zarco", "Inês", "Joana", "Urraca", "Elvira", "Sancha",
  "Mor", "Teresa", "Aldonça", "Beatriz", "Constança", "Leonor", "Mafalda"];

export const VOC_DESC: Record<VocKey, string> = {
  knight: "Linha de frente: espada, escudo e muita vida. Investida, Terremoto, que puxa as feras, e Lâmina bumerangue à distância.",
  archer: "Dano à distância com o arco longo. Tiro triplo, Tiro certo, que nunca erra, e Flecha envenenada.",
  mage: "Poder bruto e frágil: Meteoro e Bola de fogo em área, Trevas em alvo único. Mantenha distância.",
  druid: "Apoio do grupo: Nevasca que prende, Chuva de cura, Relâmpago e magia de gelo.",
};
export const VOC_MATIZ: Record<VocKey, number> = { knight: 352, archer: 120, mage: 226, druid: 162 };
