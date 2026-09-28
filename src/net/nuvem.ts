/* ================================================================
   [SYSTEM: NUVEM] save na nuvem com Supabase: login por código no
   e-mail e uma linha por conta na tabela `saves` (o mesmo .json do
   mundo salvo). Sem as variáveis VITE_SUPABASE_* o jogo segue 100%
   local; o cliente só é baixado quando a nuvem está configurada.
   ================================================================ */
import { signal } from "@preact/signals";
import type { SupabaseClient } from "@supabase/supabase-js";

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const CHAVE = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const nuvemAtiva = !!(URL_ && CHAVE);

export interface MetaNuvem { quando: string; heroi: string; nivel: number }
export const conta = signal<{ id: string; email: string } | null>(null);
export const metaNuvem = signal<MetaNuvem | null>(null);
export const nuvemOcupada = signal(false);

let sb: SupabaseClient | null = null;
let pronto: Promise<SupabaseClient | null> | null = null;
let ultimoEnvio = 0;
const INTERVALO_AUTO = 180_000;

function cliente() {
  if (!nuvemAtiva) return Promise.resolve(null);
  if (!pronto) pronto = import("@supabase/supabase-js").then(({ createClient }) => {
    sb = createClient(URL_!, CHAVE!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    sb.auth.onAuthStateChange((_ev, s) => {
      const u = s?.user;
      const antes = conta.value?.id;
      conta.value = u ? { id: u.id, email: u.email || "" } : null;
      if (!u) metaNuvem.value = null;
      else if (u.id !== antes) void lerMeta();
    });
    return sb;
  }).catch(() => null);
  return pronto;
}

export async function iniciarNuvem() {
  const c = await cliente();
  if (!c) return;
  const { data } = await c.auth.getSession();
  const u = data.session?.user;
  if (u) { conta.value = { id: u.id, email: u.email || "" }; await lerMeta(); }
}

export async function lerMeta() {
  const c = await cliente();
  if (!c || !conta.value) return null;
  const { data, error } = await c.from("saves").select("heroi,nivel,atualizado").eq("user_id", conta.value.id).maybeSingle();
  if (error) return null;
  metaNuvem.value = data ? { quando: data.atualizado, heroi: data.heroi || "", nivel: data.nivel || 0 } : null;
  return metaNuvem.value;
}

export async function pedirCodigo(email: string) {
  const c = await cliente();
  if (!c) throw new Error("nuvem não configurada");
  const { error } = await c.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
  if (error) throw error;
}
export async function confirmarCodigo(email: string, codigo: string) {
  const c = await cliente();
  if (!c) throw new Error("nuvem não configurada");
  const { error } = await c.auth.verifyOtp({ email, token: codigo, type: "email" });
  if (error) throw error;
}
export async function sairConta() {
  const c = await cliente();
  if (c) await c.auth.signOut();
  conta.value = null; metaNuvem.value = null;
}

/* chamado a cada save local; `forcar` ao pausar ou sair do app,
   senão no máximo um envio a cada 3 min */
export async function enviarMundo(m: { quando: string; heroi: string; nivel: number }, forcar = false) {
  if (!nuvemAtiva || !conta.value) return false;
  const agora = Date.now();
  if (!forcar && agora - ultimoEnvio < INTERVALO_AUTO) return false;
  ultimoEnvio = agora;
  const c = await cliente();
  if (!c || !conta.value) return false;
  nuvemOcupada.value = true;
  try {
    const { error } = await c.from("saves").upsert({
      user_id: conta.value.id, mundo: m, heroi: m.heroi, nivel: m.nivel, atualizado: m.quando,
    });
    if (error) { ultimoEnvio = 0; return false; }
    metaNuvem.value = { quando: m.quando, heroi: m.heroi, nivel: m.nivel };
    return true;
  } finally { nuvemOcupada.value = false; }
}

export async function baixarMundo(): Promise<unknown> {
  const c = await cliente();
  if (!c || !conta.value) throw new Error("entre na conta primeiro");
  nuvemOcupada.value = true;
  try {
    const { data, error } = await c.from("saves").select("mundo").eq("user_id", conta.value.id).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("não há partida na nuvem");
    return data.mundo;
  } finally { nuvemOcupada.value = false; }
}
