# Mesa de Guerra 3D

RPG de mundo aberto num **diorama 3D isométrico**, feito para o **celular primeiro** e para rodar **no navegador**, inclusive offline. É o sucessor da `mesa-de-guerra-v54.html`: a mesma dinâmica — cidade com zona de proteção, obelisco de renascimento, Feiticeiro, Comerciante e Banqueiro, quatro vocações, catorze criaturas, caveiras e trava de PZ, grupos e táticas da IA, auto cura, auto refil e auto ataque — reconstruída do zero com tecnologia de jogo de verdade.

## O que mudou em relação à v54

| | v54 (2D) | 3D |
|---|---|---|
| Motor | Canvas 2D, um arquivo | **Three.js (WebGL 2)**, TypeScript, Vite |
| Visual | sprites desenhados a cada quadro | **modelos low-poly com esqueleto**, luz e **sombra em tempo real**, **ciclo de dia e noite**, água animada por shader, grama e árvores ao vento, partículas na GPU |
| Mundo | tabuleiro plano | **maquete sobre uma mesa de madeira**: relevo, margens em camadas de terra, trilhas de terra batida, cada ponto de caça com o seu tom de chão e decoração (ossos, teias, cogumelos, acampamentos com fogueira, rachaduras de lava, cristais) |
| Magias | anéis e bolinhas | meteoro caindo com rastro de fogo, nevasca com círculo rúnico, chuva de cura, terremoto com rachadura, bola de fogo e onda de fogo do dragão, clarões de luz |
| Som | nenhum | **efeitos e música sintetizados na hora** (WebAudio): golpes, flechas, explosões, moedas, fanfarra de nível; música que muda com a noite e o combate; pássaros de dia, grilos à noite |
| Interface | DOM puro | **Preact** + sinais, ícones SVG próprios, fontes Cinzel e Inter embutidas, retratos 3D reais dos heróis |
| Celular | responsivo | **PWA instalável**, tela cheia, áreas seguras do notch, qualidade automática que se ajusta ao aparelho |

A simulação (IA, economia, combate, PK) foi **portada linha a linha** da v54 e mantém os nomes originais das funções (`unitThink`, `worldThink`, `lancarMeteoro`, `iniciaRefil`…), para ser fácil conferir uma contra a outra. As **fichas e mundos `.json` salvos na v54 abrem aqui**.

## Como rodar

Pré-requisito: [Node.js](https://nodejs.org) 20 ou mais novo.

```bash
npm install
npm run dev
```

Abra o endereço que aparecer (o `--host` também mostra o endereço da rede local, para testar no celular na mesma Wi-Fi).

## Como construir

```bash
npm run build          # dist/        → site estático + PWA (funciona offline depois da 1ª visita)
npm run build:single   # dist-single/ → um único index.html (~1,3 MB) que abre com dois cliques, sem servidor
```

A pasta `dist/` pode ser publicada em qualquer hospedagem estática (GitHub Pages, Netlify, Cloudflare Pages, Vercel). Aberto no celular, "Adicionar à tela inicial" instala o jogo em tela cheia.

`npm run typecheck` confere os tipos; `node scripts/gerar-icones.mjs` refaz os ícones do app.

## Publicar (GitHub Pages + Supabase)

O workflow `.github/workflows/deploy.yml` gera o build e publica no GitHub Pages a cada push na `main`.
O save na nuvem é opcional: sem as variáveis do Supabase o jogo roda só com o save local.

1. **Supabase**: crie um projeto, abra *SQL Editor* e rode `supabase/schema.sql`.
   O login é por link no e-mail (o modelo padrão do Supabase). Com SMTP próprio dá para incluir `{{ .Token }}` no modelo *Magic Link* e o e-mail passa a trazer também um código.
   Em *Authentication > URL Configuration* ponha a URL do Pages em *Site URL* e em *Redirect URLs* (e `http://localhost:5173/**` para testar no PC).
2. **GitHub**: crie o repositório e envie esta pasta. Em *Settings > Pages > Source* escolha **GitHub Actions**.
   Em *Settings > Secrets and variables > Actions > Variables* crie `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
   (em *Project Settings > API* no Supabase) e rode o workflow de novo.
3. Para testar a nuvem localmente, copie `.env.example` para `.env.local` e preencha.

## Controles

- **Mover**: arraste o polegar em qualquer lugar do mapa (manche invisível) · `WASD`/setas.
- **Atacar**: toque no inimigo para travar o alvo, ou o botão grande (mais perto) · `F`.
- **Magias**: três casas ao lado do Atacar · `1` `2` `3`. Magia de área pede um toque no chão.
- **Poções**: frascos à esquerda do aglomerado · `Q` `E`.
- **Painéis** (equipamento, atributos, magias, cura/refil, ataque, equipe, ficha): botão da mochila · `M`.
- **Zoom**: pinça ou roda do mouse. **Câmera livre**: botão de câmera; o dedo passa a arrastar a vista.
- **Menu e pausa**: `Esc` ou `Espaço`.

## Arquitetura

```
src/
  sim/       a simulação — nenhum DOM, nenhum WebGL
    data.ts        equilíbrio: vocações, bestiário, magias, exaustão, PZ, caveiras
    itemsData.ts   itens, preços, kit inicial
    state.ts       estado do mundo (W) e da sessão (G)
    map.ts         geração do mapa, cidade, A*, linha de visão, grade espacial
    combat.ts      acerto, dano, morte, espólio, XP, loot, projéteis, meteoros
    spells.ts      lançadores das magias (os mesmos para IA e jogador)
    ai.ts          IA tática (percepção, utilidade) e IA da fauna
    player.ts      automação do personagem sob comando e do grupo que o segue
    world.ts       zonas, bandos, grupos, convites, táticas, PK, ciclo da cidade
    step.ts        passo fixo de 1/60 s
    session.ts     mundo novo, herói novo, assumir/largar o comando
    save.ts        fichas, mundo .json, partida no aparelho, preferências
    fx.ts          barramento de eventos (a simulação anuncia, o resto reage)
  render/    Three.js
    engine.ts      renderizador, câmera, qualidade, tela ↔ chão
    terrain.ts     terreno, margens da maquete, mesa, água (shader)
    nature.ts      árvores, pedras, grama, decoração temática (instanciado)
    city.ts        praça, obelisco, lampiões, barracas e NPCs
    models/        modelos procedurais com esqueleto e animação procedural
    units3d.ts     figuras das unidades, anéis, sombras, cadáveres
    fx3d.ts        partículas, projéteis, magias, decalques, clarões
    overlay.ts     nomes, barras e números de dano em 2D por cima do 3D
    scene.ts       orquestra: dia e noite, sombras, árvore translúcida
  audio/sfx.ts  efeitos, música generativa e som ambiente (WebAudio)
  game/         laço principal e entrada (toque, pinça, teclado)
  ui/           interface Preact: HUD, folha de painéis, balcões, telas
```

Cada personagem é **uma malha com pele** (um desenho por figura, sombra inclusa): as peças são montadas em código e presas a ossos, e a animação (passada, golpe, tiro com arco, conjuração, investida, queda) é calculada a partir do estado da simulação. Não há nenhum arquivo de modelo, textura de personagem ou áudio no projeto.
