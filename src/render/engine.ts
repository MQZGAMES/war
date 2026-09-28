/* ================================================================
   Motor: renderizador WebGL, cena, câmera isométrica em perspectiva
   estreita (diorama), qualidade adaptativa e conversões tela ↔ chão.
   Mundo da simulação (x, y) vira (x, 0, y) na cena; +Y é para cima.
   ================================================================ */
import * as THREE from "three";

export type Qualidade = "baixa" | "media" | "alta";

export const engine = {
  renderer: null as unknown as THREE.WebGLRenderer,
  scene: new THREE.Scene(),
  camera: new THREE.PerspectiveCamera(34, 1, .5, 400),
  canvas: null as unknown as HTMLCanvasElement,
  W: 1, H: 1, dpr: 1,
  qual: "media" as Qualidade,
  auto: true,
  /* escala de resolução dinâmica (válvula de desempenho) */
  resScale: 1,
  time: 0,
  perdido: false,
  /* câmera: alvo no chão, distância pelo zoom */
  cam: { x: 0, y: 0, tx: 0, ty: 0, zoom: .68, tzoom: .68, yaw: Math.PI / 4, pitch: 0.76, shakeX: 0, shakeY: 0, shakeT: 0, shakeF: 0, h: 0 },
};

export function criarMotor(host: HTMLElement) {
  const dprReal = window.devicePixelRatio || 1;
  const renderer = new THREE.WebGLRenderer({
    antialias: dprReal < 1.5,
    powerPreference: "high-performance",
    alpha: false,
    stencil: false,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = true;
  engine.renderer = renderer;
  engine.canvas = renderer.domElement;
  engine.canvas.id = "cv";
  host.appendChild(engine.canvas);
  /* celular pode derrubar o contexto em segundo plano: espera e refaz a cena */
  engine.canvas.addEventListener("webglcontextlost", (ev) => { ev.preventDefault(); engine.perdido = true; });
  engine.canvas.addEventListener("webglcontextrestored", () => { engine.perdido = false; for (const f of aoRestaurar) f(); });
  engine.scene.background = new THREE.Color("#101816");
  engine.scene.fog = new THREE.Fog("#101816", 40, 120);
  redimensionar();
  const ag = () => requestAnimationFrame(redimensionar);
  window.addEventListener("resize", ag);
  window.addEventListener("orientationchange", ag);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", ag);
}

/* qualidade inicial pelo aparelho: tela grande de celular com GPU fraca
   não paga por 3× de retina */
export function qualidadeInicial(): Qualidade {
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  const movel = matchMedia("(pointer: coarse)").matches;
  if (mem <= 2 || cores <= 2) return "baixa";
  if (movel && (mem <= 4 || cores <= 4)) return "media";
  return movel ? "media" : "alta";
}
export function aplicarQualidade(q: Qualidade) {
  engine.qual = q;
  const r = engine.renderer;
  r.shadowMap.enabled = q !== "baixa";
  r.shadowMap.type = THREE.PCFShadowMap;
  engine.scene.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (!m) return;
    (Array.isArray(m) ? m : [m]).forEach((mm) => (mm.needsUpdate = true));
  });
  redimensionar();
}
export function tetoDpr() {
  const q = engine.qual;
  const base = Math.min(window.devicePixelRatio || 1, q === "alta" ? 2 : q === "media" ? 1.6 : 1.1);
  /* teto de pixels: tela 1440p não renderiza em 2× */
  const teto = Math.sqrt((q === "alta" ? 3.4e6 : q === "media" ? 2.2e6 : 1.2e6) / Math.max(1, engine.W * engine.H));
  return Math.max(.75, Math.min(base, teto) * engine.resScale);
}
export function redimensionar() {
  const vv = window.visualViewport;
  const w = Math.round(vv ? vv.width : window.innerWidth), h = Math.round(vv ? vv.height : window.innerHeight);
  engine.W = Math.max(1, w); engine.H = Math.max(1, h);
  engine.dpr = tetoDpr();
  engine.renderer.setPixelRatio(engine.dpr);
  engine.renderer.setSize(engine.W, engine.H, false);
  engine.canvas.style.width = engine.W + "px";
  engine.canvas.style.height = engine.H + "px";
  engine.camera.aspect = engine.W / engine.H;
  engine.camera.updateProjectionMatrix();
  for (const f of aoRedimensionar) f(engine.W, engine.H);
}
export const aoRedimensionar: ((w: number, h: number) => void)[] = [];
export const aoRestaurar: (() => void)[] = [];

/* ---------- câmera ---------- */
const SPAN_BASE = 12.5;            // unidades de mundo no lado curto da tela, zoom 1
export const ZOOM_MIN = .5, ZOOM_MAX = 3.2;
const alvo = new THREE.Vector3();
export function distanciaCamera() {
  const c = engine.camera, fov = THREE.MathUtils.degToRad(c.fov);
  const span = SPAN_BASE * engine.cam.zoom;
  const asp = c.aspect;
  /* lado curto: retrato mede na largura, paisagem na altura */
  const vert = asp < 1 ? span / asp : span;
  return vert / (2 * Math.tan(fov / 2));
}
export function atualizarCamera(dt: number) {
  const C = engine.cam;
  C.zoom += (C.tzoom - C.zoom) * Math.min(1, dt * 9);
  if (C.shakeT > 0) {
    C.shakeT -= dt;
    const f = C.shakeF * Math.max(0, C.shakeT / .3) * .02;
    C.shakeX = (Math.random() * 2 - 1) * f; C.shakeY = (Math.random() * 2 - 1) * f;
    if (C.shakeT <= 0) { C.shakeX = C.shakeY = 0; C.shakeF = 0; }
  }
  const d = distanciaCamera();
  const cp = Math.cos(C.pitch), sp = Math.sin(C.pitch);
  const ox = Math.cos(C.yaw) * cp * d, oz = Math.sin(C.yaw) * cp * d, oy = sp * d;
  const tx = C.x + C.shakeX, tz = C.y + C.shakeY;
  engine.camera.position.set(tx + ox, oy + C.h, tz + oz);
  alvo.set(tx, C.h, tz);
  engine.camera.lookAt(alvo);
  engine.camera.near = Math.max(.5, d * .2);
  engine.camera.far = d * 6 + 120;
  engine.camera.updateProjectionMatrix();
  const fog = engine.scene.fog as THREE.Fog | null;
  if (fog) { fog.near = d * 1.05; fog.far = d * 2.6 + 30; }
}
export function tremerCamera(f: number) {
  const C = engine.cam;
  C.shakeF = Math.min(10, Math.max(C.shakeF, f)); C.shakeT = .3;
}

/* ---------- tela ↔ chão ---------- */
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hit = new THREE.Vector3();
export function telaParaChao(px: number, py: number, altura = 0): { x: number; y: number } | null {
  ndc.set(px / engine.W * 2 - 1, -(py / engine.H) * 2 + 1);
  ray.setFromCamera(ndc, engine.camera);
  plano.constant = -altura;
  if (!ray.ray.intersectPlane(plano, hit)) return null;
  return { x: hit.x, y: hit.z };
}
const pv = new THREE.Vector3();
export function mundoParaTela(x: number, y: number, h: number, out: { x: number; y: number; vis: boolean }) {
  pv.set(x, h, y).project(engine.camera);
  out.x = (pv.x * .5 + .5) * engine.W;
  out.y = (-pv.y * .5 + .5) * engine.H;
  out.vis = pv.z < 1 && pv.z > -1;
  return out;
}
/* direção de tela → direção no chão (para o manche e o teclado) */
export function telaParaDirecao(sx: number, sy: number) {
  const yaw = engine.cam.yaw;
  /* "para cima" na tela é para longe da câmera */
  const fx = -Math.cos(yaw), fz = -Math.sin(yaw);   // frente (longe da câmera)
  const rx = -fz, rz = fx;                          // direita na tela
  const wx = rx * sx - fx * sy, wz = rz * sx - fz * sy;
  const l = Math.hypot(wx, wz) || 1;
  return { x: wx / l, y: wz / l };
}
