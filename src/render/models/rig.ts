/* ================================================================
   Esqueleto rígido: cada peça do modelo pertence a um osso (peso 1),
   então o personagem inteiro é UMA malha com pele — uma chamada de
   desenho por figura, sombra inclusa. A geometria é compartilhada por
   todos da mesma espécie; cada instância ganha os próprios ossos.
   ================================================================ */
import * as THREE from "three";

export type Arquetipo = "humano" | "quad" | "ave" | "aranha" | "dragao";
export interface OssoSpec { pai: number; p: [number, number, number] }
/* ponto de interesse preso a um osso: ponta do cajado, boca, olho */
export interface Ponto { osso: number; p: [number, number, number] }
export interface ModeloBase {
  arq: Arquetipo;
  geo: THREE.BufferGeometry;
  ossos: OssoSpec[];
  alt: number;                       // altura da figura em pé
  raio: number;                      // raio da sombra no chão
  pontos: Record<string, Ponto>;
  /* ajustes de animação próprios do modelo */
  anim: { passo: number; balanco: number; cauda?: number; asas?: number; arma?: "espada" | "arco" | "cajado" | "nenhuma" | "clava"; corcunda?: number };
}
export interface Rig {
  base: ModeloBase;
  mesh: THREE.SkinnedMesh;
  ossos: THREE.Bone[];
  rest: THREE.Vector3[];
  mat: THREE.MeshLambertMaterial;
}

export function criarRig(base: ModeloBase): Rig {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const mesh = new THREE.SkinnedMesh(base.geo, mat);
  const ossos: THREE.Bone[] = [];
  const rest: THREE.Vector3[] = [];
  base.ossos.forEach((o, i) => {
    const b = new THREE.Bone();
    if (o.pai < 0) b.position.set(o.p[0], o.p[1], o.p[2]);
    else {
      const pp = base.ossos[o.pai].p;
      b.position.set(o.p[0] - pp[0], o.p[1] - pp[1], o.p[2] - pp[2]);
    }
    rest.push(b.position.clone());
    ossos.push(b);
    if (o.pai >= 0) ossos[o.pai].add(b);
    void i;
  });
  mesh.add(ossos[0]);
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(ossos));
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  return { base, mesh, ossos, rest, mat };
}

const _v = new THREE.Vector3();
/* posição de mundo de um ponto preso a osso */
export function pontoMundo(r: Rig, nome: string, out: THREE.Vector3) {
  const pt = r.base.pontos[nome];
  if (!pt) return null;
  const o = r.base.ossos[pt.osso].p;
  _v.set(pt.p[0] - o[0], pt.p[1] - o[1], pt.p[2] - o[2]);
  r.ossos[pt.osso].updateWorldMatrix(true, false);
  return out.copy(_v).applyMatrix4(r.ossos[pt.osso].matrixWorld);
}
