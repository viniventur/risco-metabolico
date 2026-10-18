import { usePorCategorias } from "@/shared/api/endpoints/painel";
import { ORDEM_CLINICA } from "@/shared/dominio";
import { ErroInline } from "@/shared/estados/ErroInline";
import type { FiltroPainel } from "@/shared/filtros/filtroSchema";
import { useFiltros } from "@/shared/filtros/useFiltros";
import { useRotulos } from "@/shared/filtros/useRotulos";
import { fmtInt, fmtPct } from "@/shared/format/ptBR";
import { ChartFrame } from "@/shared/graficos/ChartFrame";
import { LegendaHtml } from "@/shared/graficos/LegendaHtml";
import { TabelaEquivalente } from "@/shared/graficos/TabelaEquivalente";
import { TooltipGrafico } from "@/shared/graficos/TooltipGrafico";
import { cn } from "@/shared/lib/utils";
import { useChartTheme, type TemaGrafico } from "@/shared/tema/useChartTheme";
import { Skeleton } from "@/shared/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

import { AMOSTRA_MINIMA, FATORES, montarGrupo, type GrupoFator, type LinhaFator } from "./fatores";
import { FUNDO_DO_NIVEL } from "./niveis";

function DetalheDaLinha({ linha, tema }: { linha: LinhaFator; tema: TemaGrafico }) {
  return (
    <TooltipGrafico
      titulo={`${linha.rotulo} · ${fmtInt(linha.n)} registros`}
      linhas={ORDEM_CLINICA.map((nivel) => ({
        rotulo: nivel,
        cor: tema.corDoNivel[nivel],
        valor: `${fmtPct(linha.n ? (linha.porNivel[nivel] ?? 0) / linha.n : null)} · ${fmtInt(linha.porNivel[nivel] ?? 0)}`,
      }))}
      nota={`${fmtPct(linha.obesidade)} em obesidade (I a III)`}
    />
  );
}

/** A barra 100% da categoria: os 7 níveis em ordem clínica, a obesidade na ponta direita, colada ao número. */
function BarraDeComposicao({ linha, media, niveisSelecionados }: { linha: LinhaFator; media: number | null; niveisSelecionados: string[] }) {
  return (
    <span className="relative block h-4 w-full">
      <span className="flex h-full w-full overflow-hidden rounded-[4px]">
        {ORDEM_CLINICA.map((nivel) => {
          const c = linha.porNivel[nivel] ?? 0;
          if (c === 0) return null;
          const apagado = niveisSelecionados.length > 0 && !niveisSelecionados.includes(nivel);
          return (
            <span
              key={nivel}
              // o vão de 2 px na cor do cartão separa os graus vizinhos da mesma família (o espaçador do dataviz)
              className={cn("h-full border-r-2 border-card last:border-r-0", FUNDO_DO_NIVEL[nivel], apagado && "opacity-30")}
              style={{ width: `${(c / linha.n) * 100}%` }}
            />
          );
        })}
      </span>
      {media !== null ? (
        // A média do grupo: onde a obesidade começaria numa categoria igual ao conjunto.
        <span aria-hidden="true" className="absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 rounded-full bg-foreground/80" style={{ left: `${(1 - media) * 100}%` }} />
      ) : null}
    </span>
  );
}

/** Abaixo de 640 px a barra desce para uma linha própria, de largura toda: ao lado do rótulo, sobravam 50 px. */
const NO_CELULAR_EMBAIXO = "order-last col-span-2 block sm:order-none sm:col-span-1";

function LinhaDoFator({ linha, grupo, tema }: { linha: LinhaFator; grupo: GrupoFator; tema: TemaGrafico }) {
  const { filtros, alternar } = useFiltros();
  const filtro = grupo.fator.filtro;
  const selecionados = filtro ? filtros[filtro] : [];
  const apagada = selecionados.length > 0 && !selecionados.includes(linha.valor);
  const descricao = linha.suprimido
    ? `${linha.rotulo}: ${fmtInt(linha.n)} registros, amostra pequena demais para a composição`
    : `${linha.rotulo}: ${fmtInt(linha.n)} registros, ${fmtPct(linha.obesidade)} em obesidade`;
  const conteudo = (
    <>
      <span className="flex min-w-0 items-baseline gap-1.5 text-left">
        <span className="truncate text-[13px]">{linha.rotulo}</span>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{fmtInt(linha.n)}</span>
      </span>
      {linha.suprimido ? (
        <span className={cn(NO_CELULAR_EMBAIXO, "justify-self-start text-xs text-muted-foreground italic")}>amostra &lt; {AMOSTRA_MINIMA}</span>
      ) : (
        <span className={NO_CELULAR_EMBAIXO}>
          <BarraDeComposicao linha={linha} media={grupo.media} niveisSelecionados={filtros.nivel} />
        </span>
      )}
      <span className="text-right text-[13px] font-semibold tabular-nums">{linha.suprimido ? "—" : fmtPct(linha.obesidade)}</span>
    </>
  );
  const classe = cn(
    "grid w-full grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-x-3 gap-y-1 rounded-md px-1.5 py-1.5 transition-opacity sm:grid-cols-[minmax(6.5rem,10rem)_minmax(0,1fr)_3.5rem]",
    apagada && "opacity-40",
  );
  const gatilho = filtro ? (
    <button type="button" onClick={() => alternar(filtro, linha.valor)} aria-pressed={selecionados.includes(linha.valor)} aria-label={descricao} className={cn(classe, "hover:bg-muted/70")}>
      {conteudo}
    </button>
  ) : (
    <div role="img" aria-label={descricao} className={classe}>
      {conteudo}
    </div>
  );
  if (linha.suprimido) return <li>{gatilho}</li>;
  return (
    <li>
      <Tooltip>
        <TooltipTrigger asChild>{gatilho}</TooltipTrigger>
        <TooltipContent side="top" className="border-0 bg-transparent p-0 shadow-none">
          <DetalheDaLinha linha={linha} tema={tema} />
        </TooltipContent>
      </Tooltip>
    </li>
  );
}

function GrupoDoFator({ grupo, tema }: { grupo: GrupoFator; tema: TemaGrafico }) {
  return (
    <section aria-label={grupo.fator.pergunta} className="flex min-w-0 flex-col gap-1">
      <header className="flex items-baseline justify-between gap-3 border-b px-1.5 pb-1.5">
        <h3 className="text-[13px] leading-tight font-semibold">{grupo.fator.pergunta}</h3>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">média {fmtPct(grupo.media)}</span>
      </header>
      <ul className="flex flex-col">
        {grupo.linhas.map((linha) => (
          <LinhaDoFator key={linha.valor} linha={linha} grupo={grupo} tema={tema} />
        ))}
      </ul>
    </section>
  );
}

/**
 * Fatores associados à obesidade: para cada hábito ou histórico, a composição das 7 classes em cada
 * resposta (barra 100%, na ordem clínica, com a obesidade na ponta direita) e, ao lado, quanto dela
 * está em obesidade. O traço vertical é a média do grupo: categoria com a obesidade começando antes
 * dele tem mais obesidade que o conjunto. É associação na base, não causa — e a base é majoritariamente
 * sintética. Ignora o filtro de nível (a barra É a composição dos níveis, que só se destacam) e o do
 * próprio fator (as respostas todas ficam visíveis; a escolhida, destacada); os demais filtros valem.
 */
export function FatoresAssociados() {
  const { filtros } = useFiltros();
  const tema = useChartTheme();
  const rotulo = useRotulos();
  const pedidos = FATORES.map((f) => {
    const recorte: FiltroPainel = { ...filtros, nivel: [], ...(f.filtro ? { [f.filtro]: [] } : {}) };
    return { campo: f.campo, metrica: "contagem" as const, filtros: recorte, serie: "nivel" };
  });
  const consultas = usePorCategorias(pedidos);
  const carregando = consultas.some((c) => c.isPending);
  const atualizando = !carregando && consultas.some((c) => c.isFetching);
  const erro = consultas.find((c) => c.error)?.error ?? null;
  const grupos = FATORES.map((f, i) => montarGrupo(f, consultas[i]?.data, rotulo));

  return (
    <ChartFrame
      titulo="Fatores associados à obesidade"
      descricao="Composição dos níveis em cada resposta, e quanto dela está em obesidade. O traço é a média do grupo. Associação na base, não causa."
      altura={360}
      alturaNatural
      tabela={
        <TabelaEquivalente
          legenda="Composição dos níveis por fator, em % de cada resposta"
          colunas={[
            { chave: "fator", rotulo: "Fator" },
            { chave: "resposta", rotulo: "Resposta" },
            { chave: "n", rotulo: "Registros", alinhar: "right" },
            ...ORDEM_CLINICA.map((nivel) => ({ chave: nivel, rotulo: nivel, alinhar: "right" as const })),
            { chave: "obesidade", rotulo: "Obesidade", alinhar: "right" },
          ]}
          linhas={grupos.flatMap((g) =>
            g.linhas.map((l) => ({
              fator: g.fator.pergunta,
              resposta: l.rotulo,
              n: fmtInt(l.n),
              ...Object.fromEntries(ORDEM_CLINICA.map((nivel) => [nivel, l.suprimido ? `n < ${AMOSTRA_MINIMA}` : fmtPct(l.n ? (l.porNivel[nivel] ?? 0) / l.n : null)])),
              obesidade: l.suprimido ? "—" : fmtPct(l.obesidade),
            })),
          )}
        />
      }
    >
      {erro ? (
        <ErroInline erro={erro} aoTentarNovamente={() => consultas.forEach((c) => void c.refetch())} />
      ) : (
        <div className={cn("flex flex-col gap-4", atualizando && "refetching")} aria-busy={carregando || atualizando || undefined}>
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <LegendaHtml titulo="Níveis" itens={ORDEM_CLINICA.map((nivel) => ({ rotulo: nivel, cor: tema.corDoNivel[nivel] ?? "", forma: "quadrado" as const }))} />
            <span className="pr-1.5 text-xs text-muted-foreground">à direita: % em obesidade</span>
          </div>
          {carregando ? (
            <div className="grid grid-cols-1 gap-x-10 gap-y-6 xl:grid-cols-2">
              {FATORES.map((f) => (
                <Skeleton key={f.campo} className="h-28 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-x-10 gap-y-6 xl:grid-cols-2">
              {grupos.map((g) => (
                <GrupoDoFator key={g.fator.campo} grupo={g} tema={tema} />
              ))}
            </div>
          )}
        </div>
      )}
    </ChartFrame>
  );
}
