/* [SYSTEM: CONTA] conta com usuário e senha para levar a partida entre
   aparelhos. A partida sobe sozinha a cada 5 min de jogo e ao fechar o
   app; "Salvar agora" sobe na hora. "Continuar" na tela inicial abre a
   mais recente (a do aparelho ou a da nuvem). */
import { useState } from "preact/hooks";
import { G } from "../sim/state";
import { carregarMundo, mundoDe } from "../sim/save";
import { retratoDe } from "../render/portrait";
import { conta, enviadoEm, erroNuvem, metaNuvem, nuvemAtiva, nuvemOcupada, criarConta, entrar, sairConta, baixarMundo, enviarMundo, trocarSenha } from "../net/nuvem";
import { tick, irPara, volta, aviso, retrato } from "./store";
import { Ico } from "./icons";
import { DoisToques, Seg, clique, recusa } from "./comp";

export const dataNuvem = (q: string) => { const d = new Date(q); return isNaN(+d) ? "" : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); };
/* "agora há pouco", "há 3 min", "às 14:05" */
export function haQuanto(ms: number) {
  if (!ms) return "";
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return "agora há pouco";
  if (s < 3600) return "há " + Math.floor(s / 60) + " min";
  return "às " + new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export async function abrirDaNuvem() {
  const m = await baixarMundo();
  const n = carregarMundo(m);
  if (G.ctrl) retrato.value = retratoDe(G.ctrl);
  irPara(G.ctrl ? "jogo" : "heroi");
  aviso("Partida da nuvem aberta: " + n + " aventureiros", "#8fe6a8");
}
/* o botão "Salvar na nuvem" (menu de pausa e conta) */
export async function salvarNaNuvem() {
  if (!G.ctrl) throw new Error("assuma um herói antes de salvar a partida");
  const m = mundoDe(); m.local = 1; m.heroi = G.ctrl.name; m.nivel = G.ctrl.lvl;
  await enviarMundo(m, "agora");
}

const USUARIO_OK = /^[a-z0-9_.-]{3,20}$/;
export function Conta() {
  void tick.value;
  const c = conta.value, meta = metaNuvem.value, ocupada = nuvemOcupada.value;
  const [aba, setAba] = useState<"entrar" | "criar">("entrar");
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [ver, setVer] = useState(false);
  const [trocando, setTrocando] = useState(false);
  const [msg, setMsg] = useState("");
  const [esperando, setEsperando] = useState(false);
  const tentar = async (f: () => Promise<unknown>, el?: HTMLElement | null) => {
    setEsperando(true);
    try { await f(); } catch (e) { recusa(el || undefined); setMsg("Não deu: " + ((e as Error).message || "erro") + "."); } finally { setEsperando(false); }
  };
  const ocup = esperando || ocupada;
  const campoSenha = (v: string, set: (s: string) => void, ph: string, ac: string) => (
    <input class="fin" style={{ width: "100%", marginTop: "8px" }} type={ver ? "text" : "password"} autocomplete={ac} maxLength={72}
      placeholder={ph} value={v} onInput={(e) => set((e.target as HTMLInputElement).value)} />
  );
  const enviarForm = (e: Event) => {
    e.preventDefault();
    const btn = (e.currentTarget as HTMLFormElement).querySelector("button[type=submit]") as HTMLElement | null;
    const u = usuario.trim().toLowerCase();
    if (!USUARIO_OK.test(u)) { recusa(btn || undefined); setMsg("O usuário precisa ter de 3 a 20 letras minúsculas, números, ponto, traço ou _."); return; }
    if (senha.length < 6) { recusa(btn || undefined); setMsg("A senha precisa ter pelo menos 6 caracteres."); return; }
    if (aba === "criar" && senha !== senha2) { recusa(btn || undefined); setMsg("As duas senhas não batem."); return; }
    clique();
    void tentar(async () => {
      if (aba === "criar") { await criarConta(u, senha); setMsg("Conta criada. Guarde o usuário e a senha: é com eles que você entra em outro aparelho."); }
      else { await entrar(u, senha); setMsg(""); }
      setSenha(""); setSenha2("");
    }, btn);
  };
  return (
    <div class="tela">
      <div class="cartao">
        <div class="cab"><h2>Nuvem</h2><button class="xis" aria-label="Voltar" onClick={() => { clique(); irPara(volta.value); }}><Ico n="fechar" s={18} /></button></div>
        <div class="corpo">
          {!nuvemAtiva ? (
            <p class="dica">Esta cópia do jogo não tem a nuvem configurada. A partida continua guardada neste aparelho e em arquivo .json.</p>
          ) : !c ? (
            <>
              <Seg itens={[["entrar", "Entrar"], ["criar", "Criar conta"]] as ["entrar" | "criar", string][]} valor={aba}
                aoEscolher={(v) => { setAba(v); setMsg(""); setSenha2(""); }} />
              <form onSubmit={enviarForm} style={{ marginTop: "12px" }}>
                <input class="fin" style={{ width: "100%" }} autocomplete="username" autocapitalize="none" spellcheck={false} maxLength={20}
                  placeholder="usuário" value={usuario} onInput={(e) => setUsuario((e.target as HTMLInputElement).value.toLowerCase().replace(/\s/g, ""))} />
                {campoSenha(senha, setSenha, "senha (6 ou mais caracteres)", aba === "criar" ? "new-password" : "current-password")}
                {aba === "criar" && campoSenha(senha2, setSenha2, "repita a senha", "new-password")}
                <label class="verSenha"><input type="checkbox" checked={ver} onChange={() => setVer(!ver)} /> mostrar a senha</label>
                <button class="go" type="submit" disabled={ocup} style={{ width: "100%", marginTop: "10px" }}>
                  {ocup ? "Conferindo…" : aba === "criar" ? "Criar conta e entrar" : "Entrar"}</button>
              </form>
              <p class="dica">{msg || (aba === "criar"
                ? "Sem e-mail: só um usuário e uma senha. Não dá para recuperar a senha esquecida, então anote."
                : "Com a conta, a partida vai junto para o celular, o tablet e o computador.")}</p>
            </>
          ) : (
            <>
              <div class="secao">Conta</div>
              <p class="dica" style={{ marginTop: 0 }}>Conectado como <b>{c.usuario}</b>.<br />
                {meta ? <>Na nuvem: {meta.heroi || "herói"} · nível {meta.nivel} · {dataNuvem(meta.quando)}</> : "Ainda não há partida salva nesta conta."}
                {erroNuvem.value && <><br /><span style={{ color: "var(--bad)" }}>Último envio falhou: {erroNuvem.value}.</span></>}</p>
              <div class="grade2">
                <button class="cb ouro" disabled={ocup} onClick={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  if (!G.ctrl) { recusa(el); setMsg("Assuma um herói antes de salvar a partida."); return; }
                  clique();
                  void tentar(async () => { await salvarNaNuvem(); setMsg("Partida salva na nuvem."); }, el);
                }}><Ico n="nuvem" s={20} /><b>Salvar agora</b><small>{ocup ? "enviando…" : enviadoEm.value ? "última: " + haQuanto(enviadoEm.value) : "sobe esta partida"}</small></button>
                <DoisToques cls="cb" disabled={!meta || ocup} acao={() => { void tentar(abrirDaNuvem); }}
                  filhos={<><Ico n="carregar" s={20} /><b>Abrir da nuvem</b><small>dois toques</small></>}
                  armado={<><b>Toque de novo</b><small>substitui o mundo atual</small></>} />
                <button class="cb" disabled={ocup} onClick={() => { clique(); setTrocando(!trocando); setMsg(""); setSenha(""); setSenha2(""); }}>
                  <Ico n="engrenagem" s={20} /><b>Trocar a senha</b><small>{trocando ? "fechar" : "os outros aparelhos saem"}</small></button>
                <DoisToques cls="cb sair" disabled={ocup} acao={() => { void tentar(async () => { await sairConta(); setMsg("Você saiu. A partida continua neste aparelho."); }); }}
                  filhos={<><Ico n="voltar" s={20} /><b>Sair da conta</b><small>dois toques</small></>}
                  armado={<><b>Toque de novo</b><small>desconecta este aparelho</small></>} />
              </div>
              {trocando && (
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const btn = (e.currentTarget as HTMLFormElement).querySelector("button[type=submit]") as HTMLElement | null;
                  if (senha2.length < 6) { recusa(btn || undefined); setMsg("A senha nova precisa ter pelo menos 6 caracteres."); return; }
                  clique();
                  void tentar(async () => { await trocarSenha(senha, senha2); setTrocando(false); setSenha(""); setSenha2(""); setMsg("Senha trocada. Os outros aparelhos precisam entrar de novo."); }, btn);
                }} style={{ marginTop: "10px" }}>
                  {campoSenha(senha, setSenha, "senha atual", "current-password")}
                  {campoSenha(senha2, setSenha2, "senha nova", "new-password")}
                  <label class="verSenha"><input type="checkbox" checked={ver} onChange={() => setVer(!ver)} /> mostrar as senhas</label>
                  <button class="go" type="submit" disabled={ocup} style={{ width: "100%", marginTop: "10px" }}>{ocup ? "Conferindo…" : "Trocar a senha"}</button>
                </form>
              )}
              <p class="dica">{msg || "A partida sobe sozinha a cada 5 minutos de jogo e quando você fecha o app. Use Salvar agora antes de trocar de aparelho."}</p>
            </>
          )}
        </div>
        <div class="pe"><button class="go" onClick={() => { clique(); irPara(volta.value); }}>Pronto</button></div>
      </div>
    </div>
  );
}
