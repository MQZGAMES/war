/* Mesa de Guerra 3D — ponto de entrada.
   Ordem: preferências → motor WebGL → cena → entrada → mundo → laço → interface. */
import "@fontsource/cinzel/latin-700.css";
import "@fontsource/cinzel/latin-900.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/inter/latin-800.css";
import "./ui/styles.css";
import { render } from "preact";
import { App } from "./ui/App";
import { criarMotor, engine, qualidadeInicial, aplicarQualidade } from "./render/engine";
import { criarOverlay } from "./render/overlay";
import { iniciarCena, configurarSombra } from "./render/scene";
import { iniciarEntrada } from "./game/input";
import { iniciarLaco, laco } from "./game/loop";
import { carregarPref, ganchoSave, PREF } from "./sim/save";
import { conta, enviarMundo, iniciarNuvem } from "./net/nuvem";
/* guardado antes do Supabase limpar o endereço de volta do login */
const entrouPor = location.hash;
import { startWorld, criarHeroi, SETUP } from "./sim/session";
import { fotoPose } from "./render/portrait";
import { novoQuadro, PERF, step } from "./sim/step";
import { MERCADO } from "./sim/mercado";
import { G, W } from "./sim/state";
import { irPara } from "./ui/store";
import { ligarInterface, tick, abrirNpc, aviso } from "./ui/store";
import { volumes } from "./audio/sfx";

declare const __SINGLE__: boolean;

function iniciar() {
  carregarPref();
  G.autoCam = PREF.cam !== "livre";
  const palco = document.getElementById("palco")!;
  criarMotor(palco);
  const q = PREF.qualidade === "auto" ? qualidadeInicial() : PREF.qualidade;
  aplicarQualidade(q);
  criarOverlay(palco);
  iniciarCena();
  configurarSombra(engine.qual);
  iniciarEntrada(engine.canvas);
  volumes(PREF.som, PREF.musica);
  ligarInterface();
  startWorld();
  render(<App />, document.getElementById("ui")!);
  iniciarLaco();
  ganchoSave.aoSalvar = (m, forcar) => { void enviarMundo(m, forcar); };
  void iniciarNuvem().then((e) => { if (e) aviso(e, "#e0685a"); else if (conta.value && /access_token/.test(entrouPor)) aviso("Conectado à nuvem: " + conta.value.email, "#8fe6a8"); });
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__mesa = { engine, G, W, criarHeroi, irPara, laco, tick, abrirNpc, PREF, step, SETUP, startWorld, fotoPose, novoQuadro, PERF, MERCADO };
  const boot = document.getElementById("boot");
  if (boot) { boot.classList.add("fora"); setTimeout(() => boot.remove(), 700); }
  /* PWA: guarda o jogo para abrir offline (não no .html único nem no dev) */
  if (!__SINGLE__ && import.meta.env.PROD && "serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}
/* dois quadros para o "esculpindo o mundo" aparecer antes da geração */
requestAnimationFrame(() => requestAnimationFrame(iniciar));
