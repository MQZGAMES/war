/* ================================================================
   EFEITOS — transforma os eventos da simulação em partícula, luz,
   decalque, anel e som; e desenha o que vive por vários quadros:
   projéteis, meteoros, nevasca, chuva de cura, ondas de fogo.
   ================================================================ */
import * as THREE from "three";
import { FX, type FxEv } from "../sim/fx";
import { G, W } from "../sim/state";
import type { Unit } from "../sim/types";
import { CHUVA_R, MET_R, NEVASCA } from "../sim/data";
import { Particulas } from "./particles";
import { alturaEm } from "./terrain";
import { engine, tremerCamera } from "./engine";
import { canvasTex, texAnel, texBrilho, U } from "./util";
import { alturaCabeca, VISTAS } from "./units3d";
import { pontoMundo } from "./models/rig";
import { EMISSORES } from "./nature";
import { CIDADE } from "./city";
import { som } from "../audio/sfx";
import { numeros } from "./overlay";
import { PREF } from "../sim/save";

let raiz: THREE.Group;
export let ADD: Particulas, ALFA: Particulas;
const C = (h: string) => new THREE.Color(h);

/* ---------- texturas de decalque ---------- */
function texMancha(tipo: "sangue" | "queimado" | "rachadura" | "gelo") {
  return canvasTex(128, 128, (g) => {
    g.clearRect(0, 0, 128, 128);
    if (tipo === "rachadura") {
      g.strokeStyle = "rgba(30,20,12,.85)"; g.lineCap = "round";
      for (let i = 0; i < 9; i++) {
        let x = 64, y = 64, a = i / 9 * Math.PI * 2;
        g.lineWidth = 4; g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 7; k++) { a += (Math.random() - .5) * .9; x += Math.cos(a) * 8; y += Math.sin(a) * 8; g.lineTo(x, y); g.lineWidth = Math.max(1, 4 - k * .5); }
        g.stroke();
      }
      return;
    }
    const cor = tipo === "sangue" ? "120,14,18" : tipo === "gelo" ? "210,240,255" : "20,14,10";
    for (let i = 0; i < (tipo === "sangue" ? 9 : 14); i++) {
      const r = tipo === "sangue" ? 6 + Math.random() * 14 : 10 + Math.random() * 22;
      const x = 64 + (Math.random() - .5) * (tipo === "sangue" ? 60 : 50), y = 64 + (Math.random() - .5) * (tipo === "sangue" ? 60 : 50);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(${cor},${tipo === "gelo" ? .7 : .85})`); gr.addColorStop(1, `rgba(${cor},0)`);
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
  });
}
interface Decal { m: THREE.Mesh; vida: number; max: number; }
const decals: Decal[] = [];
const texs: Record<string, THREE.Texture> = {};
function decal(tipo: "sangue" | "queimado" | "rachadura" | "gelo", x: number, y: number, r: number, vida: number) {
  if (decals.length > 70) { const d = decals.shift()!; raiz.remove(d.m); (d.m.material as THREE.Material).dispose(); }
  const t = texs[tipo] || (texs[tipo] = texMancha(tipo));
  const m = new THREE.Mesh(planoChao, new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: 1,
    blending: tipo === "gelo" ? THREE.AdditiveBlending : THREE.NormalBlending, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.position.set(x, alturaEm(x, y) + .03 + decals.length * .0004, y);
  m.rotation.y = Math.random() * 6.28;
  m.scale.set(r * 2, 1, r * 2);
  m.renderOrder = 1;
  raiz.add(m);
  decals.push({ m, vida, max: vida });
}
const planoChao = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

/* ---------- anéis que crescem no chão ---------- */
interface Anel { m: THREE.Mesh; vida: number; max: number; r0: number; r1: number; }
const aneis: Anel[] = [];
const aneisLivres: THREE.Mesh[] = [];
function anel(x: number, y: number, cor: THREE.Color | string, r1: number, vida = .5, r0 = .2, h = .06) {
  const m = aneisLivres.pop() || (() => {
    const mm = new THREE.Mesh(planoChao, new THREE.MeshBasicMaterial({ map: texAnel(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    mm.renderOrder = 3; raiz.add(mm); return mm;
  })();
  (m.material as THREE.MeshBasicMaterial).color.set(cor as THREE.Color);
  m.position.set(x, alturaEm(x, y) + h, y);
  m.visible = true;
  aneis.push({ m, vida, max: vida, r0, r1 });
}

/* ---------- clarões de luz (poucas luzes reais) ---------- */
const luzes: { l: THREE.PointLight; vida: number; max: number; i0: number }[] = [];
function clarao(x: number, y: number, h: number, cor: string, int: number, vida: number, dist = 7) {
  if (engine.qual === "baixa") return;
  let q = luzes.find((l) => l.vida <= 0);
  if (!q) q = luzes.reduce((a, b) => (a.vida < b.vida ? a : b));
  q.l.color.set(cor); q.l.position.set(x, alturaEm(x, y) + h, y); q.l.distance = dist;
  q.vida = vida; q.max = vida; q.i0 = int;
}
/* sprites de brilho (explosão, lampejo) */
const lampejos: { s: THREE.Sprite; vida: number; max: number; e0: number; e1: number }[] = [];
function lampejo(x: number, y: number, h: number, cor: string, e0: number, e1: number, vida: number) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texBrilho(), color: cor, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.position.set(x, alturaEm(x, y) + h, y);
  s.renderOrder = 7;
  raiz.add(s);
  lampejos.push({ s, vida, max: vida, e0, e1 });
}
/* golpe corpo a corpo: arco claro na frente de quem bate */
const arcos: { m: THREE.Mesh; vida: number }[] = [];
let geoArco: THREE.BufferGeometry;
function cortar(u: Unit, forte: boolean) {
  const v = VISTAS.get(u.id);
  if (!v) return;
  const m = new THREE.Mesh(geoArco, new THREE.MeshBasicMaterial({ color: forte ? "#ffd9a0" : "#f4f8ff", transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const alt = v.rig.base.alt;
  m.position.set(u.x, alturaEm(u.x, u.y) + alt * .55, u.y);
  m.rotation.set(0, Math.PI / 2 - u.fa, 0);
  const s = Math.max(.8, alt * .8) * (u.beast ? 1 : 1.05);
  m.scale.set(s, s, s);
  m.renderOrder = 7;
  raiz.add(m);
  arcos.push({ m, vida: .2 });
}
function criarGeoArco() {
  const pts: number[] = [], idx: number[] = [];
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const a = -1.1 + i / n * 2.2;
    const r0 = .45, r1 = .75 - Math.abs(a) * .1;
    pts.push(Math.sin(a) * r0, -a * .25, Math.cos(a) * r0, Math.sin(a) * r1, -a * .25, Math.cos(a) * r1);
    if (i < n) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  g.setIndex(idx);
  return g;
}

/* ---------- projéteis ---------- */
interface VistaProj { m: THREE.Object3D; kind: string; brilho?: THREE.Sprite }
const PROJ = new Map<number, VistaProj>();
const livres: Record<string, VistaProj[]> = {};
let geoFlecha: THREE.BufferGeometry, matFlecha: THREE.MeshLambertMaterial;
function criarProj(kind: string): VistaProj {
  const L = livres[kind];
  if (L && L.length) { const v = L.pop()!; v.m.visible = true; if (v.brilho) v.brilho.visible = true; return v; }
  let m: THREE.Object3D, brilho: THREE.Sprite | undefined;
  if (kind === "arrow") m = new THREE.Mesh(geoFlecha, matFlecha);
  else {
    const cor = kind === "fire" ? "#ffb04a" : kind === "ice" ? "#bfeaff" : kind === "dark" ? "#b070ff" : "#ff7a2a";
    const g = new THREE.Group();
    if (kind === "ice") g.add(new THREE.Mesh(new THREE.OctahedronGeometry(.12, 0), new THREE.MeshBasicMaterial({ color: "#e8f8ff" })));
    else if (kind === "dark") g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(.13, 1), new THREE.MeshBasicMaterial({ color: "#0a0410" })));
    else g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(kind === "bola" ? .2 : .1, 1), new THREE.MeshBasicMaterial({ color: "#fff2c0" })));
    brilho = new THREE.Sprite(new THREE.SpriteMaterial({ map: texBrilho(), color: cor, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    brilho.scale.setScalar(kind === "bola" ? 1.3 : kind === "dark" ? .8 : .65);
    brilho.renderOrder = 7;
    raiz.add(brilho);
    m = g;
  }
  raiz.add(m);
  return { m, kind, brilho };
}
function soltarProj(v: VistaProj) {
  v.m.visible = false; if (v.brilho) v.brilho.visible = false;
  (livres[v.kind] || (livres[v.kind] = [])).push(v);
}
/* ---------- meteoros, nevasca e chuva ---------- */
interface VistaMet { rocha: THREE.Mesh; alvo: THREE.Mesh; alvo2: THREE.Mesh; brilho: THREE.Sprite }
const METS = new Map<number, VistaMet>();
let geoRocha: THREE.BufferGeometry;
function criarMet(tipo: "fogo" | "gelo" | "cura"): VistaMet {
  const cor = tipo === "fogo" ? "#ff7a2a" : tipo === "gelo" ? "#9fdcff" : "#8fe6a8";
  const rocha = new THREE.Mesh(tipo === "gelo" ? new THREE.OctahedronGeometry(.35, 0) : geoRocha,
    new THREE.MeshLambertMaterial({ color: tipo === "fogo" ? "#4a2a1c" : tipo === "gelo" ? "#dff4ff" : "#9fffb8", emissive: tipo === "fogo" ? "#ff5a10" : tipo === "gelo" ? "#3a8ac0" : "#3ac070", emissiveIntensity: .8, flatShading: true }));
  rocha.visible = tipo !== "cura";
  const alvo = new THREE.Mesh(planoChao, new THREE.MeshBasicMaterial({ map: texAnel(), color: cor, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const alvo2 = new THREE.Mesh(planoChao, new THREE.MeshBasicMaterial({ map: texCirculoMagico(), color: cor, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  alvo.renderOrder = 3; alvo2.renderOrder = 3;
  const brilho = new THREE.Sprite(new THREE.SpriteMaterial({ map: texBrilho(), color: cor, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  brilho.scale.setScalar(tipo === "cura" ? .01 : 2.2);
  raiz.add(rocha, alvo, alvo2, brilho);
  return { rocha, alvo, alvo2, brilho };
}
let circuloTex: THREE.Texture | null = null;
function texCirculoMagico() {
  if (circuloTex) return circuloTex;
  circuloTex = canvasTex(256, 256, (g) => {
    g.translate(128, 128);
    g.strokeStyle = "rgba(255,255,255,.9)"; g.lineWidth = 3;
    g.beginPath(); g.arc(0, 0, 118, 0, 7); g.stroke();
    g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 100, 0, 7); g.stroke();
    g.beginPath();
    for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI * 2 * 2; const x = Math.cos(a) * 100, y = Math.sin(a) * 100; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
    g.stroke();
    g.font = "bold 20px serif"; g.fillStyle = "rgba(255,255,255,.9)";
    const r = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊ";
    for (let i = 0; i < 16; i++) { g.save(); g.rotate(i / 16 * Math.PI * 2); g.fillText(r[i], -6, -104); g.restore(); }
  });
  circuloTex.colorSpace = THREE.NoColorSpace;
  return circuloTex;
}

export function iniciarFx(scene: THREE.Scene) {
  raiz = new THREE.Group(); raiz.name = "efeitos";
  scene.add(raiz);
  ADD = new Particulas(2600, true); ALFA = new Particulas(1600, false);
  raiz.add(ADD.pts, ALFA.pts);
  const fg = new THREE.Group();
  const haste = new THREE.CylinderGeometry(.012, .012, .6, 4).rotateX(Math.PI / 2);
  const ponta = new THREE.ConeGeometry(.03, .09, 4).rotateX(Math.PI / 2).translate(0, 0, .33);
  const pena = new THREE.BoxGeometry(.06, .005, .1).translate(0, 0, -.26);
  void fg;
  geoFlecha = mergeSimples([haste, ponta, pena]);
  matFlecha = new THREE.MeshLambertMaterial({ color: "#e8dcbc" });
  geoRocha = new THREE.DodecahedronGeometry(.4, 0);
  geoArco = criarGeoArco();
  for (let i = 0; i < 5; i++) { const l = new THREE.PointLight("#ffffff", 0, 7, 2); raiz.add(l); luzes.push({ l, vida: 0, max: 1, i0: 0 }); }
}
function mergeSimples(gs: THREE.BufferGeometry[]) {
  const pos: number[] = [], nor: number[] = [];
  for (const g0 of gs) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    g.computeVertexNormals();
    const p = g.getAttribute("position"), n = g.getAttribute("normal");
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  return g;
}
export function limparFx() {
  ADD.limpar(); ALFA.limpar();
  for (const d of decals) { raiz.remove(d.m); (d.m.material as THREE.Material).dispose(); }
  decals.length = 0;
  for (const a of aneis) { a.m.visible = false; aneisLivres.push(a.m); }
  aneis.length = 0;
  for (const v of PROJ.values()) soltarProj(v);
  PROJ.clear();
  for (const v of METS.values()) raiz.remove(v.rocha, v.alvo, v.alvo2, v.brilho);
  METS.clear();
  for (const l of lampejos) raiz.remove(l.s);
  lampejos.length = 0;
  FX.length = 0;
}

/* ---------- utilidades de posição ---------- */
const V = new THREE.Vector3();
function peito(u: Unit) { return alturaEm(u.x, u.y) + alturaCabeca(u) * .55; }
function perto(x: number, y: number, r = 22) { return Math.abs(x - engine.cam.x) < r * engine.cam.zoom + 6 && Math.abs(y - engine.cam.y) < r * engine.cam.zoom + 6; }
function volume(x: number, y: number) {
  const d = Math.hypot(x - engine.cam.x, y - engine.cam.y) / (12 * engine.cam.zoom);
  return Math.max(0, 1 - d * .55);
}

/* ============================================================
   eventos da simulação
   ============================================================ */
function tratar(e: FxEv) {
  switch (e.t) {
    case "dmg": {
      const u = e.u;
      numeros.dano(u, e.v, e.heavy);
      if (u === G.ctrl) { som("dor", 1); if (PREF.vibrar && navigator.vibrate) try { navigator.vibrate(e.heavy ? 40 : 18); } catch { /* sem vibração */ } }
      else som(e.heavy ? "impactoForte" : "impacto", volume(u.x, u.y) * .8);
      break;
    }
    case "heal": {
      if (e.u) numeros.cura(e.u, e.v); else numeros.curaEm(e.x, e.y, e.v);
      if (!perto(e.x, e.y)) break;
      const h = alturaEm(e.x, e.y);
      ADD.emitir(e.x, h + .3, e.y, { n: 12, raio: .35, vy: 1.4, esp: .25, vida: .9, tam: .22, tamFim: .05, cor: "#b8ffb0", cor2: "#3fd46a" });
      break;
    }
    case "miss": {
      const u = e.u;
      numeros.errou(u);
      if (!perto(u.x, u.y)) break;
      ALFA.emitir(u.x, peito(u), u.y, { n: 6, raio: .15, esp: .4, vy: .5, vida: .5, tam: .35, tamFim: .6, cor: "#d8dde0", alfa: .5 });
      som("esquiva", volume(u.x, u.y) * .6);
      break;
    }
    case "ring": anel(e.x, e.y, e.c, (e.r || .9), e.life, .2); break;
    case "boom": {
      if (!perto(e.x, e.y)) break;
      const h = alturaEm(e.x, e.y) + .35;
      const cor = e.kind === "ice" ? ["#e8f8ff", "#5aa9dd"] : e.kind === "dark" ? ["#c080ff", "#2a0a40"] : e.kind === "heal" ? ["#d0ffd8", "#3fd46a"] : ["#ffe08a", "#ff5a10"];
      ADD.emitir(e.x, h, e.y, { n: Math.round(8 + e.r * 8), esp: 1.8 * Math.max(.5, e.r), vida: .45, tam: .35, tamFim: .05, cor: cor[0], cor2: cor[1], arrasto: 2 });
      lampejo(e.x, e.y, .4, cor[0], .3, e.r * 2.2, .25);
      break;
    }
    case "bits": if (perto(e.x, e.y)) ADD.emitir(e.x, alturaEm(e.x, e.y) + (e.h || .3), e.y, { n: e.n, esp: e.spd, vida: .5, tam: .12, cor: e.c, grav: 3 }); break;
    case "blood": {
      const u = e.u;
      if (!perto(u.x, u.y)) break;
      const cor = u.kind === "spider" ? "#6ab040" : u.kind === "demon" ? "#ffb040" : "#b0201c";
      const dx = e.src ? u.x - e.src.x : 0, dy = e.src ? u.y - e.src.y : 0, l = Math.hypot(dx, dy) || 1;
      ALFA.emitir(u.x, peito(u), u.y, { n: e.n, vx: dx / l * 1.2, vz: dy / l * 1.2, vy: 1.2, esp: 1.1, vida: .55, tam: .1, tamFim: .06, cor, grav: 9 });
      if (Math.random() < .35) decal(u.kind === "demon" ? "queimado" : "sangue", u.x + dx / l * .3, u.y + dy / l * .3, .3 + Math.random() * .2, 6);
      break;
    }
    case "levelup": {
      const u = e.u;
      anel(u.x, u.y, "#ffd86a", 1.6, .8, .3);
      ADD.emitir(u.x, alturaEm(u.x, u.y) + .1, u.y, { n: 40, raio: .5, vy: 2.6, esp: .3, vida: 1.2, tam: .2, tamFim: .04, cor: "#fff6d0", cor2: "#ffb52a" });
      lampejo(u.x, u.y, 1, "#ffd86a", .5, 3.5, .7);
      clarao(u.x, u.y, 1.5, "#ffd070", 6, .8);
      if (u === G.ctrl) som("nivel", 1);
      break;
    }
    case "death": {
      const u = e.u;
      if (!perto(u.x, u.y)) break;
      ALFA.emitir(u.x, alturaEm(u.x, u.y) + .2, u.y, { n: 10, raio: .4, esp: .6, vy: .4, vida: .9, tam: .5, tamFim: 1, cor: "#9c9080", alfa: .45 });
      if (!u.beast) ADD.emitir(u.x, peito(u), u.y, { n: 14, raio: .2, vy: 1.8, esp: .2, vida: 1.4, tam: .25, tamFim: .05, cor: "#dfe8ff", cor2: "#6a80c0" });
      decal("sangue", u.x, u.y, u.beast ? Math.max(.4, u.K.r) : .5, 12);
      som(u.beast ? "morteBicho" : "morte", volume(u.x, u.y));
      break;
    }
    case "revive": {
      const u = e.u;
      if (!perto(u.x, u.y)) break;
      if (!u.beast) {
        anel(u.x, u.y, "#9fd8ff", 1.2, .7, .2);
        ADD.emitir(u.x, alturaEm(u.x, u.y) + .1, u.y, { n: 20, raio: .4, vy: 2, esp: .2, vida: .8, tam: .18, cor: "#dff4ff", cor2: "#7fb0ff" });
        if (u === G.ctrl) som("renascer", 1);
      } else ALFA.emitir(u.x, alturaEm(u.x, u.y) + .1, u.y, { n: 6, raio: .3, esp: .4, vida: .5, tam: .4, tamFim: .7, cor: "#8a8070", alfa: .35 });
      break;
    }
    case "scorch": decal("queimado", e.x, e.y, e.r, e.life + 4); break;
    case "crack": decal("rachadura", e.x, e.y, e.r * .8, 5); break;
    case "cast": {
      const u = e.u;
      if (!perto(u.x, u.y)) break;
      const k = e.k;
      const cor = k === "meteoro" || k === "bola" || k === "onda" ? "#ff8a2a" : k === "nevasca" ? "#9fdcff" : k === "chuva" || k === "cura" ? "#8fe6a8" : k === "trevas" ? "#b070ff" : k === "terremoto" ? "#d8b070" : "#ffe9a8";
      const v = VISTAS.get(u.id);
      const pto = v && (v.rig.base.pontos.orbe ? "orbe" : v.rig.base.pontos.boca ? "boca" : "arma");
      const pp = v && pto ? pontoMundo(v.rig, pto, V) : null;
      const px = pp ? pp.x : u.x, py = pp ? pp.y : peito(u), pz = pp ? pp.z : u.y;
      ADD.emitir(px, py, pz, { n: 14, esp: .9, vida: .5, tam: .2, tamFim: .03, cor: "#ffffff", cor2: cor, arrasto: 3 });
      if (k === "cura") ADD.emitir(u.x, alturaEm(u.x, u.y) + .2, u.y, { n: 24, raio: .45, vy: 1.6, esp: .15, vida: 1, tam: .18, tamFim: .04, cor: "#dfffe0", cor2: "#3fd46a" });
      if (k === "investida") ALFA.emitir(u.x, alturaEm(u.x, u.y) + .1, u.y, { n: 8, raio: .3, esp: .8, vy: .3, vida: .6, tam: .45, tamFim: .8, cor: "#b8a88a", alfa: .5 });
      if (k === "meteoro" || k === "nevasca" || k === "chuva" || k === "cura") anel(u.x, u.y, cor, 1.1, .6, .4);
      const nome = k === "meteoro" || k === "bola" || k === "onda" ? "fogoLanca" : k === "nevasca" ? "geloLanca" : k === "chuva" || k === "cura" ? "cura" : k === "trevas" ? "trevas" : k === "terremoto" ? "terremoto" : k === "investida" ? "investida" : "magia";
      som(nome, volume(u.x, u.y));
      if (k === "bola" || k === "onda") clarao(px, pz, 1, "#ff8a2a", 3, .4);
      break;
    }
    case "shoot": {
      const u = e.u;
      const n = e.kind === "arrow" ? "flecha" : e.kind === "fire" || e.kind === "bola" ? "fogo" : e.kind === "ice" ? "gelo" : "trevas";
      som(n, volume(u.x, u.y) * .8);
      break;
    }
    case "swing": if (perto(e.u.x, e.u.y)) { cortar(e.u, e.heavy); som(e.u.beast ? (e.heavy ? "mordidaForte" : "mordida") : "espada", volume(e.u.x, e.u.y) * .8); } break;
    case "potion": {
      const u = e.u;
      ADD.emitir(u.x, peito(u), u.y, { n: 14, raio: .25, vy: 1.2, esp: .3, vida: .7, tam: .16, tamFim: .04, cor: e.tipo === "hp" ? "#ffb0a8" : "#b8dcff", cor2: e.tipo === "hp" ? "#e0302a" : "#2a7ad8" });
      if (u === G.ctrl) som("pocao", .9);
      break;
    }
    case "coins": ADD.emitir(e.u.x, peito(e.u), e.u.y, { n: 10, vy: 1.8, esp: .6, grav: 5, vida: .8, tam: .14, cor: "#ffe08a" }); if (e.u === G.ctrl) som("moedas", .8); break;
    case "loot": {
      const u = e.u;
      ADD.emitir(u.x, peito(u) + .4, u.y, { n: 12, vy: 1, esp: .5, vida: .9, tam: .18, tamFim: .03, cor: "#fff4c0", cor2: "#ffc040" });
      if (u === G.ctrl) som("loot", .9);
      break;
    }
    case "invite": anel(e.u.x, e.u.y, e.ok === false ? "#e0685a" : "#7fe0a6", 1.1, .6); if (e.ok) som("grupo", .8); break;
    case "charge": if (perto(e.u.x, e.u.y)) { ALFA.emitir(e.u.x, alturaEm(e.u.x, e.u.y) + .1, e.u.y, { n: 8, raio: .3, esp: .8, vy: .3, vida: .6, tam: .45, tamFim: .8, cor: "#b8a88a", alfa: .5 }); som("rugido", volume(e.u.x, e.u.y) * .7); } break;
    case "impact": impacto(e.x, e.y, e.kind); break;
    case "shake": if (PREF.efeitos) tremerCamera(e.f); break;
    case "ui": som(e.s === "compra" ? "moedas" : e.s === "venda" ? "moedas" : e.s === "equip" ? "equipar" : e.s === "nega" ? "nega" : "clique", .7); break;
  }
}
function impacto(x: number, y: number, kind: string) {
  const h = alturaEm(x, y);
  const vol = volume(x, y);
  if (kind === "meteoro" || kind === "bola") {
    const R = kind === "meteoro" ? MET_R : 1.7;
    ADD.emitir(x, h + .3, y, { n: kind === "meteoro" ? 70 : 40, esp: R * 2.2, espY: R * 1.5, vy: 1.5, vida: .7, tam: .45, tamFim: .08, cor: "#fff0b0", cor2: "#ff3a0a", arrasto: 2.5, grav: 2 });
    ALFA.emitir(x, h + .5, y, { n: kind === "meteoro" ? 18 : 10, raio: R * .6, vy: 1, esp: .5, vida: 1.6, tam: .9, tamFim: 1.8, cor: "#3a3230", alfa: .55 });
    ADD.emitir(x, h + .2, y, { n: 26, esp: 3, vy: 3, vida: 1.1, tam: .09, cor: "#ffd070", grav: 6 });
    anel(x, y, "#ff9a3c", R * 1.25, .45, .3);
    lampejo(x, y, .6, "#ffcf70", .5, R * 3.2, .35);
    clarao(x, y, 1.2, "#ff9040", kind === "meteoro" ? 18 : 10, .6, 10);
    if (kind === "meteoro" && vol > .2 && PREF.efeitos) tremerCamera(3.5 * vol);
    som(kind === "meteoro" ? "explosao" : "explosaoMedia", vol);
  } else if (kind === "nevasca") {
    const R = NEVASCA.raio;
    ADD.emitir(x, h + .4, y, { n: 60, raio: R * .7, esp: 1.5, vy: 1.2, vida: .9, tam: .22, tamFim: .04, cor: "#ffffff", cor2: "#6ab8ff", grav: 1.5 });
    ALFA.emitir(x, h + .3, y, { n: 16, raio: R * .7, esp: .4, vida: 1.4, tam: .8, tamFim: 1.4, cor: "#e8f6ff", alfa: .45 });
    anel(x, y, "#bfeaff", R * 1.2, .55, .3);
    lampejo(x, y, .5, "#bfeaff", .4, R * 2.6, .4);
    clarao(x, y, 1, "#8fd0ff", 10, .6, 9);
    decal("gelo", x, y, R * .9, 5);
    som("gelo", vol);
  } else if (kind === "chuva") {
    ADD.emitir(x, h + .3, y, { n: 50, raio: CHUVA_R * .8, vy: 1.8, esp: .3, vida: 1.1, tam: .2, tamFim: .04, cor: "#e8ffe8", cor2: "#3fd46a" });
    anel(x, y, "#8fe6a8", CHUVA_R * 1.1, .6, .4);
    lampejo(x, y, .5, "#a8ffb8", .4, CHUVA_R * 2, .45);
    clarao(x, y, 1, "#8fffa0", 8, .7, 9);
    som("chuva", vol);
  } else if (kind === "terremoto") {
    ALFA.emitir(x, h + .15, y, { n: 26, raio: 1.4, esp: 1.8, vy: .6, vida: 1, tam: .6, tamFim: 1.2, cor: "#a89070", alfa: .6 });
    ALFA.emitir(x, h + .1, y, { n: 20, raio: .8, esp: 2, vy: 3, vida: .8, tam: .14, cor: "#6a5238", grav: 9 });
    anel(x, y, "#e0bd63", 2.8, .5, .3);
    if (vol > .2 && PREF.efeitos) tremerCamera(2.5 * vol);
    som("terremoto", vol);
  } else if (kind === "baque") {
    ALFA.emitir(x, h + .1, y, { n: 12, raio: .5, esp: 1.3, vy: .5, vida: .7, tam: .45, tamFim: .9, cor: "#b0a080", alfa: .5 });
    anel(x, y, "#e8dcc0", 1.8, .4, .3);
    if (vol > .3 && PREF.efeitos) tremerCamera(1.5 * vol);
    som("baque", vol);
  }
}

/* ============================================================
   quadro a quadro
   ============================================================ */
const QV = new THREE.Vector3(), QD = new THREE.Vector3(), UP = new THREE.Vector3(0, 0, 1);
let ambT = 0;
export function atualizarFx(dt: number, alpha: number, t: number, noite: number) {
  for (let i = 0; i < FX.length; i++) tratar(FX[i]);
  FX.length = 0;

  /* projéteis */
  const vivos = new Set<number>();
  for (const p of W.projs) {
    vivos.add(p.id);
    let v = PROJ.get(p.id);
    if (!v) { v = criarProj(p.kind); PROJ.set(p.id, v); }
    const k = p.d0 > 0 ? Math.max(0, Math.min(1, 1 - Math.hypot(p.tx - p.x, p.ty - p.y) / p.d0)) : 1;
    const hy = alturaEm(p.x, p.y) + p.h0 + (p.h1 - p.h0) * k + p.z * 1.4;
    v.m.position.set(p.x, hy, p.y);
    QD.set(p.dirx, (p.h1 - p.h0) / Math.max(1, p.d0) - Math.cos(k * Math.PI) * p.z * .9, p.diry).normalize();
    v.m.quaternion.setFromUnitVectors(UP, QD);
    if (v.brilho) {
      v.brilho.position.copy(v.m.position);
      const cor = p.kind === "fire" ? ["#fff0c0", "#ff5a10"] : p.kind === "ice" ? ["#ffffff", "#5ab0ff"] : p.kind === "dark" ? ["#c080ff", "#1a0028"] : ["#fff0b0", "#ff4000"];
      if (p.kind === "dark") ALFA.emitir(p.x, hy, p.y, { n: 1, esp: .15, vida: .5, tam: .35, tamFim: .6, cor: "#1a0a28", alfa: .7 });
      ADD.emitir(p.x, hy, p.y, { n: p.kind === "bola" ? 3 : 1, esp: .2, vida: p.kind === "bola" ? .45 : .3, tam: p.kind === "bola" ? .5 : .22, tamFim: .03, cor: cor[0], cor2: cor[1] });
    }
  }
  for (const [id, v] of PROJ) if (!vivos.has(id)) { soltarProj(v); PROJ.delete(id); }

  /* meteoros, nevasca e chuva caindo */
  const mv = new Set<number>();
  for (const m of W.meteors) {
    mv.add(m.id);
    let v = METS.get(m.id);
    const tipo = m.gelo ? "gelo" : m.cura ? "cura" : "fogo";
    if (!v) { v = criarMet(tipo); METS.set(m.id, v); }
    const k = Math.min(1, m.t / m.dur);
    const R = m.gelo ? NEVASCA.raio : m.cura ? CHUVA_R : MET_R;
    const h = alturaEm(m.x, m.y);
    v.alvo.position.set(m.x, h + .07, m.y);
    const ra = R * 2 * (1 - k * .15);
    v.alvo.scale.set(ra, 1, ra);
    (v.alvo.material as THREE.MeshBasicMaterial).opacity = .5 + k * .5;
    v.alvo2.position.set(m.x, h + .08, m.y);
    v.alvo2.scale.set(R * 2, 1, R * 2);
    v.alvo2.rotation.y = t * (m.cura ? .8 : 1.6);
    (v.alvo2.material as THREE.MeshBasicMaterial).opacity = Math.min(1, k * 2) * .8;
    const alt = (1 - k) * (1 - k) * 9;
    v.rocha.position.set(m.x - (1 - k) * 2.2, h + .3 + alt, m.y - (1 - k) * 2.2);
    v.rocha.rotation.x += dt * 6; v.rocha.rotation.y += dt * 4;
    v.brilho.position.copy(v.rocha.position);
    if (tipo === "fogo") {
      ADD.emitir(v.rocha.position.x, v.rocha.position.y, v.rocha.position.z, { n: 4, esp: .25, vida: .45, tam: .7, tamFim: .1, cor: "#fff0a0", cor2: "#ff3000" });
      ALFA.emitir(v.rocha.position.x, v.rocha.position.y + .2, v.rocha.position.z, { n: 1, esp: .2, vida: .9, tam: .6, tamFim: 1.1, cor: "#2a2220", alfa: .5 });
    } else if (tipo === "gelo") {
      ADD.emitir(v.rocha.position.x, v.rocha.position.y, v.rocha.position.z, { n: 3, esp: .3, vida: .5, tam: .4, tamFim: .05, cor: "#ffffff", cor2: "#5ab0ff" });
      ADD.emitir(m.x, h + 2.5, m.y, { n: 3, raio: R * .9, vy: -3.5, esp: .2, vida: .8, tam: .12, cor: "#f0faff" });
    } else {
      ADD.emitir(m.x, h + 2.8, m.y, { n: 5, raio: R * .9, vy: -5, esp: .1, vida: .55, tam: .16, tamFim: .1, cor: "#dfffe0", cor2: "#5fe08a" });
    }
  }
  for (const [id, v] of METS) if (!mv.has(id)) { raiz.remove(v.rocha, v.alvo, v.alvo2, v.brilho); METS.delete(id); }

  /* ondas de fogo */
  for (const o of W.ondas) {
    const px = -o.dy, py = o.dx, h = alturaEm(o.x, o.y);
    for (let i = -2; i <= 2; i++) {
      const s = i / 2 * o.larg;
      ADD.emitir(o.x + px * s, h + .15, o.y + py * s, { n: 2, esp: .25, vy: 2.2, vida: .45, tam: .6, tamFim: .1, cor: "#fff0a0", cor2: "#ff2a00" });
    }
    if (Math.random() < .5) ALFA.emitir(o.x, h + .8, o.y, { n: 1, raio: o.larg, vy: 1.2, esp: .2, vida: 1, tam: .7, tamFim: 1.2, cor: "#2a2220", alfa: .4 });
  }

  /* investida: poeira atrás de quem corre */
  for (const u of W.units) {
    if (u.dead || u.charge <= 0 || !perto(u.x, u.y)) continue;
    ALFA.emitir(u.x, alturaEm(u.x, u.y) + .08, u.y, { n: 1, raio: .2, esp: .4, vy: .3, vida: .5, tam: .35, tamFim: .7, cor: "#b8a88a", alfa: .45 });
  }

  /* ambiente: fogueiras, brasas, cristais e vaga-lumes perto da câmera */
  ambT += dt;
  if (ambT > .05) {
    const passo = ambT; ambT = 0;
    for (const em of EMISSORES) {
      if (!perto(em.x, em.y, 14)) continue;
      const h = alturaEm(em.x, em.y) + em.h;
      if (em.tipo === "fogo") {
        ADD.emitir(em.x, h, em.y, { n: 3, raio: .12, vy: 1.3, esp: .15, vida: .6, tam: .45, tamFim: .05, cor: "#fff0a0", cor2: "#ff3a00" });
        if (Math.random() < .3) ALFA.emitir(em.x, h + .6, em.y, { n: 1, vy: .8, esp: .1, vida: 1.8, tam: .4, tamFim: 1, cor: "#3a3432", alfa: .35 });
      } else if (em.tipo === "brasa") {
        if (Math.random() < passo * 3 * em.r) ADD.emitir(em.x, h, em.y, { n: 1, raio: em.r, vy: .9, esp: .3, vida: 1.8, tam: .1, tamFim: .02, cor: "#ffb040", cor2: "#ff2000" });
      } else if (em.tipo === "cristal") {
        if (Math.random() < passo * 2) ADD.emitir(em.x, h, em.y, { n: 1, raio: .3, vy: .4, esp: .1, vida: 1.2, tam: .2, tamFim: .02, cor: "#ff6a4a" });
      } else if (em.tipo === "vagalume" && noite > .35) {
        if (Math.random() < passo * 1.5 * noite) ADD.emitir(em.x, h, em.y, { n: 1, raio: em.r, raioY: .6, esp: .3, vida: 3, vidaVar: .6, tam: .12, tamFim: .1, cor: "#e8ff80", cor2: "#80ff40", alfa: .9 });
      }
    }
    /* à noite, os lampiões da cidade soltam um pouco de brilho */
    if (noite > .3) for (const l of CIDADE.lampioes) if (Math.random() < passo * 2 && perto(l.x, l.y, 14)) ADD.emitir(l.x, l.h, l.y, { n: 1, esp: .15, vy: .2, vida: 1, tam: .1, cor: "#ffd070" });
  }

  ADD.atualizar(dt); ALFA.atualizar(dt);

  for (let i = decals.length - 1; i >= 0; i--) {
    const d = decals[i]; d.vida -= dt;
    if (d.vida <= 0) { raiz.remove(d.m); (d.m.material as THREE.Material).dispose(); decals.splice(i, 1); continue; }
    (d.m.material as THREE.MeshBasicMaterial).opacity = Math.min(1, d.vida / 1.5) * .85;
  }
  for (let i = aneis.length - 1; i >= 0; i--) {
    const a = aneis[i]; a.vida -= dt;
    if (a.vida <= 0) { a.m.visible = false; aneisLivres.push(a.m); aneis.splice(i, 1); continue; }
    const k = 1 - a.vida / a.max, r = a.r0 + (a.r1 - a.r0) * (1 - (1 - k) * (1 - k));
    a.m.scale.set(r * 2, 1, r * 2);
    (a.m.material as THREE.MeshBasicMaterial).opacity = (1 - k) * .9;
  }
  for (let i = lampejos.length - 1; i >= 0; i--) {
    const l = lampejos[i]; l.vida -= dt;
    if (l.vida <= 0) { raiz.remove(l.s); (l.s.material as THREE.Material).dispose(); lampejos.splice(i, 1); continue; }
    const k = 1 - l.vida / l.max;
    l.s.scale.setScalar(l.e0 + (l.e1 - l.e0) * k);
    (l.s.material as THREE.SpriteMaterial).opacity = 1 - k;
  }
  for (let i = arcos.length - 1; i >= 0; i--) {
    const a = arcos[i]; a.vida -= dt;
    if (a.vida <= 0) { raiz.remove(a.m); (a.m.material as THREE.Material).dispose(); arcos.splice(i, 1); continue; }
    (a.m.material as THREE.MeshBasicMaterial).opacity = a.vida / .2 * .75;
    a.m.rotation.y += dt * 6;
  }
  for (const q of luzes) {
    if (q.vida > 0) { q.vida -= dt; q.l.intensity = Math.max(0, q.vida / q.max) * q.i0; }
    else q.l.intensity = 0;
  }
  void alpha; void QV; void U;
}
