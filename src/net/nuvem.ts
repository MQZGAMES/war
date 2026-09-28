/* ================================================================
   [SYSTEM: NUVEM] save na nuvem com Supabase, conta com usuário e
   senha (sem e-mail). A senha vira hash no servidor; o aparelho guarda
   só um token de sessão. Tudo passa pelas funções mdg_* de
   supabase/contas.sql. A partida sobe sozinha a cada 5 min de jogo e
   ao fechar o app, e na hora pelo botão "Salvar na nuvem".
   Sem as variáveis VITE_SUPABASE_* o jogo segue 100% local; o cliente
   só é baixado quando a nuvem está configurada.
   ================================================================ */
import { signal } from "@preact/signals";
import type { SupabaseClient } from "@supabase/supabase-js";

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const CHAVE = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const nuvemAtiva = !!(URL_ && CHAVE);

export interface MetaNuvem { quando: string; heroi: string; nivel: number }
export const conta = signal<{ usuario: string } | null>(null);
export const metaNuvem = signal<MetaNuvem | null>(null);
export const nuvemOcupada = signal(false);
/* último envio que deu certo (relógio do aparelho) e o último erro */
export const enviadoEm = signal(0);
export const erroNuvem = signal("");

const SESSAO = "mesaDeGuerra3d.nuvem";
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
    return new Error("o servidor da nuvem ainda não tem o login por usuário (falta rodar supabase/contas.sql no Supabase)");
  if (/USUARIO_EXISTE/.test(m)) return new Error("esse usuário já existe; escolha outro ou entre com ele");
  if (/LOGIN_INVALIDO/.test(m)) return new Error("usuário ou senha errados");
  if (/BLOQUEADO/.test(m)) return new Error("muitas senhas erradas seguidas; espere 5 minutos");
  if (/USUARIO_INVALIDO/.test(m)) return new Error("o usuário precisa ter de 3 a 20 letras minúsculas, números, ponto, traço ou _");
  if (/SENHA_CURTA/.test(m)) return new Error("a senha precisa ter pelo menos 6 caracteres");
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

function lerSessao(): { usuario: string; token: string } | null {
  try { const s = JSON.parse(localStorage.getItem(SESSAO) || "null"); return s && s.usuario && s.token ? s : null; } catch { return null; }
}
function guardarSessao(usuario: string, t: string) {
  token = t;
  try { localStorage.setItem(SESSAO, JSON.stringify({ usuario, token: t })); } catch { /* sem armazenamento: vale só nesta aba */ }
  conta.value = { usuario };
  erroNuvem.value = "";
  proxAuto = Date.now() + INTERVALO_AUTO;
}
function esquecerSessao() {
  token = "";
  try { localStorage.removeItem(SESSAO); } catch { /* nada */ }
  conta.value = null; metaNuvem.value = null;
}
/* a sessão do login antigo por e-mail não vale mais: some do aparelho */
function limparLoginAntigo() {
  try { for (const k of Object.keys(localStorage)) if (/^sb-.*-auth-token$/.test(k)) localStorage.removeItem(k); } catch { /* nada */ }
}
function meta(d: { heroi?: string; nivel?: number; atualizado?: string | null } | null) {
  metaNuvem.value = d && d.atualizado ? { quando: d.atualizado, heroi: d.heroi || "", nivel: d.nivel || 0 } : null;
}

export async function iniciarNuvem(): Promise<string> {
  if (!nuvemAtiva) return "";
  limparLoginAntigo();
  const s = lerSessao();
  if (!s) return "";
  token = s.token; conta.value = { usuario: s.usuario };
  proxAuto = Date.now() + INTERVALO_AUTO;
  try { await lerMeta(); return ""; } catch (e) { return conta.value ? "" : "Nuvem: " + (e as Error).message + "."; }
}
export async function lerMeta() {
  if (!token) return null;
  meta(await rpc<{ heroi: string; nivel: number; atualizado: string | null } | null>("mdg_meta", { p_token: token }));
  return metaNuvem.value;
}
const normaliza = (u: string) => u.trim().toLowerCase();
export async function criarConta(usuario: string, senha: string) {
  const d = await rpc<{ usuario: string; token: string }>("mdg_criar_conta", { p_usuario: normaliza(usuario), p_senha: senha });
  guardarSessao(d.usuario, d.token);
  metaNuvem.value = null;
}
export async function entrar(usuario: string, senha: string) {
  const d = await rpc<{ usuario: string; token: string; heroi: string; nivel: number; atualizado: string | null }>("mdg_entrar", { p_usuario: normaliza(usuario), p_senha: senha });
  guardarSessao(d.usuario, d.token);
  meta(d);
}
export async function trocarSenha(atual: string, nova: string) {
  await rpc("mdg_trocar_senha", { p_token: token, p_atual: atual, p_nova: nova });
}
export async function sairConta() {
  const t = token;
  esquecerSessao();
  if (t) { try { await rpc("mdg_sair", { p_token: t }); } catch { /* sai deste aparelho mesmo sem rede */ } }
}

/* chamado a cada save local (1 por minuto): sobe a cada 5 min. `modo`:
   "auto" respeita os 5 min; "sair" (app fechando) sobe se passou ao
   menos 30 s do último; "agora" é o botão */
export async function enviarMundo(m: { quando: string; heroi: string; nivel: number }, modo: "auto" | "sair" | "agora" = "auto") {
  if (!nuvemAtiva || !token) return false;
  const agora = Date.now();
  if (modo === "auto" && agora < proxAuto) return false;
  if (modo === "sair" && agora - enviadoEm.value < 30_000) return false;
  if (nuvemOcupada.value && modo !== "agora") return false;
  proxAuto = agora + INTERVALO_AUTO;
  nuvemOcupada.value = true;
  try {
    const d = await rpc<{ atualizado: string }>("mdg_salvar", { p_token: token, p_mundo: m, p_heroi: m.heroi, p_nivel: m.nivel });
    enviadoEm.value = Date.now(); erroNuvem.value = "";
    metaNuvem.value = { quando: d && d.atualizado ? d.atualizado : m.quando, heroi: m.heroi, nivel: m.nivel };
    return true;
  } catch (e) {
    erroNuvem.value = (e as Error).message;
    /* falhou sozinho: tenta de novo em 1 min, não em 5 */
    proxAuto = Date.now() + 60_000;
    if (modo === "agora") throw e;
    return false;
  } finally { nuvemOcupada.value = false; }
}

export async function baixarMundo(): Promise<unknown> {
  if (!token) throw new Error("entre na conta primeiro");
  nuvemOcupada.value = true;
  try {
    const m = await rpc<unknown>("mdg_carregar", { p_token: token });
    if (!m) throw new Error("não há partida salva nesta conta");
    return m;
  } finally { nuvemOcupada.value = false; }
}
