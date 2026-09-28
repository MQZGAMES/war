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

/* ---------- itens (v54) ---------- */
const ICS: Record<string, string> = {
  espada: '<path d="M20 2l2 2-12 12-2-2z" fill="§"/><path d="M5 13l6 6-1.5 1.5-6-6z" fill="#b08a3a"/><path d="M4.5 17.5l2 2L4 22l-2-2z" fill="#6a4a24"/>',
  machado: '<path d="M6 22L17 6" stroke="#6a4a24" stroke-width="2.2" stroke-linecap="round"/><path d="M14 3c4 0 7 3 7 7l-4 1-4-5z" fill="§"/>',
  martelo: '<path d="M5 22L15 9" stroke="#6a4a24" stroke-width="2.4" stroke-linecap="round"/><path d="M11 4l6-2 5 7-6 2z" fill="§"/>',
  besta: '<path d="M4 20L20 4" stroke="#6a4a24" stroke-width="2.4"/><path d="M3 9q6-6 12 0" stroke="§" stroke-width="2.4" fill="none" transform="rotate(45 12 12)"/><path d="M12 12l6 6" stroke="#cfd6da" stroke-width="1.4"/>',
  orbe: '<circle cx="12" cy="11" r="7" fill="§"/><circle cx="9.5" cy="8.5" r="2.2" fill="#fff" opacity=".6"/><path d="M7 20h10l-2-3H9z" fill="#8a6a3a"/>',
  tiara: '<path d="M3 16l3-8 3 5 3-8 3 8 3-5 3 8z" fill="#e6c25a"/><circle cx="12" cy="12" r="2.2" fill="§"/>',
  montante: '<path d="M21 1l2 2L9.5 16.5l-2-2z" fill="§"/><path d="M4 12l8 8-1.6 1.6-8-8z" fill="#b08a3a"/><path d="M3.5 17l3.5 3.5L4 23.5 .5 20z" fill="#6a4a24"/>',
  arco: '<path d="M7 2q13 10 0 20" stroke="§" stroke-width="2.6" fill="none"/><path d="M7 2v20" stroke="#e8dcbe" stroke-width="1"/><path d="M4 12h15m-3-2.5 3 2.5-3 2.5" stroke="#cfd6da" stroke-width="1.4" fill="none"/>',
  varinha: '<path d="M4 20 16 8l1.5 1.5L5.5 21.5z" fill="#7a5a34"/><circle cx="18" cy="6" r="3.3" fill="§"/>',
  cajado: '<path d="M5 22 17 6l1.6 1.2L6.6 23z" fill="#7a5a34"/><circle cx="18.5" cy="5" r="3.8" fill="§"/><circle cx="17.4" cy="3.9" r="1.2" fill="#fff" opacity=".7"/>',
  escudo: '<path d="M12 2l8 3v6c0 6-4 9-8 11-4-2-8-5-8-11V5z" fill="§"/><path d="M12 5l5 2v4c0 4-2.5 6-5 7.5z" fill="#000" opacity=".22"/>',
  livro: '<path d="M4 3h13a2 2 0 012 2v16H6a2 2 0 01-2-2z" fill="§"/><path d="M6 19h13" stroke="#e8dcbe" stroke-width="1.6"/><path d="M11.5 7l2 3-2 3-2-3z" fill="#fff" opacity=".75"/>',
  elmo: '<path d="M4 14a8 8 0 0116 0v6h-5v-5H9v5H4z" fill="§"/><path d="M11 3h2v5h-2z" fill="#e2394f"/>',
  capuz: '<path d="M12 2c5 2 8 7 8 12v7h-4l-1-6H9l-1 6H4v-7c0-5 3-10 8-12z" fill="§"/><path d="M9 11h6v4H9z" fill="#1a1a1a"/>',
  chapeu: '<path d="M12 1l5 13H7z" fill="§"/><path d="M2 16c6-3 14-3 20 0l-2 3H4z" fill="§"/><circle cx="12.6" cy="8" r="1.3" fill="#ffe08a"/>',
  couraca: '<path d="M6 3l3 2h6l3-2 4 4-3 3v11H5V10L2 7z" fill="§"/><path d="M9 9h6v10H9z" fill="#000" opacity=".18"/>',
  gibao: '<path d="M7 3h10l4 5-3 2v11H6V10L3 8z" fill="§"/><path d="M12 5v16" stroke="#000" stroke-width="1" opacity=".3"/>',
  manto: '<path d="M9 2h6l2 4 3 16H4L7 6z" fill="§"/><path d="M12 6v16" stroke="#fff" stroke-width="1" opacity=".25"/>',
  grevas: '<path d="M6 3h12v6l-2 12h-3l-1-9-1 9H8L6 9z" fill="§"/>',
  calca: '<path d="M6 3h12l1 18h-4l-3-11-3 11H5z" fill="§"/>',
  bota: '<path d="M4 4h7v10h7a3 3 0 013 3v3H4z" fill="§"/><path d="M4 18h17" stroke="#000" stroke-width="1.4" opacity=".3"/>',
  amuleto: '<path d="M5 3q7 10 14 0" stroke="#c9cfd3" stroke-width="1.4" fill="none"/><path d="M12 11l4 5-4 6-4-6z" fill="§"/>',
  anel: '<circle cx="12" cy="15" r="6" stroke="#e0bd63" stroke-width="2.6" fill="none"/><path d="M12 3l3 4-3 4-3-4z" fill="§"/>',
  pvida: '<path d="M9 2h6v4l3 4v10a2 2 0 01-2 2H8a2 2 0 01-2-2V10l3-4z" fill="#e8dcc8" opacity=".35"/><path d="M7 12h10v8a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 017 20z" fill="#d0473f"/>',
  pmana: '<path d="M9 2h6v4l3 4v10a2 2 0 01-2 2H8a2 2 0 01-2-2V10l3-4z" fill="#e8dcc8" opacity=".35"/><path d="M7 12h10v8a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 017 20z" fill="#4f9bd8"/>',
  mochila: '<path d="M7 6a5 5 0 0110 0v2h2v13H5V8h2z" fill="#8a6a3a"/><path d="M9 11h6v4H9z" fill="#5a4020"/>',
};
export function IcoItem({ ic, cor, vazio }: { ic: string; cor: string; vazio?: boolean }) {
  return <svg class={"icoItem" + (vazio ? " vz" : "")} viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: (ICS[ic] || ICS.anel).replace(/§/g, cor) }} />;
}
