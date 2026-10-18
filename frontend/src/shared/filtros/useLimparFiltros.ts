import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

import { avisar } from "@/shared/ui/avisos";

import { useFiltros } from "./useFiltros";

/**
 * Limpar os 6 filtros, com "Desfazer". Os filtros moram na URL e cada mudança é uma entrada do
 * histórico (nuqs, history: "push"): desfazer é voltar uma entrada — o mesmo que o botão Voltar.
 */
export function useLimparFiltros(): { vazio: boolean; limpar: () => void } {
  const { vazio, limpar: limparUrl } = useFiltros();
  const navegar = useNavigate();
  const limpar = useCallback(() => {
    if (vazio) return;
    limparUrl();
    avisar.info("Filtros limpos", { acao: { rotulo: "Desfazer", aoClicar: () => navegar(-1) } });
  }, [vazio, limparUrl, navegar]);
  return { vazio, limpar };
}
