import { ChartColumn, Table2 } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

type Props = {
  titulo: string;
  /** a frase @mede do agregado: o que o leitor não técnico entende */
  descricao?: string;
  /** Altura MÍNIMA da área do gráfico: <ResponsiveContainer height="100%"> em pai `auto` desenha 0 px. */
  altura?: number;
  /** <TabelaEquivalente> — todo gráfico tem o botão "Ver dados" (acessibilidade, §7.3) */
  tabela?: ReactNode;
  acoes?: ReactNode;
  /** Legenda em HTML, fora do SVG, abaixo da área do gráfico. */
  legenda?: ReactNode;
  className?: string;
  children: ReactNode;
};

/**
 * A moldura de todo gráfico: título e descrição em até duas linhas cada, área do gráfico que
 * cresce até o fundo do cartão (os cartões de uma linha têm a mesma altura e os gráficos terminam
 * alinhados), legenda em HTML e o alternador "Ver dados" (tabela equivalente) / gráfico.
 */
export function ChartFrame({ titulo, descricao, altura = 280, tabela, acoes, legenda, className, children }: Props) {
  const [mostrarTabela, setMostrarTabela] = useState(false);
  const idTitulo = useId();
  return (
    <Card className={cn("flex h-full min-w-0 flex-col", className)}>
      <section className="flex h-full min-w-0 flex-col" aria-labelledby={idTitulo}>
        <header className="flex items-start justify-between gap-3 p-5 pb-3">
          <div className="min-w-0">
            <h2 id={idTitulo} className="line-clamp-2 text-[15px] leading-tight font-semibold tracking-tight" title={titulo}>
              {titulo}
            </h2>
            {descricao ? <p className="mt-1 line-clamp-2 min-h-[2lh] text-[13px] leading-snug text-muted-foreground">{descricao}</p> : null}
          </div>
          <div className="nao-imprimir flex shrink-0 items-center gap-1">
            {acoes}
            {tabela ? (
              // Só o ícone, para o título caber nos cartões estreitos; o nome fica no aria-label e na dica.
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setMostrarTabela((v) => !v)}
                    aria-pressed={mostrarTabela}
                    aria-label="Ver dados em tabela"
                    className="text-muted-foreground aria-pressed:bg-accent aria-pressed:text-accent-foreground"
                  >
                    {mostrarTabela ? <ChartColumn aria-hidden="true" /> : <Table2 aria-hidden="true" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{mostrarTabela ? "Ver gráfico" : "Ver dados em tabela"}</TooltipContent>
              </Tooltip>
            ) : null}
          </div>
        </header>
        {/* A área cresce até o fundo do cartão (os cartões de uma linha têm a mesma altura) e nunca
            fica abaixo de `altura`; o conteúdo vai num bloco absoluto, de tamanho sempre resolvido. */}
        <div className="flex flex-1 flex-col gap-3 px-5 pb-5">
          <div style={{ minHeight: altura }} className="relative w-full min-w-0 flex-1">
            <div className="absolute inset-0">
              {mostrarTabela && tabela ? <div className="h-full overflow-auto rounded-md border">{tabela}</div> : children}
            </div>
          </div>
          {legenda && !mostrarTabela ? legenda : null}
        </div>
      </section>
    </Card>
  );
}
