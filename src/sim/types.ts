import type { AttrKey, Estado, KindDef, KindKey, Paleta, Plano, Postura, SpellKey, AtqModo } from "./data";

export interface Pt { x: number; y: number }

export interface Item { b: string; k: number }
export interface Pocao { b: string; n: number }
export type Coisa = Item | Pocao;
export type SlotKey = "cab" | "amu" | "arm" | "arma" | "esc" | "cal" | "ane" | "bot";
export type Equip = Record<SlotKey, Item | null>;

export interface Npc {
  id: "feiticeiro" | "comerciante" | "banqueiro";
  nome: string; icone: string; placa: string;
  x: number; y: number; fa: number; cor: Paleta; bob: number;
}
export interface Cidade { x: number; y: number; r: number; npcs: Npc[]; nasce: Pt }

export interface Zona {
  x: number; y: number; r: number; tier: number; name: string;
  sp: Record<string, number>; farto: number; pop: number; alvoPop: number;
  grupos: number; repT: number; id: number; errante?: number; bandos?: Bando[]; _nv?: string;
}
export interface Bando { x: number; y: number; kind: KindKey; max: number; pop: number; repT: number; z: Zona }

export interface Percepcao {
  enemyCount: number; allyCount: number; perto: number; pertoAliado: number;
  closest: Unit | null; closestD: number; closestRanged: Unit | null; rangedD: number;
  weakest: Unit | null; weakestHp: number; ferido: Unit | null; feridoFrac: number;
  danger: number; rangedPressure: number; surrounded: boolean; cerco: boolean; saidaA: number;
  best: Unit | null; bestSc: number;
}
export interface Memoria { lastSeen: Unit | null; lastSeenT: number; lastX: number; lastY: number; lastDmgFrom: Unit | null; lastDmgT: number }

export interface WorldMind {
  goal: string; dx: number; dy: number; t: number; pkT: number; alvoPk: Unit | null;
  pk: number; social: number; ousadia: number; zona: Zona | null; ganancia: number;
  cacaT: number; presa: Zona | null; etapa: number; pronto: boolean;
  perfil: AtqModo; perfilT: number; azar: number;
  compraLider?: boolean; reencontro?: number; puxa?: string;
}

export interface Refil { fase: "isolar" | "rota" | "esperar" | "voltar"; i: number; rota: string[]; x: number; y: number; t: number }
export interface Encomenda { slot: number; k: SpellKey; x: number; y: number; ate: number }

export interface Squad {
  team: number; stance: string; stanceT: number; rally: Pt; home: Pt;
  focus: Unit | null; focusT: number; focusHp: number; focusSc: number; espalhar: number;
  alert: { target: Unit | null; x: number; y: number; source: Unit | null; time: number; confidence: number };
  isca: Unit | null; cx: number; cy: number; ex: number; ey: number; tick: number;
  kills: number; dmg: number; mets: number; lost: number; start: number;
}

export interface Party {
  id: number; team: number; sq: Squad; membros: Unit[]; lider: Unit | null;
  modo: string; zona: Zona | null; t: number; zonaT: number; pkAte: number; alvo: Unit | null; poder: number;
  tatica: string; eleicaoT: number; posto: Pt; puxador: Unit | null; min: number; paciencia: number;
}

export interface Unit {
  id: number; team: number; kind: KindKey; K: KindDef; name: string; cor: Paleta;
  swing: number; swMax: number; moving: number; dirx: number; diry: number; reborn: number; fa: number; moveA: number;
  draw: number; drawMax: number; pending: Unit | null; aim: number;
  x: number; y: number; px: number; py: number; hp: number; maxHp: number; bob: number;
  st: Estado; stSince: number;
  path: Pt[] | null; pi: number; repath: number; goal: Pt | null; goalKey: string; gkx: number; gky: number; _g: Pt | null;
  target: Unit | null; cd: number; think: number;
  slot: number; flank: number; charge: number; cvx: number; cvy: number;
  tiros: number; tiroT: number; exAte: Record<string, number>; ordem: Pt | null; encomenda: Encomenda | null; npcAlvo: Npc | null;
  potHp: number; potMp: number; pressa: number; paral: number; alvoManual: Unit | null;
  mp: number; maxMp: number; lvl: number; xp: number; bonus: number; velo: number; regHp: number; regMp: number;
  attr: Record<AttrKey, number>; pts: number; manual: boolean; proporcao: Record<AttrKey, number> | null; magic: number; defesa: number;
  plano: Plano | null; post: Postura; postT: number; driftX: number; driftY: number; acerto: number;
  beast: boolean; home: Pt | null; roam: number; wander: number; prov: Unit | null; isca: number;
  packTgt: Unit | null; packT: number; strafe: number; strafeT: number; odio: Record<number, Unit> | null; taunt: Unit | null; tauntAte: number;
  cdA: number; cdB: number; cdI: number; fogoT: number; wHit: number;
  travX: number; travY: number; travT: number; travas: number; desvio: number; desvioA: number;
  isKnight: boolean; isArcher: boolean;
  ai: { p: Percepcao; mem: Memoria; role: number };
  losId: number; losT: number; losV: boolean;
  mochila: (Coisa | null)[]; cofre: (Coisa | null)[]; eqp: Equip; ouro: number; banco: number;
  skull: "white" | "red" | null; brancaInj: boolean; injustas: number; injustaUlt: number; vermelhaAte: number;
  atkBy: Record<number, number>; contrib: Record<number, { u: Unit; d: number }>; pkJust: boolean; ultimos: [Unit | null, Unit | null];
  amarela: Record<number, boolean> | null; agrediu: Record<number, number> | null;
  pzLuta: number; pzMorte: number; pz: boolean;
  slow: number; hurt: number; kills: number; pkKills: number; dmg: number; lunge: number; dead: boolean;
  tagT: number; flash: number; squash: number; morteT: number; zonaAtual: Zona | null;
  w: WorldMind | null; party: Party | null; rep: Record<number, { v: number; t: number; nome: string }> | null;
  convite: { de: Unit; t: number } | null;
  slots: SpellKey[] | null;
  refil: Refil | null; refilEspera: number; refilAvisoT: number;
  xpMult: number; zona: Zona | null; bando: Bando | null; coleira: number; remover: boolean;
  _imp: number;
  /* visual: último golpe recebido (direção do tranco) e cast em curso */
  hitX: number; hitY: number; castT: number; castK: string;
  /* veneno da flecha: dano por segundo até `venAte` */
  venDps: number; venAte: number; venTick: number; venSrc: Unit | null;
}
