import { useMemo, useState, type ReactNode } from "react";

import { BarrasTreinoLog } from "@/features/monitoramento/BarrasTreinoLog";
import { FaixaIndisponivel } from "@/features/monitoramento/FaixaIndisponivel";
import { TabelaDeriva } from "@/features/monitoramento/TabelaDeriva";
import type { RespostaDeriva } from "@/shared/api/endpoints/tipos";
import { URL_REPO } from "@/shared/api/http";
import { QueryState } from "@/shared/estados/QueryState";
import { fmtDataHora, fmtInt } from "@/shared/format/ptBR";
import { PageHeader } from "@/shared/layout/PageHeader";
import { SegmentedControl } from "@/shared/ui/segmented-control";
import { Skeleton } from "@/shared/ui/skeleton";

import { useMetadataDiabetes } from "../api/modelo";
import { useDerivaDiabetes } from "../api/monitoramento";

const JANELAS = ["7", "30", "90"] as const;
type Janela = (typeof JANELAS)[number];
const PASTA_SQL = "sql/diabetes/deriva/";
const ARQUIVOS_SQL = ["01_distribuicao_numerica.sql", "02_contagem_por_faixa.sql", "03_indicador_divergencia.sql"];

function Fato({ rotulo, children, mono }: { rotulo: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{rotulo}</dt>
      <dd className={mono ? "truncate font-mono text-sm" : "text-sm font-medium tabular-nums"}>{children}</dd>
    </div>
  );
}

/** Qual par (modelo, dados) da vertente está sendo comparado, contra qual snapshot, e quantas predições entraram na janela. */
function CabecalhoDeriva({ dado }: { dado: RespostaDeriva }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-lg border bg-card p-5 shadow-sm sm:grid-cols-3 lg:grid-cols-5">
      <Fato rotulo="Modelo" mono>
        v{dado.versao_modelo}
      </Fato>
      <Fato rotulo="Snapshot de treino" mono>
        {dado.versao_dados}
      </Fato>
      <Fato rotulo="Janela">{fmtInt(dado.janela_dias)} dias</Fato>
      <Fato rotulo="Predições na janela">
        {fmtInt(dado.n_amostra)} <span className="font-normal text-muted-foreground">/ mínimo {fmtInt(dado.n_minimo)}</span>
      </Fato>
      <Fato rotulo="Atualizado em">{fmtDataHora(dado.atualizado_em)}</Fato>
    </dl>
  );
}

function RodapeSql({ consultas }: { consultas?: string[] }) {
  const arquivos = consultas && consultas.length > 0 ? consultas : ARQUIVOS_SQL;
  return (
    <p className="text-xs leading-relaxed text-muted-foreground">
      As três consultas desta página são os arquivos de <code className="rounded bg-muted px-1 py-0.5 font-mono">{PASTA_SQL}</code>, sobre as referências
      próprias da vertente:{" "}
      {arquivos.map((a, i) => (
        <span key={a}>
          {i > 0 ? ", " : ""}
          {URL_REPO ? (
            <a href={`${URL_REPO}/blob/main/${PASTA_SQL}${a}`} className="font-mono text-primary underline-offset-4 hover:underline" target="_blank" rel="noreferrer">
              {a}
            </a>
          ) : (
            <code className="font-mono">{a}</code>
          )}
        </span>
      ))}
      . O SQL é parte do que está sendo exibido: PSI com limiares 0,10 (atenção) e 0,25 (deriva significativa), os da ADR 0008.
    </p>
  );
}

function EsqueletoMonitoramento() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-16 w-full" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Skeleton className="h-96 xl:col-span-7" />
        <Skeleton className="h-60 xl:col-span-5" />
      </div>
    </div>
  );
}

/**
 * O monitoramento da vertente (o desenho do da obesidade, com os mesmos componentes): uma página, um
 * endpoint, /diabetes/monitoramento/deriva. 200 com `disponivel: false` vira faixa de aviso, nunca
 * erro; abaixo do mínimo medido da vertente, a tabela mostra as contagens sem o PSI.
 */
export function MonitoramentoDiabetesPage() {
  const [janela, setJanela] = useState<Janela>("30");
  const [feature, setFeature] = useState("");
  const q = useDerivaDiabetes(Number(janela), feature || undefined);
  const metadata = useMetadataDiabetes();
  const campos = useMemo(() => metadata.data?.grupos.flatMap((g) => g.campos) ?? [], [metadata.data]);
  const rotulos = useMemo(() => Object.fromEntries(campos.map((c) => [c.nome, c.rotulo])), [campos]);
  const d = q.data;
  return (
    <>
      <PageHeader
        titulo="Monitoramento de deriva da diabetes"
        descricao={`Compara a distribuição ${campos.length ? `das ${campos.length} entradas` : "das entradas"} registradas pelo simulador e pela API de diabetes com o snapshot que treinou o modelo, entrada a entrada, pelo PSI.`}
        acoes={
          <SegmentedControl
            rotulo="Janela em dias"
            valor={janela}
            aoMudar={setJanela}
            opcoes={JANELAS.map((j) => ({ valor: j, rotulo: `${j} dias` }))}
          />
        }
      />
      <QueryState
        carregando={q.isPending}
        erro={q.error}
        atualizando={q.isFetching && !q.isPending}
        aoTentarNovamente={() => void q.refetch()}
        esqueleto={<EsqueletoMonitoramento />}
      >
        {d ? (
          <div className="flex flex-col gap-4">
            <CabecalhoDeriva dado={d} />
            <FaixaIndisponivel disponivel={d.disponivel} motivo={d.motivo} nAmostra={d.n_amostra} nMinimo={d.n_minimo} />
            {d.disponivel ? (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 xl:items-start">
                <div className="min-w-0 xl:col-span-7">
                  <TabelaDeriva dado={d} featureSelecionada={feature} aoSelecionar={setFeature} rotulos={rotulos} />
                </div>
                <div className="min-w-0 xl:sticky xl:top-20 xl:col-span-5">
                  <BarrasTreinoLog dado={d} feature={feature} rotulo={rotulos[feature]} />
                </div>
              </div>
            ) : null}
            <RodapeSql consultas={d.consultas} />
          </div>
        ) : null}
      </QueryState>
    </>
  );
}
