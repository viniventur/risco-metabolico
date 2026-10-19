import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { avisar } from "@/shared/ui/avisos";

import { useFiltrosDiabetes } from "./useFiltrosDiabetes";

/**
 * Limpar os 6 filtros da vertente, com "Desfazer" — o mesmo que o botão Voltar, porque cada mudança
 * de filtro é uma entrada do histórico (nuqs, history: "push").
 */
export function useLimparFiltrosDiabetes(): { vazio: boolean; limpar: () => void } {
  const { vazio, limpar: limparUrl } = useFiltrosDiabetes();
  const navegar = useNavigate();
  const limpar = useCallback(() => {
    if (vazio) return;
    limparUrl();
    avisar.info("Filtros limpos", { acao: { rotulo: "Desfazer", aoClicar: () => navegar(-1) } });
  }, [vazio, limparUrl, navegar]);
  return { vazio, limpar };
}

/**
 * Atalho Esc das telas que filtram a vertente (a Visão Geral e a Consulta chamam): o da casca
 * (shared/filtros/useAtalhoEsc) só vale para as telas da obesidade. Uma camada aberta do Radix consome
 * o primeiro Esc e marca o evento: só o segundo limpa os filtros.
 */
export function useAtalhoEscDiabetes(): void {
  const { vazio, limpar } = useLimparFiltrosDiabetes();
  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key !== "Escape" || evento.defaultPrevented || vazio) return;
      limpar();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [vazio, limpar]);
}
