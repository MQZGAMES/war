/* [SYSTEM: RETRATO] A mesma figura do mapa, fotografada numa cena à
   parte com o renderizador principal e guardada como imagem: quadro
   do herói no HUD e cartas de vocação. Custa só na hora de montar. */
import * as THREE from "three";
import { engine } from "./engine";
import { criarRig } from "./models/rig";
import { modeloDe, modeloVitrine } from "./models";
import { animar, novaPose } from "./models/anim";
import type { Unit } from "../sim/types";
import { KINDS, type KindKey } from "../sim/data";
import type { ModeloBase } from "./models/rig";

let cena: THREE.Scene | null = null, cam: THREE.PerspectiveCamera;
let alvo: THREE.WebGLRenderTarget | null = null;
const cache = new Map<string, string>();

function preparar() {
  if (cena) return;
  cena = new THREE.Scene();
  cena.add(new THREE.HemisphereLight("#f4f0ff", "#4a3a2a", 1.6));
  const d = new THREE.DirectionalLight("#fff2dc", 2.6); d.position.set(2, 3, 4); cena.add(d);
  const r = new THREE.DirectionalLight("#9fc8ff", 1.2); r.position.set(-3, 2, -2); cena.add(r);
  cam = new THREE.PerspectiveCamera(26, 1, .1, 50);
}
/* estúdio de depuração (só em dev): fotografa um herói numa pose e
   num ângulo quaisquer, para conferir armas e animação de perto */
export function fotoPose(kind: string, pose: Partial<ReturnType<typeof novaPose>>, giro: number, px = 256, sexo: "m" | "f" = "m"): string {
  preparar();
  const base = KINDS[kind as KindKey]?.beast ? modeloDe({ beast: true, kind } as unknown as Unit) : modeloVitrine(kind, { c: "#c0392b", lo: "#5a1a14", hi: "#ff8a7a" }, sexo);
  const R = engine.renderer;
  const rt = new THREE.WebGLRenderTarget(px, px, { samples: 4 });
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  const rig = criarRig(base);
  const p = Object.assign(novaPose(), pose);
  animar(rig, p);
  rig.mesh.rotation.y = giro;
  cena!.add(rig.mesh);
  const h = base.alt;
  cam.position.set(0, h * .65, h * 2.6); cam.lookAt(0, h * .5, 0);
  const cc = new THREE.Color(); R.getClearColor(cc); const ca = R.getClearAlpha();
  R.setRenderTarget(rt); R.setClearColor(0x33403c, 1); R.clear(); R.render(cena!, cam);
  const buf = new Uint8Array(px * px * 4);
  R.readRenderTargetPixels(rt, 0, 0, px, px, buf);
  R.setRenderTarget(null); R.setClearColor(cc, ca);
  cena!.remove(rig.mesh); rig.mat.dispose(); rig.mesh.skeleton.dispose(); rt.dispose();
  const c = document.createElement("canvas"); c.width = c.height = px;
  const g = c.getContext("2d")!, img = g.createImageData(px, px);
  for (let y = 0; y < px; y++) img.data.set(buf.subarray((px - 1 - y) * px * 4, (px - y) * px * 4), y * px * 4);
  g.putImageData(img, 0, 0);
  return c.toDataURL("image/png");
}
function foto(base: ModeloBase, px: number, corpo: boolean): string {
  preparar();
  const R = engine.renderer;
  if (!alvo || alvo.width !== px) {
    alvo?.dispose();
    alvo = new THREE.WebGLRenderTarget(px, px, { samples: 4 });
    alvo.texture.colorSpace = THREE.SRGBColorSpace;
  }
  const rig = criarRig(base);
  const p = novaPose(); p.t = .4;
  animar(rig, p);
  rig.mesh.rotation.y = .5;
  cena!.add(rig.mesh);
  const h = base.alt;
  if (corpo) { cam.position.set(0, h * .7, h * 2.35); cam.lookAt(0, h * .56, 0); }
  else { cam.position.set(0, h * .82, h * 1.55); cam.lookAt(0, h * .74, 0); }
  const cc = new THREE.Color(); R.getClearColor(cc); const ca = R.getClearAlpha();
  const tm = R.toneMapping;
  R.setRenderTarget(alvo);
  R.setClearColor(0x000000, 0);
  R.clear();
  R.render(cena!, cam);
  const buf = new Uint8Array(px * px * 4);
  R.readRenderTargetPixels(alvo, 0, 0, px, px, buf);
  R.setRenderTarget(null);
  R.setClearColor(cc, ca);
  R.toneMapping = tm;
  cena!.remove(rig.mesh);
  rig.mat.dispose(); rig.mesh.skeleton.dispose();
  const c = document.createElement("canvas"); c.width = c.height = px;
  const g = c.getContext("2d")!;
  const img = g.createImageData(px, px);
  for (let y = 0; y < px; y++) img.data.set(buf.subarray((px - 1 - y) * px * 4, (px - y) * px * 4), y * px * 4);
  g.putImageData(img, 0, 0);
  return c.toDataURL("image/png");
}
export function retratoDe(u: Unit) {
  try { return foto(modeloDe(u), 128, false); } catch { return ""; }
}
export function retratoVitrine(kind: string, cor: { c: string; lo: string; hi: string }, sexo: "m" | "f" = "m") {
  const k = kind + cor.c + sexo;
  let s = cache.get(k);
  if (!s) { try { s = foto(modeloVitrine(kind, cor, sexo), 192, true); } catch { s = ""; } cache.set(k, s); }
  return s;
}
