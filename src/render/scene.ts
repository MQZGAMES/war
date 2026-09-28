/* ================================================================
   Orquestra a cena: monta o cenário quando nasce um mundo novo, faz o
   ciclo de dia e noite (sol, lua, céu, neblina, lampiões), segue a
   câmera, esmaece a árvore que cobre o herói e desenha o quadro.
   ================================================================ */
import * as THREE from "three";
import { G, W } from "../sim/state";
import { PREF } from "../sim/save";
import { engine, atualizarCamera, aplicarQualidade, aoRestaurar, type Qualidade } from "./engine";
import { alturaEm, construirTerreno } from "./terrain";
import { construirNatureza, ARVORES, ARV_CEL, GRAMAS, celArvore } from "./nature";
import { construirCidade, atualizarCidade } from "./city";
import { atualizarUnidades, iniciarUnidades, limparUnidades } from "./units3d";
import { atualizarFx, iniciarFx, limparFx } from "./fx3d";
import { desenharOverlay, limparOverlay } from "./overlay";
import { descartar, U } from "./util";

let cenario: THREE.Group | null = null;
let versao = -1;
let hemi: THREE.HemisphereLight, sol: THREE.DirectionalLight, amb: THREE.AmbientLight;
const alvoSol = new THREE.Object3D();

export function iniciarCena() {
  const s = engine.scene;
  hemi = new THREE.HemisphereLight("#dcefff", "#5a4a36", 1.35);
  s.add(hemi);
  amb = new THREE.AmbientLight("#ffffff", .18);
  s.add(amb);
  sol = new THREE.DirectionalLight("#fff1d6", 2.4);
  sol.castShadow = true;
  sol.shadow.bias = -.0008;
  sol.shadow.normalBias = .02;
  sol.shadow.mapSize.set(2048, 2048);
  s.add(sol, alvoSol);
  sol.target = alvoSol;
  iniciarUnidades(s);
  iniciarFx(s);
  aoRestaurar.push(() => { versao = -1; });
  configurarSombra(engine.qual);
}
export function configurarSombra(q: Qualidade) {
  const m = q === "alta" ? 2048 : 1024;
  if (sol.shadow.mapSize.x !== m) {
    sol.shadow.mapSize.set(m, m);
    if (sol.shadow.map) { sol.shadow.map.dispose(); sol.shadow.map = null as unknown as THREE.WebGLRenderTarget; }
  }
  sol.castShadow = q !== "baixa";
}
export function mudarQualidade(q: Qualidade) {
  aplicarQualidade(q);
  configurarSombra(q);
  versao = -1;                 // refaz a grama na densidade nova
}

function montarCenario() {
  if (cenario) { engine.scene.remove(cenario); descartar(cenario); }
  limparUnidades(); limparFx(); limparOverlay();
  cenario = new THREE.Group();
  cenario.add(construirTerreno());
  cenario.add(construirNatureza(engine.qual));
  ativas.clear();
  cenario.add(construirCidade());
  engine.scene.add(cenario);
  versao = W.mapaVersao;
}

/* ---------- dia e noite ---------- */
const DIA_S = 540;                               // um dia inteiro em 9 minutos
export const ceu = { fase: .14, noite: 0 };
const cores = {
  solDia: new THREE.Color("#fff1d6"), solTarde: new THREE.Color("#ffb070"), lua: new THREE.Color("#9ab8ff"),
  hemiDia: new THREE.Color("#dcefff"), hemiNoite: new THREE.Color("#5a6aa0"),
  chaoDia: new THREE.Color("#5a4a36"), chaoNoite: new THREE.Color("#1a1c2a"),
  fundoDia: new THREE.Color("#141d1a"), fundoNoite: new THREE.Color("#070a14"),
};
const tmpC = new THREE.Color();
function atualizarCeu() {
  if (PREF.diaNoite) ceu.fase = (W.simTime / DIA_S + .14) % 1;
  else ceu.fase = .3;
  const f = ceu.fase;
  /* noite de 0,62 a 0,95 com transições suaves */
  const sm = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const n = sm(.56, .66, f) * (1 - sm(.9, .99, f));
  const tarde = sm(.46, .6, f) * (1 - sm(.6, .66, f)) + sm(.95, 1, f) * .6 + (1 - sm(0, .08, f)) * .6;
  ceu.noite = n;
  U.uNight.value = n;
  /* sol percorre o céu de dia; de noite a luz vira a lua, do outro lado */
  const ang = f * Math.PI * 2;
  const cx = engine.cam.x, cy = engine.cam.y;
  const dx = Math.cos(ang + 1.2) * 18, dz = Math.sin(ang + 1.2) * 10 - 12;
  const alt = n > .5 ? 22 : 16 + Math.sin(f * Math.PI * 1.6) * 10;
  sol.position.set(cx + dx, alt, cy + dz);
  alvoSol.position.set(cx, 0, cy);
  tmpC.copy(cores.solDia).lerp(cores.solTarde, tarde);
  sol.color.copy(tmpC).lerp(cores.lua, n);
  sol.intensity = 2.4 * (1 - n) + 1.0 * n;
  hemi.color.copy(cores.hemiDia).lerp(cores.hemiNoite, n);
  hemi.groundColor.copy(cores.chaoDia).lerp(cores.chaoNoite, n);
  hemi.intensity = 1.35 * (1 - n) + 1.05 * n;
  amb.intensity = .18 + n * .3;
  amb.color.setRGB(1, 1, 1).lerp(tmpC.set("#6a7ab0"), n);
  const fundo = engine.scene.background as THREE.Color;
  fundo.copy(cores.fundoDia).lerp(cores.fundoNoite, n);
  (engine.scene.fog as THREE.Fog).color.copy(fundo);
  /* sombra cobre só o que a câmera vê */
  const span = 16 * engine.cam.zoom + 6;
  const sc = sol.shadow.camera;
  if (sc.right !== span) { sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span; sc.near = 1; sc.far = 80; sc.updateProjectionMatrix(); }
}

/* ---------- a árvore na frente do herói fica translúcida ---------- */
/* só as árvores das células em volta do herói, mais as que ainda estão
   voltando do translúcido (antes: todas as árvores do mapa, a cada quadro) */
const ativas = new Set<number>(), cand: number[] = [], mexidos = new Set<THREE.InstancedMesh>();
function esmaecerArvores(dt: number) {
  const u = G.ctrl || G.sel;
  const alvo = u && !u.dead ? u : null;
  const cosY = Math.cos(engine.cam.yaw), sinY = Math.sin(engine.cam.yaw);
  mexidos.clear(); cand.length = 0;
  if (alvo) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const l = ARV_CEL.get(celArvore(alvo.x + dx * 8, alvo.y + dy * 8));
    if (l) for (const i of l) cand.push(i);
  }
  for (const i of ativas) if (cand.indexOf(i) < 0) cand.push(i);
  for (const ia of cand) {
    const a = ARVORES[ia];
    if (!a) { ativas.delete(ia); continue; }
    const attr = a.mesh2.geometry.getAttribute("aFade") as THREE.InstancedBufferAttribute | undefined;
    if (!attr) continue;
    let quer = 0;
    if (alvo) {
      const dx = a.x - alvo.x, dy = a.y - alvo.y;
      if (dx * dx + dy * dy < 30) {
        const frente = dx * cosY + dy * sinY;                // em direção à câmera
        const lado = Math.abs(-dx * sinY + dy * cosY);
        if (frente > -.3 && frente < a.h * .95 && lado < 1.15) quer = .72;
      }
    }
    const atual = attr.getX(a.i2);
    if (Math.abs(atual - quer) > .005) {
      attr.setX(a.i2, atual + (quer - atual) * Math.min(1, dt * 6));
      mexidos.add(a.mesh2);
      ativas.add(ia);
    } else if (quer === 0) { if (atual !== 0) { attr.setX(a.i2, 0); mexidos.add(a.mesh2); } ativas.delete(ia); }
  }
  for (const m of mexidos) (m.geometry.getAttribute("aFade") as THREE.InstancedBufferAttribute).needsUpdate = true;
}

let tAcum = 0;
export function desenharQuadro(dt: number, alpha: number) {
  if (!G.running || engine.perdido) return;
  if (versao !== W.mapaVersao) montarCenario();
  tAcum += dt;
  U.uTime.value = tAcum;
  /* a mira da câmera sobe e desce com o relevo, sem tranco */
  engine.cam.h += (alturaEm(engine.cam.x, engine.cam.y) - engine.cam.h) * Math.min(1, dt * 4);
  atualizarCamera(dt);
  atualizarCeu();
  atualizarCidade(tAcum, dt, ceu.noite);
  atualizarUnidades(alpha, dt, tAcum);
  atualizarFx(dt, alpha, tAcum, ceu.noite);
  esmaecerArvores(dt);
  const longe = engine.cam.zoom > 2.1;
  for (const g of GRAMAS) g.visible = !longe;
  engine.renderer.render(engine.scene, engine.camera);
  desenharOverlay(dt, alpha, tAcum);
}
