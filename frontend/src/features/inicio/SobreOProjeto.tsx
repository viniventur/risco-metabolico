import {
  Activity,
  ArrowRight,
  Boxes,
  Check,
  Database,
  FileSearch,
  Fingerprint,
  GitCompareArrows,
  ListChecks,
  Scale,
  Server,
  Shuffle,
  Sigma,
  Target,
  TriangleAlert,
  Trophy,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";

import { ROTA_DA_PRIVACIDADE } from "@/features/legal/rota";
import { useMetadata } from "@/shared/api/endpoints/metadata";
import { useModelInfo } from "@/shared/api/endpoints/modelo";
import { URL_DOCS, URL_REPO } from "@/shared/api/http";
import { ORDEM_CLINICA, type MacroFaixa } from "@/shared/dominio";
import { fmtInt, fmtNum } from "@/shared/format/ptBR";
import { cn } from "@/shared/lib/utils";
import { NumeroQueConta } from "@/shared/movimento/NumeroQueConta";
import { Revelar } from "@/shared/movimento/Revelar";
import { TextoDecifrado } from "@/shared/movimento/TextoDecifrado";
import { useApareceuNaTela } from "@/shared/movimento/useApareceuNaTela";
import { Skeleton } from "@/shared/ui/skeleton";

import { seguirOPonteiro } from "./seguirOPonteiro";

/**
 * "Sobre o projeto": objetivo, dados, entradas, métodos, validação, serviço, monitoramento, o que a
 * auditoria do legado corrigiu e as limitações, num mosaico (bento) de cartões. Os números que o
 * serviço sabe (linhas do split, features, versão dos dados, gap, campos do formulário) vêm da API;
 * os que são fato documentado (77% sintéticos, 17 de 43) vêm de data/bruto/FONTE.md e da auditoria.
 */
export function SobreOProjeto() {
  return (
    <section id="sobre-o-projeto" aria-labelledby="sobre-o-projeto-titulo" className="scroll-mt-20">
      <CabecalhoDeSecao
        id="sobre-o-projeto-titulo"
        sobretitulo="Sobre o projeto"
        titulo="Objetivo, dados e métodos"
        descricao="Um microsserviço de machine learning com o serviço em volta: API com contrato versionado, banco com a base de origem e o log de predições, painel analítico, notebook de estudo e monitoramento de deriva. O diferencial não é o modelo — é o serviço em volta dele."
      />
      <ul className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Objetivo />
        <Dados />
        <Entradas />
        <Metodos />
        <Validacao />
        <Servico />
        <Monitoramento />
        <Auditoria />
        <Limitacoes />
      </ul>
    </section>
  );
}

export function CabecalhoDeSecao({ id, sobretitulo, titulo, descricao }: { id: string; sobretitulo: string; titulo: string; descricao?: string }) {
  return (
    <Revelar className="flex max-w-3xl flex-col gap-2">
      <p className="text-xs font-semibold tracking-wider text-primary uppercase">{sobretitulo}</p>
      <h2 id={id} className="text-2xl font-semibold tracking-tight text-balance sm:text-[1.75rem]">
        {titulo}
      </h2>
      {descricao ? <p className="text-sm leading-relaxed text-muted-foreground sm:text-[15px]">{descricao}</p> : null}
    </Revelar>
  );
}

// ---- O cartão do mosaico ----------------------------------------------------------------------------

type Tom = "primario" | "alerta";

const ICONE_DO_TOM: Record<Tom, string> = {
  primario: "bg-gradient-to-br from-primary/20 to-primary/5 text-primary ring-primary/15",
  alerta: "bg-gradient-to-br from-warning/20 to-warning/5 text-warning ring-warning/20",
};

function Cartao({
  icone: Icone,
  sobretitulo,
  titulo,
  className,
  ordem = 0,
  tom = "primario",
  children,
}: {
  icone: LucideIcon;
  sobretitulo: string;
  titulo: string;
  className?: string;
  ordem?: number;
  tom?: Tom;
  children: ReactNode;
}) {
  return (
    <Revelar as="li" ordem={ordem} className={cn("min-w-0", className)}>
      <article
        onPointerMove={seguirOPonteiro}
        className="cartao-holofote group flex h-full flex-col rounded-2xl border bg-card p-5 text-card-foreground shadow-sm transition-[translate,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5 motion-reduce:transition-none sm:p-6"
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 motion-reduce:transition-none",
              ICONE_DO_TOM[tom],
            )}
          >
            <Icone className="size-5" />
          </span>
          <p className={cn("text-xs font-semibold tracking-wider uppercase", tom === "alerta" ? "text-warning" : "text-primary")}>{sobretitulo}</p>
        </div>
        <h3 className="mt-4 text-lg leading-snug font-semibold tracking-tight">{titulo}</h3>
        <div className="mt-2 flex flex-1 flex-col gap-4 text-sm leading-relaxed text-muted-foreground">{children}</div>
      </article>
    </Revelar>
  );
}

function LinkDoCartao({ para, children, externo }: { para: string; children: ReactNode; externo?: boolean }) {
  const classe = "group/link mt-auto inline-flex w-fit items-center gap-1.5 pt-1 text-sm font-medium text-primary underline-offset-4 hover:underline";
  const seta = <ArrowRight aria-hidden="true" className="size-3.5 transition-transform duration-200 group-hover/link:translate-x-0.5 motion-reduce:transition-none" />;
  return externo ? (
    <a href={para} target="_blank" rel="noreferrer" className={classe}>
      {children}
      {seta}
    </a>
  ) : (
    <Link to={para} className={classe}>
      {children}
      {seta}
    </Link>
  );
}

function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full border bg-muted/40 px-2.5 py-0.5 text-xs text-foreground", className)}>{children}</span>;
}

/** Um número de destaque com o rótulo embaixo; conta quando o bloco aparece. */
function Estatistica({ valor, formatar, rotulo, carregando }: { valor: number | undefined; formatar: (v: number | null | undefined) => string; rotulo: string; carregando?: boolean }) {
  const [ref, apareceu] = useApareceuNaTela<HTMLDivElement>();
  return (
    // dt antes de dd no DOM, como o <dl> exige; o número aparece em cima pelo flex-col-reverse.
    <div ref={ref} className="flex min-w-0 flex-col-reverse justify-end gap-1 rounded-xl border bg-muted/30 px-3 py-3">
      <dt className="text-xs leading-snug">{rotulo}</dt>
      <dd className="text-2xl leading-none font-semibold tracking-tight text-foreground">
        {carregando ? <Skeleton className="h-6 w-16" /> : <NumeroQueConta valor={valor} formatar={formatar} ativo={apareceu} />}
      </dd>
    </div>
  );
}

const repo = (caminho: string) => (URL_REPO ? `${URL_REPO}/blob/main/${caminho}` : "");

// ---- Os cartões ------------------------------------------------------------------------------------

const MACRO: Record<string, MacroFaixa> = {
  "Abaixo do Peso": "abaixo",
  "Peso Normal": "normal",
  "Sobrepeso I": "sobrepeso",
  "Sobrepeso II": "sobrepeso",
  "Obesidade I": "obesidade",
  "Obesidade II": "obesidade",
  "Obesidade III": "obesidade",
};

const COR_DA_MACRO: Record<MacroFaixa, string> = {
  abaixo: "bg-faixa-abaixo",
  normal: "bg-faixa-normal",
  sobrepeso: "bg-faixa-sobrepeso",
  obesidade: "bg-faixa-obesidade",
};

function Objetivo() {
  const info = useModelInfo();
  const ordem: readonly string[] = info.data?.ordem_clinica ?? ORDEM_CLINICA;
  const [ref, apareceu] = useApareceuNaTela<HTMLDivElement>();
  const risco = ordem.slice(2);
  return (
    <Cartao icone={Target} sobretitulo="Objetivo" titulo="Ordenar prioridade de atenção, não fechar diagnóstico" className="md:col-span-2">
      <p>
        A partir de 16 respostas sobre medidas corporais e hábitos, o modelo estima a probabilidade de cada uma das{" "}
        <strong className="font-semibold text-foreground">7 faixas de composição corporal</strong>, em ordem clínica, e soma as cinco faixas de excesso de
        peso no <strong className="font-semibold text-foreground">risco metabólico acumulado</strong>. A saída diz por onde começar; quem fecha o
        diagnóstico é a avaliação clínica.
      </p>
      <div ref={ref} className="flex flex-col gap-3">
        {/* A rampa é desenho (a altura cresce com a ordem clínica, não com dado); os nomes estão na lista abaixo. */}
        <div aria-hidden="true" className="grid h-20 grid-cols-7 items-end gap-1.5">
          {ordem.map((faixa, i) => (
            <span
              key={faixa}
              data-ativo={apareceu}
              className={cn("barra-que-cresce block rounded-t-md opacity-90", COR_DA_MACRO[MACRO[faixa] ?? "normal"])}
              style={{ height: `${28 + i * 12}%`, "--ordem": i } as CSSProperties}
            />
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <ul aria-label="Faixas fora do risco" className="flex flex-wrap gap-1.5 sm:flex-col sm:justify-center">
            {ordem.slice(0, 2).map((faixa) => (
              <ChipDaFaixa key={faixa} faixa={faixa} />
            ))}
          </ul>
          <div className="flex flex-1 flex-col gap-2 rounded-xl border border-dashed border-faixa-obesidade/40 bg-faixa-obesidade/5 p-2.5">
            <ul aria-label="Faixas que somam o risco acumulado" className="flex flex-wrap gap-1.5">
              {risco.map((faixa) => (
                <ChipDaFaixa key={faixa} faixa={faixa} />
              ))}
            </ul>
            <p className="flex items-center gap-1.5 text-xs text-foreground">
              <Sigma aria-hidden="true" className="size-3.5 text-faixa-obesidade" />
              risco acumulado = soma das probabilidades destas {risco.length} faixas
            </p>
          </div>
        </div>
      </div>
    </Cartao>
  );
}

function ChipDaFaixa({ faixa }: { faixa: string }) {
  return (
    <li>
      <Chip className="gap-1.5 bg-card">
        <span aria-hidden="true" className={cn("size-2 rounded-full", COR_DA_MACRO[MACRO[faixa] ?? "normal"])} />
        {faixa}
      </Chip>
    </li>
  );
}

function Dados() {
  const info = useModelInfo();
  const split = info.data?.split;
  const linhas = split ? Number(split.linhas_treino) + Number(split.linhas_teste) : undefined;
  const colunas = info.data ? info.data.n_features_entrada + 1 : undefined;
  return (
    <Cartao icone={Database} sobretitulo="Dados" titulo="Duas bases públicas: uma fictícia, outra real e anonimizada" ordem={1}>
      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-semibold text-foreground">Obesidade: dados fictícios</h4>
        <dl className="grid grid-cols-3 gap-2">
          <Estatistica valor={linhas} formatar={fmtInt} rotulo="registros" carregando={info.isPending} />
          <Estatistica valor={colunas} formatar={fmtInt} rotulo="colunas, com o alvo" carregando={info.isPending} />
          <Estatistica valor={77} formatar={(v) => `${fmtInt(v)}%`} rotulo="sintéticos" />
        </dl>
        <p>
          Conjunto público do UCI Machine Learning Repository (id 544, licença CC BY 4.0). Os próprios autores geraram 77% dos registros
          sinteticamente: nenhum registro corresponde a uma pessoa real, e nenhuma leitura epidemiológica das distribuições é válida.
        </p>
      </div>
      <div className="flex flex-col gap-2 border-t pt-4">
        <h4 className="text-sm font-semibold text-foreground">Diabetes: dados reais e anonimizados</h4>
        <p>
          Respostas reais da pesquisa telefônica de fatores de risco do CDC dos Estados Unidos (BRFSS 2015), no UCI Machine Learning Repository
          (id 891, licença CC0), anonimizadas na origem: nenhum registro identifica uma pessoa. Sem pesos amostrais, a prevalência da base não
          estima a da população.
        </p>
      </div>
      {URL_REPO ? (
        <div className="mt-auto flex flex-wrap gap-x-4">
          <LinkDoCartao para={repo("docs/dicionario-de-dados.md")} externo>
            Dicionário · obesidade
          </LinkDoCartao>
          <LinkDoCartao para={repo("docs/dicionario-de-dados-diabetes.md")} externo>
            Dicionário · diabetes
          </LinkDoCartao>
        </div>
      ) : null}
    </Cartao>
  );
}

/** Os blocos do formulário (GET /metadata) com um nome curto para a visão geral; sem o id, vale o título da API. */
const NOME_DO_BLOCO: Record<string, string> = {
  "dados-iniciais": "Perfil e medidas",
  dieta: "Alimentação",
  habitos: "Hábitos e rotina",
};

function Entradas() {
  const metadata = useMetadata();
  const grupos = metadata.data?.grupos ?? [];
  const total = grupos.reduce((soma, g) => soma + g.campos.length, 0);
  return (
    <Cartao icone={ListChecks} sobretitulo="Entradas" titulo={total ? `${total} respostas, em ${grupos.length} blocos` : "As respostas do formulário"}>
      <p>O formulário do simulador nasce de GET /metadata, do mesmo domínio que treinou o modelo: nenhuma opção existe na tela sem existir no encoder.</p>
      {metadata.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-5 w-3/5" />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {grupos.map((grupo) => (
            <div key={grupo.id} className="flex flex-col gap-1.5">
              <p className="text-xs font-semibold text-foreground">{NOME_DO_BLOCO[grupo.id] ?? grupo.titulo}</p>
              <ul className="flex flex-wrap gap-1.5">
                {grupo.campos.map((campo) => (
                  <li key={campo.nome}>
                    <Chip>{campo.rotulo}</Chip>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Cartao>
  );
}

const PASSOS_DO_PIPELINE: Array<{ icone: LucideIcon; titulo: string; texto: string }> = [
  { icone: Scale, titulo: "IMC", texto: "peso ÷ altura², calculado no pipeline e usado como feature" },
  { icone: Boxes, titulo: "One-hot", texto: "13 categóricas de domínio fechado: valor desconhecido vira erro 422, não zero" },
  { icone: Shuffle, titulo: "SMOTE", texto: "equilibra as 7 classes só no treino, dentro do pipeline" },
  { icone: GitCompareArrows, titulo: "3 candidatos", texto: "Random Forest, LightGBM e XGBoost, com hiperparâmetros congelados" },
  { icone: Trophy, titulo: "Critério", texto: "maior recall de risco, depois acurácia, depois menor gap treino/teste" },
];

function Metodos() {
  const info = useModelInfo();
  const split = info.data?.split;
  const treino = split ? Number(split.linhas_treino) : undefined;
  const teste = split ? Number(split.linhas_teste) : undefined;
  const fracaoTreino = treino !== undefined && teste !== undefined ? treino / (treino + teste) : 0.8;
  const [ref, apareceu] = useApareceuNaTela<HTMLDivElement>();
  return (
    <Cartao icone={Workflow} sobretitulo="Métodos" titulo="Pipeline nomeado, três candidatos e um critério declarado" className="md:col-span-2" ordem={1}>
      <ol className="relative grid grid-cols-1 gap-4 sm:grid-cols-5 sm:gap-3">
        <span aria-hidden="true" className="linha-com-feixe absolute top-5 right-[10%] left-[10%] hidden h-px sm:block" />
        <span aria-hidden="true" className="linha-com-feixe linha-com-feixe--vertical absolute top-5 bottom-5 left-5 w-px sm:hidden" />
        {PASSOS_DO_PIPELINE.map(({ icone: Icone, titulo, texto }) => (
          <li key={titulo} className="relative flex gap-3 sm:flex-col sm:items-center sm:text-center">
            <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full border bg-card text-primary shadow-sm ring-4 ring-card">
              <Icone aria-hidden="true" className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{titulo}</p>
              <p className="mt-0.5 text-xs leading-snug">{texto}</p>
            </div>
          </li>
        ))}
      </ol>
      <div ref={ref} className="flex flex-col gap-2 rounded-xl border bg-muted/30 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-foreground">Divisão estratificada, semente 42</span>
          {info.data ? (
            <Chip className="gap-1.5 border-primary/30 bg-primary/8 text-primary">
              <Trophy aria-hidden="true" className="size-3" />
              escolhido: {info.data.algoritmo} v{info.data.versao}
            </Chip>
          ) : null}
        </div>
        <div aria-hidden="true" className="flex h-2.5 overflow-hidden rounded-full bg-muted">
          <span
            className="h-full rounded-l-full bg-primary transition-[width] duration-1000 ease-out motion-reduce:transition-none"
            style={{ width: apareceu ? `${fracaoTreino * 100}%` : "0%" }}
          />
          <span className="h-full flex-1 bg-secundaria/70" />
        </div>
        <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
          <div className="flex items-center gap-1.5">
            <dt className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
              Treino
            </dt>
            <dd className="font-semibold text-foreground">{info.isPending ? "…" : <NumeroQueConta valor={treino} formatar={fmtInt} ativo={apareceu} />}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2 rounded-full bg-secundaria/70" />
              Teste
            </dt>
            <dd className="font-semibold text-foreground">{info.isPending ? "…" : <NumeroQueConta valor={teste} formatar={fmtInt} ativo={apareceu} />}</dd>
          </div>
        </dl>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-foreground">Duas decisões fechadas por A/B, com número</p>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {DECISOES_AB.map((decisao) => {
            const ligado = info.data ? info.data[decisao.campo] : undefined;
            return (
              <li key={decisao.titulo} className="flex flex-col gap-1.5 rounded-xl border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground">{decisao.titulo}</span>
                  {ligado === undefined ? (
                    <Skeleton className="h-5 w-16" />
                  ) : (
                    <Chip className={ligado ? "border-success/30 bg-success/10 text-success" : "bg-muted text-muted-foreground"}>{ligado ? "ligado" : "desligado"}</Chip>
                  )}
                </div>
                <p className="text-xs leading-snug">{decisao.texto}</p>
              </li>
            );
          })}
        </ul>
      </div>
      {URL_REPO ? (
        <LinkDoCartao para={repo("docs/modelagem.md")} externo>
          Modelagem em detalhe
        </LinkDoCartao>
      ) : null}
    </Cartao>
  );
}

/** O estado de cada decisão vem do manifest (GET /model/info); o porquê, das ADRs 0002 e 0003. */
const DECISOES_AB = [
  {
    campo: "imc_como_feature",
    titulo: "IMC como feature",
    texto: "Recall empatado; com o IMC, +2,4 pontos de acurácia e o gap treino/teste cai de 3,55 para 1,18 p.p. — contra a expectativa inicial.",
  },
  {
    campo: "binning_ativo",
    titulo: "Binning das escalas",
    texto: "Um caso de diferença no recall em 423 e acurácia idêntica: dentro do ruído, e uma transformação a menos entre treino e serviço.",
  },
] as const;

function Validacao() {
  const info = useModelInfo();
  const d = info.data;
  const gap = d?.overfitting && typeof d.overfitting.diff_acuracia === "number" ? d.overfitting.diff_acuracia * 100 : undefined;
  const [ref, apareceu] = useApareceuNaTela<HTMLDListElement>();
  return (
    <Cartao icone={Fingerprint} sobretitulo="Validação" titulo="Reprodutível do dado ao artefato">
      <p>
        O treino lê um snapshot congelado do banco, e o sha256 desse arquivo vira a versão dos dados. O CI retreina sobre o mesmo snapshot e falha se as
        predições não baterem; um teste de paridade prova que treino e API calculam igual.
      </p>
      <dl ref={ref} className="grid grid-cols-2 gap-2">
        <div className="flex min-w-0 flex-col-reverse justify-end gap-1 rounded-xl border bg-muted/30 px-3 py-3">
          <dt className="text-xs">versão dos dados</dt>
          <dd className="truncate font-mono text-[15px] leading-none font-semibold text-foreground">
            {d ? <TextoDecifrado key={d.versao_dados} texto={d.versao_dados} ativo={apareceu} /> : <Skeleton className="h-4 w-24" />}
          </dd>
        </div>
        <div className="flex min-w-0 flex-col-reverse justify-end gap-1 rounded-xl border bg-muted/30 px-3 py-3">
          <dt className="text-xs">gap de acurácia treino/teste</dt>
          <dd className="text-[15px] leading-none font-semibold text-foreground">
            {d ? <NumeroQueConta valor={gap} formatar={(v) => `${fmtNum(v, 1)} p.p.`} ativo={apareceu} /> : <Skeleton className="h-4 w-16" />}
          </dd>
        </div>
      </dl>
    </Cartao>
  );
}

function Servico() {
  return (
    <Cartao icone={Server} sobretitulo="Serviço" titulo="O serviço em volta do modelo" ordem={1}>
      <p>
        API FastAPI com contrato versionado e envelope único de erro, Postgres com a base de origem e o log anônimo de predições, painel servido de memória e
        este front em React. Tudo em contêineres, com a mesma pilha no computador e no servidor.
      </p>
      <ul aria-label="Tecnologias" className="flex flex-wrap gap-1.5">
        {["FastAPI", "PostgreSQL", "XGBoost", "React", "Docker", "nginx"].map((t) => (
          <li key={t}>
            <Chip>{t}</Chip>
          </li>
        ))}
      </ul>
      <LinkDoCartao para={URL_DOCS} externo>
        Documentação da API
      </LinkDoCartao>
    </Cartao>
  );
}

function Monitoramento() {
  return (
    <Cartao icone={Activity} sobretitulo="Monitoramento" titulo="Deriva vigiada pelo PSI" className="md:col-span-2 lg:col-span-1" ordem={2}>
      <p>
        As respostas que chegam ao simulador e à API são comparadas, feature a feature, com a distribuição do treino. Se o público mudar, a tela avisa antes de o
        modelo errar em silêncio.
      </p>
      {/* Os cortes do PSI e a amostra mínima: ADR 0008 (convenção de mercado; o n = 200 foi medido). */}
      <div className="flex flex-col gap-2">
        <div aria-hidden="true" className="flex h-2 overflow-hidden rounded-full">
          <span className="w-[30%] bg-success/70" />
          <span className="w-[45%] bg-warning/70" />
          <span className="flex-1 bg-destructive/70" />
        </div>
        <ul aria-label="Leitura do PSI" className="grid grid-cols-3 gap-1 text-xs">
          <li>
            <span className="font-semibold text-foreground">&lt; 0,10</span>
            <br />
            estável
          </li>
          <li>
            <span className="font-semibold text-foreground">0,10–0,25</span>
            <br />
            atenção
          </li>
          <li>
            <span className="font-semibold text-foreground">≥ 0,25</span>
            <br />
            deriva
          </li>
        </ul>
        <p className="text-xs">Só lê a deriva com 200 predições ou mais na janela: o mínimo medido para uma amostra do próprio treino não dar alarme falso.</p>
      </div>
      <LinkDoCartao para="/monitoramento">Abrir o monitoramento</LinkDoCartao>
    </Cartao>
  );
}

const CORRECOES = [
  "Passo de features serializado como função anônima, preso a uma versão de Python → passos nomeados, gravados com joblib",
  "Binning documentado que nunca aconteceu no treino → parâmetro explícito, decidido por A/B",
  "Encoder que ignorava valor desconhecido e zerava features em silêncio → domínio fechado e erro 422",
  "Opções do formulário fora do domínio do encoder → formulário gerado de GET /metadata",
];

function Auditoria() {
  const [ref, apareceu] = useApareceuNaTela<HTMLDivElement>();
  return (
    <Cartao icone={FileSearch} sobretitulo="Auditoria do legado" titulo="O que o modelo herdado escondia" className="md:col-span-2">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div ref={ref} className="flex shrink-0 flex-col gap-1 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 sm:w-44">
          <p className="text-3xl leading-none font-semibold tracking-tight text-foreground">
            <NumeroQueConta valor={17} formatar={fmtInt} ativo={apareceu} /> <span className="text-lg font-medium text-muted-foreground">de 43</span>
          </p>
          <p className="text-xs leading-snug">features chegavam zeradas ao modelo em serviço, sem nenhum aviso</p>
        </div>
        <ul className="flex flex-col gap-2">
          {CORRECOES.map((correcao) => (
            <li key={correcao} className="flex gap-2">
              <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
              <span>{correcao}</span>
            </li>
          ))}
        </ul>
      </div>
      {URL_REPO ? (
        <LinkDoCartao para={repo("docs/auditoria-do-legado.md")} externo>
          A auditoria, com a evidência
        </LinkDoCartao>
      ) : null}
    </Cartao>
  );
}

const LIMITES = [
  "Triagem, não diagnóstico: a saída ordena prioridade de atenção.",
  "Base de obesidade majoritariamente sintética: nenhuma leitura epidemiológica é válida.",
  "Base de diabetes real, mas autodeclarada e sem pesos amostrais: associação, não causa, e uma prevalência que não é a da população.",
  "Sem login, por decisão: nada é salvo por pessoa, e o registro do simulador é anônimo.",
];

function Limitacoes() {
  return (
    <Cartao icone={TriangleAlert} sobretitulo="Limitações" titulo="Os limites, ditos com clareza" tom="alerta" className="md:col-span-2 lg:col-span-1" ordem={1}>
      <ul className="flex flex-col gap-2">
        {LIMITES.map((limite) => (
          <li key={limite} className="flex gap-2">
            <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-warning" />
            <span>{limite}</span>
          </li>
        ))}
      </ul>
      <LinkDoCartao para={ROTA_DA_PRIVACIDADE}>Política de Privacidade</LinkDoCartao>
    </Cartao>
  );
}
