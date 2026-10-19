import { Link2 } from "lucide-react";

import { fmtInt } from "@/shared/format/ptBR";
import { PageHeader } from "@/shared/layout/PageHeader";
import { avisar } from "@/shared/ui/avisos";
import { Button } from "@/shared/ui/button";

import { useResumoDiabetes } from "../api/painel";
import { BotaoLimparFiltrosDiabetes } from "../filtros/BotaoLimparFiltrosDiabetes";
import { FiltrosAtivosDiabetes } from "../filtros/FiltrosAtivosDiabetes";
import { useFiltrosDiabetes } from "../filtros/useFiltrosDiabetes";
import { useAtalhoEscDiabetes } from "../filtros/useLimparFiltrosDiabetes";
import { FaixaKpisDiabetes } from "./FaixaKpisDiabetes";
import { FatoresDiabetes } from "./FatoresDiabetes";
import { FiltrosDoPainelDiabetes } from "./FiltrosDoPainelDiabetes";
import { PiramideIdadeSexo } from "./PiramideIdadeSexo";
import { PrevalenciaPorIdade } from "./PrevalenciaPorIdade";
import { PrevalenciaPorImc } from "./PrevalenciaPorImc";

/** O painel se compartilha por link (os filtros moram na URL): copiar é levar o recorte junto. */
function BotaoCompartilhar() {
  async function copiar() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      avisar.sucesso("Link do recorte copiado", "Quem abrir verá o painel com os mesmos filtros.");
    } catch {
      avisar.erro("Não foi possível copiar o link", "Copie o endereço da barra do navegador.");
    }
  }
  return (
    <Button variant="outline" onClick={() => void copiar()}>
      <Link2 aria-hidden="true" />
      Copiar link
    </Button>
  );
}

/** O título de uma parte do painel: a pergunta que os cartões embaixo respondem. */
function TituloDaSecao({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <div className="col-span-full mt-4 flex flex-col gap-0.5 first:mt-0">
      <h2 className="text-lg leading-tight font-semibold tracking-tight">{titulo}</h2>
      <p className="text-sm text-muted-foreground">{descricao}</p>
    </div>
  );
}

/**
 * Visão Geral da vertente diabetes, no desenho da ADR 0012: a faixa de filtros, os KPIs do recorte
 * contra a base e três partes com título — a IDADE E O SEXO (o % com diabetes por faixa etária e a
 * pirâmide), O PESO (por faixa de IMC) e O QUE ANDA JUNTO com a diabetes (os 16 fatores). Gráficos em
 * 12 colunas a partir de 1280 px, 2 colunas entre 768 e 1279 px e 1 abaixo disso.
 */
export function PainelDiabetesPage() {
  const { filtros } = useFiltrosDiabetes();
  useAtalhoEscDiabetes();
  const resumo = useResumoDiabetes(filtros);
  const d = resumo.data;
  return (
    <>
      <PageHeader
        titulo="Visão Geral da diabetes"
        descricao={
          <>
            As respostas do BRFSS 2015 em indicadores e visuais com filtros cruzados: escolha nos filtros abaixo ou clique numa barra para filtrar o painel
            inteiro. <kbd className="rounded border bg-muted px-1 font-mono text-[11px]">Esc</kbd> limpa os filtros.
          </>
        }
        acoes={
          <>
            <BotaoCompartilhar />
            <BotaoLimparFiltrosDiabetes />
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p aria-live="polite" className="text-sm font-medium text-muted-foreground tabular-nums">
            {d ? `Recorte: ${fmtInt(d.total_registros)} de ${fmtInt(d.total_global)} respostas` : "Recorte: …"}
          </p>
          <FiltrosAtivosDiabetes />
        </div>
      </PageHeader>

      <div className="flex flex-col gap-4">
        <FiltrosDoPainelDiabetes />
        <FaixaKpisDiabetes resumo={resumo} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
          <TituloDaSecao titulo="Idade e sexo" descricao="O % com diabetes em cada faixa etária e como ele se divide entre mulheres e homens." />
          <div className="md:col-span-2 xl:col-span-7">
            <PrevalenciaPorIdade />
          </div>
          <div className="md:col-span-2 xl:col-span-5">
            <PiramideIdadeSexo />
          </div>

          <TituloDaSecao titulo="O peso" descricao="O % com diabetes em cada faixa de IMC da OMS, da mais leve à mais pesada." />
          <div className="md:col-span-2 xl:col-span-12">
            <PrevalenciaPorImc />
          </div>

          <TituloDaSecao
            titulo="O que anda junto com a diabetes"
            descricao="Diagnósticos, hábitos, acesso à saúde, escolaridade e renda: o % com diabetes em cada resposta."
          />
          <div className="md:col-span-2 xl:col-span-12">
            <FatoresDiabetes />
          </div>
        </div>
      </div>
    </>
  );
}
