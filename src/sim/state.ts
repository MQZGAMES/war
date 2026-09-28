import { autoPadrao, type AutoCfg } from "./data";
import type { Bando, Cidade, Party, Pt, Squad, Unit, Zona } from "./types";

export interface Prop { t: "tree" | "rock" | "water" | "obelisco" | "lampiao" | "barraca"; x: number; y: number; s: number; npc?: string }

export interface Projetil {
  x: number; y: number; tx: number; ty: number; d0: number; sp: number; dirx: number; diry: number;
  kind: "arrow" | "fire" | "ice" | "dark" | "bola" | "lamina" | "veneno" | "bolaFogo" | "raio" | "bolaGelo" | "bolaTrevas"; dmg: number; team: number; src: Unit | null; tgt: Unit | null;
  z: number; raio: number; certo: number; h0: number; h1: number; id: number;
  /* lâmina bumerangue: 1 depois de acertar, voltando para quem lançou */
  volta: number; giro: number; ja: number[];
}
export interface Meteoro {
  x: number; y: number; team: number; src: Unit | null; t: number; dur: number; dano: number;
  gelo?: number; cura?: number; alvos?: Unit[]; id: number;
}
export interface Onda {
  x: number; y: number; dx: number; dy: number; and: number; alc: number; larg: number;
  dmg: number; team: number; src: Unit | null; id: number; vel: number; t: number;
}

/* ---------- o mundo ---------- */
export const W = {
  N: 72,
  solid: new Uint8Array(0),
  /* tronco de árvore (1) ou pedra (2): desvia quem passa, mas não trava */
  tronco: new Uint8Array(0),
  blockLOS: new Uint8Array(0),
  tileCol: new Uint8Array(0),
  pzMask: new Uint8Array(0),
  /* bioma por ladrilho (só no Ultimate; vazio nos mapas menores) */
  bioma: new Uint8Array(0),
  /* centro escolhido para a cidade antes de ela ser erguida (Ultimate) */
  centro: null as Pt | null,
  props: [] as Prop[],
  units: [] as Unit[],
  projs: [] as Projetil[],
  meteors: [] as Meteoro[],
  ondas: [] as Onda[],
  squads: [] as Squad[],
  zones: [] as Zona[],
  bandos: [] as Bando[],
  parties: [] as Party[],
  partyId: 1,
  cidade: null as unknown as Cidade,
  simTime: 0,
  uid: 1,
  guerra: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
  worldLivre: true,
  guildasN: 2,
  worldSize: 72,
  worldBeastCap: 220,
  featured: null as Unit | null,
  featT: 0,
  worldTick: 0,
  grupoT: 0,
  convitesPend: [] as Unit[],
  conviteIA: 0,
  /* versão do mapa: sobe a cada mundo novo, o renderizador refaz o cenário */
  mapaVersao: 0,
  semente: 0,
};

/* ---------- a sessão de jogo ---------- */
export const G = {
  running: false,
  paused: false,
  ctrl: null as Unit | null,
  sel: null as Unit | null,
  ctrlDesde: 0,
  AUTO: autoPadrao() as AutoCfg,
  mirandoSlot: -1,
  convidando: false,
  /* direção do manche / teclado já convertida para o chão */
  tvx: 0, tvy: 0, tvn: 0,
  autoCam: true,
};

/* Ganchos que a interface registra: a simulação pede, a interface faz.
   Assim a simulação não conhece o DOM. */
export const hooks = {
  fecharDeck: () => {},
  abrirNpc: (_id: string) => {},
  onAssumir: (_u: Unit) => {},
  onLargar: () => {},
  setCam: (_auto: boolean) => {},
  centrarEm: (_p: Pt) => {},
  /* o equipamento de quem está no comando mudou fora da interface (forja
     do auto refil); o PvP mudou sozinho (revide, toque num personagem) */
  equipMudou: (_u: Unit) => {},
  pvpMudou: () => {},
};

export const idx = (x: number, y: number) => y * W.N + x;
export const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < W.N && y < W.N;
