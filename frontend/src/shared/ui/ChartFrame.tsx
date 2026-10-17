import { useId, useState, type ReactNode } from "react";

import { IconeTabela } from "@/shared/ui/icones";

type Props = {
  titulo: string;
  /** a frase @mede do agregado: o que o leitor não técnico entende */
  descricao?: string;
  altura?: number;
  /** <TabelaEquivalente> — todo gráfico tem o botão "Ver dados" (acessibilidade, 7.3) */
  tabela?: ReactNode;
  acoes?: ReactNode;
  children: ReactNode;
};

/**
 * Moldura comum dos gráficos: título, descrição, altura RESOLVIDA (o ResponsiveContainer com
 * height="100%" dentro de pai `auto` renderiza com 0 px) e o botão "Ver dados".
 */
export function ChartFrame({ titulo, descricao, altura = 300, tabela, acoes, children }: Props) {
  const [mostrarTabela, setMostrarTabela] = useState(false);
  const idTitulo = useId();
  return (
    <section className="cartao flex flex-col gap-2 p-4" aria-labelledby={idTitulo}>
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 id={idTitulo} className="text-base font-semibold text-texto">
            {titulo}
          </h2>
          {descricao ? <p className="text-xs text-texto-fraco">{descricao}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {acoes}
          {tabela ? (
            <button
              type="button"
              onClick={() => setMostrarTabela((v) => !v)}
              aria-pressed={mostrarTabela}
              className="flex h-9 items-center gap-1 rounded-card border border-borda bg-superficie px-2 text-xs text-texto hover:bg-superficie-alta"
            >
              <IconeTabela width={16} height={16} />
              {mostrarTabela ? "Ver gráfico" : "Ver dados"}
            </button>
          ) : null}
        </div>
      </header>
      <div style={{ height: altura }} className="relative w-full">
        {mostrarTabela && tabela ? <div className="h-full overflow-auto">{tabela}</div> : children}
      </div>
    </section>
  );
}
