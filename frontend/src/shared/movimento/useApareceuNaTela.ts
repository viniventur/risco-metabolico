import { useEffect, useState } from "react";

/**
 * "Este bloco já apareceu na tela?" — e, depois de aparecer, continua `true`: a revelação e a
 * contagem acontecem uma vez só, não a cada rolagem. A margem padrão dispara com o bloco já 48 px
 * DENTRO da janela, para a entrada ser vista. Sem `IntersectionObserver` (navegador antigo, jsdom),
 * o bloco nasce visível — nunca um conteúdo que não aparece.
 */
export function useApareceuNaTela<T extends Element>(margem = "0px 0px -48px 0px"): [(no: T | null) => void, boolean] {
  const [apareceu, setApareceu] = useState(() => typeof IntersectionObserver === "undefined");
  // Estado, e não ref: o nó chega depois do primeiro render, e o efeito precisa rodar quando chegar.
  const [no, setNo] = useState<T | null>(null);

  useEffect(() => {
    if (apareceu || !no) return;
    const observador = new IntersectionObserver(
      (entradas) => {
        if (!entradas.some((entrada) => entrada.isIntersecting)) return;
        setApareceu(true);
        observador.disconnect();
      },
      { rootMargin: margem },
    );
    observador.observe(no);
    return () => observador.disconnect();
  }, [apareceu, no, margem]);

  return [setNo, apareceu];
}
