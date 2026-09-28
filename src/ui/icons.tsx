/* Ícones em SVG desenhados à mão: nada de emoji, leitura igual em todo
   aparelho. `Ico` para a interface; `IcoItem` para os itens (cor do
   material no lugar de §), portados da v54. */
import type { JSX } from "preact";

const I: Record<string, string> = {
  menu: '<path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  pausa: '<path d="M8 5v14M16 5v14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
  play: '<path d="M8 5l11 7-11 7z" fill="currentColor"/>',
  camAuto: '<circle cx="12" cy="12" r="7.5" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="12" cy="12" r="2.6" fill="currentColor"/>',
  camLivre: '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
  nuvem: '<path d="M7 18a4.5 4.5 0 01-.6-8.96A6 6 0 0118 8.5a4.75 4.75 0 01-.5 9.5z" fill="currentColor" opacity=".35"/><path d="M12 10v6M9.5 13.5L12 16l2.5-2.5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  fechar: '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  espada: '<path d="M19 3l2 2-10 10-2-2z" fill="currentColor"/><path d="M5 13l6 6-1.5 1.5-6-6z" fill="currentColor" opacity=".8"/><path d="M4.5 17.5l2 2L4 22l-2-2z" fill="currentColor" opacity=".6"/>',
  arco: '<path d="M7 2q13 10 0 20" stroke="currentColor" stroke-width="2.4" fill="none"/><path d="M7 2v20" stroke="currentColor" stroke-width="1"/><path d="M4 12h15m-3-2.5 3 2.5-3 2.5" stroke="currentColor" stroke-width="1.6" fill="none"/>',
  cajado: '<path d="M5 22 16 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="17.5" cy="5.5" r="3.4" fill="currentColor"/>',
  folha: '<path d="M5 19C5 9 11 4 20 4c0 9-5 15-15 15z" fill="currentColor"/><path d="M5 19l9-9" stroke="#0b1210" stroke-width="1.4" opacity=".5"/>',
  coracao: '<path d="M12 21s-8-5.2-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 10c0 5.8-8 11-8 11z" fill="currentColor"/>',
  lapis: '<path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 013 3L8 18.5z" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linejoin="round"/><path d="M13.5 7l3.5 3.5M4 20h5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
  gota: '<path d="M12 2.5c3.6 4.6 6.4 8.3 6.4 11.8a6.4 6.4 0 01-12.8 0C5.6 10.8 8.4 7.1 12 2.5z" fill="currentColor"/>',
  escudoI: '<path d="M12 2l8 3v6c0 6-4 9-8 11-4-2-8-5-8-11V5z" fill="currentColor"/>',
  frasco: '<path d="M9 2h6v4l3.5 4.5V20a2 2 0 01-2 2h-9a2 2 0 01-2-2v-9.5L9 6z" fill="currentColor" opacity=".35"/><path d="M6.5 13h11v7a1.5 1.5 0 01-1.5 1.5H8A1.5 1.5 0 016.5 20z" fill="currentColor"/>',
  mochila: '<path d="M7 7a5 5 0 0110 0v1h2v13H5V8h2z" fill="currentColor"/><path d="M9 12h6v4H9z" fill="#0b1210" opacity=".35"/>',
  atributos: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  magia: '<path d="M12 2l2.4 6.3L21 9l-5 4.6L17.2 21 12 17.6 6.8 21 8 13.6 3 9l6.6-.7z" fill="currentColor"/>',
  cura: '<path d="M12 21s-8-5.2-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 10c0 5.8-8 11-8 11z" fill="currentColor" opacity=".35"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
  alvo: '<circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="12" cy="12" r="3.5" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 1v5M12 18v5M1 12h5M18 12h5" stroke="currentColor" stroke-width="2"/>',
  equipe: '<circle cx="8" cy="8" r="3.4" fill="currentColor"/><circle cx="16.5" cy="9" r="2.8" fill="currentColor" opacity=".75"/><path d="M2 20c0-4 3-6.5 6-6.5s6 2.5 6 6.5z" fill="currentColor"/><path d="M13 20c.2-3 1.7-5 3.8-5S21 17 21 20z" fill="currentColor" opacity=".75"/>',
  ficha: '<path d="M6 2h9l4 4v16H6z" fill="currentColor" opacity=".35"/><path d="M9 10h7M9 14h7M9 18h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  cidade: '<path d="M3 21V11l4-3 4 3v10M11 21V7l5-4 5 4v14M3 21h18" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linejoin="round"/>',
  engrenagem: '<path d="M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  som: '<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 010 7M18.5 6a8.5 8.5 0 010 12" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/>',
  mudo: '<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  tela: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
  salvar: '<path d="M5 3h11l3 3v15H5z" fill="currentColor" opacity=".35"/><path d="M8 3h8v6H8zM8 14h8v7H8z" fill="currentColor"/>',
  carregar: '<path d="M12 16V4M7 9l5-5 5 5M4 19h16" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  baixar: '<path d="M12 3v12M7 10l5 5 5-5M4 19h16" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  mundo: '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" stroke="currentColor" stroke-width="1.6" fill="none"/>',
  olho: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
  ajuda: '<circle cx="12" cy="12" r="9.5" stroke="currentColor" stroke-width="2" fill="none"/><path d="M9.3 9.2a2.8 2.8 0 015.4 1c0 1.9-2.7 2.3-2.7 4.3" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="12" cy="17.6" r="1.2" fill="currentColor"/>',
  voltar: '<path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  dado: '<rect x="3.5" y="3.5" width="17" height="17" rx="3.5" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
  caveira: '<path d="M12 3a8 8 0 00-8 8c0 3 1.6 4.8 3 5.6V20h10v-3.4c1.4-.8 3-2.6 3-5.6a8 8 0 00-8-8z" fill="currentColor"/><circle cx="9" cy="11" r="2" fill="#0b1210"/><circle cx="15" cy="11" r="2" fill="#0b1210"/><path d="M10 20v-2M12 20v-2M14 20v-2" stroke="#0b1210" stroke-width="1.2"/>',
  pata: '<ellipse cx="12" cy="16" rx="4.2" ry="3.6" fill="currentColor"/><circle cx="6" cy="10.5" r="2.1" fill="currentColor"/><circle cx="18" cy="10.5" r="2.1" fill="currentColor"/><circle cx="9.2" cy="6.5" r="2.1" fill="currentColor"/><circle cx="14.8" cy="6.5" r="2.1" fill="currentColor"/>',
  balanca: '<path d="M12 3v17M7 20h10M5 7h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M5 7l-3 6a3 3 0 006 0zM19 7l-3 6a3 3 0 006 0z" fill="currentColor"/>',
  cruzadas: '<path d="M4 4l11 11M20 4L9 15" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M13 17l4 4M11 17l-4 4M16 14l3 3M8 14l-3 3" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  proibido: '<circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="2.2" fill="none"/><path d="M6 6l12 12" stroke="currentColor" stroke-width="2.2"/>',
  paz: '<path d="M12 2.5l7.5 2.8v5.9c0 5.3-3.4 8.6-7.5 10.3-4.1-1.7-7.5-5-7.5-10.3V5.3z" fill="currentColor" opacity=".28"/><path d="M12 2.5l7.5 2.8v5.9c0 5.3-3.4 8.6-7.5 10.3-4.1-1.7-7.5-5-7.5-10.3V5.3z" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linejoin="round"/><path d="M8.5 12l2.4 2.4 4.6-4.8" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  ouro: '<ellipse cx="12" cy="15" rx="7" ry="3" fill="currentColor" opacity=".55"/><ellipse cx="12" cy="11.5" rx="7" ry="3" fill="currentColor" opacity=".8"/><ellipse cx="12" cy="8" rx="7" ry="3" fill="currentColor"/>',
  mais: '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
  menos: '<path d="M5 12h14" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
  trofeu: '<path d="M7 3h10v5a5 5 0 01-10 0zM12 13v4M8 21h8M9 17h6v4H9z" fill="currentColor"/><path d="M7 5H4c0 3 1.5 4.5 3 4.5M17 5h3c0 3-1.5 4.5-3 4.5" stroke="currentColor" stroke-width="1.6" fill="none"/>',
  /* magias */
  investida: '<path d="M3 12h11M3 7h7M3 17h7" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".6"/><path d="M13 5l8 7-8 7z" fill="currentColor"/>',
  terremoto: '<path d="M2 20h20" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M12 20l-2-5 3-3-2-4 2-4" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/><path d="M5 17l2-3M19 17l-2-3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  triplo: '<path d="M3 7h13M3 12h16M3 17h13" stroke="currentColor" stroke-width="1.8"/><path d="M14 4l4 3-4 3M17 9l4 3-4 3M14 14l4 3-4 3" stroke="currentColor" stroke-width="1.8" fill="none"/>',
  certeiro: '<circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.8" fill="none"/><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.8" fill="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/>',
  bumerangue: '<path d="M6 18L15.5 8.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M14 6l4 4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M4.5 9.5A8 8 0 0114.5 3.2" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round" opacity=".75"/><path d="M13 1.8l2 1.6-1.9 1.8" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".75"/><path d="M19.5 14.5A8 8 0 019.5 20.8" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round" opacity=".75"/>',
  veneno: '<path d="M3 21L14 10" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M11.5 7.5l5-1.5-1.5 5z" fill="currentColor"/><path d="M3 21l1-3.5M3 21l3.5-1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M18.5 12.5c1.8 2.4 2.6 3.7 2.6 4.8a2.6 2.6 0 01-5.2 0c0-1.1.8-2.4 2.6-4.8z" fill="#7fe05a"/>',
  bolaFogo: '<circle cx="12" cy="14" r="5.5" fill="currentColor"/><path d="M12 2.5c1.5 2.6 4.8 4 4.8 7.6M12 2.5C10.2 5 7.2 6.4 7.2 10.1M9 5.2c-.4 1.3.1 2.4.9 3.3" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".7"/><circle cx="10.6" cy="12.6" r="1.8" fill="#fff" opacity=".55"/>',
  relampago: '<path d="M13.5 2L5.5 13.2h5.3L9 22l9.5-12.5h-5.6L15.8 2z" fill="currentColor"/>',
  meteoro: '<circle cx="15" cy="15" r="5" fill="currentColor"/><path d="M11.5 11.5L3 3M13 9.5L7 3.5M9.5 13L3.5 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".7"/>',
  trevas: '<circle cx="12" cy="12" r="6.5" fill="currentColor"/><path d="M12 2a10 10 0 010 20" stroke="currentColor" stroke-width="1.6" fill="none" opacity=".6"/><path d="M4 7a10 10 0 000 10" stroke="currentColor" stroke-width="1.6" fill="none" opacity=".4"/>',
  nevasca: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M9.5 3.5L12 6l2.5-2.5M9.5 20.5L12 18l2.5 2.5" stroke="currentColor" stroke-width="1.6" fill="none"/>',
  chuva: '<path d="M7 14a5 5 0 01.3-10A6 6 0 0118.5 7 3.5 3.5 0 0118 14z" fill="currentColor" opacity=".45"/><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 7v5M9.5 9.5h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
};

export function Ico({ n, s = 22, cls, style }: { n: string; s?: number; cls?: string; style?: JSX.CSSProperties }) {
  return <svg class={"ico " + (cls || "")} width={s} height={s} viewBox="0 0 24 24" style={style} aria-hidden="true" dangerouslySetInnerHTML={{ __html: I[n] || I.magia }} />;
}

/* ---------- [SYSTEM: ICONES_ITENS] itens desenhados à mão ----------
   Cada peça tem contorno escuro, luz em cima à esquerda, sombra embaixo
   à direita e o material (§) no meio: lê bem de 44 px a 64 px. Armas
   longas são desenhadas em pé e giradas na diagonal. */
const O = 'stroke="#140d07" stroke-width=".9" stroke-linejoin="round"';
const LUZ = 'fill="#fff" opacity=".24"', SOMBRA = 'fill="#000" opacity=".24"';
const COURO_E = "#5a3a1e", COURO_C = "#9a6a3a", OURO = "#e2b64a", OURO_E = "#9a7422", MAD = "#7a5230", FERRO = "#8e949a";
const gira = (s: string, a = 45) => `<g transform="rotate(${a} 12 12)">${s}</g>`;
const traco = (d: string, cor: string, w: number) => `<path d="${d}" stroke="#140d07" stroke-width="${w + 1.3}" fill="none" stroke-linecap="round"/><path d="${d}" stroke="${cor}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
const gema = (x: number, y: number, r: number) =>
  `<path d="M${x} ${y - r}l${r} ${r}-${r} ${r}-${r}-${r}z" fill="§" ${O}/><path d="M${x} ${y - r}l-${r} ${r}h${r}z" fill="#fff" opacity=".6"/><path d="M${x} ${y + r}l${r}-${r}h-${r}z" fill="#000" opacity=".22"/>`;
const frasco = (liq: string) =>
  `<path d="M9.2 2h5.6v2.2H9.2z" fill="${COURO_C}" ${O}/>` +
  `<path d="M9.8 4.2h4.4v3.2l4.2 4.6c.8.9 1.2 2 1.2 3.2v4.4a2.4 2.4 0 01-2.4 2.4H7.2a2.4 2.4 0 01-2.4-2.4v-4.4c0-1.2.4-2.3 1.2-3.2l4.2-4.6z" fill="#dfe9ee" fill-opacity=".28" ${O}/>` +
  `<path d="M5.5 13.2h13c.5.6.7 1.3.7 2v4.4a2.4 2.4 0 01-2.4 2.4H7.2a2.4 2.4 0 01-2.4-2.4v-4.4c0-.7.2-1.4.7-2z" fill="${liq}"/>` +
  `<path d="M5.5 13.2h13" stroke="#fff" stroke-width=".6" opacity=".55"/>` +
  `<path d="M7.1 14.8v4.8" stroke="#fff" stroke-width="1.1" stroke-linecap="round" opacity=".55"/>` +
  `<circle cx="14.6" cy="17" r=".8" fill="#fff" opacity=".5"/><circle cx="12.6" cy="19.3" r=".5" fill="#fff" opacity=".45"/>`;

const ICS: Record<string, string> = {
  espada: gira(
    `<path d="M12-3.2l2.1 3.6v16.2H9.9V.4z" fill="§" ${O}/><path d="M12-3.2l2.1 3.6v16.2H12z" ${SOMBRA}/>` +
    `<path d="M12 .8v15" stroke="#fff" stroke-width=".7" opacity=".6"/>` +
    `<rect x="6.3" y="16.6" width="11.4" height="2.4" rx="1.1" fill="${OURO}" ${O}/>` +
    `<rect x="10.8" y="19" width="2.4" height="5.8" fill="${COURO_E}" ${O}/><path d="M10.8 20.6l2.4-.9M10.8 22.4l2.4-.9M10.8 24.2l2.4-.9" stroke="${COURO_C}" stroke-width=".7"/>` +
    `<circle cx="12" cy="26.2" r="1.7" fill="${OURO}" ${O}/>`),
  montante: gira(
    `<path d="M12-4.4l2.6 3.8v16.6H9.4V-.6z" fill="§" ${O}/><path d="M12-4.4l2.6 3.8v16.6H12z" ${SOMBRA}/>` +
    `<path d="M12-.2v15.6" stroke="#fff" stroke-width=".8" opacity=".6"/>` +
    `<path d="M4.8 16.2h14.4l-1 2.6H5.8z" fill="${OURO}" ${O}/>` +
    `<rect x="10.9" y="18.8" width="2.2" height="6.6" fill="${COURO_E}" ${O}/><path d="M10.9 20.4l2.2-.8M10.9 22.2l2.2-.8M10.9 24l2.2-.8" stroke="${COURO_C}" stroke-width=".7"/>` +
    `<circle cx="12" cy="26.8" r="1.5" fill="${OURO}" ${O}/>`),
  machado: gira(
    `<rect x="10.9" y="1" width="2.2" height="25" rx="1" fill="${MAD}" ${O}/><path d="M11.4 2.4v22.6" stroke="#fff" stroke-width=".6" opacity=".3"/>` +
    `<path d="M10.9 3.4L7 5.4l3.9 2.1z" fill="§" ${O}/>` +
    `<path d="M13 1.8c5.2-1.6 8.6 1.6 8.6 6.8-2.6-1.2-5.4-1-8.6.6z" fill="§" ${O}/>` +
    `<path d="M13 6.2c3.2-1.4 6-.9 8.6 2.4-2.6-1.2-5.4-1-8.6.6z" ${SOMBRA}/>` +
    `<path d="M21.2 7.8c-.2-3.4-2.4-5.6-6-5.8" stroke="#fff" stroke-width=".9" fill="none" opacity=".65"/>` +
    `<rect x="10.4" y="2" width="3.2" height="6.4" rx=".6" fill="${FERRO}" ${O}/>`, 40),
  martelo: gira(
    `<rect x="10.9" y="7" width="2.2" height="19" rx="1" fill="${MAD}" ${O}/><path d="M11.4 8v17" stroke="#fff" stroke-width=".6" opacity=".3"/>` +
    `<path d="M10.9 21l2.2-.8M10.9 22.8l2.2-.8M10.9 24.6l2.2-.8" stroke="${COURO_C}" stroke-width=".7"/>` +
    `<rect x="5.5" y="2.4" width="13" height="6.2" rx="1.2" fill="§" ${O}/>` +
    `<rect x="6.3" y="3.1" width="11.4" height="1.4" rx=".6" fill="#fff" opacity=".4"/><rect x="5.5" y="6.6" width="13" height="2" rx="1" ${SOMBRA}/>` +
    `<rect x="10.2" y="2.4" width="3.6" height="6.2" fill="${FERRO}" ${O}/><circle cx="12" cy="5.5" r=".8" fill="#140d07"/>`, 40),
  arco:
    traco("M8.5 2.2C19 6 19 18 8.5 21.8", "§", 2.2) +
    `<path d="M9.6 3.2C16.4 6.4 17.4 10 17.2 11.6" stroke="#fff" stroke-width=".7" fill="none" opacity=".5"/>` +
    `<path d="M8.5 2.2v19.6" stroke="#efe3c4" stroke-width=".8"/>` +
    `<rect x="14.6" y="10.3" width="2.8" height="3.4" rx=".8" fill="${COURO_E}" ${O}/>` +
    traco("M3.4 12h15.4", "#d9c9a0", .9) +
    `<path d="M22.4 12l-3.6-2v4z" fill="#cfd6da" ${O}/>` +
    `<path d="M4.4 12L2.6 9.8h2.6L6.8 12l-1.6 2.2H2.6z" fill="#e2394f" ${O}/>`,
  besta:
    `<path d="M10.6 6h2.8l.6 14.6-2 2.4-2-2.4z" fill="${MAD}" ${O}/><path d="M11.1 7v13.4" stroke="#fff" stroke-width=".6" opacity=".3"/>` +
    traco("M2.4 10C6 5.8 18 5.8 21.6 10", "§", 2) +
    `<path d="M2.8 10.2L12 13.4l9.2-3.2" stroke="#efe3c4" stroke-width=".8" fill="none"/>` +
    traco("M12 13.2V3", "#cfd6da", .9) + `<path d="M12 .8l-1.7 2.6h3.4z" fill="#cfd6da" ${O}/>` +
    `<rect x="10.2" y="12" width="3.6" height="2" fill="${FERRO}" ${O}/><path d="M12 16.6l-1.6 2.6" stroke="#140d07" stroke-width="1.2"/>`,
  varinha: gira(
    `<rect x="11.1" y="6" width="1.8" height="18" rx=".9" fill="#6a4526" ${O}/><path d="M11.5 7v16" stroke="#fff" stroke-width=".5" opacity=".35"/>` +
    `<rect x="10.3" y="5.2" width="3.4" height="1.8" rx=".6" fill="${OURO}" ${O}/>` + gema(12, 2.2, 3)) +
    `<path d="M20 1.8l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5z" fill="#fff" opacity=".85"/>`,
  cajado: gira(
    `<rect x="11" y="5.5" width="2" height="21" rx="1" fill="#6a4526" ${O}/><path d="M11.4 6.5v19" stroke="#fff" stroke-width=".5" opacity=".3"/>` +
    `<path d="M11 14l2-.8M11 15.6l2-.8M11 17.2l2-.8" stroke="${COURO_C}" stroke-width=".7"/>` +
    traco("M12 6.2C9 5.6 8.2 3.4 8.8 1.2M12 6.2c3-.6 3.8-2.8 3.2-5", OURO, .9) +
    `<circle cx="12" cy="1.8" r="3.4" fill="§" ${O}/><path d="M14.9 3.6a3.4 3.4 0 01-5.6.6" stroke="#000" stroke-width=".9" fill="none" opacity=".25"/>` +
    `<circle cx="10.8" cy=".7" r="1.2" fill="#fff" opacity=".7"/>`, 40),
  escudo:
    `<path d="M12 1.8l8.4 3v6.4c0 6.2-4.2 9.4-8.4 11.2-4.2-1.8-8.4-5-8.4-11.2V4.8z" fill="#5d6368" ${O}/>` +
    `<path d="M12 3.6l6.8 2.4v5.3c0 5.1-3.4 7.9-6.8 9.5-3.4-1.6-6.8-4.4-6.8-9.5V6z" fill="§"/>` +
    `<path d="M12 3.6L5.2 6v5.3c0 5.1 3.4 7.9 6.8 9.5z" ${LUZ}/><path d="M12 3.6l6.8 2.4v5.3c0 5.1-3.4 7.9-6.8 9.5z" fill="#000" opacity=".14"/>` +
    `<path d="M12 6.8v10M8.2 10.8h7.6" stroke="${OURO}" stroke-width="1.7" stroke-linecap="round"/>` +
    `<circle cx="12" cy="10.8" r="1.4" fill="${OURO}" ${O}/><circle cx="6.4" cy="6.4" r=".6" fill="#140d07"/><circle cx="17.6" cy="6.4" r=".6" fill="#140d07"/>`,
  livro:
    `<path d="M5 3.2h12.5a1.8 1.8 0 011.8 1.8v15.2H6.8A1.8 1.8 0 015 18.4z" fill="§" ${O}/>` +
    `<path d="M6.8 17.2h12.5v3H6.8a1.5 1.5 0 010-3z" fill="#efe3c4" ${O}/><path d="M8 18.3h10.6M8 19.2h10.6" stroke="#b8a88a" stroke-width=".4"/>` +
    `<path d="M5 3.2h2.2v14H5z" fill="#000" opacity=".3"/><path d="M8 4.4h9.4" stroke="#fff" stroke-width=".7" opacity=".35"/>` +
    `<path d="M17 3.2h.5a1.8 1.8 0 011.8 1.8v.8H17zM17 15h2.3v2.2H17z" fill="${OURO}" ${O}/>` +
    `<path d="M12.8 6.2l2.6 3.8-2.6 3.8-2.6-3.8z" fill="#9fdcff" ${O}/><path d="M12.8 6.2L10.2 10h2.6z" fill="#fff" opacity=".6"/>`,
  orbe:
    `<path d="M7.5 21.4h9l-1.4-3.4H8.9z" fill="${OURO_E}" ${O}/><path d="M9 18h6l-.8-1.6H9.8z" fill="${OURO}" ${O}/>` +
    `<circle cx="12" cy="10" r="6.6" fill="§" ${O}/>` +
    `<path d="M16.8 5.4a6.6 6.6 0 01-9.2 9.2 6.6 6.6 0 109.2-9.2z" fill="#000" opacity=".22"/>` +
    `<ellipse cx="9.6" cy="7.4" rx="2.3" ry="1.5" fill="#fff" opacity=".7" transform="rotate(-35 9.6 7.4)"/>` +
    `<path d="M14 9l.4 1 1 .4-1 .4-.4 1-.4-1-1-.4 1-.4z" fill="#fff" opacity=".9"/>`,
  elmo:
    `<path d="M4.6 14.2C4.6 7.8 7.8 4 12 4s7.4 3.8 7.4 10.2v6.2h-4.6v-5.6H9.2v5.6H4.6z" fill="§" ${O}/>` +
    `<path d="M6.4 13.4C6.4 8.8 8.6 5.8 12 5.6v7.8z" ${LUZ}/><path d="M17.6 20.4v-6.2c0-4.2-1.6-7.2-4.2-8.6 3.6.6 6 4.2 6 8.6v6.2z" ${SOMBRA}/>` +
    `<path d="M6.8 12.2h10.4" stroke="#140d07" stroke-width="1.7" stroke-linecap="round"/>` +
    `<rect x="11.2" y="11.6" width="1.6" height="6" rx=".6" fill="§" ${O}/>` +
    `<circle cx="6.5" cy="16.6" r=".7" fill="#140d07"/><circle cx="17.5" cy="16.6" r=".7" fill="#140d07"/>` +
    `<path d="M12 4.2C11.4 1.8 13.4.6 16.4 1.2c-1.8.6-2.8 1.8-3 3.4z" fill="#e2394f" ${O}/>`,
  capuz:
    `<path d="M12 2.2c5 1.6 8.2 6.2 8.2 11.4v7.6h-4.4l-.8-5.8H9l-.8 5.8H3.8v-7.6C3.8 8.4 7 3.8 12 2.2z" fill="§" ${O}/>` +
    `<path d="M12 2.2C7 3.8 3.8 8.4 3.8 13.6v2.2c.8-5.8 3.8-10.2 8.2-13.6z" ${LUZ}/>` +
    `<path d="M20.2 13.6v7.6H18v-7c0-4.6-1.8-8.6-5-11 4 1.6 7.2 5.6 7.2 10.4z" ${SOMBRA}/>` +
    `<path d="M8 15.4c0-3.9 1.7-6.8 4-6.8s4 2.9 4 6.8z" fill="#120c08" ${O}/>` +
    `<circle cx="10.6" cy="13" r=".6" fill="#ffe08a" opacity=".8"/><circle cx="13.4" cy="13" r=".6" fill="#ffe08a" opacity=".8"/>`,
  chapeu:
    `<path d="M12.6 1l5.6 13.6H6.4z" fill="§" ${O}/><path d="M12.6 1c2.4-.4 4.2.6 5 2.6-1.6-.9-3.1-1-4.2 0z" fill="§" ${O}/>` +
    `<path d="M12.6 1L6.4 14.6h3.2z" ${LUZ}/>` +
    `<path d="M2 16.8c6.4-3.2 13.6-3.2 20 0l-2.2 3H4.2z" fill="§" ${O}/><path d="M4.2 19.8h15.6l1.3-1.8c-5.8-1.9-12.4-1.9-18.2 0z" ${SOMBRA}/>` +
    `<path d="M6.7 13.2h11.8l.5 1.8H6.2z" fill="${OURO}" ${O}/>` +
    `<path d="M12.3 5.8l.7 1.5 1.6.2-1.2 1.1.3 1.6-1.4-.8-1.4.8.3-1.6-1.2-1.1 1.6-.2z" fill="#ffe08a"/>`,
  tiara:
    `<path d="M5.4 14.4L6.6 9l2.4 4.2L12 5.2l3 8L17.4 9l1.2 5.4c-4.4-1.4-8.8-1.4-13.2 0z" fill="${OURO}" ${O}/>` +
    `<path d="M3 15.6c5.8-2.4 12.2-2.4 18 0l-.8 3.2c-5.4-2-11-2-16.4 0z" fill="${OURO}" ${O}/>` +
    `<path d="M4.4 15.8c5-1.8 10.2-1.8 15.2 0" stroke="#fff" stroke-width=".6" fill="none" opacity=".6"/>` +
    `<path d="M3.8 18.8c5.4-2 11-2 16.4 0" stroke="${OURO_E}" stroke-width=".8" fill="none"/>` +
    gema(12, 12.4, 2.4) + `<circle cx="6.9" cy="16.2" r=".9" fill="§" ${O}/><circle cx="17.1" cy="16.2" r=".9" fill="§" ${O}/>`,
  couraca:
    `<path d="M8 3.2l2 1.2h4l2-1.2 4.6 2.6-1.2 5.2-2-.6v9.8c-1.8.9-3.6 1.3-5.4 1.3s-3.6-.4-5.4-1.3v-9.8l-2 .6L3.4 5.8z" fill="§" ${O}/>` +
    `<path d="M8 3.2L3.4 5.8l1.2 5.2 2-.6v9.8c1.6.8 3.4 1.2 5.4 1.3V4.4h-2z" ${LUZ}/>` +
    `<path d="M17.4 10.4v9.8c-1.6.8-3.4 1.2-5.4 1.3v-8c2.4 0 4.2-1.2 5.4-3.1z" ${SOMBRA}/>` +
    `<path d="M12 4.6v16.6" stroke="#000" stroke-width=".8" opacity=".35"/>` +
    `<path d="M6.8 12.4c3.4 1.4 7 1.4 10.4 0M6.8 16.2c3.4 1.4 7 1.4 10.4 0" stroke="#140d07" stroke-width=".7" fill="none" opacity=".55"/>` +
    `<path d="M10 4.4c.4 1.8 3.6 1.8 4 0" stroke="#140d07" stroke-width=".8" fill="none"/>` +
    `<circle cx="5.2" cy="7" r=".65" fill="#140d07"/><circle cx="18.8" cy="7" r=".65" fill="#140d07"/>`,
  gibao:
    `<path d="M8.2 3h7.6l4.6 4.6-2.6 2.2V21H5.8V9.8L3.2 7.6z" fill="§" ${O}/>` +
    `<path d="M8.2 3L3.2 7.6l2.6 2.2V21H9V6z" ${LUZ}/><path d="M18.2 9.8V21H15.6V8z" ${SOMBRA}/>` +
    `<path d="M9.4 3.2L12 7.8l2.6-4.6" fill="none" stroke="#140d07" stroke-width=".9"/>` +
    `<path d="M12 7.8V16M10.8 9.4l2.4 1.2M13.2 9.4l-2.4 1.2M10.8 12.2l2.4 1.2M13.2 12.2l-2.4 1.2" stroke="#e8d6a8" stroke-width=".6"/>` +
    `<rect x="5.8" y="16.4" width="12.4" height="1.9" fill="${COURO_E}" ${O}/><rect x="11" y="16.1" width="2" height="2.5" rx=".3" fill="${OURO}" ${O}/>` +
    `<path d="M6.6 10.2v5.4M17.4 10.2v5.4" stroke="#000" stroke-width=".5" stroke-dasharray="1 .8" opacity=".45"/>`,
  manto:
    `<path d="M9 2.6h6l1.8 3.4L20 21.4c-2.6.8-5.2 1.1-8 1.1s-5.4-.3-8-1.1L7.2 6z" fill="§" ${O}/>` +
    `<path d="M9 2.6L7.2 6 4 21.4c2.2.6 4.2.9 6.4 1L10.6 6z" ${LUZ}/><path d="M16.8 6L20 21.4c-1.6.5-3.2.8-4.8.9L14.4 7z" ${SOMBRA}/>` +
    `<path d="M9.2 2.8c-.6 1.8-.3 3.3.8 4.4h4c1.1-1.1 1.4-2.6.8-4.4" fill="#000" opacity=".32"/>` +
    `<path d="M12 7.4v15" stroke="${OURO}" stroke-width="1.4"/><path d="M4 21.4c2.6.8 5.2 1.1 8 1.1s5.4-.3 8-1.1" stroke="${OURO}" stroke-width="1" fill="none"/>` +
    `<path d="M8.6 9.6L6.9 20.6M15.4 9.6l1.7 11" stroke="#000" stroke-width=".7" opacity=".28"/>` +
    `<circle cx="12" cy="6.8" r="1.3" fill="${OURO}" ${O}/>`,
  grevas:
    `<path d="M5.6 2.8h12.8v5l-1.4 12.8h-3.4l-1-10.2h-1.2l-1 10.2H6.9L5.6 7.8z" fill="§" ${O}/>` +
    `<path d="M6.2 5.4l1.2 15.2H9L8.4 5.4z" fill="#fff" opacity=".28"/><path d="M17.8 5.4l-1.4 15.2h-1.6l1.2-15.2z" ${SOMBRA}/>` +
    `<ellipse cx="8.7" cy="11.8" rx="1.9" ry="1.5" fill="§" ${O}/><ellipse cx="15.3" cy="11.8" rx="1.9" ry="1.5" fill="§" ${O}/>` +
    `<rect x="5.6" y="2.8" width="12.8" height="2.3" fill="${FERRO}" ${O}/><circle cx="12" cy="3.95" r=".7" fill="${OURO}"/>` +
    `<path d="M6.9 20.6h3.4v1.4H6.2zM13.7 20.6h3.4l.7 1.4h-4.1z" fill="${FERRO}" ${O}/>`,
  calca:
    `<path d="M6 2.8h12l1.2 18.6h-4.6l-2.6-11.4-2.6 11.4H4.8z" fill="§" ${O}/>` +
    `<path d="M6 5h2.6L7.1 21.4H4.8z" ${LUZ}/><path d="M18 5h-2.4l1.2 16.4h2.4z" ${SOMBRA}/>` +
    `<path d="M8.4 5.4L7 21M15.6 5.4l1.4 15.6M12 10l-.4-4.6" stroke="#000" stroke-width=".5" opacity=".35"/>` +
    `<rect x="6" y="2.8" width="12" height="2.3" fill="${COURO_E}" ${O}/><rect x="11" y="2.6" width="2" height="2.7" rx=".4" fill="${OURO}" ${O}/>`,
  bota:
    `<path d="M5.2 2.6h7v10.6l6.2 2.2c1.8.6 2.8 2 2.8 3.6v1.6H5.2z" fill="§" ${O}/>` +
    `<path d="M6.4 4.8h1.9v15.8H6.4z" fill="#fff" opacity=".22"/><path d="M13 16.2l5.2 1.8c1.4.5 2.2 1.3 2.6 2.6H13z" ${SOMBRA}/>` +
    `<path d="M5.2 20.6h16v1.9H5.2z" fill="#2a1d12" ${O}/>` +
    `<rect x="4.6" y="2.2" width="8.2" height="2.7" rx=".8" fill="${COURO_E}" ${O}/>` +
    `<path d="M12.2 7.2H9.8M12.2 9.6H9.8M12.2 12H9.8" stroke="#e8d6a8" stroke-width=".7"/>`,
  amuleto:
    traco("M5 2.4c1.2 5.6 3.6 8.4 7 8.4s5.8-2.8 7-8.4", "#d9dde0", .7) +
    `<circle cx="12" cy="11.8" r="1.2" fill="none" stroke="${OURO}" stroke-width="1"/>` +
    `<path d="M12 12.6l5.4 4.6L12 22.6l-5.4-5.4z" fill="${OURO}" ${O}/>` + gema(12, 17.4, 3.2),
  anel:
    `<ellipse cx="12" cy="15.4" rx="6.6" ry="5.8" fill="none" stroke="#140d07" stroke-width="3.8"/>` +
    `<ellipse cx="12" cy="15.4" rx="6.6" ry="5.8" fill="none" stroke="${OURO}" stroke-width="2.4"/>` +
    `<path d="M6.3 13.2a6.6 5.8 0 015.7-3.6" stroke="#fff" stroke-width=".8" fill="none" opacity=".6"/>` +
    `<path d="M9.2 9h5.6l-1 1.8h-3.6z" fill="${OURO_E}" ${O}/>` + gema(12, 5.6, 3.6),
  pvida: frasco("#d0473f"),
  pmana: frasco("#4f9bd8"),
  mochila:
    `<path d="M7 7.4a5 5 0 0110 0V9h1.6a1.4 1.4 0 011.4 1.4V21H4V10.4A1.4 1.4 0 015.4 9H7z" fill="#8a6a3a" ${O}/>` +
    `<path d="M9 7.4a3 3 0 016 0" stroke="#140d07" stroke-width="1" fill="none"/>` +
    `<path d="M5.4 9h13.2a1.4 1.4 0 011.4 1.4v3.4c-2.4 1.2-5 1.8-8 1.8s-5.6-.6-8-1.8v-3.4A1.4 1.4 0 015.4 9z" fill="#6f532c" ${O}/>` +
    `<rect x="10.8" y="13.4" width="2.4" height="2.6" rx=".4" fill="${OURO}" ${O}/><rect x="7.4" y="16.8" width="9.2" height="3.2" rx=".8" fill="#000" opacity=".2"/>`,
};
export function IcoItem({ ic, cor, vazio }: { ic: string; cor: string; vazio?: boolean }) {
  return <svg class={"icoItem" + (vazio ? " vz" : "")} viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: (ICS[ic] || ICS.anel).replace(/§/g, cor || "#cfd6da") }} />;
}
