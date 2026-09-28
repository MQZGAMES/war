/* ================================================================
   CIDADE — praça de pedra (toda PZ), meio-fio, anel verde tracejado
   da zona de proteção, obelisco com runas e bandeira, lampiões que
   acendem à noite e as barracas com os três NPCs.
   ================================================================ */
import * as THREE from "three";
import { W } from "../sim/state";
import { CID_R } from "../sim/map";
import { alturaEm } from "./terrain";
import { Montador, P, lamina, deformar } from "./geo";
import { canvasTex, comVento, cor, h2, texBrilho, texDisco, U } from "./util";
import { criarRig, type Rig } from "./models/rig";
import { modeloDoNpc } from "./models";
import { animar, novaPose, type Pose } from "./models/anim";

export const CIDADE = {
  grupo: null as THREE.Group | null,
  luzes: [] as THREE.Sprite[],
  npcs: [] as { rig: Rig; pose: Pose; x: number; y: number; fa: number; id: string }[],
  runas: null as THREE.Mesh | null,
  anelPZ: null as THREE.Mesh | null,
  lampioes: [] as { x: number; y: number; h: number }[],
  pocas: [] as THREE.Mesh[],
};

function texCalcamento() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = "#5e574c"; g.fillRect(0, 0, w, h);
    const cel = 26;
    for (let y = 0; y < h + cel; y += cel * .8) {
      const off = (Math.floor(y / (cel * .8)) % 2) * cel * .5;
      for (let x = -cel; x < w + cel; x += cel) {
        const cx = x + off + (Math.random() - .5) * 5, cy = y + (Math.random() - .5) * 4;
        const l = 44 + Math.random() * 22, s = 6 + Math.random() * 10;
        g.fillStyle = `hsl(${32 + Math.random() * 14}, ${s}%, ${l}%)`;
        g.beginPath();
        const r = cel * .44;
        for (let k = 0; k < 7; k++) {
          const a = k / 7 * Math.PI * 2, rr = r * (.82 + Math.random() * .3);
          const px = cx + Math.cos(a) * rr * 1.1, py = cy + Math.sin(a) * rr * .85;
          if (k) g.lineTo(px, py); else g.moveTo(px, py);
        }
        g.closePath(); g.fill();
        g.fillStyle = "rgba(255,255,255,.08)";
        g.beginPath(); g.ellipse(cx - 3, cy - 3, r * .5, r * .3, -.4, 0, 7); g.fill();
      }
    }
  }, true);
}

function obelisco(m: Montador, x: number, y: number, z: number) {
  const pedra = cor("#d8cfb8"), pedra2 = cor("#b7ad94"), ouro = cor("#f0cf6a");
  m.add(P.caixa(1.3, .18, 1.3), [x, y + .09, z], cor("#8e8573"));
  m.add(P.caixa(1.0, .18, 1.0), [x, y + .27, z], cor("#a89f8b"));
  m.add(P.cil(.2, .34, 2.6, 4), [x, y + 1.66, z], (_x, yy) => yy > y + 2.6 ? pedra : pedra2, 0, [0, Math.PI / 4, 0]);
  m.add(P.cone(.24, .5, 4), [x, y + 3.2, z], ouro, 0, [0, Math.PI / 4, 0]);
  /* mastro e bandeira */
  m.add(P.cil(.03, .035, 2.6, 5), [x + .7, y + 1.3, z + .7], "#3a2c1e");
  m.add(P.esfera(.06, 0), [x + .7, y + 2.62, z + .7], ouro);
}

export function construirCidade(): THREE.Group {
  const g = new THREE.Group();
  g.name = "cidade";
  const c = W.cidade;
  CIDADE.luzes = []; CIDADE.npcs = []; CIDADE.lampioes = []; CIDADE.pocas = [];
  const y0 = .035;
  /* praça */
  const tex = texCalcamento();
  tex.repeat.set(CID_R / 1.15, CID_R / 1.15);
  const praca = new THREE.Mesh(new THREE.CircleGeometry(CID_R + .15, 64), new THREE.MeshLambertMaterial({ map: tex, color: "#e8e0d0" }));
  praca.rotation.x = -Math.PI / 2;
  praca.position.set(c.x, y0, c.y);
  praca.receiveShadow = true;
  g.add(praca);
  /* meio-fio de pedras */
  const mf = new Montador();
  const n = 72;
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, r = CID_R + .22;
    const x = c.x + Math.cos(a) * r, z = c.y + Math.sin(a) * r;
    mf.add(deformar(P.caixa(.62, .16, .26), .04, i), [x, alturaEm(x, z) + .06, z], cor(i % 3 ? "#9d9483" : "#8a8272"), 0, [0, -a, 0]);
  }
  const meio = new THREE.Mesh(mf.geometria(), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  meio.receiveShadow = true; meio.castShadow = true;
  g.add(meio);
  /* anel verde tracejado e animado: onde a segurança começa */
  const anelMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: U.uTime, uNight: U.uNight },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `uniform float uTime; uniform float uNight; varying vec2 vUv;
      void main(){
        float a = vUv.x;
        float d = step(.45, fract(a * 64.0 - uTime * .35));
        float borda = 1.0 - abs(vUv.y - .5) * 2.0;
        float pulso = .55 + .2 * sin(uTime * 1.3);
        gl_FragColor = vec4(vec3(.5, 1.0, .65) * (pulso + uNight * .4), d * borda * (.55 + uNight * .3));
      }`,
  });
  const anelGeo = new THREE.RingGeometry(CID_R + .42, CID_R + .6, 128, 1);
  /* UV do anel: x = ângulo, y = raio */
  const uv = anelGeo.getAttribute("uv"), pos = anelGeo.getAttribute("position");
  for (let i = 0; i < uv.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    uv.setXY(i, (Math.atan2(y, x) / (Math.PI * 2) + 1) % 1, (Math.hypot(x, y) - (CID_R + .42)) / .18);
  }
  const anel = new THREE.Mesh(anelGeo, anelMat);
  anel.rotation.x = -Math.PI / 2;
  anel.position.set(c.x, .06, c.y);
  anel.renderOrder = 3;
  g.add(anel);
  CIDADE.anelPZ = anel;

  /* obelisco */
  const ob = W.props.find((p) => p.t === "obelisco")!;
  const om = new Montador();
  obelisco(om, ob.x + .5, y0, ob.y + .5);
  const obm = new THREE.Mesh(om.geometria(), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  obm.castShadow = true; obm.receiveShadow = true;
  g.add(obm);
  const bandeira = new THREE.Mesh(lamina([[0, 0], [.75, -.05], [.7, -.3], [.75, -.55], [0, -.5]], .01),
    comVento(new THREE.MeshLambertMaterial({ color: "#d9b45c", side: THREE.DoubleSide }), .12, .8, 3));
  bandeira.position.set(ob.x + .5 + .72, y0 + 2.55, ob.y + .5 + .7);
  bandeira.rotation.y = -Math.PI / 4;
  bandeira.castShadow = true;
  g.add(bandeira);
  const brilhoTopo = new THREE.Sprite(new THREE.SpriteMaterial({ map: texBrilho(), color: "#ffd86a", transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  brilhoTopo.position.set(ob.x + .5, y0 + 3.3, ob.y + .5);
  brilhoTopo.scale.set(1.4, 1.4, 1);
  g.add(brilhoTopo);
  CIDADE.luzes.push(brilhoTopo);
  /* runas girando em volta do obelisco: é o ponto de renascimento */
  const runas = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.35, 48, 1), new THREE.MeshBasicMaterial({
    map: canvasTex(256, 64, (gg, w, h) => {
      gg.clearRect(0, 0, w, h);
      gg.fillStyle = "rgba(255,220,120,.95)";
      gg.font = "bold 40px serif";
      const s = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃ";
      for (let i = 0; i < 12; i++) gg.fillText(s[i], i * 21 + 2, 46);
    }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .55,
  }));
  runas.rotation.x = -Math.PI / 2;
  runas.position.set(ob.x + .5, y0 + .38, ob.y + .5);
  g.add(runas);
  CIDADE.runas = runas;

  /* lampiões */
  const lm = new Montador();
  for (const p of W.props.filter((q) => q.t === "lampiao")) {
    const x = p.x + .5, z = p.y + .5, y = alturaEm(x, z);
    lm.add(P.cil(.05, .07, 1.7, 6), [x, y + .85, z], "#2e2a24");
    lm.add(P.caixa(.18, .06, .18), [x, y + .03, z], "#3a342c");
    lm.add(P.caixa(.2, .24, .2), [x, y + 1.82, z], "#2e2a24");
    lm.add(P.caixa(.14, .18, .14), [x, y + 1.82, z], "#ffe7a8");
    lm.add(P.cone(.17, .14, 4), [x, y + 2.02, z], "#2e2a24", 0, [0, Math.PI / 4, 0]);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texBrilho(), color: "#ffcf6a", transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .5 }));
    s.position.set(x, y + 1.84, z);
    s.scale.set(1.2, 1.2, 1);
    g.add(s);
    CIDADE.luzes.push(s);
    CIDADE.lampioes.push({ x, y: z, h: y + 1.84 });
    /* poça de luz quente no chão, acesa à noite */
    const poca = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: texDisco(), color: "#ffb54a", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    poca.position.set(x, y + .06, z); poca.scale.set(4.2, 1, 4.2); poca.renderOrder = 2;
    g.add(poca);
    CIDADE.pocas.push(poca);
  }
  const lamp = new THREE.Mesh(lm.geometria(), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  lamp.castShadow = true;
  g.add(lamp);

  /* barracas dos NPCs */
  const bm = new Montador();
  for (const n2 of c.npcs) {
    const fa = n2.fa, bx = n2.x - Math.cos(fa) * .95, bz = n2.y - Math.sin(fa) * .95;
    const y = alturaEm(bx, bz) + y0;
    const tint = cor(n2.cor.c), clara = cor(n2.cor.hi);
    const rot: [number, number, number] = [0, Math.PI / 2 - fa, 0];
    const lado = [-Math.sin(fa), Math.cos(fa)];
    /* balcão à frente do NPC */
    const cx = n2.x + Math.cos(fa) * .55, cz = n2.y + Math.sin(fa) * .55;
    bm.add(P.caixa(1.3, .5, .36), [cx, y + .25, cz], "#7a5a3a", 0, rot);
    bm.add(P.caixa(1.4, .06, .44), [cx, y + .53, cz], "#9c7650", 0, rot);
    /* postes e toldo listrado */
    for (const s of [-1, 1]) {
      bm.add(P.cil(.035, .035, 1.9, 5), [bx + lado[0] * .75 * s, y + .95, bz + lado[1] * .75 * s], "#5a3b22");
      bm.add(P.cil(.035, .035, 1.5, 5), [cx + lado[0] * .7 * s, y + .75, cz + lado[1] * .7 * s], "#5a3b22");
    }
    for (let k = 0; k < 6; k++) {
      const t = (k - 2.5) / 6 * 1.6;
      const tx = (bx + cx) / 2 + lado[0] * t, tz = (bz + cz) / 2 + lado[1] * t;
      bm.add(P.caixa(.28, .04, 1.6), [tx, y + 1.72, tz], k % 2 ? clara : tint, 0, [-.32, Math.PI / 2 - fa, 0]);
    }
    /* mercadoria no balcão */
    if (n2.id === "feiticeiro") {
      const cores = ["#d0473f", "#4f9bd8", "#d0473f", "#7fd68f", "#4f9bd8"];
      for (let k = 0; k < 5; k++) {
        const t = (k - 2) * .22, px = cx + lado[0] * t, pz = cz + lado[1] * t;
        bm.add(P.cil(.05, .06, .16, 6), [px, y + .64, pz], cores[k]);
        bm.add(P.cil(.02, .02, .06, 5), [px, y + .75, pz], "#e8e0d0");
      }
    } else if (n2.id === "comerciante") {
      for (let k = 0; k < 3; k++) {
        const t = (k - 1) * .35, px = cx + lado[0] * t, pz = cz + lado[1] * t;
        bm.add(P.caixa(.05, .03, .5), [px, y + .6, pz], "#c9cfd3", 0, [0, -fa, 0]);
      }
      bm.add(P.cil(.16, .16, .05, 10), [cx + lado[0] * .45, y + .62, cz + lado[1] * .45], "#8e949a", 0, [Math.PI / 2, -fa, 0]);
    } else if (n2.id === "ferreiro") {
      /* bigorna no balcão e a forja acesa atrás */
      bm.add(P.caixa(.34, .1, .14), [cx, y + .6, cz], "#3a3a40", 0, rot);
      bm.add(P.caixa(.16, .1, .1), [cx, y + .7, cz], "#4a4a52", 0, rot);
      bm.add(P.caixa(.5, .45, .4), [bx, y + .22, bz], "#6a5a50", 0, rot);
      bm.add(P.caixa(.3, .12, .24), [bx, y + .47, bz], "#ff6a1a", 0, rot);
      for (let k = 0; k < 3; k++) bm.add(P.caixa(.04, .04, .4), [cx + lado[0] * (k - 1) * .16 + Math.cos(fa) * .05, y + .57, cz + lado[1] * (k - 1) * .16 + Math.sin(fa) * .05], "#c9cfd3", 0, [0, -fa + .4 * (k - 1), 0]);
    } else {
      bm.add(P.caixa(.46, .3, .3), [bx, y + .15, bz], "#6a4428", 0, rot);
      bm.add(P.caixa(.48, .06, .32), [bx, y + .32, bz], "#e8c35a", 0, rot);
      for (let k = 0; k < 4; k++) bm.add(P.cil(.07, .07, .03, 8), [cx + lado[0] * (k - 1.5) * .12, y + .58 + (k % 2) * .03, cz + lado[1] * (k - 1.5) * .12], "#f2c53d");
    }
    /* o NPC */
    const base = modeloDoNpc(n2.id, n2.cor);
    const rig = criarRig(base);
    rig.mesh.position.set(n2.x, alturaEm(n2.x, n2.y) + y0, n2.y);
    rig.mesh.rotation.y = Math.PI / 2 - fa;
    g.add(rig.mesh);
    CIDADE.npcs.push({ rig, pose: novaPose(), x: n2.x, y: n2.y, fa, id: n2.id });
  }
  const barracas = new THREE.Mesh(bm.geometria(), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  barracas.castShadow = true; barracas.receiveShadow = true;
  g.add(barracas);

  /* barris e caixotes na borda da praça, entre os lampiões */
  const dm = new Montador();
  for (let k = 0; k < 10; k++) {
    const a = k / 10 * Math.PI * 2 + .18 + h2(k, 3) * .2, r = CID_R - .35;
    const x = c.x + Math.cos(a) * r, z = c.y + Math.sin(a) * r;
    if (c.npcs.some((q) => Math.hypot(q.x - x, q.y - z) < 1.8)) continue;
    if (h2(k, 7) < .5) {
      dm.add(P.cil(.17, .15, .42, 8), [x, y0 + .21, z], "#8a5a34");
      dm.add(P.toro(.165, .015, 3, 10), [x, y0 + .34, z], "#3a342c", 0, [Math.PI / 2, 0, 0]);
      dm.add(P.toro(.165, .015, 3, 10), [x, y0 + .08, z], "#3a342c", 0, [Math.PI / 2, 0, 0]);
    } else {
      dm.add(P.caixa(.36, .3, .36), [x, y0 + .15, z], "#9c744c", 0, [0, a, 0]);
      dm.add(P.caixa(.26, .22, .26), [x + .05, y0 + .41, z], "#8a6440", 0, [0, a + .4, 0]);
    }
  }
  const deco = new THREE.Mesh(dm.geometria(), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  deco.castShadow = true; deco.receiveShadow = true;
  g.add(deco);
  CIDADE.grupo = g;
  return g;
}

export function atualizarCidade(t: number, dt: number, noite: number) {
  if (CIDADE.runas) CIDADE.runas.rotation.z = t * .15;
  for (const s of CIDADE.luzes) {
    const m = s.material as THREE.SpriteMaterial;
    const flick = .9 + Math.sin(t * 7 + s.position.x * 3) * .05 + Math.sin(t * 13 + s.position.z) * .04;
    m.opacity = (.25 + noite * .75) * flick;
    const k = 1.1 + noite * 1.5;
    s.scale.set(k, k, 1);
  }
  for (const p of CIDADE.pocas) (p.material as THREE.MeshBasicMaterial).opacity = noite * .38 * (.94 + Math.sin(t * 6 + p.position.x) * .06);
  for (const n of CIDADE.npcs) {
    n.pose.t = t + n.x;
    animar(n.rig, n.pose);
  }
  void dt;
}
