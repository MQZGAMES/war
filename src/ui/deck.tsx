/* ================================================================
   [SYSTEM: HUD_DECK] Folha de painéis, mobile first: cabeçalho fixo,
   corpo que rola, as sete abas no pé (zona do polegar), alça que
   expande e arrasta para fechar. Deitado, vira coluna à direita.
   O balcão de NPC usa a mesma folha, sem abas e com o saldo no topo.
   ================================================================ */
import { useRef, useState } from "preact/hooks";
import { G, W } from "../sim/state";
import { ATQ_DICA, ATQ_MODOS, ATRIB, CUSTO, PONTO, SPELLS, TEAMS, magiasDe, type AttrKey, type SpellKey, type VocKey } from "../sim/data";
import { RARO_COR, RARO_NOME, BASES, BASES_LOJA, COFRE_N, LOJA_MAX_K, MOCHILA_N, precoPocao, SLOT_NOME, STAT_LONGO, type StatKey } from "../sim/itemsData";
import { recontar, comprarItem, comprarPocoes, corItem, depositarItem, depositarOuro, desequipar, descreveStats, ehPocao, equipar, equiparSeQuiser, espacoEm, espacoPocao, itemStat, livres, nomeItem, precoItem, precoVenda, sacarItem, sacarOuro, saldo, servePara, venderItem, vocNome, ITEM_TMP } from "../sim/items";
import { beberPocao } from "../sim/spells";
import { dmgFis, dmgMag, recalcular, somaGear, zerarBuild } from "../sim/stats";
import { janelaNivel } from "../sim/player";
import { deixarEquipe, EQUIPE_MAX, expulsar, TATICAS } from "../sim/world";
import { chanceForja, custoForja, forjar, riscoForja } from "../sim/items";
import { anunciar, cancelar, comprarOferta, MERCADO, minhasOfertas, OFERTAS_POR_VENDEDOR, precoSugerido, TAXA_MERCADO } from "../sim/mercado";
import { SLOTS as SLOTS_EQ, NIVEL_MAX as NIVEL_MAX_F } from "../sim/itemsData";
import { teamAlive } from "../sim/map";
import { avisoDe, fx } from "../sim/fx";
import { largar } from "../sim/session";
import { aplicarFicha, baixarJson, fichaDe, salvarPref } from "../sim/save";
import { CORES_FICHA } from "../sim/unit";
import { clamp } from "../sim/rng";
import type { Coisa, Item, Pocao, SlotKey, Unit } from "../sim/types";
import { tick, painel, painelUlt, npcAberto, cheio, abrirDeck, fecharDeck, atualizar, retrato, irPara, type Painel } from "./store";
import { retratoDe } from "../render/portrait";
import { Ico, IcoItem } from "./icons";
import { Casas, Grade, type Sel } from "./itens";
import { DoisToques, Lin, Passo, Seg, SimNao, clique, fmt, recusa } from "./comp";

const ABAS: [Painel, string, string, string][] = [
  ["equip", "Equip", "mochila", "Equipamento"], ["atrib", "Atrib.", "atributos", "Atributos"],
  ["magias", "Magias", "magia", "Magias"], ["cura", "Cura", "cura", "Cura e refil"],
  ["ataque", "Ataque", "espada", "Auto ataque"], ["equipe", "Equipe", "equipe", "Equipe"], ["ficha", "Ficha", "ficha", "Ficha"],
];
const TIT: Record<string, string> = Object.fromEntries(ABAS.map((a) => [a[0], a[3]]));
const NPC_TIT: Record<string, string> = { feiticeiro: "⚗ Feiticeiro", comerciante: "⚖ Comerciante", banqueiro: "◍ Banqueiro", ferreiro: "⚒ Ferreiro" };

let itemSel: Sel = null;
const rolagem: Record<string, number> = {};

export function Deck() {
  void tick.value;
  const u = G.ctrl!;
  const p = painel.value;
  const npc = p === "npc";
  const corpo = useRef<HTMLDivElement>(null);
  const arr = useRef<{ y0: number; dy: number; alca: boolean } | null>(null);
  const [dy, setDy] = useState(0);
  const ini = (alca: boolean) => (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    arr.current = { y0: e.clientY, dy: 0, alca };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const mov = (e: PointerEvent) => { const a = arr.current; if (!a) return; a.dy = e.clientY - a.y0; setDy(Math.max(0, a.dy)); };
  const fim = () => {
    const a = arr.current; if (!a) return;
    arr.current = null; setDy(0);
    if (a.dy < -40) cheio.value = true;
    else if (a.dy > 70) { if (cheio.value) cheio.value = false; else fecharDeck(); }
    else if (a.alca && Math.abs(a.dy) < 6) cheio.value = !cheio.value;
  };
  const trocar = (k: Painel) => {
    clique();
    if (corpo.current && p && p !== "npc") rolagem[p] = corpo.current.scrollTop;
    itemSel = null;
    abrirDeck(k);
    requestAnimationFrame(() => { if (corpo.current) corpo.current.scrollTop = rolagem[k] || 0; });
  };
  const saldoTxt = npc || p === "equip" ? "Saldo " + fmt(saldo(u)) : "";
  return (
    <div class={"deck" + (cheio.value ? " cheio" : "")} style={dy ? { transform: `translateY(${dy}px)` } : undefined}>
      <div class="pega" onPointerDown={ini(true)} onPointerMove={mov} onPointerUp={fim} onPointerCancel={fim} />
      <div class="dcab" onPointerDown={ini(false)} onPointerMove={mov} onPointerUp={fim} onPointerCancel={fim}>
        <b>{npc ? NPC_TIT[npcAberto.value || ""] : TIT[p]}</b>
        {saldoTxt && <span class="saldo">{saldoTxt}<br /><small style={{ color: "var(--dim)", fontWeight: 500 }}>mochila {fmt(u.ouro)} · banco {fmt(u.banco)}</small></span>}
        <button class="xis" aria-label="Fechar" onClick={() => { clique(); fecharDeck(); }}><Ico n="fechar" s={18} /></button>
      </div>
      <div class="dcorpo" ref={corpo}>
        {p === "equip" && <PEquip u={u} />}
        {p === "atrib" && <PAtrib u={u} />}
        {p === "magias" && <PMagias u={u} />}
        {p === "cura" && <PCura u={u} />}
        {p === "ataque" && <PAtaque u={u} />}
        {p === "equipe" && <PEquipe u={u} />}
        {p === "ficha" && <PFicha u={u} />}
        {npc && <PNpc u={u} id={npcAberto.value || ""} />}
      </div>
      {!npc && (
        <nav class="abas" aria-label="Painéis">
          {ABAS.map(([k, rot, ico, tit]) => {
            const bdg = k === "atrib" ? u.pts : k === "equipe" && u.party && u.party.membros.length > 1 ? u.party.membros.length : 0;
            return (
              <button key={k} aria-pressed={p === k} aria-label={tit} onClick={() => trocar(k)}>
                <Ico n={ico} s={21} /><span>{rot}</span>{bdg ? <em class="bdg">{bdg}</em> : null}
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}

/* ---------- detalhe do item selecionado ---------- */
function itemDe(u: Unit, s: Sel): Coisa | null {
  if (!s) return null;
  return s.onde === "eq" ? u.eqp[s.i as SlotKey] : s.onde === "mo" ? u.mochila[s.i as number] : u.cofre[s.i as number];
}
function comparaStats(it: Item, at: Item | null) {
  const S = BASES[it.b].st, A = at ? BASES[at.b].st : null;
  const partes: preact.JSX.Element[] = [];
  for (const k in STAT_LONGO) {
    const kk = k as StatKey;
    const v = S[kk] ? itemStat(it, kk) : 0, va = A && A[kk] ? itemStat(at!, kk) : 0;
    if (!v && !va) continue;
    const d = v - va, un = kk === "spd" ? "%" : "";
    partes.push(<span key={k}>{partes.length ? " · " : ""}{v ? "+" + v : "0"}{un} {STAT_LONGO[kk]}{A && d ? <span class={d > 0 ? "up" : "dn"}> {d > 0 ? "↑" : "↓"}{Math.abs(d)}</span> : null}</span>);
  }
  return <>{partes}{BASES[it.b].duas ? " · duas mãos" : ""}</>;
}
let descArm: Coisa | null = null, descAte = 0;
let qtdSel = 1, qtdAberta = false;
function qtdMax(u: Unit) {
  const it = itemDe(u, itemSel);
  if (!it || !ehPocao(it)) return 1;
  return Math.max(1, Math.min(it.n, itemSel!.onde === "co" ? espacoEm(u.mochila, it.b) : espacoEm(u.cofre, it.b)));
}
function Detalhe({ u, modo }: { u: Unit; modo: "equip" | "comerciante" | "banqueiro" }) {
  void tick.value;
  const it = itemDe(u, itemSel);
  if (!it) return <p class="dica">{modo === "banqueiro" ? "Toque num item da mochila para guardar, ou do cofre para retirar." : modo === "comerciante" ? "Toque num item da mochila para vender." : "Toque num item para ver os detalhes."}</p>;
  const B = BASES[it.b], serve = ehPocao(it) || servePara(it, u.kind), onde = itemSel!.onde;
  const at = !B.pocao && onde !== "eq" && serve ? u.eqp[B.s!] : null;
  const agir = (a: string, e: Event) => {
    const b = e.currentTarget as HTMLElement;
    const s = itemSel!;
    let ok = true;
    if (a === "descartar") {
      if (descArm !== it || performance.now() > descAte) { descArm = it; descAte = performance.now() + 3000; clique(); atualizar(); return; }
      descArm = null;
      u.mochila[s.i as number] = null;
      recontar(u);
      avisoDe(u, "Descartou " + nomeItem(it), "#8d9aa0"); itemSel = null; atualizar(); return;
    }
    if (a === "qtdabre") { qtdAberta = !qtdAberta; qtdSel = Math.min(10, qtdMax(u)); clique(); atualizar(); return; }
    if (a === "equipar") ok = equipar(u, s.i as number);
    else if (a === "desequipar") ok = desequipar(u, s.i as SlotKey);
    else if (a === "usar") ok = beberPocao(u, B.pocao!);
    else if (a === "vender") { const v = venderItem(u, s.i as number); avisoDe(u, "Vendeu " + nomeItem(it) + " · +" + fmt(v), "#f2c53d"); fx({ t: "ui", s: "venda" }); }
    else if (a === "guardar") ok = depositarItem(u, s.i as number) > 0;
    else if (a === "guardarn") ok = depositarItem(u, s.i as number, qtdSel) > 0;
    else if (a === "retirar" || a === "retirarn") { ok = sacarItem(u, s.i as number, a === "retirarn" ? qtdSel : 0) > 0; if (ok) equiparSeQuiser(u); }
    if (!ok) { recusa(b); if (a === "desequipar" || a === "retirar" || a === "retirarn") avisoDe(u, "Mochila cheia", "#e0b93a"); atualizar(); return; }
    if (a === "equipar" || a === "desequipar") fx({ t: "ui", s: "equip" }); else clique();
    if (a === "equipar" || a === "desequipar") retrato.value = retratoDe(u);
    if (!(a === "usar" || ((a === "guardarn" || a === "retirarn") && itemDe(u, s)))) { itemSel = null; qtdAberta = false; }
    atualizar();
  };
  const bt = (a: string, rot: string, sub: string, off?: boolean, cls?: string) =>
    <button class={"cb" + (cls ? " " + cls : "")} disabled={off} onClick={(e) => agir(a, e)}><b>{rot}</b>{sub && <small>{sub}</small>}</button>;
  const pilha = ehPocao(it);
  let botoes: preact.JSX.Element | null = null, extra: preact.JSX.Element | null = null;
  if (modo === "equip") {
    if (onde === "eq") botoes = bt("desequipar", "Desequipar", "para a mochila");
    else {
      const armado = descArm === it && performance.now() < descAte;
      botoes = <>{B.pocao ? bt("usar", "Beber", "1 gole") : bt("equipar", "Equipar", serve ? "" : "outra vocação", !serve)}
        {bt("descartar", armado ? "Toque de novo" : "Descartar", armado ? "some de vez" : "pede 2 toques", false, armado ? "arm" : "")}</>;
    }
  } else if (modo === "comerciante") {
    if (onde === "mo") botoes = bt("vender", "Vender", fmt(precoVenda(it)) + " de ouro");
  } else {
    if (onde === "mo") {
      const cabe = pilha ? espacoEm(u.cofre, it.b) > 0 : livres(u.cofre) > 0;
      botoes = <>{bt("guardar", pilha ? "Guardar tudo" : "Guardar", pilha ? (it as Pocao).n + " unidades" : "no cofre", !cabe)}
        {pilha && bt("qtdabre", "Guardar unidades", "escolher quantas", !cabe, qtdAberta ? "on" : "")}</>;
      if (pilha && qtdAberta && cabe) extra = <Qtd u={u} acao={(e) => agir("guardarn", e)} rot="Guardar" />;
    } else if (onde === "co") {
      const cabe = pilha ? espacoPocao(u, it.b) > 0 : livres(u.mochila) > 0;
      botoes = <>{bt("retirar", pilha ? "Retirar tudo" : "Retirar", pilha ? (it as Pocao).n + " unidades" : "para a mochila", !cabe)}
        {pilha && bt("qtdabre", "Retirar unidades", "escolher quantas", !cabe, qtdAberta ? "on" : "")}</>;
      if (pilha && qtdAberta && cabe) extra = <Qtd u={u} acao={(e) => agir("retirarn", e)} rot="Retirar" />;
    }
  }
  return (
    <div class="idet">
      <div class="inm" style={{ color: B.raro ? RARO_COR[B.raro] : corItem(it) }}>{nomeItem(it)}{B.raro ? <small style={{ marginLeft: "6px", fontWeight: 700 }}>{RARO_NOME[B.raro]}</small> : null}</div>
      <div class="ist">{B.pocao ? descreveStats(it) : <>{SLOT_NOME[B.s!]} · {comparaStats(it as Item, at)}</>}</div>
      {!B.pocao && <div class={"ivoc" + (serve ? "" : " nao")}>{serve ? "Serve para " : "Não serve: só "}{vocNome(it)}</div>}
      {!B.pocao && onde !== "eq" && serve && <div class="ist">No corpo: {at ? <b>{nomeItem(at)}</b> : "nada"}</div>}
      <div class="ist">Vale <b>{fmt(precoItem(it))}</b> · o Comerciante paga <b>{fmt(precoVenda(it))}</b></div>
      {botoes && <div class="crow">{botoes}</div>}
      {extra}
    </div>
  );
}
function Qtd({ u, acao, rot }: { u: Unit; acao: (e: Event) => void; rot: string }) {
  void tick.value;
  const mx = qtdMax(u);
  const muda = (d: number) => { qtdSel = clamp(qtdSel + d, 1, mx); clique(); atualizar(); };
  return (
    <div class="qtd">
      <button onClick={() => muda(-10)}>−10</button><button onClick={() => muda(-1)}>−</button>
      <b>{qtdSel}</b>
      <button onClick={() => muda(1)}>+</button><button onClick={() => muda(10)}>+10</button>
      <button class="cb" style={{ flex: "1 1 100%" }} onClick={acao}><b>{rot} {qtdSel}</b><small>de {mx} possíveis</small></button>
    </div>
  );
}
const tocarSel = (onde: "eq" | "mo" | "co", i: number | SlotKey, vazio: boolean) => {
  clique();
  itemSel = (vazio || (itemSel && itemSel.onde === onde && itemSel.i === i)) ? null : { onde, i };
  descArm = null; qtdAberta = false;
  atualizar();
};

/* ---------- abas ---------- */
function PEquip({ u }: { u: Unit }) {
  void tick.value;
  return (
    <>
      <Lin rot="Auto equipar" sub="veste sozinho o melhor item que chegar à mochila">
        <SimNao valor={G.AUTO.equip} aoEscolher={(v) => { G.AUTO.equip = v; if (v) equiparSeQuiser(u); salvarPref(); atualizar(); }} />
      </Lin>
      <Grade u={u} sel={itemSel} aoTocar={(s) => tocarSel("eq", s, !u.eqp[s])} />
      <Detalhe u={u} modo="equip" />
      <div class="mot"><span>Mochila</span><b>{MOCHILA_N - livres(u.mochila)}/{MOCHILA_N}</b></div>
      <Casas arr={u.mochila} onde="mo" sel={itemSel} aoTocar={(i) => tocarSel("mo", i, !u.mochila[i])} />
    </>
  );
}
function PAtrib({ u }: { u: Unit }) {
  void tick.value;
  const g = somaGear(u), a = u.attr;
  const pv = (tab: Record<string, number>) => tab[u.kind] || 0;
  const desc = (k: AttrKey) => {
    const b = a[k], gi = g[k] || 0;
    if (k === "hp") return <>build +{Math.round(b * pv(PONTO.hp))} · itens +{gi} · <b>máx {Math.round(u.maxHp)}</b> · regen +{u.regHp.toFixed(2)}/s</>;
    if (k === "mp") return <>build +{Math.round(b * pv(PONTO.mp))} · itens +{gi} · <b>máx {Math.round(u.maxMp)}</b> · regen +{u.regMp.toFixed(2)}/s</>;
    const tot = <>build {b}{gi ? " + itens " + gi : ""} = <b>{b + gi}</b></>;
    if (k === "str") return <>{tot} · dano {Math.round(dmgFis(u))}</>;
    if (k === "dex") return <>{tot} · acerto {Math.round(u.acerto * 100)}%</>;
    if (k === "def") return <>{tot} · corta {Math.round(u.defesa * 100)}% do dano</>;
    return <>{tot} · dano mágico {Math.round(dmgMag(u))}</>;
  };
  return (
    <>
      <Lin rot={<>Nível {u.lvl} · {u.manual ? "build manual" : u.plano ? u.plano.n : ""}</>}><b style={{ color: u.pts ? "var(--gold-hi)" : "var(--dim)" }}>{u.pts} livre{u.pts === 1 ? "" : "s"}</b></Lin>
      {ATRIB.map(([k, rot]) => (
        <Lin key={k} rot={rot} sub={desc(k)}>
          <Passo valor={a[k]} podeMenos={a[k] > 0} podeMais={u.pts > 0}
            menos={() => { if (u.attr[k] > 0) { u.attr[k]--; u.pts++; u.manual = true; recalcular(u); atualizar(); } }}
            mais={() => { if (u.pts > 0) { u.attr[k]++; u.pts--; u.manual = true; recalcular(u, true); atualizar(); } }} />
        </Lin>
      ))}
      <p class="dica">Com build manual, ao largar o comando o personagem segue distribuindo na mesma proporção.</p>
      <button class="btn" style={{ width: "100%" }} onClick={() => { clique(); zerarBuild(u); u.manual = true; atualizar(); }}>Zerar e redistribuir</button>
    </>
  );
}
const ICO_M: Record<SpellKey, string> = { investida: "investida", triplo: "triplo", meteoro: "meteoro", trevas: "trevas", terremoto: "terremoto", nevasca: "nevasca", chuva: "chuva", cura: "cura", certeiro: "certeiro", bumerangue: "bumerangue", veneno: "veneno", bolaFogo: "bolaFogo", relampago: "relampago" };
function PMagias({ u }: { u: Unit }) {
  void tick.value;
  const lista = magiasDe(u.kind as VocKey);
  if (!u.slots) return null;
  return (
    <>
      <p class="dica" style={{ marginTop: 0 }}>Escolha o que vai em cada uma das quatro casas ao lado do Atacar. Magia de área pede um toque no chão; com alvo marcado, já mira nele.</p>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} class="lin col">
          <span class="rot">Casa {i + 1}</span>
          <div class="magiaOp">
            {lista.map((k) => (
              <button key={k} class={u.slots![i] === k ? "on" : ""} onClick={() => { clique(); u.slots![i] = k; atualizar(); }}>
                <Ico n={ICO_M[k]} s={18} />{SPELLS[k].nome}<small style={{ color: "var(--mute)", fontWeight: 600 }}>{CUSTO[k]}</small>
              </button>
            ))}
          </div>
        </div>
      ))}
      <div class="secao">O que cada uma faz</div>
      {lista.map((k) => <Lin key={k} rot={<><b>{SPELLS[k].nome}</b></>} sub={SPELLS[k].desc + " · " + CUSTO[k] + " de mana"} />)}
    </>
  );
}
function PCura({ u }: { u: Unit }) {
  void tick.value;
  const C = G.AUTO.cura, R = G.AUTO.refil;
  const s = (f: () => void) => { f(); u.think = 0; salvarPref(); atualizar(); };
  const pct = (v: number) => Math.round(v * 100) + "%";
  return (
    <>
      <div class="secao">Cura automática</div>
      <Lin rot="Curar a si mesmo"><Seg itens={[[0, "Desligado"], [1, "Ligado"]]} valor={C.ligado} aoEscolher={(v) => s(() => { C.ligado = v; })} /></Lin>
      <Lin rot="Quando a vida cair de"><Passo valor={pct(C.pct)} menos={() => s(() => { C.pct = clamp(C.pct - .1, .1, .9); })} mais={() => s(() => { C.pct = clamp(C.pct + .1, .1, .9); })} /></Lin>
      {u.maxMp > 0 && <Lin rot="Quando a mana cair de"><Passo valor={pct(C.pctMana)} menos={() => s(() => { C.pctMana = clamp(C.pctMana - .1, .1, .9); })} mais={() => s(() => { C.pctMana = clamp(C.pctMana + .1, .1, .9); })} /></Lin>}
      {u.kind === "druid" && <>
        <Lin rot="Curar aliados por perto"><SimNao valor={C.aliados} aoEscolher={(v) => s(() => { C.aliados = v; })} /></Lin>
        <Lin rot="Aliado com vida abaixo de"><Passo valor={pct(C.pctAliado)} menos={() => s(() => { C.pctAliado = clamp(C.pctAliado - .1, .1, .9); })} mais={() => s(() => { C.pctAliado = clamp(C.pctAliado + .1, .1, .9); })} /></Lin>
      </>}
      <div class="secao">Auto refil</div>
      <Lin rot="Repor poções sozinho"><Seg itens={[[0, "Desligado"], [1, "Ligado"]]} valor={R.ligado} aoEscolher={(v) => s(() => { R.ligado = v; if (!v) u.refil = null; })} /></Lin>
      <Lin rot="Mínimo de poções de vida"><Passo valor={R.hp} menos={() => s(() => { R.hp = clamp(R.hp - 5, 0, 200); })} mais={() => s(() => { R.hp = clamp(R.hp + 5, 0, 200); })} /></Lin>
      <Lin rot="Mínimo de poções de mana"><Passo valor={R.mp} menos={() => s(() => { R.mp = clamp(R.mp - 5, 0, 200); })} mais={() => s(() => { R.mp = clamp(R.mp + 5, 0, 200); })} /></Lin>
      <p class="dica">Na cidade, nesta ordem:</p>
      <Lin rot="Vender loot ao Comerciante"><SimNao valor={R.vender} aoEscolher={(v) => s(() => { R.vender = v; })} /></Lin>
      <Lin rot="Comprar poções no Feiticeiro"><SimNao valor={R.pocoes} aoEscolher={(v) => s(() => { R.pocoes = v; })} /></Lin>
      <Lin rot="Comprar equipamento melhor"><SimNao valor={R.comprar} aoEscolher={(v) => s(() => { R.comprar = v; })} /></Lin>
      <Lin rot="Guardar ouro e itens no banco"><SimNao valor={R.banco} aoEscolher={(v) => s(() => { R.banco = v; })} /></Lin>
      <details class="ajuda"><summary><Ico n="ajuda" s={18} />Como funciona o auto refil</summary>
        <p>Poção zerada, ou mochila cheia com algo para vender ou guardar, manda o personagem à cidade. Lá ele vende o loot que não vale guardar, compra poções até o mínimo, veste equipamento melhor só com o ouro que sobrar além das poções, e deposita ouro e itens de reserva no banco. Liderando, o grupo vai junto. Com trava de PZ, se afasta da briga e espera a trava acabar. Atacar, andar ou mexer o manche pausa a viagem; ela volta sozinha quando o alvo cair e você parar.</p>
      </details>
    </>
  );
}
function PAtaque({ u }: { u: Unit }) {
  void tick.value;
  const A = G.AUTO.ataque;
  const s = (f: () => void) => { f(); u.think = 0; salvarPref(); atualizar(); };
  const J = janelaNivel(u);
  return (
    <>
      <Lin col rot="O que atacar sozinho"><Seg cls="sm wrap" itens={ATQ_MODOS} valor={A.modo} aoEscolher={(v) => s(() => { A.modo = v; })} /></Lin>
      <p class="dica">{ATQ_DICA[A.modo]}</p>
      <Lin rot="Revidar quem me atacar" sub="troca o alvo na hora para quem te feriu"><SimNao valor={A.revidar} aoEscolher={(v) => s(() => { A.revidar = v; })} /></Lin>
      <div class="secao">Nível das criaturas</div>
      <Lin rot="Escolha da presa"><Seg itens={[[1, "Automático"], [0, "Faixa"]]} valor={A.nivelAuto} aoEscolher={(v) => s(() => { A.nivelAuto = v; })} /></Lin>
      {!A.nivelAuto && <>
        <Lin rot="Nível mínimo"><Passo valor={A.nivelMin} menos={() => s(() => { A.nivelMin = clamp(A.nivelMin - 1, 1, 60); })} mais={() => s(() => { A.nivelMin = clamp(A.nivelMin + 1, 1, 60); if (A.nivelMax < A.nivelMin) A.nivelMax = A.nivelMin; })} /></Lin>
        <Lin rot="Nível máximo"><Passo valor={A.nivelMax} menos={() => s(() => { A.nivelMax = clamp(A.nivelMax - 1, A.nivelMin, 60); })} mais={() => s(() => { A.nivelMax = clamp(A.nivelMax + 1, 1, 60); })} /></Lin>
      </>}
      <p class="dica">{A.nivelAuto ? "Pela sua força de agora: prefere criaturas de Lv " + J.lo + " a Lv " + J.hi + ", a mais forte primeiro, e sobe junto com você." : "Só criaturas de Lv " + A.nivelMin + " a Lv " + A.nivelMax + " viram alvo sozinhas."}</p>
    </>
  );
}
function PEquipe({ u }: { u: Unit }) {
  void tick.value;
  const p = u.party, n = W.worldLivre ? (p ? p.membros.length : 1) : teamAlive(u.team).length;
  return (
    <>
      <Lin rot="Liderar o grupo" sub={G.AUTO.lider ? (W.worldLivre ? "Seu grupo segue você" : "Sua guilda segue você") + ": cavaleiros à frente, o resto atrás, todos no seu alvo." : "Cada um por conta própria, com a inteligência de sempre."}>
        <SimNao valor={G.AUTO.lider} aoEscolher={(v) => { G.AUTO.lider = v; for (const o of W.units) if (!o.beast) { o.think = 0; o.goalKey = ""; } atualizar(); }} />
      </Lin>
      <Lin rot="Equipe"><b>{W.worldLivre ? (n > 1 ? n + " na equipe" + (p && p.lider === u ? " · você lidera" : "") + (p ? " · " + TATICAS[p.tatica || "cacadores"].n : "") : "você, sozinho") : TEAMS[u.team].name + " · " + n + " em campo"}</b></Lin>
      {W.worldLivre ? <>
        <div class="crow">
          <button class={"cb" + (G.convidando ? " on" : "")} disabled={u.dead || n >= EQUIPE_MAX} onClick={() => { clique(); G.convidando = !G.convidando; if (G.convidando) fecharDeck(); atualizar(); }}>
            <b>Convidar</b><small>{G.convidando ? "toque em quem chamar" : "equipe de " + n}</small></button>
          <button class="cb" disabled={u.dead || n < 2} onClick={() => { clique(); if (deixarEquipe(u)) atualizar(); }}>
            <b>Sair da equipe</b><small>{n > 1 ? (p && p.lider === u ? "você lidera" : "membro") : "sem equipe"}</small></button>
        </div>
        <Lin rot="Auto agrupar" sub={G.AUTO.agrupar ? "Chama sozinho quem está livre por perto até completar a equipe." : "Só entra quem você convidar."}>
          <SimNao valor={G.AUTO.agrupar} aoEscolher={(v) => { G.AUTO.agrupar = v; salvarPref(); atualizar(); }} />
        </Lin>
        <p class="dica">Quem entra na sua equipe deixa de ser alvo, ganha o círculo verde e recebe cura do druida. Equipe de no máximo {EQUIPE_MAX}. {p && p.lider === u ? "Como líder, ninguém sai sem você querer." : "Num grupo liderado por outro, os membros entram e saem quando quiserem."}</p>
        {p && p.membros.length > 1 && <>
          <div class="secao">Membros</div>
          {p.membros.map((m) => (
            <Lin key={m.id} rot={<b style={{ color: m.cor.hi }}>{m.name}</b>} sub={m.K.pt + " · Lv " + m.lvl + (m.dead ? " · caído" : "") + (p.lider === m ? " · líder" : "")}>
              <span style={{ fontWeight: 800, color: m.hp / m.maxHp < .35 ? "var(--bad)" : "var(--ok)" }}>{Math.round(m.hp / m.maxHp * 100)}%</span>
              {p.lider === u && m !== u && <DoisToques cls="btn" acao={() => { expulsar(u, m); atualizar(); }} filhos="Remover" armado="Confirmar" />}
            </Lin>
          ))}
        </>}
      </> : <p class="dica">Com guildas a equipe é a própria guilda. O que resta escolher é se ela segue você.</p>}
    </>
  );
}
function PFicha({ u }: { u: Unit }) {
  void tick.value;
  const [msg, setMsg] = useState("");
  const arq = useRef<HTMLInputElement>(null);
  const renomear = (v: string) => { v = v.slice(0, 18); if (!v.trim() || v === u.name) return; u.name = v; atualizar(); };
  return (
    <>
      <Lin rot="Nome do personagem">
        <input class="fin" maxLength={18} autocomplete="off" spellcheck={false} value={u.name}
          onChange={(e) => renomear((e.target as HTMLInputElement).value)} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
      </Lin>
      <Lin col rot="Cor do personagem" sub={W.worldLivre ? "Toque para trocar a cor das roupas." : "Com guildas a cor vem do tom da guilda."}>
        <div class="cores">
          {CORES_FICHA.map((p, i) => <button key={i} class={p.h === u.cor.h ? "on" : ""} style={{ background: p.h >= 400 ? `linear-gradient(135deg, ${p.c} 52%, ${p.h === 400 ? p.lo : p.hi} 52%)` : p.c }} disabled={!W.worldLivre} aria-label={p.h === 400 ? "Branca com preto" : p.h === 401 ? "Preta com branco" : "Cor " + (i + 1)}
            onClick={() => { clique(); u.cor = CORES_FICHA[i]; retrato.value = retratoDe(u); atualizar(); }} />)}
        </div>
      </Lin>
      <div class="crow">
        <button class="cb" onClick={() => { clique(); const f = fichaDe(u); baixarJson(f, "ficha-" + f.nome.replace(/[^\w\-]+/g, "_").toLowerCase() + ".json"); setMsg("Ficha de " + f.nome + " salva: nível " + f.lvl + "."); }}>
          <Ico n="salvar" s={20} /><b>Salvar ficha</b><small>baixa um .json</small></button>
        <DoisToques cls="cb" acao={() => { if (arq.current) { arq.current.value = ""; arq.current.click(); } }}
          filhos={<><Ico n="carregar" s={20} /><b>Carregar ficha</b><small>de um arquivo</small></>} armado={<><b>Toque de novo</b><small>substitui o personagem</small></>} />
      </div>
      <input ref={arq} type="file" accept=".json,application/json" hidden onChange={() => {
        const f = arq.current && arq.current.files && arq.current.files[0];
        if (!f) return;
        const fr = new FileReader();
        fr.onload = () => {
          try { aplicarFicha(u, JSON.parse(String(fr.result))); retrato.value = retratoDe(u); setMsg("Ficha carregada: " + u.name + ", " + u.K.pt.toLowerCase() + " nível " + u.lvl + "."); atualizar(); }
          catch (e) { setMsg(e instanceof SyntaxError ? "Esse arquivo não é uma ficha legível." : "Não deu para carregar: " + (e as Error).message + "."); }
        };
        fr.readAsText(f);
      }} />
      <p class="dica">{msg || "Salvar baixa a ficha deste personagem, com caveira e mortes injustas. Carregar substitui quem você comanda pelo que estiver no arquivo — fichas da versão 2D também abrem."}</p>
      <div class="secao">Comando</div>
      <div class="crow">
        <DoisToques cls="cb sair" acao={() => { largar(); irPara("jogo"); }} filhos={<><b>Largar o comando</b><small>dois toques · volta a assistir</small></>} armado={<><b>Toque de novo</b><small>para largar o comando</small></>} />
      </div>
    </>
  );
}

/* ---------- [SYSTEM: NPC_LOJA] os três balcões ---------- */
const CAT_LOJA: [SlotKey, string][] = [["arma", "Arma"], ["esc", "Escudo"], ["cab", "Capacete"], ["arm", "Armadura"], ["cal", "Calça"], ["bot", "Bota"], ["amu", "Amuleto"], ["ane", "Anel"]];
let catLoja: SlotKey = "arma", baseLoja = "", subNpc = "comprar";
function basesDaCat(u: Unit, s: SlotKey) { return BASES_LOJA.filter((b) => BASES[b].s === s && (!BASES[b].voc || BASES[b].voc!.indexOf(u.kind as VocKey) >= 0)); }
function PNpc({ u, id }: { u: Unit; id: string }) {
  void tick.value;
  if (id === "feiticeiro") return (
    <>
      <p class="dica" style={{ marginTop: 0 }}>Poções empilham 50 por casa: o limite é o espaço livre na mochila.</p>
      <LinhaPocao u={u} tipo="hp" />
      {u.maxMp > 0 && <LinhaPocao u={u} tipo="mp" />}
    </>
  );
  if (id === "comerciante") {
    const cab = <Seg itens={[["comprar", "Comprar"], ["vender", "Vender"], ["mercado", "Mercado"]]} valor={subNpc} aoEscolher={(v) => { subNpc = v; itemSel = null; atualizar(); }} />;
    if (subNpc === "mercado") return <>{cab}<PMercado u={u} /></>;
    if (subNpc === "vender") {
      let tot = 0; for (const it of u.mochila) if (it && !ehPocao(it)) tot += precoVenda(it);
      return (
        <>
          {cab}
          <p class="dica">Compro qualquer item pela metade do preço.</p>
          <Detalhe u={u} modo="comerciante" />
          <Casas arr={u.mochila} onde="mo" sel={itemSel} aoTocar={(i) => tocarSel("mo", i, !u.mochila[i])} />
          <button class="btn" style={{ width: "100%", marginTop: "10px" }} disabled={!tot} onClick={() => {
            let v = 0; for (let i = 0; i < u.mochila.length; i++) { const x = u.mochila[i]; if (x && !ehPocao(x)) v += venderItem(u, i); }
            avisoDe(u, "+" + fmt(v) + " de ouro", "#f2c53d"); fx({ t: "ui", s: "venda" }); itemSel = null; atualizar();
          }}>Vender todos os itens (menos poções) · {fmt(tot)}</button>
        </>
      );
    }
    const L = basesDaCat(u, catLoja);
    if (L.indexOf(baseLoja) < 0) baseLoja = L[0] || "";
    const at = u.eqp[catLoja];
    return (
      <>
        {cab}
        <div class="cat" style={{ marginTop: "10px" }}>{CAT_LOJA.map(([s, r]) => <button key={s} aria-pressed={catLoja === s} onClick={() => { clique(); catLoja = s; baseLoja = ""; atualizar(); }}>{r}</button>)}</div>
        {!L.length ? <p class="dica">Nada deste tipo serve para {u.K.pt.toLowerCase()}.</p> : <>
          {L.length > 1 && <Seg itens={L.map((b) => [b, BASES[b].n] as [string, string])} valor={baseLoja} aoEscolher={(v) => { baseLoja = v; atualizar(); }} />}
          {Array.from({ length: LOJA_MAX_K }, (_, i) => i + 1).map((k) => {
            ITEM_TMP.b = baseLoja; ITEM_TMP.k = k;
            const it: Item = { b: baseLoja, k };
            const p = precoItem(it), ok = saldo(u) >= p && livres(u.mochila) > 0;
            return (
              <div key={k} class="nrow">
                <span class="nic"><IcoItem ic={BASES[baseLoja].ic} cor={corItem(it)} /></span>
                <span class="ntx"><b>{nomeItem(it)}</b><small>{comparaStats(it, at)}</small></span>
                <button class="cb ouro" disabled={!ok} onClick={(e) => {
                  if (!comprarItem(u, baseLoja, k)) { recusa(e.currentTarget as HTMLElement); return; }
                  avisoDe(u, "Comprou " + nomeItem(it), "#e0bd63"); fx({ t: "ui", s: "compra" }); equiparSeQuiser(u); retrato.value = retratoDe(u); atualizar();
                }}><b>{fmt(p)}</b><small>comprar</small></button>
              </div>
            );
          })}
        </>}
      </>
    );
  }
  if (id === "ferreiro") return <PForja u={u} />;
  /* banqueiro */
  const ouro = (f: () => void) => { f(); fx({ t: "ui", s: "compra" }); atualizar(); };
  return (
    <>
      <Lin rot="No banco"><b style={{ color: "#f2c53d" }}>{fmt(u.banco)}</b></Lin>
      <Lin rot="Na mochila"><b style={{ color: "#f2c53d" }}>{fmt(u.ouro)}</b></Lin>
      <div class="crow">
        <button class="cb ouro" disabled={!u.ouro} onClick={() => ouro(() => depositarOuro(u, u.ouro))}><b>Depositar</b><small>tudo</small></button>
        <button class="cb ouro" disabled={!u.banco} onClick={() => ouro(() => sacarOuro(u, 100))}><b>Sacar</b><small>100</small></button>
        <button class="cb ouro" disabled={!u.banco} onClick={() => ouro(() => sacarOuro(u, 1000))}><b>Sacar</b><small>1.000</small></button>
        <button class="cb ouro" disabled={!u.banco} onClick={() => ouro(() => sacarOuro(u, u.banco))}><b>Sacar</b><small>tudo</small></button>
      </div>
      <p class="dica">O ouro do banco não ocupa casa e não se perde ao morrer. Toda compra debita direto dele.</p>
      <Detalhe u={u} modo="banqueiro" />
      <div class="mot"><span>Mochila</span><b>{MOCHILA_N - livres(u.mochila)}/{MOCHILA_N}</b></div>
      <Casas arr={u.mochila} onde="mo" sel={itemSel} aoTocar={(i) => tocarSel("mo", i, !u.mochila[i])} />
      <div class="mot"><span>Cofre</span><b>{COFRE_N - livres(u.cofre)}/{COFRE_N}</b></div>
      <Casas arr={u.cofre} onde="co" sel={itemSel} aoTocar={(i) => tocarSel("co", i, !u.cofre[i])} />
    </>
  );
}
/* ---------- [SYSTEM: FORJA] balcão do Ferreiro ---------- */
function PForja({ u }: { u: Unit }) {
  void tick.value;
  const linhas: { it: Item; onde: string }[] = [];
  for (const s of SLOTS_EQ) { const it = u.eqp[s]; if (it) linhas.push({ it, onde: "vestido" }); }
  for (const it of u.mochila) if (it && !ehPocao(it)) linhas.push({ it: it as Item, onde: "mochila" });
  return (
    <>
      <p class="dica" style={{ marginTop: 0 }}>Cada nível custa mais e dá menos certo. Falhar custa o ouro; do +6 em diante, metade das falhas derruba um nível. A loja só vende até +{LOJA_MAX_K}.</p>
      {!linhas.length && <p class="dica">Nada para forjar: vista ou carregue um equipamento.</p>}
      {linhas.map(({ it, onde }, i) => {
        const c = custoForja(it), ch = chanceForja(it), max = it.k >= NIVEL_MAX_F;
        return (
          <div key={i} class="nrow">
            <span class="nic"><IcoItem ic={BASES[it.b].ic} cor={corItem(it)} /></span>
            <span class="ntx"><b style={BASES[it.b].raro ? { color: RARO_COR[BASES[it.b].raro!] } : undefined}>{nomeItem(it)}</b>
              <small>{max ? "no máximo" : onde + " · " + Math.round(ch * 100) + "% para +" + (it.k + 1) + (riscoForja(it) ? " · pode cair" : "")}</small></span>
            <button class="cb ouro" disabled={max || saldo(u) < c} onClick={(e) => {
              const r = forjar(u, it);
              if (!r) { recusa(e.currentTarget as HTMLElement); return; }
              avisoDe(u, r.ok ? "Forjou " + nomeItem(it) + "!" : "A forja falhou" + (r.caiu ? ": caiu para +" + it.k : ""), r.ok ? "#e0bd63" : "#e0685a");
              fx({ t: "ui", s: r.ok ? "equip" : "nega" }); retrato.value = retratoDe(u); atualizar();
            }}><b>{max ? "—" : fmt(c)}</b><small>forjar</small></button>
          </div>
        );
      })}
    </>
  );
}
/* ---------- [SYSTEM: MERCADO] vitrine entre jogadores ---------- */
let precoMerc = 0;
function PMercado({ u }: { u: Unit }) {
  void tick.value;
  const minhas = minhasOfertas(u), outras = MERCADO.ofertas.filter((o) => o.vendedor !== u);
  const sel = itemSel && itemSel.onde === "mo" ? u.mochila[itemSel.i as number] : null;
  const vende = sel && !ehPocao(sel) ? sel as Item : null;
  if (vende && !precoMerc) precoMerc = precoSugerido(vende);
  return (
    <>
      <div class="secao">À venda</div>
      {!outras.length && <p class="dica">Ninguém anunciou nada ainda.</p>}
      {outras.slice(0, 40).map((o) => {
        const at = BASES[o.item.b].s ? u.eqp[BASES[o.item.b].s!] : null;
        const serve = servePara(o.item, u.kind);
        return (
          <div key={o.id} class="nrow">
            <span class="nic"><IcoItem ic={BASES[o.item.b].ic} cor={corItem(o.item)} /></span>
            <span class="ntx"><b style={BASES[o.item.b].raro ? { color: RARO_COR[BASES[o.item.b].raro!] } : undefined}>{nomeItem(o.item)}</b>
              <small>{o.nome} · {serve ? comparaStats(o.item, at) : "outra vocação"}</small></span>
            <button class="cb ouro" disabled={saldo(u) < o.preco || livres(u.mochila) < 1} onClick={(e) => {
              if (!comprarOferta(u, o.id)) { recusa(e.currentTarget as HTMLElement); return; }
              avisoDe(u, "Comprou " + nomeItem(o.item) + " de " + o.nome, "#e0bd63"); fx({ t: "ui", s: "compra" }); equiparSeQuiser(u); atualizar();
            }}><b>{fmt(o.preco)}</b><small>comprar</small></button>
          </div>
        );
      })}
      <div class="secao">Seus anúncios · {minhas.length}/{OFERTAS_POR_VENDEDOR}</div>
      {minhas.map((o) => (
        <div key={o.id} class="nrow">
          <span class="nic"><IcoItem ic={BASES[o.item.b].ic} cor={corItem(o.item)} /></span>
          <span class="ntx"><b>{nomeItem(o.item)}</b><small>{fmt(o.preco)} · vence em {Math.ceil((o.ate - W.simTime) / 60)} min</small></span>
          <button class="cb" onClick={(e) => { if (!cancelar(u, o.id)) { recusa(e.currentTarget as HTMLElement); return; } clique(); atualizar(); }}><b>Retirar</b><small>volta à mochila</small></button>
        </div>
      ))}
      <p class="dica">Toque num item da mochila para anunciar. O valor vai para o seu banco quando alguém comprar, menos {Math.round(TAXA_MERCADO * 100)}% de taxa.</p>
      {vende && <div class="idet">
        <div class="inm">{nomeItem(vende)}</div>
        <div class="ist">Loja paga {fmt(precoVenda(vende))} · sugerido {fmt(precoSugerido(vende))}</div>
        <Lin rot="Preço"><Passo valor={fmt(precoMerc)} larg={70} menos={() => { precoMerc = Math.max(1, Math.round(precoMerc * .95)); atualizar(); }} mais={() => { precoMerc = Math.round(precoMerc * 1.05) + 1; atualizar(); }} /></Lin>
        <button class="cb ouro" style={{ width: "100%" }} disabled={minhas.length >= OFERTAS_POR_VENDEDOR} onClick={(e) => {
          if (!anunciar(u, itemSel!.i as number, precoMerc)) { recusa(e.currentTarget as HTMLElement); return; }
          avisoDe(u, "Anunciou " + nomeItem(vende) + " por " + fmt(precoMerc), "#e0bd63"); itemSel = null; precoMerc = 0; clique(); atualizar();
        }}><b>Anunciar</b><small>{minhas.length >= OFERTAS_POR_VENDEDOR ? "limite de anúncios" : "por " + fmt(precoMerc)}</small></button>
      </div>}
      <Casas arr={u.mochila} onde="mo" sel={itemSel} aoTocar={(i) => { precoMerc = 0; tocarSel("mo", i, !u.mochila[i]); }} />
    </>
  );
}
function LinhaPocao({ u, tipo }: { u: Unit; tipo: "hp" | "mp" }) {
  void tick.value;
  const b = tipo === "hp" ? "pvida" : "pmana", B = BASES[b], cabem = espacoPocao(u, b);
  const preco = precoPocao(tipo);
  const pode = Math.min(cabem, Math.floor(saldo(u) / preco));
  const comprar = (n: number, e: Event) => {
    const foi = comprarPocoes(u, tipo, n);
    if (!foi) { recusa(e.currentTarget as HTMLElement); return; }
    avisoDe(u, "+" + foi + " " + (tipo === "hp" ? "vida" : "mana") + " · −" + fmt(foi * preco), "#8fe6a8");
    fx({ t: "ui", s: "compra" }); atualizar();
  };
  return (
    <>
      <div class="nrow">
        <span class="nic"><IcoItem ic={B.ic} cor="" /></span>
        <span class="ntx"><b>{B.n}</b><small>{descreveStats({ b, n: 1 })} · {preco} cada · na mochila {tipo === "hp" ? u.potHp : u.potMp} · cabem {cabem}</small></span>
      </div>
      <div class="crow" style={{ marginBottom: "10px" }}>
        <button class="cb ouro" disabled={pode < 1} onClick={(e) => comprar(1, e)}><b>+1</b><small>{preco}</small></button>
        <button class="cb ouro" disabled={pode < 1} onClick={(e) => comprar(10, e)}><b>+10</b><small>{fmt(preco * Math.min(10, pode || 10))}</small></button>
        <button class="cb ouro" disabled={pode < 1} onClick={(e) => comprar(1e9, e)}><b>Encher</b><small>{pode} · {fmt(pode * preco)}</small></button>
      </div>
    </>
  );
}
void painelUlt;
