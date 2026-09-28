/* Raiz da interface: o HUD fica por baixo das telas; o título e a
   escolha de herói escondem o HUD, como na v54. */
import { tela, tick } from "./store";
import { Hud } from "./hud";
import { Ajuda, Ajustes, Heroi, Menu, Mundo, Titulo } from "./telas";
import { Conta } from "./conta";

export function App() {
  void tick.value;
  const t = tela.value;
  const hud = t !== "titulo" && t !== "heroi";
  return (
    <>
      {hud && <Hud />}
      {t === "titulo" && <Titulo />}
      {t === "heroi" && <Heroi />}
      {t === "ajuda" && <Ajuda />}
      {t === "menu" && <Menu />}
      {t === "mundo" && <Mundo />}
      {t === "ajustes" && <Ajustes />}
      {t === "conta" && <Conta />}
    </>
  );
}
