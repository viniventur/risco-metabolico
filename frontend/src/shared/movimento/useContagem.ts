import { useEffect, useState } from "react";

import { pedeMovimentoReduzido } from "./movimento";

export const DURACAO_DA_CONTAGEM_MS = 1600;

/** Sai rápido e chega devagar: os últimos dígitos assentam em vez de parar seco. */
export function desacelerar(progresso: number): number {
  return 1 - (1 - progresso) ** 4;
}

/**
 * Um número que CONTA de 0 até o alvo quando `ativo` liga (vem de `useApareceuNaTela`). Devolve o
 * valor do quadro, sem arredondar: quem formata decide as casas (98,8% conta em décimos).
 *
 * O tempo sai do carimbo do `requestAnimationFrame` e o primeiro quadro marca o início: com a aba em
 * segundo plano o navegador segura os quadros e, na volta, o número chega direto no alvo. Com
 * `prefers-reduced-motion`, ou com o alvo ainda desconhecido (`null`), não conta nada.
 */
export function useContagem(alvo: number | null | undefined, ativo: boolean, duracaoMs: number = DURACAO_DA_CONTAGEM_MS): number {
  const [reduzido] = useState(pedeMovimentoReduzido);
  const [valor, setValor] = useState(0);
  const destino = alvo ?? 0;

  useEffect(() => {
    if (!ativo || reduzido || alvo === null || alvo === undefined) return;
    let inicio: number | null = null;
    let quadro = requestAnimationFrame(function passo(agora: number) {
      inicio ??= agora;
      const progresso = Math.min((agora - inicio) / duracaoMs, 1);
      setValor(alvo * desacelerar(progresso));
      if (progresso < 1) quadro = requestAnimationFrame(passo);
    });
    return () => cancelAnimationFrame(quadro);
  }, [alvo, ativo, reduzido, duracaoMs]);

  return reduzido ? destino : valor;
}
