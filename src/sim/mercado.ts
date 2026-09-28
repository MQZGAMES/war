/* ================================================================
   [SYSTEM: MERCADO] vitrine de jogador para jogador, no balcão do
   Comerciante. Quem vende anuncia um item da mochila com preço; quem
   compra paga do saldo; o vendedor recebe no banco, menos 5% de taxa
   (a taxa some da economia). Anúncio vence em 15 min e o item volta
   para o cofre de quem vendeu.
   A IA anuncia o que não usa e tem valor, e compra o que melhora o
   equipamento por menos do que a loja cobraria.
   ================================================================ */
import { avisoDe } from "./fx";
import { cabe, darItem, ehPocao, ganhoDe, livres, nomeItem, pagar, precoItem, reservaIA, saldo, servePara, equiparSeQuiser } from "./items";
import { BASES } from "./itemsData";
import { rr } from "./rng";
import { G, W } from "./state";
import type { Item, Unit } from "./types";

export interface Oferta { id: number; item: Item; preco: number; vendedor: Unit | null; nome: string; ate: number }
export const MERCADO = { ofertas: [] as Oferta[], id: 1 };
export const TAXA_MERCADO = .05, VALIDADE_OFERTA = 900, OFERTAS_POR_VENDEDOR = 4, OFERTAS_MAX = 80;

export const precoSugerido = (it: Item) => Math.max(10, Math.round(precoItem(it) * .75));
export function minhasOfertas(u: Unit) { return MERCADO.ofertas.filter((o) => o.vendedor === u); }

export function anunciar(u: Unit, i: number, preco: number) {
  const it = u.mochila[i];
  if (!it || ehPocao(it) || preco < 1) return false;
  if (minhasOfertas(u).length >= OFERTAS_POR_VENDEDOR || MERCADO.ofertas.length >= OFERTAS_MAX) return false;
  u.mochila[i] = null;
  MERCADO.ofertas.push({ id: MERCADO.id++, item: it as Item, preco: Math.round(preco), vendedor: u, nome: u.name, ate: W.simTime + VALIDADE_OFERTA });
  return true;
}
function devolver(o: Oferta) {
  const v = o.vendedor;
  if (!v || v.remover) return;
  const j = v.cofre.indexOf(null);
  if (j >= 0) v.cofre[j] = o.item;
  else if (cabe(v, o.item)) darItem(v, o.item);
}
export function cancelar(u: Unit, id: number) {
  const k = MERCADO.ofertas.findIndex((o) => o.id === id && o.vendedor === u);
  if (k < 0) return false;
  const o = MERCADO.ofertas[k];
  if (livres(u.mochila) < 1) return false;
  MERCADO.ofertas.splice(k, 1);
  darItem(u, o.item);
  return true;
}
export function comprarOferta(u: Unit, id: number) {
  const k = MERCADO.ofertas.findIndex((o) => o.id === id);
  if (k < 0) return false;
  const o = MERCADO.ofertas[k];
  if (o.vendedor === u || livres(u.mochila) < 1 || !pagar(u, o.preco)) return false;
  MERCADO.ofertas.splice(k, 1);
  darItem(u, o.item);
  if (o.vendedor && !o.vendedor.remover) {
    const liquido = Math.floor(o.preco * (1 - TAXA_MERCADO));
    o.vendedor.banco += liquido;
    avisoDe(o.vendedor, "Mercado: " + nomeItem(o.item) + " vendido a " + u.name + " · +" + liquido.toLocaleString("pt-BR"), "#f2c53d");
  }
  return true;
}
/* passo lento: anúncios vencidos voltam ao dono */
export function mercadoPasso() {
  const L = MERCADO.ofertas;
  for (let i = L.length - 1; i >= 0; i--) {
    const o = L[i];
    if (o.ate > W.simTime && !(o.vendedor && o.vendedor.remover)) continue;
    L.splice(i, 1);
    devolver(o);
    if (o.vendedor === G.ctrl) avisoDe(o.vendedor!, "Anúncio vencido: " + nomeItem(o.item) + " voltou ao cofre", "#8d9aa0");
  }
}

/* ---------- a IA no mercado ---------- */
/* vale anunciar em vez de vender ao Comerciante (que paga só 50%) */
export function valeAnunciar(it: Item) { return (BASES[it.b].raro || 0) >= 1 || it.k >= 4; }
export function iaAnunciar(u: Unit, i: number) {
  const it = u.mochila[i] as Item | null;
  if (!it || !valeAnunciar(it) || minhasOfertas(u).length >= OFERTAS_POR_VENDEDOR) return false;
  return anunciar(u, i, precoSugerido(it) * rr(.85, 1.2));
}
export function iaComprarMercado(u: Unit) {
  const verba = saldo(u) - reservaIA(u);
  if (verba <= 0 || livres(u.mochila) < 1) return 0;
  let melhor: Oferta | null = null, bs = 0;
  for (const o of MERCADO.ofertas) {
    if (o.vendedor === u || o.preco > verba || !servePara(o.item, u.kind) || !BASES[o.item.b].s) continue;
    const g = ganhoDe(u, o.item);
    if (g <= .01) continue;
    /* ganho por moeda, com bônus se estiver abaixo do preço de loja */
    const sc = g / o.preco * (precoItem(o.item) / o.preco);
    if (sc > bs) { bs = sc; melhor = o; }
  }
  if (!melhor || !comprarOferta(u, melhor.id)) return 0;
  equiparSeQuiser(u);
  avisoDe(u, "Comprou no mercado: " + nomeItem(melhor.item), "#e0bd63");
  return 1;
}
