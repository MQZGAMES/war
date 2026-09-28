/* Peças da interface: seletor, sim/não, passo com repetição ao segurar,
   botão de dois toques ([SYSTEM: UX_MOBILE]) e som de clique. */
import type { ComponentChildren, JSX } from "preact";
import { useRef, useState, useEffect } from "preact/hooks";
import { som } from "../audio/sfx";
import { Ico } from "./icons";

export function clique() { som("clique", .6); }
export function recusa(el?: HTMLElement | null) {
  som("nega", .7);
  if (!el) return;
  el.classList.remove("nao"); void el.offsetWidth; el.classList.add("nao");
}

export function Seg<T extends string | number>({ itens, valor, aoEscolher, cls }: { itens: [T, string][]; valor: T; aoEscolher: (v: T) => void; cls?: string }) {
  return (
    <div class={"seg " + (cls || "sm")}>
      {itens.map(([v, t]) => (
        <button key={String(v)} aria-pressed={String(v) === String(valor)} onClick={() => { clique(); aoEscolher(v); }}>{t}</button>
      ))}
    </div>
  );
}
export function SimNao({ valor, aoEscolher, rotulos = ["Não", "Sim"] }: { valor: number | boolean; aoEscolher: (v: number) => void; rotulos?: [string, string] }) {
  return <Seg itens={[[0, rotulos[0]], [1, rotulos[1]]]} valor={valor ? 1 : 0} aoEscolher={aoEscolher} />;
}

/* passo: segurar − ou + repete (ir de 0 a 200 poções não pede 40 toques) */
export function Passo({ valor, menos, mais, podeMenos = true, podeMais = true, larg }: { valor: string | number; menos: () => void; mais: () => void; podeMenos?: boolean; podeMais?: boolean; larg?: number }) {
  const rep = useRef<{ t: number; i: number } | null>(null);
  const parar = () => { if (rep.current) { clearTimeout(rep.current.t); clearInterval(rep.current.i); rep.current = null; } };
  useEffect(() => parar, []);
  const segurar = (f: () => void) => (e: PointerEvent) => {
    e.preventDefault();
    parar();
    clique(); f();
    const r = { t: 0, i: 0 };
    r.t = window.setTimeout(() => { r.i = window.setInterval(f, 85); }, 420);
    rep.current = r;
  };
  return (
    <div class="passo">
      <button disabled={!podeMenos} onPointerDown={segurar(menos)} onPointerUp={parar} onPointerLeave={parar} onPointerCancel={parar} aria-label="Menos"><Ico n="menos" s={18} /></button>
      <b style={larg ? { minWidth: larg + "px" } : undefined}>{valor}</b>
      <button disabled={!podeMais} onPointerDown={segurar(mais)} onPointerUp={parar} onPointerLeave={parar} onPointerCancel={parar} aria-label="Mais"><Ico n="mais" s={18} /></button>
    </div>
  );
}

/* ação destrutiva pede dois toques: o primeiro arma por 3 s */
export function DoisToques({ cls, filhos, armado, acao, disabled }: { cls: string; filhos: ComponentChildren; armado: ComponentChildren; acao: () => void; disabled?: boolean }) {
  const [arm, setArm] = useState(false);
  const t = useRef(0);
  useEffect(() => () => clearTimeout(t.current), []);
  return (
    <button class={cls + (arm ? " arm" : "")} disabled={disabled} onClick={() => {
      clique();
      if (arm) { clearTimeout(t.current); setArm(false); acao(); return; }
      setArm(true);
      t.current = window.setTimeout(() => setArm(false), 3000);
    }}>{arm ? armado : filhos}</button>
  );
}

export function Barra({ cls, v, max, txt, fantasma }: { cls: string; v: number; max: number; txt?: string; fantasma?: number }) {
  const f = Math.max(0, Math.min(1, max > 0 ? v / max : 0)) * 100;
  return (
    <div class={"br " + cls}>
      {fantasma !== undefined && <i class="fant" style={{ width: fantasma + "%" }} />}
      <i class="v" style={{ width: f.toFixed(1) + "%" }} />
      {txt && <em>{txt}</em>}
    </div>
  );
}
export function Lin({ rot, sub, children, col }: { rot: ComponentChildren; sub?: ComponentChildren; children?: ComponentChildren; col?: boolean }) {
  return (
    <div class={"lin" + (col ? " col" : "")}>
      <span class="rot">{rot}{sub !== undefined && <small>{sub}</small>}</span>
      {children}
    </div>
  );
}
export const fmt = (n: number) => Math.floor(n).toLocaleString("pt-BR");
export type Filhos = ComponentChildren;
export type Estilo = JSX.CSSProperties;
