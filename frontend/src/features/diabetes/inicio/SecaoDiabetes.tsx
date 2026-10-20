import { Activity, ArrowRight, BookOpen, Calculator, LayoutDashboard, Table2, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { CabecalhoDoProjeto } from "@/features/inicio/CabecalhoDoProjeto";
import { ComoFunciona, type PassoDoModelo } from "@/features/inicio/ComoFunciona";
import { seguirOPonteiro } from "@/features/inicio/seguirOPonteiro";
import { Velocimetro } from "@/features/inicio/Velocimetro";
import { ErroInline } from "@/shared/estados/ErroInline";
import { fmtDataHora, fmtNum, fmtPct } from "@/shared/format/ptBR";
import { NumeroQueConta } from "@/shared/movimento/NumeroQueConta";
import { Revelar } from "@/shared/movimento/Revelar";
import { useApareceuNaTela } from "@/shared/movimento/useApareceuNaTela";
import { DIABETES } from "@/shared/projetos";
import { Skeleton } from "@/shared/ui/skeleton";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

import { useModelInfoDiabetes } from "../api/modelo";
import type { InfoModeloDiabetes } from "../api/tipos";

type ChaveDaMetrica = keyof InfoModeloDiabetes["metricas_teste"];
type LimiaresPorIdade = NonNullable<InfoModeloDiabetes["limiares_por_idade"]>;

/** A marca de referência do velocímetro de uma métrica: onde ela fica na régua e o que o cartão escreve. */
type Referencia = { valor: number; texto: string };

/** A ROC-AUC de uma ordenação ao acaso: o valor da definição, não uma medida. */
const ROC_AUC_DO_ACASO = 0.5;

/** A prevalência do conjunto de teste (`split.prevalencia_teste`); sem ela no manifest, as marcas que dependem dela não aparecem. */
function prevalenciaDoTeste(d: InfoModeloDiabetes): number | undefined {
  const prevalencia = Number(d.split.prevalencia_teste);
  return Number.isFinite(prevalencia) ? prevalencia : undefined;
}

/**
 * As métricas do teste que dizem o que a triagem faz: a ordenação (ROC-AUC) e o ponto de operação no limiar.
 * Com `limiares_por_idade`, o ponto de operação é o da regra por grupo, e o texto de apoio é o `detalheDoGrupo`.
 * Cada uma tem o velocímetro dos indicadores da obesidade e uma marca que dá sentido ao ponteiro, com os
 * números de /diabetes/model/info: o acaso na ROC-AUC (régua de 0 a 1) e na precisão (a prevalência: quem
 * encaminhasse ao acaso acertaria nessa proporção), o alvo no recall e o ideal nos encaminhados (só os casos).
 */
const METRICAS: Array<{
  chave: ChaveDaMetrica;
  rotulo: string;
  detalhe: string;
  detalheDoGrupo?: string;
  formatar: (v: number | null | undefined) => string;
  rotulos?: readonly [string, string];
  referencia: (d: InfoModeloDiabetes) => Referencia | undefined;
}> = [
  {
    chave: "roc_auc",
    rotulo: "ROC-AUC",
    detalhe: "no conjunto de teste",
    formatar: (v) => fmtNum(v, 3),
    rotulos: ["0", "1"],
    referencia: () => ({ valor: ROC_AUC_DO_ACASO, texto: `acaso: ${fmtNum(ROC_AUC_DO_ACASO, 1)}` }),
  },
  {
    chave: "recall_no_limiar",
    rotulo: "Recall no limiar",
    detalhe: "dos casos de diabetes, os que o limiar encaminha",
    detalheDoGrupo: "dos casos de diabetes, os que o limiar do grupo de idade encaminha",
    formatar: fmtPct,
    referencia: (d) => {
      const alvo = d.limiares_por_idade?.recall_alvo ?? d.limiar.recall_alvo;
      return { valor: alvo, texto: `alvo: ${fmtPct(alvo)}` };
    },
  },
  {
    chave: "precisao_no_limiar",
    rotulo: "Precisão no limiar",
    detalhe: "dos encaminhados, os que têm diabetes",
    detalheDoGrupo: "dos encaminhados pelo limiar do grupo de idade, os que têm diabetes",
    formatar: fmtPct,
    referencia: (d) => {
      const prevalencia = prevalenciaDoTeste(d);
      return prevalencia === undefined ? undefined : { valor: prevalencia, texto: `acaso: ${fmtPct(prevalencia)} (a base)` };
    },
  },
  {
    chave: "encaminhados_no_limiar",
    rotulo: "Encaminhados",
    detalhe: "das respostas, as que o limiar encaminha",
    detalheDoGrupo: "das respostas, as que o limiar do grupo de idade encaminha",
    formatar: fmtPct,
    referencia: (d) => {
      const prevalencia = prevalenciaDoTeste(d);
      return prevalencia === undefined ? undefined : { valor: prevalencia, texto: `ideal: ${fmtPct(prevalencia)} (só os casos)` };
    },
  },
];

const TELAS: Array<{ para: string; titulo: string; texto: string; textoDoGrupo?: string; icone: LucideIcon }> = [
  { para: "/diabetes", titulo: "Visão Geral", texto: "O % com diabetes por idade, sexo, IMC e fatores associados, com filtros cruzados.", icone: LayoutDashboard },
  { para: "/diabetes/consulta", titulo: "Consulta", texto: "As respostas linha a linha, com a exportação do recorte inteiro.", icone: Table2 },
  {
    para: "/diabetes/simulador",
    titulo: "Simulador",
    texto: "A probabilidade, o limiar, a classificação e o relatório.",
    textoDoGrupo: "A probabilidade, o limiar do grupo de idade, a classificação e o relatório.",
    icone: Calculator,
  },
  { para: "/diabetes/monitoramento", titulo: "Monitoramento", texto: "A deriva das entradas contra o treino, pelo PSI.", icone: Activity },
  {
    para: "/estudos/triagem-de-diabetes",
    titulo: "Notebook da triagem",
    texto: "O estudo: entradas, modelos, desbalanceamento, calibração e limiar.",
    icone: BookOpen,
  },
];

const CLASSE_DO_CARTAO =
  "cartao-holofote group flex h-full flex-col gap-3 rounded-2xl border bg-card p-5 text-card-foreground shadow-sm transition-[translate,box-shadow] duration-300 " +
  "hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/10 motion-reduce:transition-none";

/** O traço tracejado da referência, em miniatura, antes do texto dela: liga o texto à marca do velocímetro. */
function TracoDaReferencia() {
  return (
    <svg viewBox="0 0 4 12" className="h-3 w-1 shrink-0 text-foreground" fill="none" aria-hidden="true">
      <line x1={2} y1={1} x2={2} y2={11} stroke="currentColor" strokeWidth={1.6} strokeDasharray="2.2 1.8" strokeLinecap="round" />
    </svg>
  );
}

type PropsDaMetrica = {
  rotulo: string;
  detalhe: string;
  valor: number | undefined;
  formatar: (v: number | null | undefined) => string;
  carregando: boolean;
  /** A posição na fileira, para a entrada em sequência (Revelar). */
  ordem: number;
  referencia?: Referencia;
  rotulos?: readonly [string, string];
};

/**
 * O cartão de uma métrica, no desenho dos indicadores da obesidade (MetricasDoModelo): entra subindo, em
 * sequência, e, quando chega à tela, o número conta até o valor e o ponteiro do velocímetro sobe junto. A
 * referência fica escrita embaixo do texto de apoio e marcada na régua.
 */
function Metrica({ rotulo, detalhe, valor, formatar, carregando, ordem, referencia, rotulos }: PropsDaMetrica) {
  const [ref, apareceu] = useApareceuNaTela<HTMLDivElement>();
  return (
    <Revelar as="li" ordem={ordem} className="min-w-0">
      <div
        ref={ref}
        onPointerMove={seguirOPonteiro}
        aria-busy={carregando || undefined}
        className="cartao-holofote @container h-full rounded-xl border bg-card p-5 text-card-foreground shadow-sm transition-[translate,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none"
      >
        {/* Lado a lado quando o cartão tem largura (16rem de conteúdo); espremido, o velocímetro desce. */}
        <div className="flex h-full flex-col gap-3 @3xs:flex-row @3xs:items-center @3xs:justify-between @3xs:gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{rotulo}</span>
            {carregando ? (
              <>
                <span className="sr-only">Carregando…</span>
                <Skeleton className="h-9 w-24" />
              </>
            ) : (
              <p className="text-3xl leading-none font-semibold tracking-tight">
                <NumeroQueConta valor={valor} formatar={formatar} ativo={apareceu} />
              </p>
            )}
            <span className="text-xs leading-snug text-muted-foreground">{detalhe}</span>
            {referencia ? (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <TracoDaReferencia />
                {referencia.texto}
              </span>
            ) : null}
          </div>
          <Velocimetro fracao={valor} ativo={apareceu && !carregando} referencia={referencia?.valor} rotulos={rotulos} className="self-center" />
        </div>
      </div>
    </Revelar>
  );
}

function Par({ rotulo, children, mono }: { rotulo: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{rotulo}</dt>
      <dd className={mono ? "truncate font-mono text-[13px]" : "text-sm font-medium"}>{children}</dd>
    </div>
  );
}

/** A frase da validação cruzada, a mesma nos dois cartões do limiar. */
function ValidacaoCruzada({ cv }: { cv: InfoModeloDiabetes["validacao_cruzada"] }) {
  return (
    <>
      Na validação cruzada ({cv.n_splits} dobras), ROC-AUC <span className="font-medium text-foreground tabular-nums">{fmtNum(cv.roc_auc, 3)}</span> e PR-AUC{" "}
      <span className="font-medium text-foreground tabular-nums">{fmtNum(cv.pr_auc, 3)}</span>.
    </>
  );
}

/** O cartão de um limiar só, para todas as idades: o de um modelo sem `limiares_por_idade`. */
function LimiarUnico({ d }: { d: InfoModeloDiabetes }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm text-muted-foreground">
        Limiar de triagem <strong className="text-2xl font-semibold text-foreground tabular-nums">{fmtPct(d.limiar.valor)}</strong>
      </p>
      <p className="text-sm leading-relaxed text-muted-foreground">
        O maior limiar com recall ≥ {fmtNum(d.limiar.recall_alvo, 2)} nas predições fora da dobra do treino. <ValidacaoCruzada cv={d.validacao_cruzada} />
      </p>
    </div>
  );
}

// No celular, as quatro colunas cabem no cartão com menos respiro e letra menor: sem isso, o cabeçalho
// "Encaminhados" espreme o nome do grupo em quatro linhas.
/** As colunas de número: à direita, com algarismos de mesma largura. */
const NUMERO = "px-1.5 text-right tabular-nums sm:px-3";
/** A última coluna encosta na borda do cartão, como a primeira. */
const NUMERO_NA_BORDA = `${NUMERO} pr-0 sm:pr-0`;
/** Os cabeçalhos das colunas, sem o espaçamento entre letras no celular. */
const CABECALHO_DA_COLUNA = "text-[11px] tracking-normal sm:text-xs sm:tracking-wide";
/** A coluna do grupo encosta na borda do cartão. */
const GRUPO = "pr-1.5 pl-0 whitespace-normal sm:pr-3";
/** O nome do grupo na linha: um cabeçalho de linha (scope="row") com a letra do corpo da tabela. */
const CABECALHO_DA_LINHA = `${GRUPO} h-auto py-2.5 text-xs font-medium tracking-normal normal-case sm:text-[13px]`;

/**
 * O cartão de um modelo com `limiares_por_idade`: o critério aplicado dentro de cada grupo, a tabela
 * com o limiar, o recall e os encaminhados de cada grupo nas predições fora da dobra do treino (e o
 * total, cada pessoa no limiar do grupo dela) e o limiar único, que fica como referência.
 */
function LimiarPorGrupo({ d, porIdade }: { d: InfoModeloDiabetes; porIdade: LimiaresPorIdade }) {
  const unico = d.limiar;
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-start lg:gap-8">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium">Limiar de triagem por grupo de idade</p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Em cada grupo de idade, o maior limiar com recall ≥ {fmtNum(porIdade.recall_alvo, 2)} nas predições fora da dobra do treino.{" "}
          <ValidacaoCruzada cv={d.validacao_cruzada} />
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Um limiar só, para todas as idades, seria <strong className="font-semibold text-foreground tabular-nums">{fmtPct(unico.valor)}</strong>: no total, recall de{" "}
          <span className="font-medium text-foreground tabular-nums">{fmtPct(unico.fora_da_dobra.recall)}</span> e{" "}
          <span className="font-medium text-foreground tabular-nums">{fmtPct(unico.fora_da_dobra.encaminhados)}</span> das respostas encaminhadas.
        </p>
      </div>
      <Table aria-label="Limiar de cada grupo de idade" className="text-xs sm:text-[13px]">
        <TableCaption className="text-left">Recall e encaminhados nas predições fora da dobra do treino.</TableCaption>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={`${CABECALHO_DA_COLUNA} ${GRUPO}`}>Grupo de idade</TableHead>
            <TableHead className={`${CABECALHO_DA_COLUNA} ${NUMERO}`}>Limiar</TableHead>
            <TableHead className={`${CABECALHO_DA_COLUNA} ${NUMERO}`}>Recall</TableHead>
            <TableHead className={`${CABECALHO_DA_COLUNA} ${NUMERO_NA_BORDA}`}>Encaminhados</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {porIdade.grupos.map((g) => (
            <TableRow key={g.grupo}>
              <TableHead scope="row" className={`${CABECALHO_DA_LINHA} text-foreground`}>
                {g.grupo}
              </TableHead>
              <TableCell className={`${NUMERO} text-sm font-semibold sm:text-base`}>{fmtPct(g.valor)}</TableCell>
              <TableCell className={NUMERO}>{fmtPct(g.fora_da_dobra.recall)}</TableCell>
              <TableCell className={NUMERO_NA_BORDA}>{fmtPct(g.fora_da_dobra.encaminhados)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <tfoot className="border-t">
          <TableRow className="border-0">
            <TableHead scope="row" colSpan={2} className={`${CABECALHO_DA_LINHA} text-muted-foreground`}>
              Todas as idades
            </TableHead>
            <TableCell className={NUMERO}>{fmtPct(porIdade.fora_da_dobra.recall)}</TableCell>
            <TableCell className={NUMERO_NA_BORDA}>{fmtPct(porIdade.fora_da_dobra.encaminhados)}</TableCell>
          </TableRow>
        </tfoot>
      </Table>
    </div>
  );
}

/**
 * O limiar com o critério e a validação cruzada, e o artefato da vertente: tudo do manifest, por
 * /diabetes/model/info. Com `limiares_por_idade`, a tabela por grupo; sem ela, o limiar único.
 */
function LimiarEModelo({ d }: { d: InfoModeloDiabetes }) {
  return (
    <div className="flex flex-col gap-5">
      {d.limiares_por_idade ? <LimiarPorGrupo d={d} porIdade={d.limiares_por_idade} /> : <LimiarUnico d={d} />}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-5">
        <Par rotulo="Algoritmo">{d.algoritmo}</Par>
        <Par rotulo="Versão">v{d.versao}</Par>
        <Par rotulo="Release" mono>
          {d.release}
        </Par>
        <Par rotulo="Treinado em">{fmtDataHora(d.treinado_em)}</Par>
        <Par rotulo="Dados (versão)" mono>
          {d.versao_dados}
        </Par>
      </dl>
    </div>
  );
}

/**
 * "Como funciona" no cabeçalho do projeto: as respostas, a probabilidade e o limiar — um por grupo de
 * idade, quando o modelo servido traz `limiares_por_idade`. As contagens vêm de /diabetes/model/info.
 */
function passosDoModelo(d: InfoModeloDiabetes | undefined): PassoDoModelo[] {
  const porIdade = d?.limiares_por_idade;
  return [
    { chave: "entrada", valor: d?.n_features_entrada, texto: "respostas sobre o perfil, a saúde e os hábitos" },
    { chave: "saida", simbolo: "%", texto: "a probabilidade de já ter recebido o diagnóstico de diabetes" },
    porIdade
      ? { chave: "limiar", valor: porIdade.grupos.length, texto: "limiares de triagem, um para cada grupo de idade" }
      : { chave: "limiar", simbolo: "≥", texto: "um limiar de triagem, o mesmo para todas as idades" },
  ];
}

/**
 * A seção da vertente diabetes no Início, o projeto 2 (ADR 0016): o cabeçalho do projeto com o que o
 * modelo faz e "como funciona", as métricas do teste contando até o valor, o limiar com o critério e o
 * artefato, e as telas da vertente. Todo número vem de /diabetes/model/info. Os atalhos ficam num menu
 * próprio, como o "Explorar" da obesidade. Os textos falam no limiar do grupo de idade quando o modelo
 * servido traz `limiares_por_idade`.
 */
export function SecaoDiabetes() {
  const info = useModelInfoDiabetes();
  const d = info.data;
  const porGrupo = Boolean(d?.limiares_por_idade);
  const limiar = porGrupo ? "o limiar do grupo de idade" : "o limiar";
  return (
    <section aria-labelledby="diabetes-titulo" className="scroll-mt-20">
      <CabecalhoDoProjeto
        projeto={DIABETES}
        id="diabetes-titulo"
        titulo="Triagem de diabetes: o modelo em teste"
        descricao={`${d ? `${d.n_features_entrada} respostas viram` : "As respostas viram"} a probabilidade de já ter recebido o diagnóstico de diabetes; ${limiar} encaminha quem fica nele ou acima dele. A base é real e anonimizada: o BRFSS 2015, do CDC.`}
        versao={d?.versao}
        lado={<ComoFunciona rotulo="Como funciona a triagem de diabetes" passos={passosDoModelo(d)} carregando={info.isPending} />}
      />
      {/* Dois por linha: com o velocímetro, quatro numa linha espremeriam o texto (os da obesidade são três). */}
      <ul aria-label="Desempenho da triagem de diabetes no teste" className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {METRICAS.map((m, i) => (
          <Metrica
            key={m.chave}
            rotulo={m.rotulo}
            detalhe={porGrupo && m.detalheDoGrupo ? m.detalheDoGrupo : m.detalhe}
            valor={d?.metricas_teste[m.chave]}
            formatar={m.formatar}
            carregando={info.isPending}
            ordem={i}
            referencia={d ? m.referencia(d) : undefined}
            rotulos={m.rotulos}
          />
        ))}
      </ul>
      <Revelar className="mt-4">
        <div onPointerMove={seguirOPonteiro} className="cartao-holofote rounded-2xl border bg-card p-5 text-card-foreground shadow-sm sm:p-6">
          {info.isError ? (
            <ErroInline erro={info.error} titulo="Não foi possível ler o manifest da vertente" aoTentarNovamente={() => void info.refetch()} />
          ) : d ? (
            <LimiarEModelo d={d} />
          ) : (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          )}
        </div>
      </Revelar>
      <nav aria-label="Telas da vertente diabetes" className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {TELAS.map(({ para, titulo, texto, textoDoGrupo, icone: Icone }, i) => (
          <Revelar key={para} ordem={i % 3}>
            <Link to={para} onPointerMove={seguirOPonteiro} className={CLASSE_DO_CARTAO}>
              <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary ring-1 ring-primary/15 ring-inset transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 motion-reduce:transition-none">
                <Icone aria-hidden="true" className="size-5" />
              </span>
              <span className="flex items-start justify-between gap-2 text-[15px] font-semibold">
                {titulo}
                <ArrowRight aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:text-primary motion-reduce:transition-none" />
              </span>
              <span className="text-sm text-muted-foreground">{porGrupo && textoDoGrupo ? textoDoGrupo : texto}</span>
            </Link>
          </Revelar>
        ))}
      </nav>
    </section>
  );
}
