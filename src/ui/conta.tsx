/* [SYSTEM: CONTA] a conta da nuvem: e-mail e senha, com até 10
   personagens. Cada personagem guarda a sua partida; escolher um abre a
   partida dele; criar um herói novo com a conta aberta vira mais um
   personagem da lista. A partida do personagem em jogo sobe sozinha a
   cada 5 min e ao fechar o app; "Salvar agora" sobe na hora. */
import { useState } from "preact/hooks";
import { G } from "../sim/state";
import { KINDS, type VocKey } from "../sim/data";
import { carregarMundo, mundoDe } from "../sim/save";
import { retratoDe } from "../render/portrait";
import {
  conta, personagens, ativo, enviadoEm, erroNuvem, nuvemAtiva, nuvemOcupada, MAX_PERSONAGENS,
  criarConta, entrar, sairConta, trocarSenha, baixarPersonagem, enviarMundo, excluirPersonagem, novoPersonagem, escolherAtivo, podeCriarPersonagem,
} from "../net/nuvem";
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
const vocNome = (v: string) => (KINDS[v as VocKey] ? KINDS[v as VocKey].pt : "");

/* abre a partida de um personagem da conta; sem partida salva ainda,
   vai para a escolha do herói e o herói criado ocupa esse personagem */
export async function abrirPersonagem(id: number) {
  const p = personagens.value.find((q) => q.id === id);
  if (p && !p.salvo) { escolherAtivo(id); irPara("heroi"); return; }
  const m = await baixarPersonagem(id);
  if (!m) { irPara("heroi"); return; }
  carregarMundo(m);
  if (G.ctrl) retrato.value = retratoDe(G.ctrl);
  irPara(G.ctrl ? "jogo" : "heroi");
  aviso("Partida de " + (p ? p.nome : "personagem") + " aberta", "#8fe6a8");
}
function mundoAgora() {
  const m = mundoDe() as ReturnType<typeof mundoDe> & { vocacao?: string };
  m.local = 1; m.heroi = G.ctrl!.name; m.nivel = G.ctrl!.lvl; m.vocacao = G.ctrl!.kind;
  return m;
}
/* o botão "Salvar na nuvem" (menu de pausa e conta) */
export async function salvarNaNuvem() {
  if (!G.ctrl) throw new Error("assuma um herói antes de salvar a partida");
  if (!ativo.value) {
    if (!podeCriarPersonagem()) throw new Error("a conta já tem " + MAX_PERSONAGENS + " personagens; exclua um na tela Nuvem");
    await novoPersonagem(G.ctrl.name, G.ctrl.kind);
  }
  await enviarMundo(mundoAgora(), "agora");
}
/* herói criado com a conta aberta: ocupa o personagem escolhido ainda
   vazio ou vira um personagem novo da conta, e já sobe a partida */
export async function heroiNaConta() {
  if (!conta.value || !G.ctrl) return;
  try {
    const vazio = personagens.value.find((p) => p.id === ativo.value && !p.salvo);
    if (!vazio) {
      if (!podeCriarPersonagem()) { escolherAtivo(0); aviso("A conta já tem " + MAX_PERSONAGENS + " personagens: este herói fica só no aparelho", "#e0b93a"); return; }
      await novoPersonagem(G.ctrl.name, G.ctrl.kind);
    }
    await enviarMundo(mundoAgora(), "agora");
    aviso(G.ctrl.name + " entrou na sua conta (" + personagens.value.length + "/" + MAX_PERSONAGENS + ")", "#8fe6a8");
  } catch (e) { aviso("Nuvem: " + (e as Error).message, "#e0685a"); }
}

const EMAIL_OK = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export function Conta() {
  void tick.value;
  const c = conta.value, lista = personagens.value, ocupada = nuvemOcupada.value;
  const [aba, setAba] = useState<"entrar" | "criar">("entrar");
  const [email, setEmail] = useState("");
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
    const em = email.trim().toLowerCase();
    if (!EMAIL_OK.test(em)) { recusa(btn); setMsg("Digite um e-mail válido."); return; }
    if (senha.length < 6) { recusa(btn); setMsg("A senha precisa ter pelo menos 6 caracteres."); return; }
    if (aba === "criar" && senha !== senha2) { recusa(btn); setMsg("As duas senhas não batem."); return; }
    clique();
    void tentar(async () => {
      if (aba === "criar") {
        await criarConta(em, senha);
        /* já jogando: o herói atual vira o primeiro personagem da conta */
        if (G.ctrl) await heroiNaConta();
        setMsg("Conta criada. Crie até " + MAX_PERSONAGENS + " personagens nela.");
      } else { await entrar(em, senha); setMsg(""); }
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
                <input class="fin" style={{ width: "100%" }} type="email" inputMode="email" autocomplete="email" autocapitalize="none" spellcheck={false} maxLength={120}
                  placeholder="e-mail" value={email} onInput={(e) => setEmail((e.target as HTMLInputElement).value.replace(/\s/g, ""))} />
                {campoSenha(senha, setSenha, "senha (6 ou mais caracteres)", aba === "criar" ? "new-password" : "current-password")}
                {aba === "criar" && campoSenha(senha2, setSenha2, "repita a senha", "new-password")}
                <label class="verSenha"><input type="checkbox" checked={ver} onChange={() => setVer(!ver)} /> mostrar a senha</label>
                <button class="go" type="submit" disabled={ocup} style={{ width: "100%", marginTop: "10px" }}>
                  {ocup ? "Conferindo…" : aba === "criar" ? "Criar conta e entrar" : "Entrar"}</button>
              </form>
              <p class="dica">{msg || (aba === "criar"
                ? "Uma conta por e-mail, com até " + MAX_PERSONAGENS + " personagens dentro. Cada personagem guarda a sua partida."
                : "Entre com o e-mail e a senha da conta para escolher um dos seus personagens em qualquer aparelho.")}</p>
            </>
          ) : (
            <>
              <p class="dica" style={{ marginTop: 0 }}>Conta <b>{c.email}</b>
                {erroNuvem.value && <><br /><span style={{ color: "var(--bad)" }}>Último envio falhou: {erroNuvem.value}.</span></>}</p>
              <div class="secao">Personagens · {lista.length}/{MAX_PERSONAGENS}</div>
              {!lista.length && <p class="dica" style={{ marginTop: 0 }}>Nenhum personagem ainda. Crie o primeiro abaixo{G.ctrl ? " ou salve o herói atual na conta" : ""}.</p>}
              <div class="plista">
                {lista.map((p) => (
                  <div key={p.id} class={"pitem" + (p.id === ativo.value ? " on" : "")}>
                    <span class="pnome"><b>{p.nome || "Sem nome"}</b>
                      <small>{[vocNome(p.vocacao), p.salvo ? "nível " + p.nivel : "ainda sem partida", p.atualizado ? dataNuvem(p.atualizado) : ""].filter(Boolean).join(" · ")}{p.id === ativo.value ? " · em jogo" : ""}</small></span>
                    {G.ctrl ? (
                      <DoisToques cls="btn" disabled={ocup} acao={() => { void tentar(() => abrirPersonagem(p.id)); }} filhos="Jogar" armado="Trocar?" />
                    ) : (
                      <button class="btn on" disabled={ocup} onClick={() => { clique(); void tentar(() => abrirPersonagem(p.id)); }}>Jogar</button>
                    )}
                    <DoisToques cls="btn sair" disabled={ocup} acao={() => { void tentar(async () => { await excluirPersonagem(p.id); setMsg(p.nome + " foi excluído da conta."); }); }}
                      filhos={<Ico n="fechar" s={16} />} armado="Excluir?" />
                  </div>
                ))}
              </div>
              <div class="grade2" style={{ marginTop: "10px" }}>
                <button class="cb ouro" disabled={ocup || !podeCriarPersonagem()} onClick={() => { clique(); escolherAtivo(0); irPara("heroi"); }}>
                  <Ico n="mais" s={20} /><b>Novo personagem</b><small>{podeCriarPersonagem() ? "entra na lista" : "limite de " + MAX_PERSONAGENS}</small></button>
                <button class="cb" disabled={ocup || !G.ctrl} onClick={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  clique();
                  void tentar(async () => { await salvarNaNuvem(); setMsg("Partida de " + G.ctrl!.name + " salva na conta."); }, el);
                }}><Ico n="nuvem" s={20} /><b>Salvar agora</b><small>{ocup ? "enviando…" : enviadoEm.value ? "última: " + haQuanto(enviadoEm.value) : G.ctrl ? G.ctrl.name : "sem herói em jogo"}</small></button>
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
                  if (senha2.length < 6) { recusa(btn); setMsg("A senha nova precisa ter pelo menos 6 caracteres."); return; }
                  clique();
                  void tentar(async () => { await trocarSenha(senha, senha2); setTrocando(false); setSenha(""); setSenha2(""); setMsg("Senha trocada. Os outros aparelhos precisam entrar de novo."); }, btn);
                }} style={{ marginTop: "10px" }}>
                  {campoSenha(senha, setSenha, "senha atual", "current-password")}
                  {campoSenha(senha2, setSenha2, "senha nova", "new-password")}
                  <label class="verSenha"><input type="checkbox" checked={ver} onChange={() => setVer(!ver)} /> mostrar as senhas</label>
                  <button class="go" type="submit" disabled={ocup} style={{ width: "100%", marginTop: "10px" }}>{ocup ? "Conferindo…" : "Trocar a senha"}</button>
                </form>
              )}
              <p class="dica">{msg || "A partida do personagem em jogo sobe sozinha a cada 5 minutos e quando você fecha o app. Em outro aparelho, entre com o mesmo e-mail e escolha o personagem."}</p>
            </>
          )}
        </div>
        <div class="pe"><button class="go" onClick={() => { clique(); irPara(volta.value); }}>Pronto</button></div>
      </div>
    </div>
  );
}
