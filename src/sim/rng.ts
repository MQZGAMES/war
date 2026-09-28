/* Aleatoriedade determinística. O mundo nasce de uma semente: a mesma
   semente e o mesmo tamanho refazem o mesmo mapa, a mesma cidade e os
   mesmos pontos de caça (é o que permite salvar só o que muda). */
export function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let gen = mulberry32((Date.now() ^ 0x9e3779b9) >>> 0);
export let SEED = 0;
export function reseed(seed: number) { SEED = seed >>> 0; gen = mulberry32(SEED); }
export const rnd = () => gen();
export const rr = (a: number, b: number) => a + gen() * (b - a);
export const ri = (a: number, b: number) => Math.floor(rr(a, b + 1));
export function pick<T>(a: readonly T[]): T { return a[Math.floor(gen() * a.length)]; }

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
export const dist2 = (ax: number, ay: number, bx: number, by: number) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/* ruído de valor, usado no terreno e no minimapa */
export function hash2(x: number, y: number) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}
export function vnoise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}
