import { useCallback, useSyncExternalStore } from "react";

export type Tema = "light" | "dark";

/**
 * O tema vigente lido do DOM, que é a fonte única: `public/tema-inicial.js` escreve `data-theme`
 * antes da hidratação, e `alternar` escreve no mesmo lugar. Sem o atributo (script bloqueado ou
 * JavaScript desligado), vale o sistema — a mesma regra da `@media` de `tokens.css`. Ler daqui, e
 * não de um estado próprio, é o que impede o botão de anunciar "claro" com a tela escura.
 */
function lerTema(): Tema {
  const atributo = document.documentElement.getAttribute("data-theme");
  if (atributo === "light" || atributo === "dark") return atributo;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function assinar(aoMudar: () => void): () => void {
  const observador = new MutationObserver(aoMudar);
  observador.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const consulta = window.matchMedia?.("(prefers-color-scheme: dark)");
  consulta?.addEventListener("change", aoMudar);
  return () => {
    observador.disconnect();
    consulta?.removeEventListener("change", aoMudar);
  };
}

export function useTema(): { tema: Tema; alternar: () => void } {
  const tema = useSyncExternalStore(assinar, lerTema, () => "light" as Tema);
  const alternar = useCallback(() => {
    const proximo: Tema = lerTema() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", proximo);
    try {
      localStorage.setItem("tema", proximo);
    } catch {
      /* modo privado ou armazenamento bloqueado: o tema vale só para esta visita */
    }
  }, []);
  return { tema, alternar };
}
