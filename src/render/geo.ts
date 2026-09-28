/* Montagem de geometria low-poly com cor por vértice (e osso, para
   personagens). Tudo vira uma malha só: uma chamada de desenho. */
import * as THREE from "three";

export class Montador {
  pos: number[] = []; nor: number[] = []; col: number[] = []; si: number[] = []; sw: number[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3();
  private nm = new THREE.Matrix3();

  /* acrescenta uma geometria transformada, com cor e osso */
  add(g: THREE.BufferGeometry, p: [number, number, number], cor: THREE.Color | string | null | ((x: number, y: number, z: number) => THREE.Color),
    osso = 0, rot: [number, number, number] = [0, 0, 0], esc: [number, number, number] = [1, 1, 1]) {
    const geo = g.index ? g.toNonIndexed() : g;
    if (!geo.getAttribute("normal")) geo.computeVertexNormals();
    this.e.set(rot[0], rot[1], rot[2]);
    this.q.setFromEuler(this.e);
    this.v.set(p[0], p[1], p[2]);
    this.s.set(esc[0], esc[1], esc[2]);
    this.m.compose(this.v, this.q, this.s);
    this.nm.getNormalMatrix(this.m);
    const P = geo.getAttribute("position"), Nn = geo.getAttribute("normal");
    const fixa = cor === null || typeof cor === "function" ? null : (typeof cor === "string" ? new THREE.Color(cor) : cor);
    const Cc = cor === null ? geo.getAttribute("color") : null;
    const tv = new THREE.Vector3(), tn = new THREE.Vector3();
    for (let i = 0; i < P.count; i++) {
      tv.set(P.getX(i), P.getY(i), P.getZ(i)).applyMatrix4(this.m);
      tn.set(Nn.getX(i), Nn.getY(i), Nn.getZ(i)).applyMatrix3(this.nm).normalize();
      this.pos.push(tv.x, tv.y, tv.z);
      this.nor.push(tn.x, tn.y, tn.z);
      if (Cc) this.col.push(Cc.getX(i), Cc.getY(i), Cc.getZ(i));
      else {
        const c = fixa || (cor as (x: number, y: number, z: number) => THREE.Color)(tv.x, tv.y, tv.z);
        this.col.push(c.r, c.g, c.b);
      }
      this.si.push(osso, 0, 0, 0);
      this.sw.push(1, 0, 0, 0);
    }
    if (geo !== g) geo.dispose();
    return this;
  }
  geometria(pele = false) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    if (pele) {
      g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(this.si, 4));
      g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(this.sw, 4));
    }
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/* primitivas baratas e reaproveitadas */
const cache = new Map<string, THREE.BufferGeometry>();
function mem(k: string, f: () => THREE.BufferGeometry) { let g = cache.get(k); if (!g) { g = f(); cache.set(k, g); } return g; }
export const P = {
  caixa: (w: number, h: number, d: number) => mem("b" + w + "," + h + "," + d, () => new THREE.BoxGeometry(w, h, d)),
  cil: (rt: number, rb: number, h: number, s = 6) => mem("c" + rt + "," + rb + "," + h + "," + s, () => new THREE.CylinderGeometry(rt, rb, h, s)),
  cone: (r: number, h: number, s = 6) => mem("k" + r + "," + h + "," + s, () => new THREE.ConeGeometry(r, h, s)),
  esfera: (r: number, d = 0) => mem("i" + r + "," + d, () => new THREE.IcosahedronGeometry(r, d)),
  bola: (r: number, w = 8, h = 6) => mem("s" + r + "," + w + "," + h, () => new THREE.SphereGeometry(r, w, h)),
  dodeca: (r: number) => mem("d" + r, () => new THREE.DodecahedronGeometry(r, 0)),
  octa: (r: number) => mem("o" + r, () => new THREE.OctahedronGeometry(r, 0)),
  tetra: (r: number) => mem("t" + r, () => new THREE.TetrahedronGeometry(r, 0)),
  toro: (r: number, t: number, rs = 5, ts = 10) => mem("r" + r + "," + t + "," + rs + "," + ts, () => new THREE.TorusGeometry(r, t, rs, ts)),
  plano: (w: number, h: number) => mem("p" + w + "," + h, () => new THREE.PlaneGeometry(w, h)),
};
/* asa ou lâmina: triângulo/quadrilátero fino com espessura mínima */
export function lamina(pts: [number, number][], esp = .02) {
  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: esp, bevelEnabled: false });
  g.translate(0, 0, -esp / 2);
  return g;
}
export function deformar(g: THREE.BufferGeometry, amt: number, seed: number) {
  const geo = g.clone();
  const p = geo.getAttribute("position");
  const mapa = new Map<string, [number, number, number]>();
  let s = seed * 9301 + 49297;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = 0; i < p.count; i++) {
    const k = p.getX(i).toFixed(3) + "," + p.getY(i).toFixed(3) + "," + p.getZ(i).toFixed(3);
    let d = mapa.get(k);
    if (!d) { d = [(rnd() - .5) * amt, (rnd() - .5) * amt, (rnd() - .5) * amt]; mapa.set(k, d); }
    p.setXYZ(i, p.getX(i) + d[0], p.getY(i) + d[1], p.getZ(i) + d[2]);
  }
  geo.computeVertexNormals();
  return geo;
}
