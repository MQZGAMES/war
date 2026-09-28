/* ================================================================
   [SYSTEM: NUVEM] conta na nuvem com Supabase: e-mail + senha, e
   dentro dela até 10 personagens, cada um com a sua partida. A senha
   vira hash no servidor; o aparelho guarda só um token de sessão e qual
   personagem está em jogo. Tudo passa pelas funções mdc_* de
   supabase/conta-personagens.sql. A partida do personagem em jogo sobe
   sozinha a cada 5 min e ao fechar o app, e na hora pelo botão.
   Sem as variáveis VITE_SUPABASE_* o jogo segue 100% local; o cliente
   só é baixado quando a nuvem está configurada.
   ================================================================ */
import { signal } from "@preact/signals";
import type { SupabaseClient } from "@supabase/supabase-js";

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const CHAVE = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const nuvemAtiva = !!(URL_ && CHAVE);
export const MAX_PERSONAGENS = 10;

export interface Personagem { id: number; nome: string; vocacao: string; nivel: number; atualizado: string | null; salvo: boolean }
export interface MetaNuvem { quando: string; heroi: string; nivel: number; id: number }
export const conta = signal<{ email: string } | null>(null);
export const personagens = signal<Personagem[]>([]);
/* o personagem da conta que está em jogo neste aparelho (0 = nenhum) */
export const ativo = signal(0);
/* o personagem salvo mais recente (para o "Continuar" da tela inicial) */
export const metaNuvem = signal<MetaNuvem | null>(null);
export const nuvemOcupada = signal(false);
export const enviadoEm = signal(0);
export const erroNuvem = signal("");

const SESSAO = "mesaDeGuerra3d.conta";
export const INTERVALO_AUTO = 5 * 60_000;
let token = "";
let proxAuto = 0;

let pronto: Promise<SupabaseClient | null> | null = null;
function cliente() {
  if (!nuvemAtiva) return Promise.resolve(null);
  if (!pronto) pronto = import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(URL_!, CHAVE!, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }),
  ).catch(() => null);
  return pronto;
}

/* o erro do servidor em português de gente */
function traduz(m: string, code = ""): Error {
  if (code === "PGRST202" || /could not find the function|schema cache/i.test(m))
    return new Error("o servidor da nuvem ainda não tem a conta com personagens (falta rodar supabase/conta-personagens.sql no Supabase)");
  if (/EMAIL_EXISTE/.test(m)) return new Error("já existe uma conta com esse e-mail; use Entrar");
  if (/EMAIL_INVALIDO/.test(m)) return new Error("esse e-mail não parece válido");
  if (/LOGIN_INVALIDO/.test(m)) return new Error("e-mail ou senha errados");
  if (/BLOQUEADO/.test(m)) return new Error("muitas senhas erradas seguidas; espere 5 minutos");
  if (/SENHA_CURTA/.test(m)) return new Error("a senha precisa ter pelo menos 6 caracteres");
  if (/LIMITE_PERSONAGENS/.test(m)) return new Error("a conta já tem " + MAX_PERSONAGENS + " personagens; exclua um para criar outro");
  if (/PERSONAGEM_INVALIDO/.test(m)) return new Error("esse personagem não existe mais nesta conta");
  if (/SESSAO_INVALIDA/.test(m)) { esquecerSessao(); return new Error("a sessão venceu; entre de novo"); }
  if (/fetch|network|failed to|load failed/i.test(m)) return new Error("sem conexão com o servidor");
  return new Error(m || "erro desconhecido");
}
async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const c = await cliente();
  if (!c) throw new Error("nuvem não configurada");
  let r;
  try { r = await c.rpc(fn, args); } catch (e) { throw traduz((e as Error).message || "network"); }
  if (r.error) throw traduz(r.error.message || "", r.error.code || "");
  const d = r.data as T & { erro?: string };
  if (d && typeof d === "object" && "erro" in d && d.erro) throw traduz(d.erro);
  return d;
}

function guardar() {
  try {
    if (conta.value && token) localStorage.setItem(SESSAO, JSON.stringify({ email: conta.value.email, token, ativo: ativo.value }));
    else localStorage.removeItem(SESSAO);
  } catch { /* sem armazenamento: vale só nesta aba */ }
}
function esquecerSessao() {
  token = "";
  conta.value = null; personagens.value = []; ativo.value = 0; metaNuvem.value = null;
  guardar();
}
/* sessões dos logins antigos (e-mail por link, usuário) não valem mais */
function limparLoginAntigo() {
  try {
    for (const k of Object.keys(localStorage)) if (/^sb-.*-auth-token$/.test(k)) localStorage.removeItem(k);
    localStorage.removeItem("mesaDeGuerra3d.nuvem");
  } catch { /* nada */ }
}
function lista(l: Personagem[] | null | undefined) {
  personagens.value = Array.isArray(l) ? l : [];
  if (ativo.value && !personagens.value.some((p) => p.id === ativo.value)) { ativo.value = 0; guardar(); }
  const r = personagens.value.filter((p) => p.salvo && p.atualizado).sort((a, b) => +new Date(b.atualizado!) - +new Date(a.atualizado!))[0];
  metaNuvem.value = r ? { quando: r.atualizado!, heroi: r.nome, nivel: r.nivel, id: r.id } : null;
}
function entrouCom(email: string, t: string, l: Personagem[]) {
  token = t; conta.value = { email }; erroNuvem.value = "";
  proxAuto = Date.now() + INTERVALO_AUTO;
  lista(l);
  guardar();
}

export async function iniciarNuvem(): Promise<string> {
  if (!nuvemAtiva) return "";
  limparLoginAntigo();
  let s: { email: string; token: string; ativo?: number } | null = null;
  try { s = JSON.parse(localStorage.getItem(SESSAO) || "null"); } catch { s = null; }
  if (!s || !s.email || !s.token) return "";
  token = s.token; conta.value = { email: s.email }; ativo.value = s.ativo || 0;
  proxAuto = Date.now() + INTERVALO_AUTO;
  try { await lerPersonagens(); return ""; } catch (e) { return conta.value ? "" : "Nuvem: " + (e as Error).message + "."; }
}
export async function lerPersonagens() {
  if (!token) return [];
  const d = await rpc<{ email: string; personagens: Personagem[] }>("mdc_personagens", { p_token: token });
  lista(d.personagens);
  return personagens.value;
}
const normaliza = (e: string) => e.trim().toLowerCase();
export async function criarConta(email: string, senha: string) {
  const d = await rpc<{ email: string; token: string; personagens: Personagem[] }>("mdc_criar_conta", { p_email: normaliza(email), p_senha: senha });
  ativo.value = 0;
  entrouCom(d.email, d.token, d.personagens);
}
export async function entrar(email: string, senha: string) {
  const d = await rpc<{ email: string; token: string; personagens: Personagem[] }>("mdc_entrar", { p_email: normaliza(email), p_senha: senha });
  ativo.value = 0;
  entrouCom(d.email, d.token, d.personagens);
}
export async function trocarSenha(atual: string, nova: string) {
  await rpc("mdc_trocar_senha", { p_token: token, p_atual: atual, p_nova: nova });
}
export async function sairConta() {
  const t = token;
  esquecerSessao();
  if (t) { try { await rpc("mdc_sair", { p_token: t }); } catch { /* sai deste aparelho mesmo sem rede */ } }
}

/* ---------- personagens ---------- */
export const podeCriarPersonagem = () => !!conta.value && personagens.value.length < MAX_PERSONAGENS;
/* um personagem novo na conta; vira o personagem em jogo */
export async function novoPersonagem(nome: string, vocacao: string) {
  const d = await rpc<{ id: number; personagens: Personagem[] }>("mdc_novo_personagem", { p_token: token, p_nome: nome, p_vocacao: vocacao });
  lista(d.personagens);
  ativo.value = d.id; guardar();
  return d.id;
}
export async function excluirPersonagem(id: number) {
  const d = await rpc<{ personagens: Personagem[] }>("mdc_excluir_personagem", { p_token: token, p_id: id });
  if (ativo.value === id) ativo.value = 0;
  lista(d.personagens);
  guardar();
}
export function escolherAtivo(id: number) { ativo.value = id; guardar(); }
export async function baixarPersonagem(id: number): Promise<unknown> {
  if (!token) throw new Error("entre na conta primeiro");
  nuvemOcupada.value = true;
  try {
    const m = await rpc<unknown>("mdc_carregar", { p_token: token, p_id: id });
    ativo.value = id; guardar();
    return m;
  } finally { nuvemOcupada.value = false; }
}

/* chamado a cada save local (1 por minuto): sobe o personagem em jogo a
   cada 5 min. `modo`: "auto" respeita os 5 min; "sair" (app fechando)
   sobe se passou ao menos 30 s do último; "agora" é o botão */
export async function enviarMundo(m: { quando: string; heroi: string; nivel: number; vocacao?: string }, modo: "auto" | "sair" | "agora" = "auto") {
  if (!nuvemAtiva || !token || !ativo.value) { if (modo === "agora" && token) throw new Error("escolha ou crie um personagem na conta"); return false; }
  const agora = Date.now();
  if (modo === "auto" && agora < proxAuto) return false;
  if (modo === "sair" && agora - enviadoEm.value < 30_000) return false;
  if (nuvemOcupada.value && modo !== "agora") return false;
  proxAuto = agora + INTERVALO_AUTO;
  nuvemOcupada.value = true;
  const id = ativo.value;
  try {
    const d = await rpc<{ atualizado: string }>("mdc_salvar", { p_token: token, p_id: id, p_mundo: m, p_nome: m.heroi, p_vocacao: m.vocacao || null, p_nivel: m.nivel });
    enviadoEm.value = Date.now(); erroNuvem.value = "";
    const q = d && d.atualizado ? d.atualizado : m.quando;
    lista(personagens.value.map((p) => p.id === id ? { ...p, nome: m.heroi, nivel: m.nivel, vocacao: m.vocacao || p.vocacao, atualizado: q, salvo: true } : p));
    return true;
  } catch (e) {
    erroNuvem.value = (e as Error).message;
    proxAuto = Date.now() + 60_000;
    if (modo === "agora") throw e;
    return false;
  } finally { nuvemOcupada.value = false; }
}
