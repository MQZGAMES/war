/* ================================================================
   HUD — quadro do personagem, minimapa com a seta da cidade, avisos,
   faixa central, aglomerado de ação no polegar direito, poções,
   espectador e ficha de seleção. Atualiza no relógio da interface.
   ================================================================ */
import { useEffect, useRef, useState } from "preact/hooks";
import { G, W } from "../sim/state";
import { EXA, KINDS, PERFIL_NOME, TEAMS, VERMELHA_N, ATQ_ICONE, type SpellKey } from "../sim/data";
import { pzAtiva, pzMorte, pzRestante, exaustoEm } from "../sim/pk";
import { magiaDe, slotDe } from "../sim/spells";
import { REFIL_TXT, avisoPz, cacaAtual, desligarPvp, ligarPvp } from "../sim/player";
import { portaoPara } from "../sim/map";
import { inimigo, odeia } from "../sim/relations";
import { corTier, TATICAS } from "../sim/world";
import { xpNeed } from "../sim/combat";
import { avisoDe } from "../sim/fx";
import { assumir } from "../sim/session";
import { temaDaZona } from "../render/terrain";
import { BIO_COR } from "../sim/biomas";
import { engine } from "../render/engine";
import { tick, painel, avisos, faixa, popXp, popOuro, retrato, abrirDeck, fecharDeck, atacar, usarSlot, beber, atualizar, irPara } from "./store";
import { Ico } from "./icons";
import { Barra, fmt, clique } from "./comp";
import { Grade } from "./itens";
import { Deck } from "./deck";

const ICO_MAGIA: Record<SpellKey, string> = { investida: "investida", triplo: "triplo", meteoro: "meteoro", trevas: "trevas", terremoto: "terremoto", nevasca: "nevasca", chuva: "chuva", cura: "cura", certeiro: "certeiro", bumerangue: "bumerangue", veneno: "veneno", bolaFogo: "bolaFogo", relampago: "relampago" };
const CLS_MAGIA: Record<SpellKey, string> = { investida: "m-terra", triplo: "m-arco", meteoro: "m-fogo", trevas: "m-trevas", terremoto: "m-terra", nevasca: "m-gelo", chuva: "m-cura", cura: "m-cura", certeiro: "m-arco", bumerangue: "m-terra", veneno: "m-veneno", bolaFogo: "m-fogo", relampago: "m-raio" };
const mmss = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };

export function Hud() {
  void tick.value;
  const c = G.ctrl;
  const deck = !!painel.value;
  return (
    <div class={"hud" + (deck ? " comDeck" : "")}>
      <div class="moldura" />
      <Vinheta />
      {c ? <Quadro /> : G.sel && !G.sel.dead ? <Inspecao /> : null}
      <Avisos />
      <FaixaC />
      <Minimapa />
      <div class="topo">
        <button class="redondo" aria-label="Menu" onClick={() => { clique(); irPara("menu"); }}><Ico n="pausa" s={18} /></button>
        <button class={"redondo" + (G.autoCam ? " on" : "")} aria-label="Câmera" onClick={() => { clique(); G.autoCam = !G.autoCam; atualizar(); }}><Ico n={G.autoCam ? "camAuto" : "camLivre"} s={20} /></button>
      </div>
      {c && <Acao />}
      {c && G.mirandoSlot >= 0 && (
        <div class="mirando">Toque onde a magia deve cair
          <button class="btn" onClick={() => { G.mirandoSlot = -1; atualizar(); }}>Cancelar</button></div>
      )}
      {c && G.convidando && (
        <div class="mirando">Toque em quem chamar para a equipe
          <button class="btn" onClick={() => { G.convidando = false; atualizar(); }}>Cancelar</button></div>
      )}
      {!c && (
        <div class="espec"><span>Modo espectador · toque num aventureiro para vê-lo</span>
          <button class="btn on" onClick={() => { clique(); irPara("heroi"); }}>Novo herói</button></div>
      )}
      {c && deck && <Deck />}
    </div>
  );
}

/* ---------- quadro do personagem ---------- */
let ghost = 100, ghostU = 0;
function Quadro() {
  void tick.value;
  const u = G.ctrl!;
  const morto = u.dead;
  const fr = Math.max(0, Math.min(1, u.hp / u.maxHp)), pct = fr * 100;
  if (ghostU !== u.id) { ghostU = u.id; ghost = pct; }
  if (pct >= ghost) ghost = pct; else ghost += (pct - ghost) * .35;
  const r = u.refil, cacaZ = cacaAtual();
  const sub = morto ? "caído · volta em " + Math.max(0, Math.ceil(u.reborn - W.simTime)) + " s"
    : G.mirandoSlot >= 0 ? "toque onde a magia deve cair"
      : G.convidando ? "toque em quem chamar"
        : r ? (r.fase === "isolar" ? "auto refil · esperando a trava (" + Math.ceil(pzRestante(u)) + " s)"
          : r.fase === "rota" ? "auto refil · " + (REFIL_TXT[r.rota[r.i]] || "na cidade")
            : r.fase === "esperar" ? "auto refil · esperando o grupo" : "auto refil · voltando à caça")
          : cacaZ && !u.target && Math.hypot(u.x - cacaZ.x, u.y - cacaZ.y) > cacaZ.r + 3 ? "indo caçar · " + cacaZ.name
            : u.K.pt + " · " + u.st.t;
  const p = u.party, n = p ? p.membros.length : 1, seg = Math.ceil(pzRestante(u));
  return (
    <div class="pcard" onClick={() => { clique(); painel.value ? fecharDeck() : abrirDeck("equip"); }}>
      <div class="pc1">
        <span class="av" style={{ borderColor: u.cor.hi, background: `radial-gradient(circle at 34% 28%, ${u.cor.hi}66, ${u.cor.lo})` }}>
          {retrato.value && <img src={retrato.value} alt="" />}
          <span class="lvl">{u.lvl}</span>
        </span>
        <span class="pnm"><b style={{ color: u.cor.hi }}>{u.name}</b><i>{sub}</i></span>
      </div>
      <Barra cls={"hp" + (fr < .35 ? " baixo" : "")} v={u.hp} max={u.maxHp} txt={Math.max(0, Math.round(u.hp)) + " / " + Math.round(u.maxHp)} fantasma={ghost} />
      {u.maxMp > 0 && <Barra cls="mp" v={u.mp} max={u.maxMp} />}
      <Barra cls="xp" v={u.xp} max={xpNeed(u.lvl)} />
      <div class="chips">
        <span class="ouro"><Ico n="ouro" s={12} />{fmt(u.ouro)}</span>
        {u.pz ? <span class="pz">cidade · PZ</span> : pzAtiva(u) ? <span class={pzMorte(u) ? "morte" : "luta"}>trava {seg}s</span> : null}
        {!u.pz && u.zonaAtual && <span style={{ color: corTier(u.zonaAtual.tier) }}>{u.zonaAtual.name} · {u.zonaAtual.tier}</span>}
        {u.skull === "red" ? <span class="morte">vermelha {mmss(u.vermelhaAte - Date.now())}</span> : u.skull === "white" ? <span class="branca">caveira branca</span> : null}
        {u.injustas > 0 && <span class="luta">injustas {u.injustas}/{VERMELHA_N}</span>}
        {W.worldLivre && n > 1 && <span class="pz">equipe {n}</span>}
      </div>
      <Pop />
    </div>
  );
}
function Pop() {
  void tick.value;
  const x = popXp.value, o = popOuro.value;
  return (
    <>
      {x.id > 0 && <span key={"x" + x.id} class="pop xp">+{x.v} exp</span>}
      {o.id > 0 && <span key={"o" + o.id} class="pop ouro">{o.v >= 0 ? "+" : "−"}{fmt(Math.abs(o.v))}</span>}
    </>
  );
}
function Vinheta() {
  void tick.value;
  const u = G.ctrl;
  const on = !!u && !u.dead && u.hp / u.maxHp < .3;
  return <div class={"vinheta" + (on ? " on" : "")} />;
}
function Avisos() {
  void tick.value;
  const agora = performance.now();
  const l = avisos.value.filter((a) => a.ate > agora);
  return <div class={"avisos" + (G.ctrl ? "" : " esp")}>{l.map((a) => <div key={a.id} style={{ color: a.cor }}>{a.txt}</div>)}</div>;
}
function FaixaC() {
  void tick.value;
  const f = faixa.value;
  if (!f) return null;
  return <div key={f.id} class={"faixa " + f.cls}><b>{f.tit}</b>{f.sub && <small>{f.sub}</small>}</div>;
}

/* ---------- aglomerado de ação ---------- */
function Acao() {
  void tick.value;
  const u = G.ctrl!, morto = u.dead;
  const alvo = u.alvoManual && !u.alvoManual.dead ? u.alvoManual : null;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const nega = (i: number) => { const b = refs.current[i]; if (b) { b.classList.remove("nao"); void b.offsetWidth; b.classList.add("nao"); } };
  const exPo = exaustoEm(u, "pocao");
  const A = G.AUTO.ataque;
  return (
    <>
      <div class="acao">
        {[0, 1, 2, 3].map((i) => {
          const k = slotDe(u, i), m = magiaDe(u, k), ex = exaustoEm(u, k), falta = u.mp < m.custo;
          const cd = ex > 0 ? Math.round(ex / (EXA[k] || 2) * 100) : 0;
          return (
            <button key={i} ref={(el) => { refs.current[i] = el; }} class={"ab s" + i + " " + CLS_MAGIA[k] + (G.mirandoSlot === i ? " on" : "")}
              style={{ "--cd": cd + "%" } as never} disabled={morto || ex > 0 || falta}
              onClick={() => { if (!usarSlot(i)) nega(i); }} aria-label={m.nome}>
              <Ico n={ICO_MAGIA[k]} s={24} />
              <small>{ex > 0 ? Math.ceil(ex) + "s" : falta ? "mana" : m.custo}</small>
            </button>
          );
        })}
        <button ref={(el) => { refs.current[3] = el; }} class={"ab atk" + (alvo ? " mira" : "")} disabled={morto} onClick={() => { if (!atacar()) nega(3); }}>
          <Ico n={alvo ? "alvo" : u.isArcher ? "arco" : u.kind === "mage" || u.kind === "druid" ? "cajado" : "espada"} s={28} />
          <b>{alvo ? "Soltar" : "Atacar"}</b>
          <small style={{ maxWidth: "76px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{alvo ? alvo.name : "mais perto"}</small>
        </button>
      </div>
      <div class="pocoes">
        <button ref={(el) => { refs.current[4] = el; }} class="ab hp" style={{ "--cd": (exPo > 0 ? Math.round(exPo / EXA.pocao * 100) : 0) + "%" } as never}
          disabled={morto || u.potHp <= 0 || exPo > 0 || u.hp >= u.maxHp} onClick={() => { if (!beber("hp")) nega(4); }} aria-label="Poção de vida">
          <Ico n="frasco" s={22} /><small>{u.potHp}</small></button>
        {u.maxMp > 0 && <button ref={(el) => { refs.current[5] = el; }} class="ab mp" style={{ "--cd": (exPo > 0 ? Math.round(exPo / EXA.pocao * 100) : 0) + "%" } as never}
          disabled={morto || u.potMp <= 0 || exPo > 0 || u.mp >= u.maxMp} onClick={() => { if (!beber("mp")) nega(5); }} aria-label="Poção de mana">
          <Ico n="frasco" s={22} /><small>{u.potMp}</small></button>}
      </div>
      <button class={"redondo atqm" + (A.modo !== "desligado" || A.revidar ? " ativo" : "") + (A.modo === "maldoso" || A.modo === "todos" ? " maldoso" : "")}
        style={{ position: "absolute", pointerEvents: "auto" }} aria-label="Auto ataque"
        onClick={() => { clique(); painel.value === "ataque" ? fecharDeck() : abrirDeck("ataque"); }}>
        <Ico n={{ desligado: "proibido", criaturas: "pata", justiceiro: "balanca", maldoso: "caveira", todos: "cruzadas" }[A.modo]} s={20} />
      </button>
      {/* [SYSTEM: PVP] liga e desliga o dano em personagens */}
      <button class={"redondo pvpb" + (A.pvp ? " on" : "")} style={{ position: "absolute", pointerEvents: "auto" }} aria-pressed={!!A.pvp} aria-label={"PvP " + (A.pvp ? "ligado" : "desligado")}
        onClick={() => {
          clique();
          if (A.pvp) {
            const antes = A.modo;
            desligarPvp(u);
            avisoDe(u, "PvP desligado · ninguém é ferido" + (antes !== A.modo ? " · auto ataque em Criaturas" : ""), "#8fe6a8");
          } else ligarPvp(u, "magia de área e revide acertam personagens");
        }}>
        <Ico n={A.pvp ? "cruzadas" : "paz"} s={20} />
      </button>
      <button class="redondo hub" style={{ position: "absolute", pointerEvents: "auto" }} aria-label="Painéis"
        onClick={() => { clique(); painel.value ? fecharDeck() : abrirDeck("equip"); }}>
        <Ico n="mochila" s={24} />{u.pts > 0 && <span class="pt">{u.pts}</span>}
      </button>
    </>
  );
}
void ATQ_ICONE;

/* ---------- [SYSTEM: MINIMAPA] mundo inteiro num círculo, girado como a tela ---------- */
let base: HTMLCanvasElement | null = null, baseV = -1;
function construirBase() {
  const N = W.N;
  base = document.createElement("canvas"); base.width = base.height = N;
  const g = base.getContext("2d")!, img = g.createImageData(N, N), d = img.data;
  const CH = [[64, 110, 52], [72, 122, 58], [82, 132, 64], [92, 142, 70], [150, 140, 120], [132, 123, 106], [150, 78, 60], [104, 98, 88]];
  /* no Ultimate o chão tem a cor do bioma (o tom varia um pouco pelo ruído) */
  const bio = W.bioma.length ? W.bioma : null;
  const BC = BIO_COR.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, c = W.tileCol[i];
    let r: number, gg: number, b: number;
    if (c === 200) { r = 52; gg = 120; b = 140; }
    else if (bio && c < 4) { const t = BC[bio[i]], k = .9 + c * .05; r = t[0] * k; gg = t[1] * k; b = t[2] * k; }
    else { const t = CH[c] || CH[0]; r = t[0]; gg = t[1]; b = t[2]; }
    if (W.solid[i] && c !== 200 && !W.pzMask[i]) { r = (r * .55) | 0; gg = (gg * .55) | 0; b = (b * .55) | 0; }
    d[i * 4] = r; d[i * 4 + 1] = gg; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  for (const z of W.zones) {
    if (z.errante) continue;
    g.globalAlpha = .45; g.fillStyle = temaDaZona(z.name);
    g.beginPath(); g.arc(z.x, z.y, z.r + 1, 0, 7); g.fill();
    g.globalAlpha = .9; g.strokeStyle = corTier(z.tier); g.lineWidth = .8;
    g.beginPath(); g.arc(z.x, z.y, z.r + 1, 0, 7); g.stroke();
  }
  g.globalAlpha = 1;
  baseV = W.mapaVersao;
}
function Minimapa() {
  void tick.value;
  const cv = useRef<HTMLCanvasElement>(null);
  const [ang, setAng] = useState(0);
  const u = G.ctrl, ref = u && !u.dead ? u : G.sel && !G.sel.dead ? G.sel : null;
  useEffect(() => {
    const c = cv.current;
    if (!c || !W.cidade) return;
    if (baseV !== W.mapaVersao || !base) construirBase();
    const S = c.width, g = c.getContext("2d")!, N = W.N;
    const yaw = engine.cam.yaw, sy = Math.sin(yaw), cy = Math.cos(yaw);
    const k = S * .94 / (N * 1.414);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, S, S);
    const tx = (x: number, y: number) => [S / 2 + ((x - N / 2) * sy - (y - N / 2) * cy) * k, S / 2 + ((x - N / 2) * cy + (y - N / 2) * sy) * k];
    g.setTransform(sy * k, cy * k, -cy * k, sy * k, S / 2 - (N / 2) * (sy - cy) * k, S / 2 - (N / 2) * (cy + sy) * k);
    g.imageSmoothingEnabled = false;
    g.drawImage(base!, 0, 0);
    g.setTransform(1, 0, 0, 1, 0, 0);
    /* câmera: retângulo claro do que está na tela */
    const [cxp, cyp] = tx(engine.cam.x, engine.cam.y);
    g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 1;
    const vw = 13 * engine.cam.zoom * k * (engine.W / Math.min(engine.W, engine.H)), vh = 13 * engine.cam.zoom * k * (engine.H / Math.min(engine.W, engine.H));
    g.strokeRect(cxp - vw / 2, cyp - vh / 2, vw, vh);
    const ponto = (x: number, y: number, r: number, cor: string, borda?: string) => {
      const [px, py] = tx(x, y);
      g.fillStyle = cor; g.beginPath(); g.arc(px, py, r, 0, 7); g.fill();
      if (borda) { g.strokeStyle = borda; g.lineWidth = 1.5; g.stroke(); }
    };
    const [qx, qy] = tx(W.cidade.x, W.cidade.y);
    g.fillStyle = "#f5db8f"; g.strokeStyle = "rgba(0,0,0,.7)"; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(qx, qy - 7); g.lineTo(qx + 7, qy); g.lineTo(qx, qy + 7); g.lineTo(qx - 7, qy); g.closePath(); g.fill(); g.stroke();
    if (ref) {
      for (const e of W.units) {
        if (e.dead || e === ref) continue;
        if (!e.beast && ref.party && e.party === ref.party) { ponto(e.x, e.y, 3, "#7fd6a0"); continue; }
        if (Math.abs(e.x - ref.x) + Math.abs(e.y - ref.y) > 30) continue;
        if (e.beast) { if (e.target === ref || odeia(e, ref)) ponto(e.x, e.y, 2.4, "#ff9a3c"); }
        else if (inimigo(e, ref) || e.skull === "red") ponto(e.x, e.y, 3, "#ff4f45");
      }
      ponto(ref.x, ref.y, 4.4, ref === G.ctrl ? "#ffe08a" : "#efe6d2", "rgba(0,0,0,.8)");
      const [rx, ry] = tx(ref.x, ref.y);
      setAng(Math.atan2(qy - ry, qx - rx) * 57.2958 + 90);
    }
  });
  const dentro = ref ? ref.pz : false;
  const dist = ref && W.cidade ? Math.round(Math.hypot(W.cidade.x - ref.x, W.cidade.y - ref.y)) : 0;
  return (
    <button class={"mini" + (dentro ? " pz" : "")} aria-label="Minimapa: toque para ir à cidade" onClick={irCidade}>
      <canvas ref={cv} width={208} height={208} />
      {ref && !dentro && <svg class="seta" viewBox="0 0 100 100" style={{ transform: `rotate(${ang}deg)` }}><path d="M50 2 57 14 50 11 43 14Z" fill="#f5db8f" stroke="rgba(0,0,0,.7)" stroke-width="1" /></svg>}
      <small>{ref ? (dentro ? "PZ" : dist + " m") : "mapa"}</small>
    </button>
  );
}
function irCidade() {
  clique();
  const u = G.ctrl;
  if (!W.cidade) return;
  if (!u || u.dead) { G.autoCam = false; engine.cam.x = W.cidade.x; engine.cam.y = W.cidade.y; atualizar(); return; }
  if (u.pz) { avisoDe(u, "Você já está na cidade", "#7fd6a0"); return; }
  u.alvoManual = null; u.target = null; u.goalKey = ""; u.encomenda = null; u.npcAlvo = null; u.think = 0;
  if (pzAtiva(u)) { const g = portaoPara(u); u.ordem = { x: g.x, y: g.y }; avisoPz(u); }
  else { u.ordem = { x: W.cidade.nasce.x, y: W.cidade.nasce.y }; avisoDe(u, "A caminho da cidade", "#e0bd63"); }
  G.autoCam = true;
  fecharDeck();
}

/* ---------- ficha de seleção (espectador) ---------- */
function Inspecao() {
  void tick.value;
  const u = G.sel!;
  const fr = u.hp / u.maxHp;
  return (
    <div class="insp" style={{ borderLeftColor: u.beast ? "#9a8f6a" : u.cor.c }}>
      <div class="t" style={{ color: u.beast ? "#d8caa0" : u.cor.hi }}>{u.name}
        {u.skull && <span style={{ fontSize: "11px", marginLeft: "6px", color: u.skull === "red" ? "#ff5a6c" : "#f2eee2" }}>{u.skull === "red" ? "caveira vermelha" : "caveira branca"}</span>}</div>
      <div class="s">{u.beast ? "Criatura" : KINDS[u.kind].pt} · Lv {u.lvl}
        {!u.beast && !W.worldLivre ? " · " + TEAMS[u.team].name : ""}
        {!u.beast && u.w ? " · " + PERFIL_NOME[u.w.perfil] : ""}
        {!u.beast && u.party && u.party.membros.length > 1 ? " · " + TATICAS[u.party.tatica || "cacadores"].n + (u.party.lider === u ? " (líder)" : "") : ""}</div>
      <Barra cls={"hp" + (fr < .35 ? " baixo" : "")} v={u.hp} max={u.maxHp} txt={Math.max(0, Math.round(u.hp)) + " / " + Math.round(u.maxHp)} />
      {!u.beast && <><div style={{ height: "8px" }} /><Grade u={u} peq /></>}
      {!u.beast && <button class="go" onClick={() => { clique(); assumir(u); atualizar(); }}>Assumir o comando</button>}
    </div>
  );
}
