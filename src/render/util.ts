/* Utilidades de desenho: cores, uniformes globais, vento e texturas. */
import * as THREE from "three";

/* uniformes compartilhados por vários materiais (tempo, noite, vento) */
export const U = {
  uTime: { value: 0 },
  uNight: { value: 0 },
  uWind: { value: 1 },
};

const _c = new THREE.Color();
export function cor(hex: string | number) { return new THREE.Color(hex); }
export function misturar(a: THREE.Color, b: THREE.Color, t: number, out = new THREE.Color()) {
  return out.copy(a).lerp(b, t);
}
/* variação leve e determinística de tom e brilho */
export function variar(c: THREE.Color, s: number, amt = .08, out = new THREE.Color()) {
  out.copy(c);
  const k = 1 + (s - .5) * amt * 2;
  out.r *= k; out.g *= k * (1 + (s - .5) * amt * .4); out.b *= k;
  return out;
}
export function hexLin(hex: string) { return _c.set(hex).clone(); }

/* ---------- vento: balanço no vértice, mais forte no alto ---------- */
export function comVento(mat: THREE.Material, forca: number, altura = 1, frequencia = 1, fade = false) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    sh.uniforms.uWind = U.uWind;
    sh.vertexShader = "uniform float uTime;\nuniform float uWind;\n" + (fade ? "attribute float aFade;\nvarying float vFade;\n" : "") + sh.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ipos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      #else
        vec3 ipos = vec3(modelMatrix[3][0], 0.0, modelMatrix[3][2]);
      #endif
      float hh = max(position.y, 0.0) / ${altura.toFixed(3)};
      float ww = sin(uTime * ${(1.6 * frequencia).toFixed(3)} + ipos.x * .63 + ipos.z * .41) + .45 * sin(uTime * ${(3.3 * frequencia).toFixed(3)} + ipos.x * 1.7 - ipos.z * .9);
      float amp = ${forca.toFixed(4)} * uWind * hh * hh;
      transformed.x += ww * amp;
      transformed.z += ww * amp * .55;
      ${fade ? "vFade = aFade;" : ""}`,
    );
    if (fade) {
      sh.fragmentShader = "varying float vFade;\n" + sh.fragmentShader.replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
        if (vFade > 0.001) {
          vec2 q = mod(floor(gl_FragCoord.xy), 4.0);
          float b = mod(q.x * 2.0 + q.y * 3.0 + q.x * q.y, 7.0) / 7.0;
          if (b < vFade) discard;
        }`,
      );
    }
  };
  mat.customProgramCacheKey = () => "vento" + forca + "_" + altura + "_" + frequencia + (fade ? "f" : "");
  return mat;
}

/* ---------- texturas procedurais em canvas ---------- */
export function canvasTex(w: number, h: number, pinta: (g: CanvasRenderingContext2D, w: number, h: number) => void, repetir = false) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  pinta(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repetir) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}
/* sprite de brilho radial (luz, fagulha, poeira) */
let brilho: THREE.Texture | null = null;
export function texBrilho() {
  if (brilho) return brilho;
  brilho = canvasTex(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(.25, "rgba(255,255,255,.75)");
    gr.addColorStop(.6, "rgba(255,255,255,.18)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
  brilho.colorSpace = THREE.NoColorSpace;
  return brilho;
}
/* anel suave para marcações no chão */
let anel: THREE.Texture | null = null;
export function texAnel() {
  if (anel) return anel;
  anel = canvasTex(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 40, 64, 64, 64);
    gr.addColorStop(0, "rgba(255,255,255,0)");
    gr.addColorStop(.55, "rgba(255,255,255,.95)");
    gr.addColorStop(.75, "rgba(255,255,255,.55)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  });
  anel.colorSpace = THREE.NoColorSpace;
  return anel;
}
let disco: THREE.Texture | null = null;
export function texDisco() {
  if (disco) return disco;
  disco = canvasTex(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(.7, "rgba(255,255,255,.55)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  });
  disco.colorSpace = THREE.NoColorSpace;
  return disco;
}

/* ruído determinístico barato para posicionar enfeites */
export function h2(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function descartar(o: THREE.Object3D) {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((x) => {
      const mm = x as THREE.MeshBasicMaterial;
      if (mm.map && !(mm.map as unknown as { __keep?: boolean }).__keep) mm.map.dispose();
      x.dispose();
    });
  });
}
