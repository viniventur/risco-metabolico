import { toast } from "sonner";

/**
 * Os toasts do sistema, num lugar só. Toast é para o que não tem lugar fixo na tela (filtros limpos,
 * link copiado, relatório baixado); erro de carregamento continua DENTRO do cartão que falhou, e o
 * 429 do simulador continua na faixa fixa do formulário (§6.8.3) — o toast só reforça.
 */
export const avisar = {
  sucesso: (titulo: string, descricao?: string) => toast.success(titulo, { description: descricao }),
  erro: (titulo: string, descricao?: string) => toast.error(titulo, { description: descricao }),
  alerta: (titulo: string, descricao?: string) => toast.warning(titulo, { description: descricao }),
  info: (titulo: string, opcoes?: { descricao?: string; acao?: { rotulo: string; aoClicar: () => void } }) =>
    toast(titulo, {
      description: opcoes?.descricao,
      action: opcoes?.acao ? { label: opcoes.acao.rotulo, onClick: opcoes.acao.aoClicar } : undefined,
    }),
};
