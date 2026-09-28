/* ================================================================
   Animação procedural: passada, golpe, tiro, conjuração, investida,
   tranco ao apanhar, queda ao morrer. Só rotações de osso e um pouco
   de translação do quadril — nada de clipe, nada de arquivo.
   ================================================================ */
import * as THREE from "three";
import type { Rig } from "./rig";
import { ARCO, H } from "./humanos";
import { A, D, Q } from "./bichos";

export interface Pose {
  andar: number;        // 0..1 suavizado
  fase: number;         // fase da passada
  golpe: number;        // -1 sem golpe; 0..1 progresso
  mira: number;         // arco erguido 0..1
  puxa: number;         // corda puxada 0..1
  cast: number;         // 0..1 da conjuração (0 = nada)
  investida: number;    // 0..1
  morte: number;        // 0..1 da queda
  lado: number;         // lado da queda ±1
  t: number;            // relógio
  bote: number;         // arranco à frente (lunge)
  fogo: number;         // monstro cuspindo fogo 0..1
  corrida: number;      // pressa (investida de bicho, fuga)
}
export function novaPose(): Pose {
  return { andar: 0, fase: 0, golpe: -1, mira: 0, puxa: 0, cast: 0, investida: 0, morte: 0, lado: 1, t: 0, bote: 0, fogo: 0, corrida: 0 };
}
const qA = new THREE.Quaternion(), qB = new THREE.Quaternion(), eixo = new THREE.Vector3();

/* golpe de arma: ergue acima da cabeça, desce rápido à frente, volta */
function bracoGolpe(g: number) {
  const ss = (x: number) => x * x * (3 - 2 * x);
  if (g < .38) return -2.6 * ss(g / .38);
  if (g < .56) return -2.6 + 2.05 * ss((g - .38) / .18);
  return -.55 * (1 - ss((g - .56) / .44));
}

/* ---------- arco ----------
   Ângulos (Euler XYZ, com Y = 0) que levam um braço pendurado (0,-1,0) a
   apontar para a direção d: Rz abre para o lado, Rx leva à frente. */
function apontar(dx: number, dy: number, dz: number) {
  const z = Math.asin(Math.max(-1, Math.min(1, dx)));
  return { x: Math.atan2(-dz, -dy), z };
}
const MIRA = { lx: 0, lz: 0, rx: 0, rz: 0 };
function mirarArco(r: Rig, puxa: number) {
  const os = r.base.ossos;
  const sL = os[H.ARM_L].p, sR = os[H.ARM_R].p, mao = os[H.ARCO].p;
  const L = Math.hypot(mao[0] - sL[0], mao[1] - sL[1], mao[2] - sL[2]);
  /* mão do arco: um pouco para dentro da linha do ombro, na altura dele */
  const lx = -.14 * L / .32, lz = Math.sqrt(Math.max(0, L * L - lx * lx));
  const e = apontar(lx / L, 0, lz / L);
  MIRA.lx = e.x; MIRA.lz = e.z;
  /* mão da corda: na linha da corda (z da mão do arco menos a barriga),
     e recuando ao puxar; a distância ao ombro é sempre o braço */
  const zCorda = lz - ARCO.barriga;
  const sz = zCorda - puxa * .09, sy = -.02;
  const sx = Math.sqrt(Math.max(0, L * L - sy * sy - sz * sz));
  const d = apontar(sx / L, sy / L, sz / L);
  MIRA.rx = d.x; MIRA.rz = d.z;
  void sR;
  return MIRA;
}
const qBraco = new THREE.Quaternion(), qRepouso = new THREE.Quaternion().setFromEuler(new THREE.Euler(.32, 0, -.1));
function posarArco(o: THREE.Bone[], mira: number, puxa: number) {
  /* o osso do arco desfaz a rotação do braço: na mira o arco fica de pé,
     com a barriga para o alvo; andando, segue a mão levemente inclinado */
  qBraco.copy(o[H.ARM_L].quaternion).invert();
  o[H.ARCO].quaternion.slerpQuaternions(qRepouso, qBraco, mira);
  /* a corda dobra em V até a mão que puxa */
  const dobra = Math.atan2(puxa * .09 * mira, ARCO.meia);
  o[H.CORDA_A].rotation.x = dobra;
  o[H.CORDA_B].rotation.x = -dobra;
  /* a flecha só existe na mira: aponta para a frente, presa à mão direita */
  const vis = mira > .55 ? 1 : .0001;
  o[H.FLECHA].scale.setScalar(vis);
  o[H.FLECHA].quaternion.copy(o[H.ARM_R].quaternion).invert();
}

export function animar(r: Rig, p: Pose) {
  const o = r.ossos, rest = r.rest, a = r.base.anim;
  for (let i = 0; i < o.length; i++) { o[i].rotation.set(0, 0, 0); o[i].position.copy(rest[i]); o[i].scale.set(1, 1, 1); }
  const w = p.andar, s = Math.sin(p.fase), c = Math.cos(p.fase), t = p.t;
  switch (r.base.arq) {
    case "humano": {
      const amp = .72 * a.passo;
      o[H.LEG_L].rotation.x = -s * amp * w;
      o[H.LEG_R].rotation.x = s * amp * w;
      o[H.HIPS].position.y = rest[H.HIPS].y + Math.abs(c) * .035 * w * r.base.alt + Math.sin(t * 2.1) * .006 * (1 - w);
      o[H.TORSO].rotation.x = (a.corcunda || 0) + .07 * w + p.bote * .9 + p.investida * .45;
      o[H.TORSO].rotation.y = s * .08 * w;
      o[H.HEAD].rotation.x = -(a.corcunda || 0) * .8 - p.investida * .3;
      o[H.HEAD].rotation.y = Math.sin(t * .7) * .12 * (1 - w);
      let bl = s * .55 * w * a.balanco, br = -s * .55 * w * a.balanco;
      let blz = .06, brz = -.06;
      let mira = 0;
      if (a.arma === "arco") {
        mira = Math.min(1, Math.max(p.mira, p.puxa));
        if (mira > .001) {
          /* braço do arco estendido à frente do ombro esquerdo; mão da corda
             encostada na corda, e recuando até o queixo conforme puxa */
          const e = mirarArco(r, p.puxa);
          const k = mira * mira * (3 - 2 * mira);
          bl += (e.lx - bl) * k; blz += (e.lz - blz) * k;
          br += (e.rx - br) * k; brz += (e.rz - brz) * k;
        }
      } else if (a.arma === "cajado") {
        if (p.cast > 0) {
          const k = Math.sin(Math.min(1, p.cast) * Math.PI);
          br = br * (1 - k) - 2.1 * k; bl = bl * (1 - k) - 1.2 * k; blz = .3 * k;
          o[H.TORSO].rotation.x -= .15 * k;
        }
        if (p.golpe >= 0) { const k = Math.sin(Math.min(1, p.golpe) * Math.PI); br = br - 1.25 * k; }
      } else if (a.arma !== "nenhuma") {
        if (p.golpe >= 0) {
          br = bracoGolpe(p.golpe);
          o[H.TORSO].rotation.y += -.3 * Math.sin(p.golpe * Math.PI);
          o[H.TORSO].rotation.x += .12 * Math.sin(p.golpe * Math.PI);
          bl = -.55 * Math.sin(p.golpe * Math.PI);
        }
        if (p.cast > 0) {
          const k = Math.sin(Math.min(1, p.cast) * Math.PI);
          br = br * (1 - k) - 2.6 * k; bl = bl * (1 - k) - 2.6 * k;
        }
        if (p.investida > 0) { br = -1.45; bl = .5; }
      } else {
        bl = bl * .3 + Math.sin(t * 1.3) * .08; br = br * .3 - .5 + Math.sin(t * 1.1 + 1) * .1;
      }
      o[H.ARM_L].rotation.x = bl; o[H.ARM_L].rotation.z = blz;
      o[H.ARM_R].rotation.x = br; o[H.ARM_R].rotation.z = brz;
      if (a.arma === "arco") posarArco(o, mira, p.puxa);
      o[H.CAPE].rotation.x = .12 + w * .45 + p.investida * .5 + Math.sin(t * 3 + p.fase) * .05 * w;
      if (o[H.WING_L]) {
        const f = (a.arma === "clava" ? .25 : 0) + Math.sin(t * 2.2) * .15 + p.cast * .6;
        o[H.WING_L].rotation.y = -f; o[H.WING_R].rotation.y = f;
      }
      o[H.TAIL].rotation.y = Math.sin(t * 2.4) * .35; o[H.TAIL].rotation.x = Math.sin(t * 1.3) * .1;
      break;
    }
    case "quad": {
      const amp = .6 * a.passo * (1 + p.corrida * .4);
      o[Q.FL].rotation.x = -s * amp * w; o[Q.BR].rotation.x = -s * amp * w;
      o[Q.FR].rotation.x = s * amp * w; o[Q.BL].rotation.x = s * amp * w;
      o[Q.BODY].position.y = rest[Q.BODY].y + Math.abs(c) * .04 * w * r.base.alt + Math.sin(t * 2) * .004;
      o[Q.BODY].rotation.x = c * .05 * w - p.bote * .25;
      o[Q.BODY].position.z = rest[Q.BODY].z + p.bote * .25 * r.base.alt;
      const g = p.golpe >= 0 ? Math.sin(p.golpe * Math.PI) : 0;
      o[Q.HEAD].rotation.x = g * .55 - (1 - w) * Math.max(0, Math.sin(t * .4)) * .25 + s * .05 * w;
      o[Q.HEAD].rotation.y = Math.sin(t * .5) * .15 * (1 - w);
      o[Q.TAIL].rotation.y = Math.sin(t * (w > .3 ? 9 : 3)) * .35 * (a.cauda || 1);
      o[Q.TAIL].rotation.x = -.1 + w * .15;
      break;
    }
    case "ave": {
      o[A.LEG_L].rotation.x = -s * .8 * w; o[A.LEG_R].rotation.x = s * .8 * w;
      o[A.BODY].position.y = rest[A.BODY].y + Math.abs(c) * .03 * w;
      o[A.BODY].rotation.x = .1 * w;
      const bica = Math.max(0, Math.sin(t * 1.7)) ** 8 * (1 - w);
      o[A.HEAD].rotation.x = bica * .9 + (p.golpe >= 0 ? Math.sin(p.golpe * Math.PI) * .7 : 0);
      o[A.HEAD].position.z = rest[A.HEAD].z + Math.sin(p.fase * 2) * .025 * w;
      const bate = (p.corrida > .1 || w > .7) ? Math.sin(t * 22) * .7 : Math.sin(t * 2) * .05;
      o[A.WING_L].rotation.z = -Math.abs(bate); o[A.WING_R].rotation.z = Math.abs(bate);
      o[A.TAIL].rotation.x = Math.sin(t * 3) * .1;
      break;
    }
    case "aranha": {
      for (let i = 0; i < 8; i++) {
        const b = o[2 + i], side = i < 4 ? 1 : -1, k = i % 4;
        const ph = p.fase * 1.4 + (k % 2 === (i < 4 ? 0 : 1) ? 0 : Math.PI);
        const sweep = Math.sin(ph) * .35 * w;
        const lift = Math.max(0, Math.cos(ph)) * .35 * w + (p.golpe >= 0 && k === 0 ? Math.sin(p.golpe * Math.PI) * .9 : 0);
        const ang = [.55, 1.0, 1.45, 1.95][k];
        eixo.set(Math.cos(ang), 0, -side * Math.sin(ang)).normalize();
        qA.setFromAxisAngle(eixo, -lift * side);
        qB.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, sweep * side);
        b.quaternion.copy(qB).multiply(qA);
      }
      o[1].position.y = rest[1].y + Math.abs(Math.sin(p.fase * 2.8)) * .02 * w + Math.sin(t * 3) * .006;
      o[1].rotation.x = -p.bote * .3;
      break;
    }
    case "dragao": {
      const amp = .45;
      o[D.FL].rotation.x = -s * amp * w; o[D.BR].rotation.x = -s * amp * w;
      o[D.FR].rotation.x = s * amp * w; o[D.BL].rotation.x = s * amp * w;
      o[D.BODY].position.y = rest[D.BODY].y + Math.abs(c) * .05 * w + Math.sin(t * 1.4) * .02;
      const g = p.golpe >= 0 ? Math.sin(p.golpe * Math.PI) : 0;
      const f = p.fogo;
      o[D.NECK].rotation.x = Math.sin(t * .9) * .06 - f * .5 + g * .5;
      o[D.HEAD].rotation.x = f > 0 ? (f < .5 ? -f * .8 : (f - .5) * 1.4 - .4) : g * .4;
      o[D.NECK].rotation.y = Math.sin(t * .6) * .15;
      const bate = w > .2 || f > 0 || g > 0 ? Math.sin(t * (f > 0 ? 9 : 4)) * .5 + .2 : Math.sin(t * 1.2) * .12 + .35;
      o[D.WING_L].rotation.z = bate; o[D.WING_R].rotation.z = -bate;
      o[D.TAIL1].rotation.y = Math.sin(t * 1.6) * .25; o[D.TAIL2].rotation.y = Math.sin(t * 1.6 - .8) * .4;
      o[D.TAIL1].rotation.x = -.05;
      break;
    }
  }
  /* queda: tomba de lado e assenta no chão */
  if (p.morte > 0) {
    const k = Math.min(1, p.morte), e = 1 - (1 - k) * (1 - k);
    o[0].rotation.z = p.lado * e * Math.PI * .5;
    o[0].position.y = rest[0].y + r.base.raio * .35 * e;
  }
}
