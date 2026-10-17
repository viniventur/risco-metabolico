import { useState } from "react";

import { useDeriva } from "@/shared/api/endpoints/monitoramento";
import type { RespostaDeriva } from "@/shared/api/endpoints/tipos";
import { URL_REPO } from "@/shared/api/http";
import { fmtDataHora, fmtInt } from "@/shared/format/ptBR";
import { QueryState } from "@/shared/ui/QueryState";

import { BarrasTreinoLog } from "./BarrasTreinoLog";
import { FaixaIndisponivel } from "./FaixaIndisponivel";
import { TabelaDeriva } from "./TabelaDeriva";

const JANELAS = [7, 30, 90] as const;
const ARQUIVOS_SQL = ["01_distribuicao_numerica.sql", "02_contagem_por_faixa.sql", "03_indicador_divergencia.sql"];

function CabecalhoDeriva({ dado }: { dado: RespostaDeriva }) {
  return (
    <dl className="cartao grid grid-cols-2 gap-x-4 gap-y-1 p-4 text-sm sm:grid-cols-3 lg:grid-cols-6">
      <dt className="text-texto-fraco">Modelo</dt>
      <dd className="font-mono text-xs">v{dado.versao_modelo}</dd>
      <dt className="text-texto-fraco">Snapshot de treino</dt>
      <dd className="font-mono text-xs">{dado.versao_dados}</dd>
      <dt className="text-texto-fraco">Janela</dt>
      <dd>{fmtInt(dado.janela_dias)} dias</dd>
      <dt className="text-texto-fraco">Predições na janela</dt>
      <dd className="tabular-nums">{fmtInt(dado.n_amostra)}</dd>
      <dt className="text-texto-fraco">Mínimo para PSI</dt>
      <dd className="tabular-nums">{fmtInt(dado.n_minimo)}</dd>
      <dt className="text-texto-fraco">Atualizado em</dt>
      <dd>{fmtDataHora(dado.atualizado_em)}</dd>
    </dl>
  );
}

function RodapeSql({ consultas }: { consultas?: string[] }) {
  const arquivos = consultas && consultas.length > 0 ? consultas : ARQUIVOS_SQL;
  return (
    <p className="text-xs text-texto-fraco">
      As três consultas desta página são os arquivos de <code>sql/deriva/</code>:{" "}
      {arquivos.map((a, i) => (
        <span key={a}>
          {i > 0 ? ", " : ""}
          {URL_REPO ? (
            <a href={`${URL_REPO}/blob/main/sql/deriva/${a}`} className="underline" target="_blank" rel="noreferrer">
              {a}
            </a>
          ) : (
            <code>{a}</code>
          )}
        </span>
      ))}
      . O SQL é parte do que está sendo exibido: PSI com limiares 0,10 (atenção) e 0,25 (deriva significativa).
    </p>
  );
}

/** Uma página, um endpoint (§7.6): 200 com `disponivel: false` vira faixa de aviso, nunca erro. */
export function MonitoramentoPage() {
  const [janela, setJanela] = useState<number>(30);
  const [feature, setFeature] = useState("");
  const q = useDeriva(janela, feature || undefined);
  const d = q.data;
  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Monitoramento de deriva</h1>
          <p className="text-sm text-texto-fraco">
            Compara a distribuição das 16 entradas registradas pelo simulador e pela API com o snapshot que treinou o modelo.
          </p>
        </div>
        <fieldset className="flex items-center gap-1">
          <legend className="sr-only">Janela em dias</legend>
          <div className="flex overflow-hidden rounded-card border border-borda" role="group" aria-label="Janela em dias">
            {JANELAS.map((j) => (
              <button
                key={j}
                type="button"
                aria-pressed={janela === j}
                onClick={() => setJanela(j)}
                className={`min-h-11 px-3 text-sm ${janela === j ? "bg-primaria text-primaria-contraste" : "bg-superficie text-texto hover:bg-superficie-alta"}`}
              >
                {j} dias
              </button>
            ))}
          </div>
        </fieldset>
      </header>
      <QueryState carregando={q.isPending} erro={q.error} atualizando={q.isFetching && !q.isPending}>
        {d ? (
          <div className="flex flex-col gap-4">
            <CabecalhoDeriva dado={d} />
            <FaixaIndisponivel disponivel={d.disponivel} motivo={d.motivo} nAmostra={d.n_amostra} nMinimo={d.n_minimo} />
            {d.disponivel ? (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                <TabelaDeriva dado={d} featureSelecionada={feature} aoSelecionar={setFeature} />
                <BarrasTreinoLog dado={d} feature={feature} />
              </div>
            ) : null}
            <RodapeSql consultas={d.consultas} />
          </div>
        ) : null}
      </QueryState>
    </div>
  );
}
