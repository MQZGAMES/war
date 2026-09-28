/* [SYSTEM: CONTA] entrar com código no e-mail e levar a partida entre
   aparelhos. A partida sobe sozinha ao pausar, ao sair do app e a cada
   poucos minutos; "Continuar" na tela inicial abre a mais recente. */
import { useState } from "preact/hooks";
import { G } from "../sim/state";
import { carregarMundo, mundoDe } from "../sim/save";
import { retratoDe } from "../render/portrait";
import { conta, metaNuvem, nuvemAtiva, nuvemOcupada, pedirCodigo, confirmarCodigo, sairConta, baixarMundo, enviarMundo } from "../net/nuvem";
import { tick, irPara, volta, aviso, retrato } from "./store";
import { Ico } from "./icons";
import { DoisToques, clique, recusa } from "./comp";

export const dataNuvem = (q: string) => { const d = new Date(q); return isNaN(+d) ? "" : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); };

export async function abrirDaNuvem() {
  const m = await baixarMundo();
  const n = carregarMundo(m);
  if (G.ctrl) retrato.value = retratoDe(G.ctrl);
  irPara(G.ctrl ? "jogo" : "heroi");
  aviso("Partida da nuvem aberta: " + n + " aventureiros", "#8fe6a8");
}

export function Conta() {
  void tick.value;
  const c = conta.value, meta = metaNuvem.value, ocupada = nuvemOcupada.value;
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [etapa, setEtapa] = useState<"email" | "codigo">("email");
  const [msg, setMsg] = useState("");
  const [esperando, setEsperando] = useState(false);
  const tentar = async (f: () => Promise<unknown>, el?: HTMLElement) => {
    setEsperando(true);
    try { await f(); } catch (e) { recusa(el); const t = (e as Error).message || ""; setMsg("Não deu: " + (!t || /fetch|network/i.test(t) ? "sem conexão com o servidor" : /token|expired|invalid/i.test(t) ? "código errado ou vencido" : t) + "."); } finally { setEsperando(false); }
  };
  const ocup = esperando || ocupada;
  return (
    <div class="tela">
      <div class="cartao">
        <div class="cab"><h2>Nuvem</h2><button class="xis" aria-label="Voltar" onClick={() => { clique(); irPara(volta.value); }}><Ico n="fechar" s={18} /></button></div>
        <div class="corpo">
          {!nuvemAtiva ? (
            <p class="dica">Esta cópia do jogo não tem a nuvem configurada. A partida continua guardada neste aparelho e em arquivo .json.</p>
          ) : !c ? (
            <>
              <div class="secao">Entrar</div>
              {etapa === "email" ? (
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const em = email.trim();
                  if (!/^\S+@\S+\.\S+$/.test(em)) { recusa(); setMsg("Digite um e-mail válido."); return; }
                  clique();
                  void tentar(async () => { await pedirCodigo(em); setEtapa("codigo"); setMsg("Enviamos um e-mail para " + em + ". Abra-o neste aparelho e toque em “Sign in”: o jogo volta já conectado. Se vier um código, digite acima. Olhe também o spam."); });
                }}>
                  <input class="fin" style={{ width: "100%" }} type="email" inputMode="email" autocomplete="email" placeholder="seu e-mail" value={email} onInput={(e) => setEmail((e.target as HTMLInputElement).value)} />
                  <button class="go" type="submit" disabled={ocup} style={{ width: "100%", marginTop: "10px" }}>{ocup ? "Enviando…" : "Receber link de acesso"}</button>
                </form>
              ) : (
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const cd = codigo.replace(/\D/g, "");
                  if (cd.length < 6) { recusa(); setMsg("O código tem 6 dígitos ou mais."); return; }
                  clique();
                  void tentar(async () => { await confirmarCodigo(email.trim(), cd); setMsg(""); setCodigo(""); });
                }}>
                  <input class="fin" style={{ width: "100%" }} inputMode="numeric" autocomplete="one-time-code" maxLength={10} placeholder="código (se o e-mail trouxer um)" value={codigo} onInput={(e) => setCodigo((e.target as HTMLInputElement).value)} />
                  <button class="go" type="submit" disabled={ocup} style={{ width: "100%", marginTop: "10px" }}>{ocup ? "Conferindo…" : "Entrar"}</button>
                  <button class="btn" type="button" style={{ width: "100%", marginTop: "8px" }} onClick={() => { clique(); setEtapa("email"); setMsg(""); }}>Trocar e-mail</button>
                </form>
              )}
              <p class="dica">{msg || "Com uma conta, a partida vai junto para o celular, o tablet e o computador. Sem senha: você recebe um link de acesso no e-mail."}</p>
            </>
          ) : (
            <>
              <div class="secao">Conta</div>
              <p class="dica" style={{ marginTop: 0 }}>Conectado como <b>{c.email}</b>.<br />
                {meta ? <>Na nuvem: {meta.heroi || "herói"} · nível {meta.nivel} · {dataNuvem(meta.quando)}</> : "Ainda não há partida na nuvem."}</p>
              <div class="grade2">
                <button class="cb ouro" disabled={ocup} onClick={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  if (!G.ctrl) { recusa(el); setMsg("Assuma um herói antes de enviar a partida."); return; }
                  clique();
                  void tentar(async () => {
                    const m = mundoDe(); m.local = 1; m.heroi = G.ctrl!.name; m.nivel = G.ctrl!.lvl;
                    const ok = await enviarMundo(m, true);
                    setMsg(ok ? "Partida enviada para a nuvem." : "O envio não confirmou; tente de novo.");
                  }, el);
                }}><Ico n="nuvem" s={20} /><b>Enviar agora</b><small>{ocup ? "sincronizando…" : "sobe esta partida"}</small></button>
                <DoisToques cls="cb" disabled={!meta || ocup} acao={() => { void tentar(abrirDaNuvem); }}
                  filhos={<><Ico n="carregar" s={20} /><b>Abrir da nuvem</b><small>dois toques</small></>}
                  armado={<><b>Toque de novo</b><small>substitui o mundo atual</small></>} />
                <DoisToques cls="cb cheio sair" disabled={ocup} acao={() => { void tentar(async () => { await sairConta(); setMsg("Você saiu. A partida continua neste aparelho."); }); }}
                  filhos={<><Ico n="voltar" s={20} /><b>Sair da conta</b><small>dois toques</small></>}
                  armado={<><b>Toque de novo</b><small>desconecta este aparelho</small></>} />
              </div>
              <p class="dica">{msg || "A partida sobe sozinha ao pausar, ao sair do app e a cada 3 minutos de jogo."}</p>
            </>
          )}
        </div>
        <div class="pe"><button class="go" onClick={() => { clique(); irPara(volta.value); }}>Pronto</button></div>
      </div>
    </div>
  );
}
