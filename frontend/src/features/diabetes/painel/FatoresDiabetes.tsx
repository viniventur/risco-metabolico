import { ErroInline } from "@/shared/estados/ErroInline";
import { fmtInt, fmtPontosPct } from "@/shared/format/ptBR";
import { ChartFrame } from "@/shared/graficos/ChartFrame";
import { TabelaEquivalente } from "@/shared/graficos/TabelaEquivalente";
import { TooltipGrafico } from "@/shared/graficos/TooltipGrafico";
import { cn } from "@/shared/lib/utils";
import { useChartTheme } from "@/shared/tema/useChartTheme";
import { Skeleton } from "@/shared/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

import { useFatoresDiabetes, usePorCategoriasDiabetes } from "../api/painel";
import type { AgregadoDiabetes } from "../api/tipos";
import { FILTRO_VAZIO_DIABETES, NOMES_FILTRO_DIABETES, semFiltros } from "../filtros/filtroDiabetes";
import { useFiltrosDiabetes } from "../filtros/useFiltrosDiabetes";
import { montarGruposDeFatores, tetoDaPrevalencia, type GrupoFatorDiabetes, type LinhaPrevalencia } from "./prevalencia";

/** Abaixo desta largura a barra desce para uma linha própria (o desenho do gráfico de fatores da obesidade). */
const NO_CELULAR_EMBAIXO = "order-last col-span-2 block sm:order-none sm:col-span-1";

/** A barra do % com diabetes da resposta, sobre o trilho da escala, com o traço do conjunto da pergunta. */
function BarraDoFator({ linha, media, teto }: { linha: LinhaPrevalencia; media: number | null; teto: number }) {
  return (
    <span className="relative block h-3.5 w-full">
      <span className="absolute inset-y-0.5 right-0 left-0 rounded-[4px] bg-muted" />
      <span className="absolute inset-y-0 left-0 rounded-r-[4px] bg-diabetes" style={{ width: `${((linha.prevalencia ?? 0) / teto) * 100}%` }} />
      {media !== null ? (
        <span aria-hidden="true" className="absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 rounded-full bg-foreground/80" style={{ left: `${(media / teto) * 100}%` }} />
      ) : null}
    </span>
  );
}

function LinhaDoFator({ linha, grupo, teto, amostraMinima }: { linha: LinhaPrevalencia; grupo: GrupoFatorDiabetes; teto: number; amostraMinima: number }) {
  const { filtros, alternar } = useFiltrosDiabetes();
  const tema = useChartTheme();
  const filtro = grupo.filtro;
  const selecionados = filtro ? filtros[filtro] : [];
  const apagada = selecionados.length > 0 && !selecionados.includes(linha.valor);
  const descricao = linha.suprimido
    ? `${linha.rotulo}: ${fmtInt(linha.contagem)} respostas, amostra pequena demais para o %`
    : `${linha.rotulo}: ${fmtInt(linha.contagem)} respostas, ${fmtPontosPct(linha.prevalencia)} com diabetes`;
  const conteudo = (
    <>
      <span className="flex min-w-0 items-baseline gap-1.5 text-left">
        <span className="truncate text-[13px]">{linha.rotulo}</span>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{fmtInt(linha.contagem)}</span>
      </span>
      {linha.suprimido ? (
        <span className={cn(NO_CELULAR_EMBAIXO, "justify-self-start text-xs text-muted-foreground italic")}>amostra &lt; {amostraMinima}</span>
      ) : (
        <span className={NO_CELULAR_EMBAIXO}>
          <BarraDoFator linha={linha} media={grupo.media} teto={teto} />
        </span>
      )}
      <span className="text-right text-[13px] font-semibold tabular-nums">{linha.suprimido ? "—" : fmtPontosPct(linha.prevalencia)}</span>
    </>
  );
  const classe = cn(
    "grid w-full grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-x-3 gap-y-1 rounded-md px-1.5 py-1.5 transition-opacity sm:grid-cols-[minmax(6.5rem,15.5rem)_minmax(0,1fr)_3.5rem]",
    apagada && "opacity-40",
  );
  const gatilho = filtro ? (
    <button
      type="button"
      onClick={() => alternar(filtro, linha.valor)}
      aria-pressed={selecionados.includes(linha.valor)}
      aria-label={descricao}
      className={cn(classe, "hover:bg-muted/70")}
    >
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
          <TooltipGrafico
            titulo={`${linha.rotulo} · ${fmtInt(linha.contagem)} respostas`}
            linhas={[
              { rotulo: "Com diabetes", valor: fmtPontosPct(linha.prevalencia), cor: tema.diabetes },
              { rotulo: "Casos", valor: fmtInt(linha.nDiabetes) },
              { rotulo: "No conjunto da pergunta", valor: fmtPontosPct(grupo.media) },
            ]}
          />
        </TooltipContent>
      </Tooltip>
    </li>
  );
}

function GrupoDoFator({ grupo, teto, amostraMinima }: { grupo: GrupoFatorDiabetes; teto: number; amostraMinima: number }) {
  return (
    <section aria-label={grupo.rotulo} className="flex min-w-0 flex-col gap-1">
      <header className="flex items-baseline justify-between gap-3 border-b px-1.5 pb-1.5">
        <h3 className="text-[13px] leading-tight font-semibold">{grupo.rotulo}</h3>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">conjunto {fmtPontosPct(grupo.media)}</span>
      </header>
      <ul className="flex flex-col">
        {grupo.linhas.map((linha) => (
          <LinhaDoFator key={linha.valor} linha={linha} grupo={grupo} teto={teto} amostraMinima={amostraMinima} />
        ))}
      </ul>
    </section>
  );
}

/**
 * Fatores associados à diabetes: para cada uma das 16 perguntas categóricas da base (diagnósticos,
 * hábitos, acesso à saúde, saúde geral, escolaridade e renda), o % com diabetes em cada resposta, com o
 * traço do conjunto da pergunta. Pressão alta, colesterol alto e atividade física também são filtros: a
 * linha filtra ao clicar, e a pergunta filtrada continua com as respostas todas (vem sem o próprio
 * filtro). É associação na base, não causa — e parte dela mede o acesso ao diagnóstico.
 */
export function FatoresDiabetes() {
  const { filtros } = useFiltrosDiabetes();
  const q = useFatoresDiabetes(filtros);
  const base = useFatoresDiabetes(FILTRO_VAZIO_DIABETES);
  const camposDosFatores = new Set((base.data ?? q.data)?.campos.map((c) => c.campo) ?? []);
  const proprios = NOMES_FILTRO_DIABETES.filter((nome) => filtros[nome].length > 0 && camposDosFatores.has(nome));
  const consultas = usePorCategoriasDiabetes(proprios.map((nome) => ({ campo: nome, filtros: semFiltros(filtros, nome) })));
  const semOProprioFiltro = new Map<string, AgregadoDiabetes>();
  proprios.forEach((nome, i) => {
    const dado = consultas[i]?.data;
    if (dado) semOProprioFiltro.set(nome, dado);
  });
  const grupos = montarGruposDeFatores(q.data, semOProprioFiltro);
  const teto = tetoDaPrevalencia(...montarGruposDeFatores(base.data).map((g) => g.linhas), ...grupos.map((g) => g.linhas));
  const amostraMinima = q.data?.amostra_minima ?? 0;
  const carregando = q.isPending || consultas.some((c) => c.isPending);
  const atualizando = !carregando && (q.isFetching || consultas.some((c) => c.isFetching));
  const erro = q.error ?? consultas.find((c) => c.error)?.error ?? null;

  return (
    <ChartFrame
      titulo="Fatores associados à diabetes"
      descricao="% com diabetes em cada resposta; o traço é o % do conjunto da pergunta. As respostas de pressão, colesterol e atividade física filtram o painel."
      altura={360}
      alturaNatural
      tabela={
        <TabelaEquivalente
          legenda="Porcentagem com diabetes em cada resposta das 16 perguntas"
          colunas={[
            { chave: "fator", rotulo: "Pergunta" },
            { chave: "resposta", rotulo: "Resposta" },
            { chave: "contagem", rotulo: "Respostas", alinhar: "right" },
            { chave: "casos", rotulo: "Com diabetes", alinhar: "right" },
            { chave: "prevalencia", rotulo: "% com diabetes", alinhar: "right" },
          ]}
          linhas={grupos.flatMap((g) =>
            g.linhas.map((l) => ({
              fator: g.rotulo,
              resposta: l.rotulo,
              contagem: fmtInt(l.contagem),
              casos: fmtInt(l.nDiabetes),
              prevalencia: l.suprimido ? `n < ${amostraMinima}` : fmtPontosPct(l.prevalencia),
            })),
          )}
        />
      }
    >
      {erro ? (
        <ErroInline erro={erro} aoTentarNovamente={() => [q, ...consultas].forEach((c) => void c.refetch())} />
      ) : (
        <div className={cn("flex flex-col gap-4", atualizando && "refetching")} aria-busy={carregando || atualizando || undefined}>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Associação na base, não causa — e parte dela mede o acesso ao diagnóstico (o exame de colesterol, o plano de saúde), não a doença.
          </p>
          {carregando ? (
            <div className="grid grid-cols-1 gap-x-10 gap-y-6 xl:grid-cols-2">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-x-10 gap-y-6 xl:grid-cols-2">
              {grupos.map((g) => (
                <GrupoDoFator key={g.campo} grupo={g} teto={teto} amostraMinima={amostraMinima} />
              ))}
            </div>
          )}
        </div>
      )}
    </ChartFrame>
  );
}
