import { defineConfig, type Plugin } from "vite";
import preact from "@preact/preset-vite";
import { viteSingleFile } from "vite-plugin-singlefile";

/* Service worker gerado no build: guarda todos os arquivos emitidos para
   o jogo abrir offline depois da primeira visita (PWA). Só no build
   normal — o .html único já é offline por natureza. */
function serviceWorker(): Plugin {
  return {
    name: "mesa-sw",
    apply: "build",
    generateBundle(_opts, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith(".map"));
      const lista = ["./", ...files.map((f) => "./" + f), "./manifest.webmanifest", "./icon.svg", "./icon-192.png", "./icon-512.png"];
      const versao = Date.now().toString(36);
      const codigo = `/* Mesa de Guerra 3D — cache offline (gerado no build) */
const CACHE="mesa3d-${versao}";
const ARQUIVOS=${JSON.stringify(lista)};
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ARQUIVOS)).then(()=>self.skipWaiting()));});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET"||new URL(e.request.url).origin!==location.origin)return;
  e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(r=>r||fetch(e.request).then(res=>{
    if(res.ok&&new URL(e.request.url).origin===location.origin){const cp=res.clone();caches.open(CACHE).then(c=>c.put(e.request,cp));}
    return res;
  }).catch(()=>caches.match("./"))));
});
`;
      this.emitFile({ type: "asset", fileName: "sw.js", source: codigo });
    },
  };
}

export default defineConfig(({ mode }) => {
  const single = mode === "single";
  return {
    base: "./",
    plugins: [preact(), ...(single ? [viteSingleFile()] : [serviceWorker()])],
    define: { __SINGLE__: JSON.stringify(single) },
    build: {
      outDir: single ? "dist-single" : "dist",
      target: "es2020",
      chunkSizeWarningLimit: 4000,
      assetsInlineLimit: single ? 100_000_000 : 4096,
      reportCompressedSize: false,
    },
    server: { host: true, port: 5173 },
  };
});
