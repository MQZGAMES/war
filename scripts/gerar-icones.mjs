/* Gera os ícones do app (PNG 192 e 512 + SVG) sem dependência nenhuma:
   desenho por função de distância, 4×4 amostras por pixel e codificação
   PNG à mão com o zlib do Node. Uso: node scripts/gerar-icones.mjs */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return (buf) => { let c = 0xffffffff; for (const b of buf) c = t[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
})();
function bloco(tipo, dados) {
  const len = Buffer.alloc(4); len.writeUInt32BE(dados.length);
  const td = Buffer.concat([Buffer.from(tipo, "ascii"), dados]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(CRC(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const cru = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { cru[y * (w * 4 + 1)] = 0; rgba.copy(cru, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloco("IHDR", ihdr), bloco("IDAT", deflateSync(cru, { level: 9 })), bloco("IEND", Buffer.alloc(0))]);
}

/* ---------- desenho em coordenadas 0..1 ---------- */
const mix = (a, b, t) => a + (b - a) * t;
function sdCaixa(px, py, cx, cy, hw, hh, ang) {
  const c = Math.cos(-ang), s = Math.sin(-ang);
  const x = (px - cx) * c - (py - cy) * s, y = (px - cx) * s + (py - cy) * c;
  const dx = Math.abs(x) - hw, dy = Math.abs(y) - hh;
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0);
}
function sdPonta(px, py, cx, cy, hw, hh, ang) {
  /* lâmina que afina até a ponta */
  const c = Math.cos(-ang), s = Math.sin(-ang);
  const x = (px - cx) * c - (py - cy) * s, y = (px - cx) * s + (py - cy) * c;
  const k = Math.max(0, Math.min(1, (y + hh) / (2 * hh)));
  const w = hw * (k < .18 ? k / .18 : 1);
  const dx = Math.abs(x) - w, dy = Math.abs(y) - hh;
  return Math.max(dx, dy);
}
function cor(x, y) {
  /* fundo: verde-noite com brilho no centro */
  const r0 = Math.hypot(x - .5, y - .42);
  let R = mix(34, 8, Math.min(1, r0 * 1.6)), G = mix(52, 13, Math.min(1, r0 * 1.6)), B = mix(46, 12, Math.min(1, r0 * 1.6));
  const pinta = (d, cr, cg, cb, a = 1) => { if (d < 0) { R = mix(R, cr, a); G = mix(G, cg, a); B = mix(B, cb, a); } };
  /* anel dourado */
  const ra = Math.abs(Math.hypot(x - .5, y - .5) - .36) - .018;
  pinta(ra, 217, 180, 92);
  /* duas espadas cruzadas */
  for (const s of [1, -1]) {
    const ang = s * Math.PI / 4;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const P = (t) => [.5 + sa * t, .5 - ca * t];
    const [bx, by] = P(.06);
    const lam = sdPonta(x, y, bx, by, .032, .24, ang);
    const [gx, gy] = P(-.17);
    const guarda = sdCaixa(x, y, gx, gy, .09, .018, ang);
    const [hx, hy] = P(-.24);
    const cabo = sdCaixa(x, y, hx, hy, .02, .06, ang);
    const [px, py] = P(-.31);
    const pomo = Math.hypot(x - px, y - py) - .03;
    pinta(Math.min(lam, 1) - .012, 20, 16, 12);
    pinta(lam, 238, 236, 228);
    if (lam < 0 && (x - bx) * ca + (y - by) * sa > 0) { R = mix(R, 170, .5); G = mix(G, 176, .5); B = mix(B, 184, .5); }
    pinta(Math.min(guarda, cabo, pomo) - .012, 20, 16, 12);
    pinta(cabo, 110, 74, 40);
    pinta(Math.min(guarda, pomo), 232, 196, 96);
  }
  return [R, G, B];
}
function rasterizar(n) {
  const buf = Buffer.alloc(n * n * 4), S = 4;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let r = 0, g = 0, b = 0;
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      const c = cor((x + (sx + .5) / S) / n, (y + (sy + .5) / S) / n);
      r += c[0]; g += c[1]; b += c[2];
    }
    const i = (y * n + x) * 4, k = S * S;
    buf[i] = Math.round(r / k); buf[i + 1] = Math.round(g / k); buf[i + 2] = Math.round(b / k); buf[i + 3] = 255;
  }
  return buf;
}
mkdirSync("public", { recursive: true });
for (const n of [192, 512]) writeFileSync(`public/icon-${n}.png`, png(n, n, rasterizar(n)));
writeFileSync("public/icon.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<defs><radialGradient id="f" cx=".5" cy=".42" r=".7"><stop offset="0" stop-color="#22342e"/><stop offset="1" stop-color="#080d0c"/></radialGradient></defs>
<rect width="100" height="100" rx="22" fill="url(#f)"/>
<circle cx="50" cy="50" r="36" fill="none" stroke="#d9b45c" stroke-width="3.6"/>
<g stroke-linecap="round"><g transform="rotate(45 50 50)"><path d="M47 20h6l-3-6z" fill="#eeece4"/><rect x="46.8" y="20" width="6.4" height="42" fill="#eeece4"/><rect x="41" y="62" width="18" height="3.6" rx="1.4" fill="#e8c460"/><rect x="48" y="65" width="4" height="10" fill="#6e4a28"/><circle cx="50" cy="78" r="3" fill="#e8c460"/></g>
<g transform="rotate(-45 50 50)"><path d="M47 20h6l-3-6z" fill="#eeece4"/><rect x="46.8" y="20" width="6.4" height="42" fill="#eeece4"/><rect x="41" y="62" width="18" height="3.6" rx="1.4" fill="#e8c460"/><rect x="48" y="65" width="4" height="10" fill="#6e4a28"/><circle cx="50" cy="78" r="3" fill="#e8c460"/></g></g>
</svg>
`);
console.log("ícones gerados em public/");
