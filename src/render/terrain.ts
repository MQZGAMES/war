/* ================================================================
   TERRENO — a campina vira maquete: grade com relevo sutil, cores por
   vértice (grama, trilhas, tom de cada ponto de caça), margens em
   camadas de terra e a mesa de madeira embaixo. Água por shader.
   ================================================================ */
import * as THREE from "three";
import { W } from "../sim/state";
import { vnoise } from "../sim/rng";
import { CID_R } from "../sim/map";
import { canvasTex, cor, h2, U } from "./util";

export const T = {
  N: 0,
  H: new Float32Array(0),          // altura por vértice, (N+1)²
  AGUA: -.09,
  FUNDO: -1.9,                      // tampo da mesa
};
export function alturaEm(x: number, y: number) {
  const N = T.N;
  if (!N) return 0;
  const cx = Math.max(0, Math.min(N - .001, x)), cy = Math.max(0, Math.min(N - .001, y));
  const ix = cx | 0, iy = cy | 0, fx = cx - ix, fy = cy - iy, S = N + 1;
  const a = T.H[iy * S + ix], b = T.H[iy * S + ix + 1], c = T.H[(iy + 1) * S + ix], d = T.H[(iy + 1) * S + ix + 1];
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
}

/* tom do chão em cada ponto de caça */
const TEMA: Record<string, string> = {
  "Pastagem": "#7fb24a", "Toca de ratos": "#7d7a4c", "Ninhada": "#8aac52", "Alcateia": "#5a7a44",
  "Lameiro": "#6e5a3a", "Teia": "#4e5a46", "Cerrado": "#a09c56", "Covil": "#546a3e",
  "Savana": "#bfa95a", "Acampamento orc": "#7c6646", "Urso do norte": "#6c8a70", "Ruína antiga": "#7d8468",
  "Ermo": "#948a62", "Horda orc": "#6e5a40", "Colina do touro": "#8e7048", "Bosque negro": "#3c4838",
  "Penhasco": "#7c7b73", "Vale calcinado": "#4a403a", "Toca do dragão": "#5c3c32", "Fenda infernal": "#5e2a26",
  "Trono do ciclope": "#706e64",
};
export function temaDaZona(nome: string) { return TEMA[nome] || "#6aa24c"; }

const GRAMA = ["#4c7d3a", "#57893f", "#629545", "#6fa04b"].map(cor);
const CALCADA = cor("#8e8573"), AREIA = cor("#8a8255"), TRILHA = cor("#9a8058"), TERRA = cor("#6b4f35");

function distSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / l2; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}

export function construirTerreno(): THREE.Group {
  const N = W.N, S = N + 1;
  T.N = N;
  T.H = new Float32Array(S * S);
  const grupo = new THREE.Group();
  grupo.name = "terreno";
  const c = W.cidade;
  const tc = W.tileCol, solid = W.solid;
  const agua = (x: number, y: number) => x >= 0 && y >= 0 && x < N && y < N && tc[y * N + x] === 200;

  /* ---------- alturas ---------- */
  const o = (W.semente % 997) * .37;
  for (let y = 0; y <= N; y++) for (let x = 0; x <= N; x++) {
    let h = vnoise(x * .12 + o, y * .12 + o) * .26 + vnoise(x * .37 + 9, y * .37 + o) * .07;
    const dc = Math.hypot(x - c.x, y - c.y);
    const f = Math.max(0, Math.min(1, (dc - (CID_R + 1)) / 3));
    h *= f;
    let na = 0;
    if (agua(x - 1, y - 1)) na++; if (agua(x, y - 1)) na++; if (agua(x - 1, y)) na++; if (agua(x, y)) na++;
    if (na) h = h * (1 - na / 4) + (na === 4 ? -.46 : -.12 - na * .07) * (na / 4) + (na === 4 ? 0 : -.05);
    if (na === 4) h = -.46 + (vnoise(x * .9, y * .9) - .5) * .08;
    if (!na) h = Math.max(h, 0);
    if (x === 0 || y === 0 || x === N || y === N) h = Math.max(h, -.05);
    T.H[y * S + x] = h;
  }

  /* ---------- cor por ladrilho ---------- */
  const tileCor: THREE.Color[] = new Array(N * N);
  const zonas = W.zones.filter((z) => !z.errante);
  const trilhas = zonas.map((z) => {
    const a = Math.atan2(z.y - c.y, z.x - c.x);
    return { ax: c.x + Math.cos(a) * (CID_R - .5), ay: c.y + Math.sin(a) * (CID_R - .5), bx: z.x, by: z.y, w: .55 + z.tier * .03 };
  });
  const tmp = new THREE.Color();
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, v = tc[i];
    const cc = new THREE.Color();
    if (v === 200) cc.copy(AREIA);
    else if (v >= 4) cc.copy(CALCADA);
    else {
      cc.copy(GRAMA[v]);
      const n = vnoise(x * .23 + 3, y * .23 + 7);
      cc.lerp(tmp.set("#8fae4e"), Math.max(0, n - .55) * .9);
      /* tom do ponto de caça */
      for (const z of zonas) {
        const d = Math.hypot(x + .5 - z.x, y + .5 - z.y);
        const r = z.r + 1.2;
        if (d > r + 2.5) continue;
        const k = d < r ? .82 : .82 * (1 - (d - r) / 2.5);
        cc.lerp(tmp.set(temaDaZona(z.name)), k * (.85 + vnoise(x * .5, y * .5) * .15));
      }
      /* trilhas de terra batida da cidade até os pontos de caça */
      for (const t of trilhas) {
        const wob = (vnoise(x * .31 + t.bx, y * .31 + t.by) - .5) * 1.1;
        const d = distSeg(x + .5 + wob, y + .5 + wob, t.ax, t.ay, t.bx, t.by);
        if (d < t.w + .6) cc.lerp(TRILHA, Math.max(0, Math.min(1, (t.w + .6 - d) / .8)) * .8);
      }
      /* sombra de copa: chão mais escuro em volta das árvores */
      if (solid[i] && W.blockLOS[i]) cc.multiplyScalar(.78);
    }
    tileCor[i] = cc;
  }
  /* borda da praça: terra batida em volta do calçamento */
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.hypot(x + .5 - c.x, y + .5 - c.y);
    if (d > CID_R && d < CID_R + 1.6 && tc[y * N + x] < 4) tileCor[y * N + x].lerp(TRILHA, .55 * (1 - (d - CID_R) / 1.6));
  }

  /* ---------- malha ---------- */
  const pos = new Float32Array(S * S * 3), col = new Float32Array(S * S * 3);
  for (let y = 0; y <= N; y++) for (let x = 0; x <= N; x++) {
    const k = y * S + x;
    const jx = (x > 0 && x < N) ? (h2(x, y) - .5) * .18 : 0, jy = (y > 0 && y < N) ? (h2(y + 99, x) - .5) * .18 : 0;
    pos[k * 3] = x + jx; pos[k * 3 + 1] = T.H[k]; pos[k * 3 + 2] = y + jy;
    let r = 0, g = 0, b = 0, n = 0;
    for (let dy = -1; dy <= 0; dy++) for (let dx = -1; dx <= 0; dx++) {
      const tx = x + dx, ty = y + dy;
      if (tx < 0 || ty < 0 || tx >= N || ty >= N) continue;
      const t = tileCor[ty * N + tx]; r += t.r; g += t.g; b += t.b; n++;
    }
    const s = 1 + (h2(x * 3 + 1, y * 5 + 2) - .5) * .12;
    const hh = T.H[k];
    const fundo = hh < -.2 ? .55 + (hh + .46) * 1.4 : 1;   // lagoa mais escura no fundo
    col[k * 3] = r / n * s * fundo; col[k * 3 + 1] = g / n * s * fundo; col[k * 3 + 2] = b / n * s * fundo;
  }
  const idx: number[] = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const a = y * S + x, b = a + 1, cI = a + S, d = cI + 1;
    if ((x + y) & 1) { idx.push(a, cI, b, b, cI, d); } else { idx.push(a, cI, d, a, d, b); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const chao = new THREE.Mesh(geo, mat);
  chao.receiveShadow = true;
  chao.name = "chao";
  grupo.add(chao);

  grupo.add(construirMargem(N, S));
  grupo.add(construirMesa(N));
  grupo.add(construirAgua(N, S));
  return grupo;
}

/* ---------- margem da maquete: grama, terra e pedra ---------- */
function construirMargem(N: number, S: number) {
  const pos: number[] = [], col: number[] = [];
  const faixas = [
    { y: 0, c: cor("#5a8a3e") }, { y: -.14, c: cor("#4d3a26") }, { y: -.75, c: cor("#5b4330") },
    { y: -1.25, c: cor("#4a4644") }, { y: T.FUNDO, c: cor("#3a3634") },
  ];
  const borda: [number, number][] = [];
  for (let x = 0; x < N; x++) borda.push([x, 0]);
  for (let y = 0; y < N; y++) borda.push([N, y]);
  for (let x = N; x > 0; x--) borda.push([x, N]);
  for (let y = N; y > 0; y--) borda.push([0, y]);
  for (let i = 0; i < borda.length; i++) {
    const [ax, ay] = borda[i], [bx, by] = borda[(i + 1) % borda.length];
    const ha = T.H[ay * S + ax], hb = T.H[by * S + bx];
    for (let f = 0; f < faixas.length - 1; f++) {
      const y0a = f === 0 ? ha : faixas[f].y, y0b = f === 0 ? hb : faixas[f].y, y1 = faixas[f + 1].y;
      const c0 = faixas[f].c, c1 = faixas[f + 1].c;
      /* leve saliência irregular nas camadas */
      const off = (h2(ax * 7 + f, ay * 3 + f) - .5) * .06;
      const nx = ay === 0 && by === 0 ? 0 : ay === N && by === N ? 0 : (ax === 0 && bx === 0 ? -1 : ax === N && bx === N ? 1 : 0);
      const nz = ax === 0 && bx === 0 ? 0 : ax === N && bx === N ? 0 : (ay === 0 && by === 0 ? -1 : ay === N && by === N ? 1 : 0);
      const e = f === 0 ? 0 : off;
      const v = [
        [ax + nx * e, y0a, ay + nz * e, c0], [bx + nx * e, y0b, by + nz * e, c0],
        [ax + nx * e, y1, ay + nz * e, c1], [bx + nx * e, y1, by + nz * e, c1],
      ] as [number, number, number, THREE.Color][];
      const tri = [0, 2, 1, 1, 2, 3];
      for (const t of tri) {
        const q = v[t];
        pos.push(q[0], q[1], q[2]);
        const s = 1 + (h2(ax * 11 + t, ay * 13 + f) - .5) * .14;
        col.push(q[3].r * s, q[3].g * s, q[3].b * s);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }));
  m.receiveShadow = true;
  m.name = "margem";
  return m;
}

/* ---------- a mesa de guerra ---------- */
function texMadeira() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = "#5a3a22"; g.fillRect(0, 0, w, h);
    const tabuas = 6, th = h / tabuas;
    for (let i = 0; i < tabuas; i++) {
      const base = 40 + (i * 37) % 22;
      g.fillStyle = `hsl(26, 42%, ${base * .5 + 8}%)`;
      g.fillRect(0, i * th, w, th - 2);
      for (let k = 0; k < 90; k++) {
        const y = i * th + Math.random() * th, a = .05 + Math.random() * .09;
        g.strokeStyle = `rgba(${Math.random() < .5 ? "30,16,6" : "120,80,45"},${a})`;
        g.lineWidth = .6 + Math.random() * 1.6;
        g.beginPath();
        g.moveTo(0, y);
        for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * .02 + k) * 2.2);
        g.stroke();
      }
      g.fillStyle = "rgba(10,5,2,.55)"; g.fillRect(0, i * th + th - 2, w, 2);
      for (let n = 0; n < 2; n++) {           // nó da madeira
        const nx = Math.random() * w, ny = i * th + th * (.3 + Math.random() * .4);
        const gr = g.createRadialGradient(nx, ny, 0, nx, ny, 9);
        gr.addColorStop(0, "rgba(25,12,4,.6)"); gr.addColorStop(1, "rgba(25,12,4,0)");
        g.fillStyle = gr; g.beginPath(); g.ellipse(nx, ny, 14, 6, 0, 0, 7); g.fill();
      }
    }
  }, true);
}
function construirMesa(N: number) {
  const grupo = new THREE.Group();
  const lado = N * 4 + 60;
  const tex = texMadeira();
  tex.repeat.set(lado / 14, lado / 14);
  const mesa = new THREE.Mesh(new THREE.PlaneGeometry(lado, lado), new THREE.MeshLambertMaterial({ map: tex, color: "#b09070" }));
  mesa.rotation.x = -Math.PI / 2;
  mesa.position.set(N / 2, T.FUNDO, N / 2);
  mesa.receiveShadow = true;
  grupo.add(mesa);
  /* sombra de contato da maquete sobre a mesa */
  const sombra = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
    map: canvasTex(128, 128, (g) => {
      const gr = g.createRadialGradient(64, 64, 20, 64, 64, 64);
      gr.addColorStop(0, "rgba(0,0,0,.75)"); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    }), transparent: true, depthWrite: false,
  }));
  sombra.rotation.x = -Math.PI / 2;
  sombra.scale.set(N * 1.45, N * 1.45, 1);
  sombra.position.set(N / 2, T.FUNDO + .01, N / 2);
  grupo.add(sombra);
  grupo.name = "mesa";
  return grupo;
}

/* ---------- água: profundidade pela altura do fundo ---------- */
function construirAgua(N: number, S: number) {
  const data = new Uint8Array(S * S * 4);
  for (let i = 0; i < S * S; i++) {
    const v = Math.max(0, Math.min(255, Math.round((T.H[i] + 1) * 127.5)));
    data[i * 4] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uAlt: { value: null as THREE.Texture | null }, uS: { value: S }, uAgua: { value: T.AGUA },
      uRaso: { value: new THREE.Color("#57c2c0") }, uFundo: { value: new THREE.Color("#1a5a70") },
    }]),
    vertexShader: `
      varying vec3 vW;
      #include <fog_pars_vertex>
      void main(){
        vec4 wp = modelMatrix * vec4(position,1.0);
        vW = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform sampler2D uAlt; uniform float uS; uniform float uAgua; uniform float uTime; uniform float uNight;
      uniform vec3 uRaso; uniform vec3 uFundo;
      varying vec3 vW;
      #include <fog_pars_fragment>
      void main(){
        vec2 uv = (vW.xz + .5) / uS;
        float h = texture2D(uAlt, uv).r * 2.0 - 1.0;
        float prof = uAgua - h;
        if (prof < 0.0) discard;
        float t = uTime;
        float w1 = sin(vW.x * 2.1 + t * 1.3) * cos(vW.z * 1.7 - t * 1.1);
        float w2 = sin((vW.x + vW.z) * 3.7 - t * 2.2) * .5;
        vec3 n = normalize(vec3(w1 * .18 + w2 * .1, 1.0, w2 * .16 - w1 * .08));
        vec3 L = normalize(vec3(.4, .8, .35));
        vec3 V = normalize(cameraPosition - vW);
        float spec = pow(max(dot(reflect(-L, n), V), 0.0), 48.0) * (1.0 - uNight * .7);
        float k = smoothstep(0.0, .34, prof);
        vec3 c = mix(uRaso, uFundo, k);
        c += (w1 * .5 + .5) * .05;
        float espuma = (1.0 - smoothstep(0.0, .045, prof)) * (.55 + .45 * sin(t * 2.6 + (vW.x - vW.z) * 6.0));
        c = mix(c, vec3(.92, .98, 1.0), espuma * .55);
        c += spec * .9;
        c *= mix(1.0, .42, uNight);
        c = mix(c, c * vec3(.55, .7, 1.1), uNight * .6);
        gl_FragColor = vec4(c, mix(.55, .9, k) + espuma * .15);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  mat.uniforms.uAlt.value = tex;
  mat.uniforms.uTime = U.uTime;
  mat.uniforms.uNight = U.uNight;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(N, N), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(N / 2, T.AGUA, N / 2);
  m.renderOrder = 2;
  m.name = "agua";
  return m;
}
