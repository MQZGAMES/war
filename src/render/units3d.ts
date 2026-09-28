/* ================================================================
   UNIDADES NA CENA — cada unidade da simulação ganha uma figura com
   esqueleto. Posição interpolada entre passos, pose tirada do estado
   (andar, golpe, tiro, conjuração, investida, morte), clarão ao
   apanhar, gelo sob nevasca, verde de veneno, cadáver que some devagar.
   ================================================================ */
import * as THREE from "three";
import { G, W } from "../sim/state";
import type { Unit } from "../sim/types";
import { MET_ALCANCE } from "../sim/data";
import { alturaEm } from "./terrain";
import { criarRig, pontoMundo, type Rig } from "./models/rig";
import { chaveModelo, modeloDe } from "./models";
import { animar, novaPose, type Pose } from "./models/anim";
import { engine } from "./engine";
import { texAnel, texBrilho, texDisco, U } from "./util";
import { magiaDe, slotDe } from "../sim/spells";

interface Vista {
  u: Unit; rig: Rig; chave: string; pose: Pose; andar: number; fasePrev: number;
  morto: boolean; sumir: number; brilho: THREE.Sprite | null; vivoEm: number;
}
export const VISTAS = new Map<number, Vista>();
const CADAVERES: Vista[] = [];
let raiz: THREE.Group;
let sombras: THREE.InstancedMesh;
const aneis: THREE.Mesh[] = [];
let alcance: THREE.Mesh;
const CORPO_BICHO = 14;

export function iniciarUnidades(scene: THREE.Scene) {
  raiz = new THREE.Group(); raiz.name = "unidades";
  scene.add(raiz);
  sombras = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: texDisco(), color: "#000000", transparent: true, opacity: .42, depthWrite: false }), 600);
  sombras.count = 0; sombras.frustumCulled = false; sombras.renderOrder = 1;
  raiz.add(sombras);
  const anelMat = () => new THREE.MeshBasicMaterial({ map: texAnel(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), anelMat());
    m.visible = false; m.renderOrder = 2;
    raiz.add(m); aneis.push(m);
  }
  alcance = new THREE.Mesh(new THREE.RingGeometry(.97, 1, 96).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: "#ffd98a", transparent: true, opacity: .55, depthWrite: false }));
  alcance.visible = false; alcance.renderOrder = 2;
  raiz.add(alcance);
}
export function limparUnidades() {
  for (const v of VISTAS.values()) desfazer(v);
  VISTAS.clear();
  for (const v of CADAVERES) desfazer(v);
  CADAVERES.length = 0;
}
function desfazer(v: Vista) {
  raiz.remove(v.rig.mesh);
  v.rig.mat.dispose();
  v.rig.mesh.skeleton.dispose();
  if (v.brilho) { raiz.remove(v.brilho); (v.brilho.material as THREE.Material).dispose(); }
}
function montarVista(u: Unit): Vista {
  const base = modeloDe(u);
  const rig = criarRig(base);
  raiz.add(rig.mesh);
  let brilho: THREE.Sprite | null = null;
  if (base.pontos.orbe || u.kind === "demon" || u.kind === "cyclops" || u.kind === "dragon") {
    const cor = u.kind === "druid" ? "#7cff9a" : u.kind === "mage" ? "#7fc4ff" : u.kind === "demon" ? "#ffcc40" : u.kind === "dragon" ? "#ff8a2a" : "#bfe8ff";
    brilho = new THREE.Sprite(new THREE.SpriteMaterial({ map: texBrilho(), color: cor, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    brilho.scale.setScalar(u.beast ? .5 : .42);
    raiz.add(brilho);
  }
  const v: Vista = { u, rig, chave: chaveModelo(u), pose: novaPose(), andar: 0, fasePrev: u.bob, morto: u.dead, sumir: 0, brilho, vivoEm: W.simTime };
  v.pose.lado = (u.id & 1) ? 1 : -1;
  return v;
}

const tmp = new THREE.Vector3();
const dummy = new THREE.Object3D();
const BRANCO = new THREE.Color(1, 1, 1), GELO = new THREE.Color("#9fd8ff"), VENENO = new THREE.Color("#b6f08a"), CLARAO = new THREE.Color();

export function atualizarUnidades(alpha: number, dt: number, t: number) {
  const vistos = new Set<number>();
  const cx = engine.cam.x, cy = engine.cam.y;
  const raioVista = 16 * engine.cam.zoom + 10;
  const r2 = raioVista * raioVista;
  let ns = 0;
  for (const u of W.units) {
    vistos.add(u.id);
    let v = VISTAS.get(u.id);
    const k = chaveModelo(u);
    if (v && v.chave !== k && !u.dead) { desfazer(v); VISTAS.delete(u.id); v = undefined; }
    if (!v) { v = montarVista(u); VISTAS.set(u.id, v); }
    const x = u.px + (u.x - u.px) * alpha, y = u.py + (u.y - u.py) * alpha;
    const dx = x - cx, dy = y - cy;
    const perto = dx * dx + dy * dy < r2;
    v.rig.mesh.visible = perto;
    v.rig.mesh.castShadow = engine.cam.zoom < 1.9;
    if (v.brilho) v.brilho.visible = perto && !u.dead;
    if (!perto) continue;
    posicionar(v, u, x, y, dt, t);
    if (!u.dead && ns < 600) {
      const s = v.rig.base.raio * 2.3;
      dummy.position.set(x, alturaEm(x, y) + .02, y);
      dummy.rotation.set(0, 0, 0); dummy.scale.set(s, 1, s * .8);
      dummy.updateMatrix();
      sombras.setMatrixAt(ns++, dummy.matrix);
    }
  }
  /* quem saiu da lista vira cadáver (fauna) e some devagar */
  for (const [id, v] of VISTAS) {
    if (vistos.has(id)) continue;
    VISTAS.delete(id);
    if (v.u.dead) { v.sumir = CORPO_BICHO; CADAVERES.push(v); }
    else desfazer(v);
  }
  for (let i = CADAVERES.length - 1; i >= 0; i--) {
    const v = CADAVERES[i];
    v.sumir -= dt;
    if (v.sumir <= 0 || CADAVERES.length > 60) { desfazer(v); CADAVERES.splice(i, 1); continue; }
    const m = v.rig.mat;
    const a = Math.min(1, v.sumir / 1.5);
    if (a < 1) { m.transparent = true; m.opacity = a; v.rig.mesh.position.y -= dt * .15; }
    v.pose.morte = Math.min(1, v.pose.morte + dt * 2);
    v.pose.t = t;
    animar(v.rig, v.pose);
  }
  sombras.count = ns;
  sombras.instanceMatrix.needsUpdate = true;
  atualizarAneis(alpha, t);
}

function posicionar(v: Vista, u: Unit, x: number, y: number, dt: number, t: number) {
  const r = v.rig, m = r.mesh, p = v.pose;
  const h = alturaEm(x, y);
  m.position.set(x, h, y);
  m.rotation.y = Math.PI / 2 - u.fa;
  /* escala: bicho de nível alto é um pouco maior */
  let s = u.beast ? 1 + (u.xpMult - 1) * .25 : 1;
  if (u.squash > 0 && !u.dead) { const q = u.squash / .18; m.scale.set(s * (1 + .1 * q), s * (1 - .12 * q), s * (1 + .1 * q)); }
  else m.scale.setScalar(s);
  /* pose */
  const paral = u.paral > 0 && !u.dead;
  const mov = u.moving && !paral ? 1 : 0;
  v.andar += (mov - v.andar) * Math.min(1, dt * 10);
  p.andar = v.andar;
  const passo = u.beast ? 1 / Math.sqrt(Math.max(.6, r.base.alt)) : .95;
  if (!paral) p.fase = u.bob * passo * (r.base.anim.passo || 1);
  p.t = paral ? p.t : t + u.id * .37;
  const melee = u.beast || u.kind === "knight";
  p.golpe = u.swing > 0 && (melee || u.kind === "mage" || u.kind === "druid") ? 1 - u.swing / u.swMax : -1;
  p.mira = u.aim;
  p.puxa = u.draw > 0 ? 1 - u.draw / u.drawMax : 0;
  const dc = W.simTime - u.castT;
  p.cast = u.castK && dc < .6 && u.castK !== "triplo" && u.castK !== "certeiro" && u.castK !== "investida" ? dc / .6 : 0;
  p.investida = u.charge > 0 ? 1 : 0;
  p.bote = Math.min(1, u.lunge * 1.6);
  p.fogo = u.fogoT > W.simTime - .35 && u.fogoT > 0 ? Math.min(1, 1 - (u.fogoT - W.simTime + .35) / .7) : 0;
  p.corrida = u.pressa > 0 ? 1 : 0;
  if (u.dead) {
    if (!v.morto) { v.morto = true; p.morte = 0; }
    p.morte = Math.min(1, (W.simTime - u.morteT) / .5);
  } else if (v.morto) { v.morto = false; p.morte = 0; r.mat.transparent = false; r.mat.opacity = 1; }
  else p.morte = 0;
  animar(r, p);
  /* cor: clarão, gelo, veneno */
  const mat = r.mat;
  if (u.flash > 0 && !u.dead) { CLARAO.setRGB(1, .95, .9).multiplyScalar(u.flash / .16 * .9); mat.emissive.copy(CLARAO); }
  else mat.emissive.setRGB(.04, .045, .07).multiplyScalar(U.uNight.value * .7);
  if (paral) mat.color.copy(GELO);
  else if (u.slow > 0 && !u.dead) mat.color.copy(VENENO);
  else mat.color.copy(BRANCO);
  /* brilho da ponta do cajado / olho do monstro */
  if (v.brilho) {
    const nome = r.base.pontos.orbe ? "orbe" : r.base.pontos.olho ? "olho" : "boca";
    if (pontoMundo(r, nome, tmp)) {
      v.brilho.position.copy(tmp);
      const pul = .85 + Math.sin(t * 5 + u.id) * .12 + (p.cast > 0 ? Math.sin(p.cast * Math.PI) * .9 : 0) + p.fogo * 1.2;
      const base = u.beast ? (u.kind === "dragon" ? .35 + p.fogo * 1.4 : .55) : .42;
      v.brilho.scale.setScalar(base * pul);
      (v.brilho.material as THREE.SpriteMaterial).opacity = u.kind === "dragon" && p.fogo <= 0 ? .25 : .9;
    }
  }
}

const COR_ANEL = { ctrl: new THREE.Color("#ffd166"), alvo: new THREE.Color("#ff5a3c"), grupo: new THREE.Color("#7fe0a6"), sel: new THREE.Color("#f2ecda"), convite: new THREE.Color("#7fe0a6") };
function atualizarAneis(alpha: number, t: number) {
  let i = 0;
  const usar = (u: Unit, cor: THREE.Color, esc: number, op: number) => {
    if (i >= aneis.length || u.dead) return;
    const m = aneis[i++];
    const x = u.px + (u.x - u.px) * alpha, y = u.py + (u.y - u.py) * alpha;
    const v = VISTAS.get(u.id);
    const r = (v ? v.rig.base.raio : .35) * esc * (u.beast ? 1 + (u.xpMult - 1) * .25 : 1);
    m.position.set(x, alturaEm(x, y) + .04, y);
    m.scale.set(r * 3.2, 1, r * 3.2);
    const mm = m.material as THREE.MeshBasicMaterial;
    mm.color.copy(cor); mm.opacity = op;
    m.visible = true;
  };
  const c = G.ctrl;
  if (c) {
    usar(c, COR_ANEL.ctrl, 1 + Math.sin(t * 4) * .05, .9);
    if (c.target && !c.target.dead) usar(c.target, COR_ANEL.alvo, 1.1 + Math.sin(t * 7) * .08, 1);
    if (c.party) for (const m of c.party.membros) if (m !== c) usar(m, COR_ANEL.grupo, .95, .6);
  } else if (G.sel) usar(G.sel, COR_ANEL.sel, 1.05, .8);
  for (; i < aneis.length; i++) aneis[i].visible = false;
  /* alcance da magia de área enquanto se escolhe o ponto */
  if (c && !c.dead && G.mirandoSlot >= 0) {
    const mg = magiaDe(c, slotDe(c, G.mirandoSlot));
    const R = mg.alc || MET_ALCANCE;
    const x = c.px + (c.x - c.px) * alpha, y = c.py + (c.y - c.py) * alpha;
    alcance.position.set(x, alturaEm(x, y) + .05, y);
    alcance.scale.set(R, 1, R);
    (alcance.material as THREE.MeshBasicMaterial).opacity = .4 + Math.sin(t * 5) * .15;
    alcance.visible = true;
  } else alcance.visible = false;
}
export function alturaCabeca(u: Unit) {
  const v = VISTAS.get(u.id);
  const s = u.beast ? 1 + (u.xpMult - 1) * .25 : 1;
  return (v ? v.rig.base.alt : u.K.alt) * s;
}
