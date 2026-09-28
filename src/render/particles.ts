/* Partículas em GPU (THREE.Points) com atualização na CPU em arrays
   tipados: nenhum objeto por partícula, nada para o coletor. Dois
   sistemas: aditivo (fogo, magia, brilho) e alfa (fumaça, sangue, pó). */
import * as THREE from "three";
import { engine } from "./engine";

export interface OpcPart {
  n?: number; vx?: number; vy?: number; vz?: number; esp?: number; espY?: number;
  vida?: number; vidaVar?: number; tam?: number; tamFim?: number; cor?: THREE.Color | string; cor2?: THREE.Color | string;
  grav?: number; arrasto?: number; alfa?: number; raio?: number; raioY?: number;
}
export class Particulas {
  cap: number; n = 0;
  pos: Float32Array; vel: Float32Array; cor: Float32Array; cor2: Float32Array; vida: Float32Array; max: Float32Array;
  tam: Float32Array; tamF: Float32Array; grav: Float32Array; arr: Float32Array; alfa0: Float32Array;
  gAlfa: Float32Array; gTam: Float32Array; gCor: Float32Array;
  geo: THREE.BufferGeometry; pts: THREE.Points; mat: THREE.ShaderMaterial;
  constructor(cap: number, aditivo: boolean) {
    this.cap = cap;
    this.pos = new Float32Array(cap * 3); this.vel = new Float32Array(cap * 3);
    this.cor = new Float32Array(cap * 3); this.cor2 = new Float32Array(cap * 3);
    this.vida = new Float32Array(cap); this.max = new Float32Array(cap);
    this.tam = new Float32Array(cap); this.tamF = new Float32Array(cap);
    this.grav = new Float32Array(cap); this.arr = new Float32Array(cap); this.alfa0 = new Float32Array(cap);
    this.gAlfa = new Float32Array(cap); this.gTam = new Float32Array(cap); this.gCor = new Float32Array(cap * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aCor", new THREE.BufferAttribute(this.gCor, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aAlfa", new THREE.BufferAttribute(this.gAlfa, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aTam", new THREE.BufferAttribute(this.gTam, 1).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uEsc: { value: 400 } },
      vertexShader: `
        attribute vec3 aCor; attribute float aAlfa; attribute float aTam;
        uniform float uEsc; varying vec3 vC; varying float vA;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(aTam * uEsc / -mv.z, 1.0, 180.0);
          vC = aCor; vA = aAlfa;
        }`,
      fragmentShader: aditivo ? `
        varying vec3 vC; varying float vA;
        void main(){
          float d = length(gl_PointCoord - .5) * 2.0;
          float a = pow(max(0.0, 1.0 - d), 1.6);
          gl_FragColor = vec4(vC * a * vA, 1.0);
          #include <colorspace_fragment>
        }` : `
        varying vec3 vC; varying float vA;
        void main(){
          float d = length(gl_PointCoord - .5) * 2.0;
          float a = smoothstep(1.0, .55, d);
          if (a * vA < .01) discard;
          gl_FragColor = vec4(vC, a * vA);
          #include <colorspace_fragment>
        }`,
    });
    this.pts = new THREE.Points(g, this.mat);
    this.pts.frustumCulled = false;
    this.pts.renderOrder = aditivo ? 6 : 5;
  }
  emitir(x: number, y: number, z: number, o: OpcPart) {
    const n = o.n || 1;
    const c1 = o.cor instanceof THREE.Color ? o.cor : new THREE.Color(o.cor || "#ffffff");
    const c2 = o.cor2 ? (o.cor2 instanceof THREE.Color ? o.cor2 : new THREE.Color(o.cor2)) : c1;
    for (let k = 0; k < n; k++) {
      if (this.n >= this.cap) return;
      const i = this.n++;
      const r = o.raio || 0, ry = o.raioY || 0;
      const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * r;
      this.pos[i * 3] = x + Math.cos(a) * rr; this.pos[i * 3 + 1] = y + (Math.random() - .5) * ry; this.pos[i * 3 + 2] = z + Math.sin(a) * rr;
      const e = o.esp || 0, ey = o.espY ?? e;
      this.vel[i * 3] = (o.vx || 0) + (Math.random() - .5) * 2 * e;
      this.vel[i * 3 + 1] = (o.vy || 0) + (Math.random() - .5) * 2 * ey;
      this.vel[i * 3 + 2] = (o.vz || 0) + (Math.random() - .5) * 2 * e;
      const v = (o.vida || .8) * (1 + (Math.random() - .5) * (o.vidaVar ?? .5));
      this.vida[i] = v; this.max[i] = v;
      this.tam[i] = (o.tam || .3) * (.8 + Math.random() * .4); this.tamF[i] = o.tamFim ?? this.tam[i] * .3;
      this.grav[i] = o.grav || 0; this.arr[i] = o.arrasto || 0; this.alfa0[i] = o.alfa ?? 1;
      this.cor[i * 3] = c1.r; this.cor[i * 3 + 1] = c1.g; this.cor[i * 3 + 2] = c1.b;
      this.cor2[i * 3] = c2.r; this.cor2[i * 3 + 1] = c2.g; this.cor2[i * 3 + 2] = c2.b;
    }
  }
  atualizar(dt: number) {
    let j = 0;
    for (let i = 0; i < this.n; i++) {
      const v = this.vida[i] - dt;
      if (v <= 0) continue;
      if (j !== i) this.copiar(i, j);
      this.vida[j] = v;
      const k = 1 - v / this.max[j];
      const ar = 1 - this.arr[j] * dt;
      this.vel[j * 3] *= ar; this.vel[j * 3 + 1] = this.vel[j * 3 + 1] * ar - this.grav[j] * dt; this.vel[j * 3 + 2] *= ar;
      this.pos[j * 3] += this.vel[j * 3] * dt; this.pos[j * 3 + 1] += this.vel[j * 3 + 1] * dt; this.pos[j * 3 + 2] += this.vel[j * 3 + 2] * dt;
      if (this.pos[j * 3 + 1] < -.2 && this.grav[j] > 0) { this.pos[j * 3 + 1] = -.2; this.vel[j * 3 + 1] = 0; }
      this.gAlfa[j] = this.alfa0[j] * (k < .1 ? k / .1 : 1 - (k - .1) / .9);
      this.gTam[j] = this.tam[j] + (this.tamF[j] - this.tam[j]) * k;
      this.gCor[j * 3] = this.cor[j * 3] + (this.cor2[j * 3] - this.cor[j * 3]) * k;
      this.gCor[j * 3 + 1] = this.cor[j * 3 + 1] + (this.cor2[j * 3 + 1] - this.cor[j * 3 + 1]) * k;
      this.gCor[j * 3 + 2] = this.cor[j * 3 + 2] + (this.cor2[j * 3 + 2] - this.cor[j * 3 + 2]) * k;
      j++;
    }
    this.n = j;
    this.geo.setDrawRange(0, j);
    for (const nome of ["position", "aCor", "aAlfa", "aTam"]) {
      const a = this.geo.getAttribute(nome) as THREE.BufferAttribute;
      a.clearUpdateRanges();
      a.addUpdateRange(0, j * a.itemSize);
      a.needsUpdate = true;
    }
    this.mat.uniforms.uEsc.value = engine.H * engine.dpr / (2 * Math.tan(THREE.MathUtils.degToRad(engine.camera.fov) / 2));
  }
  private copiar(i: number, j: number) {
    for (let c = 0; c < 3; c++) {
      this.pos[j * 3 + c] = this.pos[i * 3 + c]; this.vel[j * 3 + c] = this.vel[i * 3 + c];
      this.cor[j * 3 + c] = this.cor[i * 3 + c]; this.cor2[j * 3 + c] = this.cor2[i * 3 + c];
    }
    this.max[j] = this.max[i]; this.tam[j] = this.tam[i]; this.tamF[j] = this.tamF[i];
    this.grav[j] = this.grav[i]; this.arr[j] = this.arr[i]; this.alfa0[j] = this.alfa0[i];
  }
  limpar() { this.n = 0; this.geo.setDrawRange(0, 0); }
}
