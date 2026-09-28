/* ================================================================
   [SYSTEM: TELAS] título, herói, como jogar, pausa, regras do mundo e
   ajustes. Todas por cima do mundo vivo; só bloqueiam o toque no mapa.
   ================================================================ */
import { useEffect, useRef, useState } from "preact/hooks";
import { G, W } from "../sim/state";
import { KINDS, NOMES_F, NOMES_M, TEAMS, VOCS, VOC_DESC, VOC_MATIZ, nomeAoAcaso, type Sexo, type VocKey } from "../sim/data";
import { SETUP, TAMANHO_MEGA, TAMANHO_ULTIMATE, JOGADORES_MAX, GUILDA_MAX, MONSTROS_MAX, MONSTROS_MIN, aplicarNoAtual, mudancasDeMundo, criarHeroi, largar, somaCfg, distribuirTotal, distribuirGuilda, desce10, sobe10, mudarTamanho, presetsMonstros, sortearVocacoes, startWorld, type Cfg } from "../sim/session";
import { PREF, salvarPref, salvarLocalMundo, temMundoLocal, apagarLocal, MUNDO_CHAVE, carregarMundo, mundoDe, baixarJson } from "../sim/save";
import { corPorMatiz } from "../sim/unit";
import { clamp } from "../sim/rng";
import { engine, qualidadeInicial } from "../render/engine";
import { mudarQualidade } from "../render/scene";
import { retratoVitrine } from "../render/portrait";
import { volumes, iniciarAudio } from "../audio/sfx";
import { tela, volta, irPara, atualizar, tick, aviso, retrato } from "./store";
import { Ico } from "./icons";
import { DoisToques, Lin, Passo, Seg, SimNao, clique, recusa } from "./comp";
import { retratoDe } from "../render/portrait";
import { conta, enviadoEm, metaNuvem, nuvemAtiva, nuvemOcupada } from "../net/nuvem";
import { abrirDaNuvem, dataNuvem, haQuanto, salvarNaNuvem } from "./conta";

/* ---------- título ---------- */
export function Titulo() {
  void tick.value;
  const m = temMundoLocal();
  const q = m && m.quando ? new Date(m.quando) : null;
  /* "Continuar" abre a partida mais nova: a do aparelho ou a da nuvem */
  const nv = metaNuvem.value;
  const daNuvem = !!nv && (!q || isNaN(+q) || +new Date(nv.quando) > +q + 1000);
  const [abrindo, setAbrindo] = useState(false);
  return (
    <div class="tela titulo-tela">
      <div class="titulo-box">
        <div class="logo">
          <div class="orn"><i /><Ico n="cruzadas" s={22} /><i /></div>
          <h1>Mesa de<br />Guerra</h1>
          <p>RPG de mundo aberto · diorama 3D</p>
        </div>
        <div class="menuT">
          {G.ctrl ? (
            <button class="go" onClick={() => { clique(); irPara("jogo"); }}>Voltar à partida<small>{G.ctrl.name} continua no comando</small></button>
          ) : (
            <button class="go" onClick={() => { iniciarAudio(); clique(); irPara("heroi"); }}>Jogar<small>escolha um herói e assuma o comando</small></button>
          )}
          {daNuvem && !G.ctrl && (
            <button class="go sec" disabled={abrindo} onClick={() => {
              iniciarAudio(); clique(); setAbrindo(true);
              abrirDaNuvem().catch((err) => aviso("A partida da nuvem não abriu: " + (err as Error).message, "#e0685a")).finally(() => setAbrindo(false));
            }}>{abrindo ? "Baixando…" : "Continuar"}<small>{(nv!.heroi ? nv!.heroi + " · " : "") + "nível " + (nv!.nivel || "?") + " · nuvem · " + dataNuvem(nv!.quando)}</small></button>
          )}
          {m && !daNuvem && !G.ctrl && (
            <button class="go sec" onClick={() => {
              iniciarAudio(); clique();
              try { carregarMundo(m); if (G.ctrl) retrato.value = retratoDe(G.ctrl); irPara(G.ctrl ? "jogo" : "heroi"); }
              catch (err) { apagarLocal(MUNDO_CHAVE); aviso("A partida guardada não abriu: " + (err as Error).message, "#e0685a"); atualizar(); }
            }}>Continuar<small>{(m.heroi ? m.heroi + " · " : "") + "nível " + (m.nivel || "?") + (q && !isNaN(+q) ? " · " + q.toLocaleDateString("pt-BR") : "")}</small></button>
          )}
          <div class="linha">
            <button class="go sec" onClick={() => { iniciarAudio(); clique(); irPara("jogo"); }}><Ico n="olho" s={20} />Assistir</button>
            <button class="go sec" onClick={() => { clique(); irPara("ajuda"); }}><Ico n="ajuda" s={20} />Como jogar</button>
          </div>
          <div class="linha">
            <button class="go sec" onClick={() => { clique(); irPara("mundo"); }}><Ico n="mundo" s={20} />Regras</button>
            <button class="go sec" onClick={() => { clique(); irPara("ajustes"); }}><Ico n="engrenagem" s={20} />Ajustes</button>
          </div>
          {nuvemAtiva && <button class="go sec" onClick={() => { clique(); irPara("conta"); }}><Ico n="nuvem" s={20} />{conta.value ? "Nuvem · " + conta.value.usuario : "Entrar para salvar na nuvem"}</button>}
          <p class="rodape">v1.0 · toque, teclado e mouse · funciona offline</p>
        </div>
      </div>
    </div>
  );
}

/* ---------- escolha do herói ---------- */
export function Heroi() {
  void tick.value;
  const [voc, setVoc] = useState<VocKey>(PREF.vocacao || "knight");
  const [sexo, setSexo] = useState<Sexo>(PREF.sexo || "m");
  const [nome, setNome] = useState(PREF.nome || nomeAoAcaso(PREF.sexo || "m"));
  const [imgs, setImgs] = useState<Record<string, string>>({});
  useEffect(() => {
    /* os retratos saem do renderizador: um por quadro para não travar a abertura */
    let i = 0, vivo = true;
    const um = () => {
      if (!vivo || i >= VOCS.length) return;
      const k = VOCS[i++];
      const s = retratoVitrine(k, corPorMatiz(VOC_MATIZ[k]), sexo);
      setImgs((o) => ({ ...o, [k + sexo]: s }));
      requestAnimationFrame(um);
    };
    requestAnimationFrame(um);
    return () => { vivo = false; };
  }, [sexo]);
  /* trocar o sexo troca o nome sorteado (o digitado fica) */
  const escolherSexo = (s: Sexo) => {
    setSexo(s);
    const base = nome.trim();
    if (!base || ((s === "f" ? NOMES_M : NOMES_F).indexOf(base) >= 0)) setNome(nomeAoAcaso(s));
  };
  const comecar = () => {
    const n = nome.trim().slice(0, 18);
    PREF.nome = n; PREF.vocacao = voc; PREF.sexo = sexo; salvarPref();
    const u = criarHeroi(voc, n, sexo);
    retrato.value = retratoDe(u);
    irPara("jogo");
    if (!PREF.ajudaVista) aviso("Arraste para andar · toque num inimigo para atacar · a mochila abre os painéis", "#f0cf6e");
  };
  const barra = (v: number) => ({ "--w": Math.round(v * 100) + "%" } as never);
  return (
    <div class="tela">
      <div class="cartao">
        <div class="cab"><h2>Escolha o herói</h2><button class="xis" aria-label="Voltar" onClick={() => { clique(); irPara("titulo"); }}><Ico n="fechar" s={18} /></button></div>
        <div class="corpo">
          <p class="dica" style={{ marginTop: 0 }}>Um aventureiro novo nasce no obelisco da cidade, com o kit da vocação. Os outros continuam vivendo no mundo, e você pode assumir qualquer um deles depois.</p>
          <div class="vocs">
            {VOCS.map((k) => {
              const K = KINDS[k];
              return (
                <button key={k} class="voc" aria-pressed={voc === k} onClick={() => { clique(); setVoc(k); }}>
                  {imgs[k + sexo] ? <img src={imgs[k + sexo]} alt="" /> : <span class="ph" />}
                  <b>{K.pt}</b>
                  <small>{VOC_DESC[k]}</small>
                  <span class="est">
                    <span>vida</span><i style={barra(K.hp / 155)} />
                    <span>dano</span><i style={barra(K.dmg / 32)} />
                    <span>alcance</span><i style={barra(K.range / 4)} />
                    <span>mana</span><i style={barra(K.mp / 125)} />
                  </span>
                </button>
              );
            })}
          </div>
          <Lin rot="Personagem"><Seg itens={[["m", "Masculino"], ["f", "Feminino"]] as [Sexo, string][]} valor={sexo} aoEscolher={escolherSexo} /></Lin>
          <div class="nome">
            <span>Nome</span>
            <input class="fin" maxLength={18} autocomplete="off" spellcheck={false} placeholder="nome do herói" value={nome}
              onInput={(e) => setNome((e.target as HTMLInputElement).value)} onKeyDown={(e) => { if (e.key === "Enter") comecar(); }} />
            <button class="btn" aria-label="Sortear nome" onClick={() => { clique(); setNome(nomeAoAcaso(sexo)); }}><Ico n="dado" s={20} /></button>
          </div>
          <p class="dica" style={{ marginTop: "10px" }}>{W.worldLivre ? "Regra do mundo: cada um por si. A cor do herói é sorteada e pode ser trocada na ficha." : "Regra do mundo: guildas. O herói entra na guilda " + TEAMS[0].name + "."}</p>
        </div>
        <div class="pe"><button class="go" onClick={() => { clique(); comecar(); }}>Começar a aventura</button></div>
      </div>
    </div>
  );
}

/* ---------- como jogar ---------- */
const AJ: [string, string, preact.ComponentChildren][] = [
  ["camLivre", "Mover", <>Arraste o polegar em qualquer lugar do mapa: o manche nasce onde o dedo cai. No teclado, <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> ou setas. Tocar no chão manda o personagem caminhar até lá.</>],
  ["espada", "Atacar", <>Toque num inimigo para travar o alvo, ou use o botão grande, que mira no mais próximo. Tocar de novo solta. Sem ordem, o auto ataque escolhe sozinho conforme o modo (botão da pata) e vai sozinho para a caça que mais rende.</>],
  ["paz", "PvP", <>O botão PvP ao lado da pata diz se personagens podem ser feridos. Desligado, nem a magia de área acerta outro jogador. Justiceiro, Maldoso e Todos ligam o PvP; tocar num personagem ou revidar um ataque também liga. Desligar volta o auto ataque para Criaturas.</>],
  ["magia", "Magias e poções", <>Quatro casas de magia ao lado do Atacar (troque na aba Magias). Magia de área pede um toque no chão; com alvo marcado, já mira nele. Os frascos bebem poções; a aba Cura deixa isso automático. Teclas <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd>, <kbd>Q</kbd><kbd>E</kbd>, <kbd>F</kbd>.</>],
  ["cidade", "Cidade e zona de proteção", <>Todo o calçamento é PZ: ninguém ataca nem é atacado, e criatura não entra. Feiticeiro vende poções, Comerciante compra e vende itens de +1 a +10, Banqueiro guarda ouro e 50 itens. O minimapa leva até lá com um toque.</>],
  ["caveira", "Caveiras e trava", <>Agredir quem não te atacou dá caveira branca e tranca a cidade por 30 s; matar por agressão tranca 2 min. Três mortes injustas em uma hora trazem a caveira vermelha. Bater em criatura nunca trava.</>],
  ["coracao", "Morte", <>Perde 1 nível, a mochila inteira e o ouro fora do banco, com 10% de chance de perder um item vestido. Volta ao obelisco em 9 s. Deposite no Banqueiro antes de arriscar.</>],
  ["mochila", "Automação", <>Na mochila: auto cura, auto refil (repõe poções, vende o loot, compra equipamento e forja no Ferreiro), auto equipar, modos de auto ataque, atributos por nível (seguem a proporção que você pôs à mão), equipe e ficha. O personagem se vira mesmo quando você só assiste.</>],
  ["nuvem", "Nuvem", <>Crie uma conta com usuário e senha em Nuvem. A partida sobe sozinha a cada 5 minutos de jogo e ao fechar o app; no menu, Salvar na nuvem sobe na hora. Em outro aparelho, entre com a mesma conta e toque em Continuar.</>],
  ["equipe", "Equipe", <>Na aba Equipe, convide quem estiver sem grupo. Liderar faz o grupo seguir você: cavaleiros à frente, o resto atrás, todos no seu alvo.</>],
  ["olho", "Câmera", <>Pinça ou roda do mouse dá zoom. Com a câmera em Livre, o dedo arrasta a vista; botão direito do mouse também. <kbd>Esc</kbd> ou <kbd>Espaço</kbd> abre o menu e pausa. O dia vira noite a cada nove minutos.</>],
];
export function Ajuda() {
  void tick.value;
  return (
    <div class="tela">
      <div class="cartao">
        <div class="cab"><h2>Como jogar</h2><button class="xis" aria-label="Voltar" onClick={() => { clique(); irPara(volta.value); }}><Ico n="fechar" s={18} /></button></div>
        <div class="corpo">
          {AJ.map(([i, t, p]) => <div key={t} class="aj"><div class="ai"><Ico n={i} s={22} /></div><div><b>{t}</b><p>{p}</p></div></div>)}
        </div>
        <div class="pe"><button class="go" onClick={() => { clique(); irPara(volta.value); }}>Entendi</button></div>
      </div>
    </div>
  );
}

/* ---------- pausa ---------- */
export function Menu() {
  void tick.value;
  const [msg, setMsg] = useState("O jogo guarda a partida sozinho a cada minuto e ao pausar. O arquivo .json leva o mundo inteiro: regra, semente do mapa, grupos, guerras e cada aventureiro.");
  const arq = useRef<HTMLInputElement>(null);
  return (
    <div class="tela">
      <div class="cartao">
        <div class="cab"><h2>Pausa</h2><button class="xis" aria-label="Continuar" onClick={() => { clique(); irPara("jogo"); }}><Ico n="play" s={18} /></button></div>
        <div class="corpo">
          <div class="secao">Partida</div>
          <div class="grade2">
            <button class="cb" onClick={() => { clique(); irPara("ajuda"); }}><Ico n="ajuda" s={20} /><b>Como jogar</b><small>controles e regras</small></button>
            <button class="cb" onClick={() => { clique(); irPara("jogo"); G.autoCam = false; engine.cam.x = W.cidade.x; engine.cam.y = W.cidade.y; }}><Ico n="cidade" s={20} /><b>Ver a cidade</b><small>centraliza a câmera</small></button>
            <button class="cb" onClick={() => { clique(); irPara("heroi"); }}><Ico n="mais" s={20} /><b>Novo herói</b><small>outro personagem</small></button>
            <DoisToques cls="cb sair" disabled={!G.ctrl} acao={() => { largar(); irPara("jogo"); }} filhos={<><Ico n="olho" s={20} /><b>Largar o comando</b><small>dois toques · assistir</small></>} armado={<><b>Toque de novo</b><small>volta a assistir</small></>} />
            <button class="cb cheio" onClick={() => { clique(); irPara("ajustes"); }}><Ico n="engrenagem" s={20} /><b>Ajustes</b><small>qualidade, som, música, câmera, dia e noite</small></button>
          </div>
          <div class="secao">Salvar e carregar</div>
          <div class="grade2">
            <button class="cb ouro" onClick={(e) => {
              const ok = salvarLocalMundo("nao");
              if (!ok) recusa(e.currentTarget as HTMLElement); else clique();
              setMsg(ok ? "Partida guardada neste aparelho. Ela volta em “Continuar”, na tela inicial." : G.ctrl ? "Não deu para guardar aqui (sem espaço ou armazenamento bloqueado). Use Salvar arquivo." : "Assuma um herói antes de guardar a partida.");
            }}><Ico n="salvar" s={20} /><b>Guardar no aparelho</b><small>volta em “Continuar”</small></button>
            <button class="cb" onClick={() => {
              clique();
              const m = mundoDe(); const d = new Date(), p = (n: number) => String(n).padStart(2, "0");
              baixarJson(m, "mundo-" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes()) + ".json");
              setMsg("Mundo salvo com " + m.jogadores.length + " aventureiros. Guarde o arquivo: é ele que volta em Carregar.");
            }}><Ico n="baixar" s={20} /><b>Salvar arquivo</b><small>baixa um .json</small></button>
            <DoisToques cls="cb" acao={() => { if (arq.current) { arq.current.value = ""; arq.current.click(); } }} filhos={<><Ico n="carregar" s={20} /><b>Carregar arquivo</b><small>dois toques</small></>} armado={<><b>Toque de novo</b><small>substitui o mundo atual</small></>} />
            <DoisToques cls="cb" acao={() => { apagarLocal(MUNDO_CHAVE); setMsg("Partida guardada apagada deste aparelho."); }} filhos={<><Ico n="fechar" s={20} /><b>Apagar do aparelho</b><small>dois toques</small></>} armado={<><b>Toque de novo</b><small>apaga a partida guardada</small></>} />
            {nuvemAtiva && conta.value && <button class="cb ouro" disabled={nuvemOcupada.value} onClick={(e) => {
              const el = e.currentTarget as HTMLElement;
              if (!G.ctrl) { recusa(el); setMsg("Assuma um herói antes de salvar na nuvem."); return; }
              clique(); setMsg("Enviando para a nuvem…");
              salvarNaNuvem().then(() => setMsg("Partida salva na nuvem (" + conta.value!.usuario + ").")).catch((err) => { recusa(el); setMsg("A nuvem não confirmou: " + (err as Error).message + "."); });
            }}><Ico n="nuvem" s={20} /><b>Salvar na nuvem</b><small>{nuvemOcupada.value ? "enviando…" : enviadoEm.value ? "última: " + haQuanto(enviadoEm.value) : "sozinha a cada 5 min"}</small></button>}
            {nuvemAtiva && <button class={"cb" + (conta.value ? "" : " cheio")} onClick={() => { clique(); irPara("conta"); }}><Ico n="nuvem" s={20} /><b>{conta.value ? "Conta" : "Nuvem"}</b><small>{conta.value ? conta.value.usuario + (metaNuvem.value ? " · " + dataNuvem(metaNuvem.value.quando) : "") : "entre para levar a partida a outro aparelho"}</small></button>}
          </div>
          <input ref={arq} type="file" accept=".json,application/json" hidden onChange={() => {
            const f = arq.current && arq.current.files && arq.current.files[0];
            if (!f) return;
            const fr = new FileReader();
            fr.onload = () => {
              try { const n = carregarMundo(JSON.parse(String(fr.result))); if (G.ctrl) retrato.value = retratoDe(G.ctrl); irPara(G.ctrl ? "jogo" : "heroi"); aviso("Mundo carregado: " + n + " aventureiros de volta", "#8fe6a8"); }
              catch (err) { setMsg(err instanceof SyntaxError ? "Esse arquivo não é um mundo legível." : "Não deu para carregar: " + (err as Error).message + "."); }
            };
            fr.readAsText(f);
          }} />
          <p class="dica">{msg}</p>
          <div class="secao">Mundo</div>
          <div class="grade2">
            <button class="cb" onClick={() => { clique(); irPara("mundo"); }}><Ico n="mundo" s={20} /><b>Regras do mundo</b><small>gerar um mundo novo</small></button>
            <button class="cb" onClick={() => { clique(); irPara("titulo"); }}><Ico n="voltar" s={20} /><b>Tela inicial</b><small>o mundo continua</small></button>
          </div>
        </div>
        <div class="pe"><button class="go" onClick={() => { clique(); irPara("jogo"); }}>Continuar</button></div>
      </div>
    </div>
  );
}

/* ---------- [SYSTEM: WORLD_SETUP] regras do mundo ---------- */
function LinhaRoster({ c, nome, cor, teto }: { c: Cfg; nome: string; cor: string; teto: number }) {
  void tick.value;
  const ICOV: Record<VocKey, string> = { knight: "espada", archer: "arco", mage: "cajado", druid: "folha" };
  return (
    <div class="exercito" style={{ borderLeftColor: cor }}>
      <span class="nm" style={{ color: cor }}>{nome} <span class="tot">· {somaCfg(c)} no total</span></span>
      <div class="passos">
        {VOCS.map((k) => (
          <div key={k} class="passoV" title={KINDS[k].pt}>
            <Ico n={ICOV[k]} s={16} />
            <button aria-label={"Menos " + KINDS[k].pt} onClick={() => { clique(); c[k] = clamp(c[k] - 1, 0, teto); SETUP.sujo = true; atualizar(); }}><Ico n="menos" s={14} /></button>
            <b>{c[k]}</b>
            <button aria-label={"Mais " + KINDS[k].pt} onClick={() => { clique(); c[k] = clamp(c[k] + 1, 0, teto); SETUP.sujo = true; atualizar(); }}><Ico n="mais" s={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
/* número exato, de 10 em 10: segurar o botão repete */
function Exato({ rot, valor, min, max, aoMudar }: { rot: string; valor: number; min: number; max: number; aoMudar: (v: number) => void }) {
  return (
    <div class="exato">
      <span>{rot}<small>de 10 em 10</small></span>
      <Passo valor={valor} larg={52} podeMenos={valor > min} podeMais={valor < max}
        menos={() => aoMudar(desce10(valor, min))} mais={() => aoMudar(sobe10(valor, max))} />
    </div>
  );
}
export function Mundo() {
  void tick.value;
  const suja = () => { SETUP.sujo = true; atualizar(); };
  const gerar = () => { startWorld(); retrato.value = ""; irPara("heroi"); };
  const estrut = mudancasDeMundo();
  return (
    <>
      <div class="folhaFundo" onClick={() => irPara(volta.value)} />
      <div class="folha">
        <div class="cab" style={{ padding: "0 0 10px" }}><h2>Regras do mundo</h2><button class="xis" aria-label="Fechar" onClick={() => { clique(); irPara(volta.value); }}><Ico n="fechar" s={18} /></button></div>
        <Lin col rot="Regra"><Seg cls="" itens={[[1, "Cada um por si"], [0, "Guildas"]]} valor={SETUP.livre ? 1 : 0} aoEscolher={(v) => { SETUP.livre = v === 1; suja(); }} /></Lin>
        <p class="dica">{SETUP.livre ? "Cada um tem a própria cor. Ninguém é aliado fora da equipe montada por convite, mas também ninguém é inimigo até alguém atacar." : "Os membros usam tons parecidos da cor da guilda, se poupam e se curam. Guildas entram em guerra de tempos em tempos."}</p>
        {SETUP.livre ? <>
          <Lin col rot="Aventureiros da IA"><Seg itens={[[8, "8"], [16, "16"], [24, "24"], [32, "32"], [50, "50"]]} valor={somaCfg(SETUP.cfgLivre)} aoEscolher={(v) => { distribuirTotal(v); suja(); }} /></Lin>
          <Exato rot="Número exato" valor={somaCfg(SETUP.cfgLivre)} min={0} max={JOGADORES_MAX} aoMudar={(v) => { distribuirTotal(v); suja(); }} />
          <LinhaRoster c={SETUP.cfgLivre} nome="Aventureiros da IA" cor="#d9b45c" teto={40} />
        </> : <>
          <Lin col rot="Número de guildas"><Seg itens={[[2, "2"], [3, "3"], [4, "4"]]} valor={SETUP.guildas} aoEscolher={(v) => { SETUP.guildas = v; suja(); }} /></Lin>
          {Array.from({ length: SETUP.guildas }, (_, t) => <div key={t}>
            <Exato rot={"Membros · " + TEAMS[t].name} valor={somaCfg(SETUP.cfgGuilda[t])} min={0} max={GUILDA_MAX} aoMudar={(v) => { distribuirGuilda(t, v); suja(); }} />
            <LinhaRoster c={SETUP.cfgGuilda[t]} nome={TEAMS[t].name} cor={TEAMS[t].c} teto={GUILDA_MAX / 2} />
          </div>)}
        </>}
        <button class="btn" style={{ width: "100%", marginTop: "6px" }} onClick={() => { clique(); sortearVocacoes(); suja(); }}><Ico n="dado" s={18} />Sortear vocações</button>
        <Lin col rot="Tamanho do mundo" sub={SETUP.tamanho === TAMANHO_ULTIMATE ? "Ultimate: " + TAMANHO_ULTIMATE + "² ladrilhos, o triplo da área do Mega. Cidade murada com lojas e casas, e oito biomas: campos, floresta, pântano, deserto, neve, montanhas, terras malditas e vulcânicas." : SETUP.tamanho === TAMANHO_MEGA ? "Mega: " + TAMANHO_MEGA + "² ladrilhos, mais pontos de caça e viagens longas." : undefined}>
          <Seg itens={[[72, "72²"], [96, "96²"], [128, "128²"], [TAMANHO_MEGA, "Mega"], [TAMANHO_ULTIMATE, "Ultimate"]]} valor={SETUP.tamanho} aoEscolher={(v) => { mudarTamanho(v); suja(); }} /></Lin>
        <Lin col rot="Monstros no mundo" sub="Mesmo em Poucos, todas as 25 criaturas aparecem.">
          <Seg itens={presetsMonstros(SETUP.tamanho).map((v, i) => [v, ["Poucos", "Normal", "Muitos"][i]] as [number, string])} valor={SETUP.monstros} aoEscolher={(v) => { SETUP.monstros = v; suja(); }} /></Lin>
        <Exato rot="Número exato" valor={SETUP.monstros} min={MONSTROS_MIN} max={MONSTROS_MAX} aoMudar={(v) => { SETUP.monstros = v; suja(); }} />
        <div style={{ height: "8px" }} />
        {SETUP.sujo && <>
          <div class="secao">Onde aplicar as mudanças?</div>
          <button class="go" disabled={!!estrut.length} onClick={() => {
            clique();
            const r = aplicarNoAtual();
            if (r) aviso("Mundo atual ajustado" + (r.entraram ? " · " + r.entraram + " chegaram" : "") + (r.sairam ? " · " + r.sairam + " partiram" : ""), "#8fe6a8");
            irPara(volta.value);
          }}>Aplicar no mundo atual<small>{estrut.length ? "precisa de mundo novo: " + estrut.join(", ") : "jogadores e criaturas mudam sem perder o que já aconteceu"}</small></button>
          <div style={{ height: "8px" }} />
        </>}
        {G.ctrl
          ? <DoisToques cls={SETUP.sujo ? "go sec" : "go"} acao={gerar} filhos={<>Gerar mundo novo<small>{SETUP.sujo ? "com as mudanças; o mundo atual se perde" : "outra cidade e outros pontos de caça"}</small></>} armado="Toque de novo: o mundo atual se perde" />
          : <button class={SETUP.sujo ? "go sec" : "go"} onClick={() => { clique(); gerar(); }}>Gerar mundo novo<small>{SETUP.sujo ? "com as mudanças" : "outra cidade e outros pontos de caça"}</small></button>}
        <p class="dica">{SETUP.sujo ? (estrut.length ? "Mudar " + estrut.join(" e ") + " só vale num mundo novo." : "Aplicar no atual mantém mapa, níveis, itens e grupos: quem sobra sai (primeiro quem está na cidade) e quem falta nasce no obelisco, no nível 1.") : "Um mundo novo sorteia outra cidade e outros pontos de caça. Depois você escolhe o herói."}</p>
        <p class="dica">Todo o calçamento da cidade é zona de proteção. Bater em criatura não trava; agredir um personagem que não te atacou trava 30 s, e matar por agressão trava 2 min. Morrer tira 1 nível, a mochila e o ouro fora do banco, com 10% de chance de perder 1 item equipado.</p>
      </div>
    </>
  );
}

/* ---------- ajustes ---------- */
export function Ajustes() {
  void tick.value;
  const s = (f: () => void) => { f(); salvarPref(); atualizar(); };
  const telaCheia = () => {
    const d = document as Document & { webkitFullscreenElement?: Element };
    if (d.fullscreenElement || d.webkitFullscreenElement) document.exitFullscreen?.();
    else (document.documentElement.requestFullscreen?.({ navigationUI: "hide" }) as Promise<void> | undefined)?.catch(() => {});
  };
  return (
    <div class="tela">
      <div class="cartao">
        <div class="cab"><h2>Ajustes</h2><button class="xis" aria-label="Voltar" onClick={() => { clique(); irPara(volta.value); }}><Ico n="fechar" s={18} /></button></div>
        <div class="corpo">
          <div class="secao">Imagem</div>
          <Lin col rot="Qualidade" sub="Automática ajusta sozinha pelo desempenho do aparelho.">
            <Seg itens={[["auto", "Auto"], ["baixa", "Baixa"], ["media", "Média"], ["alta", "Alta"]]} valor={PREF.qualidade} aoEscolher={(v) => s(() => {
              PREF.qualidade = v as typeof PREF.qualidade;
              engine.resScale = 1;
              mudarQualidade(v === "auto" ? qualidadeInicial() : v as "baixa" | "media" | "alta");
            })} />
          </Lin>
          <Lin rot="Efeitos de tela" sub="tremor ao apanhar e nas explosões"><SimNao valor={PREF.efeitos} aoEscolher={(v) => s(() => { PREF.efeitos = v; })} /></Lin>
          <Lin rot="Vibrar ao apanhar" sub="só em aparelhos que vibram"><SimNao valor={PREF.vibrar} aoEscolher={(v) => s(() => { PREF.vibrar = v; })} /></Lin>
          <Lin rot="Dia e noite" sub="um dia inteiro a cada nove minutos"><SimNao valor={PREF.diaNoite} aoEscolher={(v) => s(() => { PREF.diaNoite = v; })} /></Lin>
          <Lin rot="Câmera" sub="automática segue o herói; livre deixa arrastar a vista"><Seg itens={[[1, "Segue"], [0, "Livre"]]} valor={G.autoCam ? 1 : 0} aoEscolher={(v) => s(() => { G.autoCam = !!v; PREF.cam = v ? "auto" : "livre"; })} /></Lin>
          <Lin rot="Tela cheia"><button class="btn" onClick={() => { clique(); telaCheia(); }}><Ico n="tela" s={18} />Alternar</button></Lin>
          <div class="secao">Som</div>
          <Lin col rot={<>Efeitos sonoros <b>{Math.round(PREF.som * 100)}%</b></>}>
            <input class="faixaRange" type="range" min={0} max={100} value={Math.round(PREF.som * 100)} onInput={(e) => s(() => { iniciarAudio(); PREF.som = +(e.target as HTMLInputElement).value / 100; volumes(PREF.som, PREF.musica); })} />
          </Lin>
          <Lin col rot={<>Música e ambiente <b>{Math.round(PREF.musica * 100)}%</b></>}>
            <input class="faixaRange" type="range" min={0} max={100} value={Math.round(PREF.musica * 100)} onInput={(e) => s(() => { iniciarAudio(); PREF.musica = +(e.target as HTMLInputElement).value / 100; volumes(PREF.som, PREF.musica); })} />
          </Lin>
          <p class="dica">Todo o som é sintetizado na hora — nenhum arquivo de áudio. A música acompanha o dia, a noite e o combate.</p>
        </div>
        <div class="pe"><button class="go" onClick={() => { clique(); irPara(volta.value); }}>Pronto</button></div>
      </div>
    </div>
  );
}
void tela;
