import { Link, NavLink } from "react-router-dom";

import { useModelInfo } from "@/shared/api/endpoints/modelo";
import { URL_DOCS } from "@/shared/api/http";
import { fmtDataHora, fmtPct } from "@/shared/format/ptBR";
import { IconeConsulta, IconePainel, IconeSimulador } from "@/shared/ui/icones";
import { KpiCard } from "@/shared/ui/KpiCard";
import { RodapeAviso } from "@/shared/ui/RodapeAviso";

function Hero() {
  return (
    <header className="flex flex-col gap-3">
      <h1 className="text-3xl font-bold text-texto">Triagem Metabólica</h1>
      <p className="max-w-3xl text-texto">
        Dezesseis respostas sobre medidas corporais e hábitos viram, em milissegundos, a distribuição de probabilidade entre
        sete faixas de composição corporal e um risco metabólico acumulado. A saída ordena prioridade de atenção; ela não fecha
        diagnóstico.
      </p>
      <RodapeAviso />
    </header>
  );
}

function CardsMetricas() {
  const info = useModelInfo();
  const m = info.data?.metricas_teste;
  return (
    <section aria-label="Métricas do modelo em teste" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <KpiCard rotulo="Acurácia" valor={fmtPct(m?.acuracia)} carregando={info.isPending} detalhe="conjunto de teste" />
      <KpiCard rotulo="F1-macro" valor={fmtPct(m?.f1_macro)} carregando={info.isPending} detalhe="conjunto de teste" />
      <KpiCard
        rotulo="Recall de risco"
        valor={fmtPct(m?.recall_risco)}
        carregando={info.isPending}
        detalhe="classes de sobrepeso e obesidade"
      />
    </section>
  );
}

function CardModelo() {
  const info = useModelInfo();
  if (info.isError) {
    return (
      <div className="cartao p-4 text-sm text-perigo" role="alert">
        Não foi possível ler o manifest do modelo: {info.error.mensagem}
      </div>
    );
  }
  const d = info.data;
  const hp = d?.hiperparametros ?? {};
  return (
    <section className="cartao flex flex-col gap-2 p-4" aria-labelledby="modelo-titulo">
      <h2 id="modelo-titulo" className="text-base font-semibold">
        Modelo servido
      </h2>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
        <dt className="text-texto-fraco">Algoritmo</dt>
        <dd>{d?.algoritmo ?? "…"}</dd>
        <dt className="text-texto-fraco">Versão</dt>
        <dd>{d ? `v${d.versao}` : "…"}</dd>
        <dt className="text-texto-fraco">Treinado em</dt>
        <dd>{fmtDataHora(d?.treinado_em)}</dd>
        <dt className="text-texto-fraco">Dados (versão)</dt>
        <dd className="font-mono text-xs">{d?.versao_dados ?? "…"}</dd>
        <dt className="text-texto-fraco">Features</dt>
        <dd>{d ? `${d.n_features_entrada} de entrada → ${d.n_features_modelo} no modelo` : "…"}</dd>
        <dt className="text-texto-fraco">Hiperparâmetros</dt>
        <dd className="col-span-3 font-mono text-xs">
          {d
            ? ["n_estimators", "max_depth", "learning_rate", "subsample", "colsample_bytree"]
                .filter((k) => k in hp)
                .map((k) => `${k}=${String(hp[k])}`)
                .join(" · ")
            : "…"}
        </dd>
      </dl>
      <p className="text-xs text-texto-fraco">
        Métricas lidas de <code>GET /model/info</code>, que lê o manifest do treino — nenhum número é escrito à mão.{" "}
        <a href={URL_DOCS} className="underline" target="_blank" rel="noreferrer">
          Documentação da API
        </a>
      </p>
    </section>
  );
}

function CartoesNavegacao() {
  const cartoes = [
    { para: "/painel", titulo: "Visão Geral", texto: "KPIs e sete visuais com filtros cruzados sobre a base.", Icone: IconePainel },
    { para: "/consulta", titulo: "Consulta", texto: "Seis filtros e a tabela de registros com exportação.", Icone: IconeConsulta },
    { para: "/simulador", titulo: "Simulador", texto: "Dezesseis respostas, sete probabilidades e o relatório.", Icone: IconeSimulador },
  ];
  return (
    <nav aria-label="Atalhos" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {cartoes.map(({ para, titulo, texto, Icone }) => (
        <NavLink
          key={para}
          to={para}
          aria-label={`Abrir ${titulo}`}
          className="cartao flex min-h-24 flex-col gap-1 p-4 text-texto hover:bg-superficie-alta"
        >
          <span className="flex items-center gap-2 text-base font-semibold">
            <Icone /> {titulo}
          </span>
          <span className="text-sm text-texto-fraco">{texto}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export function InicioPage() {
  return (
    <div className="flex flex-col gap-6">
      <Hero />
      <CardsMetricas />
      <CardModelo />
      <CartoesNavegacao />
      <p className="text-sm">
        <Link to="/estudos/comparacao-de-modelos" className="font-semibold text-primaria underline">
          Ver o notebook de comparação de modelos
        </Link>{" "}
        — com o gráfico interativo e os dois A/B que fecharam as decisões de modelagem.
      </p>
    </div>
  );
}
