import { QueryState } from "@/shared/estados/QueryState";
import { fmtInt, fmtPontosPct } from "@/shared/format/ptBR";
import { ChartFrame } from "@/shared/graficos/ChartFrame";
import { TabelaEquivalente } from "@/shared/graficos/TabelaEquivalente";
import { cn } from "@/shared/lib/utils";
import { Skeleton } from "@/shared/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

import { usePorCategoriaDiabetes } from "../api/painel";
import { FILTRO_VAZIO_DIABETES, semFiltros } from "../filtros/filtroDiabetes";
import { useCrossFilterDiabetes } from "../filtros/useCrossFilterDiabetes";
import { useFiltrosDiabetes } from "../filtros/useFiltrosDiabetes";
import { celulaDe, montarPiramide, rotuloCurtoDaFaixaEtaria, tetoDaPrevalencia, type CelulaPiramide, type TotalDoSexo } from "./prevalencia";

/**
 * Uma barra da pirâmide: cresce do centro para fora (o primeiro sexo à esquerda, o segundo à direita),
 * no violeta da vertente — o sexo é a POSIÇÃO, porque o violeta reprova ao lado do azul do par de
 * gênero. O % fica do lado de fora da ponta; a escala não encolhe ao filtrar.
 */
function BarraDaPiramide({
  celula,
  teto,
  esquerda,
  apagada,
  rotuloDaFaixa,
  sexo,
  aoClicar,
}: {
  celula: CelulaPiramide;
  teto: number;
  esquerda: boolean;
  apagada: boolean;
  rotuloDaFaixa: string;
  sexo: string;
  aoClicar: () => void;
}) {
  const texto = celula.suprimido
    ? `${rotuloDaFaixa}, ${sexo}: ${fmtInt(celula.contagem)} respostas, amostra pequena demais para o %`
    : `${rotuloDaFaixa}, ${sexo}: ${fmtPontosPct(celula.prevalencia)} com diabetes (${fmtInt(celula.nDiabetes)} de ${fmtInt(celula.contagem)})`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={aoClicar}
          aria-label={`${texto}. Filtrar ${sexo.toLowerCase()}`}
          className={cn("group flex h-6 min-w-0 items-center gap-1.5", esquerda ? "flex-row-reverse" : "flex-row", apagada && "opacity-35")}
        >
          <span
            className={cn(
              "h-4 bg-diabetes transition-[width] duration-300 group-hover:brightness-110 motion-reduce:transition-none",
              esquerda ? "rounded-l-[4px]" : "rounded-r-[4px]",
            )}
            style={{ width: teto > 0 && celula.prevalencia !== null ? `${(celula.prevalencia / teto) * 100}%` : 0 }}
          />
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{celula.suprimido ? "—" : fmtPontosPct(celula.prevalencia)}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{texto}</TooltipContent>
    </Tooltip>
  );
}

function TotalDoLado({ total, alinhar, apagado }: { total: TotalDoSexo; alinhar: "esquerda" | "direita"; apagado: boolean }) {
  return (
    <div className={cn("flex min-w-0 flex-col transition-opacity", alinhar === "direita" && "items-end text-right", apagado && "opacity-40")}>
      <span className="text-xs font-medium text-muted-foreground">{total.rotulo}</span>
      <span className="text-2xl leading-tight font-semibold">{fmtPontosPct(total.prevalencia)}</span>
      <span className="text-xs text-muted-foreground tabular-nums">
        com diabetes · {fmtInt(total.nDiabetes)} de {fmtInt(total.contagem)}
      </span>
    </div>
  );
}

/**
 * Idade e sexo: o % com diabetes de cada sexo no recorte, no topo, e a pirâmide das faixas etárias,
 * das mais velhas (em cima) às mais novas. ORIGEM de cross-filter de sexo: clicar numa barra filtra o
 * sexo; a pirâmide não se filtra por sexo nem por idade (as faixas fora do filtro só esmaecem).
 */
export function PiramideIdadeSexo() {
  const { filtros } = useFiltrosDiabetes();
  const cf = useCrossFilterDiabetes("diabetes-piramide", "sexo");
  const q = usePorCategoriaDiabetes("faixa_etaria", semFiltros(filtros, "sexo", "faixa_etaria"), "sexo");
  const base = usePorCategoriaDiabetes("faixa_etaria", FILTRO_VAZIO_DIABETES, "sexo");
  const faixasSelecionadas = filtros.faixa_etaria;
  const { linhas, sexos } = montarPiramide(q.data, faixasSelecionadas);
  const linhasDaBase = montarPiramide(base.data).linhas;
  const celulas = (ls: typeof linhas) => ls.flatMap((l) => Object.values(l.porSexo));
  const teto = tetoDaPrevalencia(celulas(linhasDaBase), celulas(linhas));
  const [primeiro, segundo] = sexos;

  return (
    <ChartFrame
      titulo="Idade e sexo"
      descricao="% com diabetes por faixa etária, mulheres à esquerda e homens à direita. Clique numa barra para filtrar o sexo."
      altura={300}
      alturaNatural
      tabela={
        <TabelaEquivalente
          legenda="Porcentagem com diabetes por faixa etária e sexo, com os casos e as respostas de cada grupo"
          colunas={[{ chave: "faixa", rotulo: "Faixa etária" }, ...sexos.map((s) => ({ chave: s.valor, rotulo: s.rotulo, alinhar: "right" as const }))]}
          linhas={linhas.map((l) => ({
            faixa: l.rotulo,
            ...Object.fromEntries(
              sexos.map((s) => {
                const c = celulaDe(l, s.valor);
                return [s.valor, c.suprimido ? `amostra pequena (${fmtInt(c.contagem)})` : `${fmtPontosPct(c.prevalencia)} (${fmtInt(c.nDiabetes)} de ${fmtInt(c.contagem)})`];
              }),
            ),
          }))}
        />
      }
    >
      <QueryState
        carregando={q.isPending}
        erro={q.error}
        atualizando={q.isFetching && !q.isPending}
        vazio={linhas.length === 0}
        aoTentarNovamente={() => void q.refetch()}
        esqueleto={
          <div className="flex flex-col gap-4">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-72 w-full" />
          </div>
        }
      >
        <div className="flex h-full flex-col gap-4">
          {primeiro && segundo ? (
            <div className="flex items-end justify-between gap-4">
              <TotalDoLado total={primeiro} alinhar="esquerda" apagado={cf.opacidade(primeiro.valor) < 1} />
              <TotalDoLado total={segundo} alinhar="direita" apagado={cf.opacidade(segundo.valor) < 1} />
            </div>
          ) : null}
          {primeiro && segundo ? (
            <ul className="flex flex-col" aria-label={`% com diabetes por faixa etária, ${primeiro.rotulo.toLowerCase()} à esquerda e ${segundo.rotulo.toLowerCase()} à direita`}>
              {linhas.map((l) => {
                const apagada = faixasSelecionadas.length > 0 && !faixasSelecionadas.includes(l.valor);
                return (
                  <li key={l.valor} className={cn("grid grid-cols-[minmax(0,1fr)_3.75rem_minmax(0,1fr)] items-center gap-2", apagada && "opacity-40")}>
                    <BarraDaPiramide
                      celula={celulaDe(l, primeiro.valor)}
                      teto={teto}
                      esquerda
                      apagada={cf.opacidade(primeiro.valor) < 1}
                      rotuloDaFaixa={l.rotulo}
                      sexo={primeiro.rotulo}
                      aoClicar={() => cf.aoClicar(primeiro.valor)}
                    />
                    <span className="text-center text-xs leading-tight text-muted-foreground tabular-nums">{rotuloCurtoDaFaixaEtaria(l.rotulo)}</span>
                    <BarraDaPiramide
                      celula={celulaDe(l, segundo.valor)}
                      teto={teto}
                      esquerda={false}
                      apagada={cf.opacidade(segundo.valor) < 1}
                      rotuloDaFaixa={l.rotulo}
                      sexo={segundo.rotulo}
                      aoClicar={() => cf.aoClicar(segundo.valor)}
                    />
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </QueryState>
    </ChartFrame>
  );
}
