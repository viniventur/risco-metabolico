import { ChevronRight } from "lucide-react";

import type { RespostaDeriva } from "@/shared/api/endpoints/tipos";
import { fmtInt, fmtNum } from "@/shared/format/ptBR";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Card } from "@/shared/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

type Props = {
  dado: RespostaDeriva;
  featureSelecionada: string;
  aoSelecionar: (feature: string) => void;
  /** nome da coluna -> rótulo de /metadata ("Atividade_Fisica_Frequencia" -> "Atividade física semanal") */
  rotulos?: Record<string, string>;
};

const SELO: Record<string, { variante: "success" | "warning" | "destructive" | "muted"; texto: string }> = {
  estavel: { variante: "success", texto: "estável" },
  atencao: { variante: "warning", texto: "atenção" },
  "deriva significativa": { variante: "destructive", texto: "deriva significativa" },
  "amostra insuficiente": { variante: "muted", texto: "amostra insuficiente" },
};

/** O nome da coluna pode quebrar depois de cada "_": sem isso ele define sozinho a largura mínima da tabela. */
function comQuebras(nome: string) {
  return nome.split("_").map((parte, i, partes) => (
    <span key={i}>
      {parte}
      {i < partes.length - 1 ? (
        <>
          _<wbr />
        </>
      ) : null}
    </span>
  ));
}

/**
 * Uma linha por feature, na ordem do backend (PSI desc). A coluna de PSI SOME quando a amostra
 * está abaixo do mínimo: amostra insuficiente é resultado, não falha (§7.6). A feature aparece pelo
 * rótulo de /metadata, com o nome da coluna embaixo; a classificação é um selo de uma linha.
 */
export function TabelaDeriva({ dado, featureSelecionada, aoSelecionar, rotulos = {} }: Props) {
  const mostrarPsi = dado.n_amostra >= dado.n_minimo;
  const estatisticas = new Map((dado.estatisticas ?? []).map((e) => [e.feature, e]));
  return (
    <Card className="min-w-0 overflow-hidden">
      <Table className="text-[13px]">
        <TableCaption className="mt-0 border-t px-4 py-3 text-left">Escolha uma feature para comparar treino e log faixa a faixa.</TableCaption>
        <TableHeader className="bg-muted">
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-4">Feature</TableHead>
            {mostrarPsi ? <TableHead className="text-right">PSI</TableHead> : null}
            <TableHead>Classificação</TableHead>
            <TableHead className="text-right">n (log)</TableHead>
            <TableHead className="text-right">
              Média <span className="font-normal normal-case">(log / treino)</span>
            </TableHead>
            <TableHead className="pr-4 text-right">Desloc.</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(dado.features ?? []).map((f) => {
            const e = estatisticas.get(f.feature);
            const ativa = f.feature === featureSelecionada;
            const selo = SELO[f.classificacao] ?? { variante: "muted" as const, texto: f.classificacao };
            const rotulo = rotulos[f.feature];
            return (
              <TableRow key={f.feature} data-state={ativa ? "selected" : undefined}>
                <TableCell className="py-1 pl-2">
                  <button
                    type="button"
                    onClick={() => aoSelecionar(ativa ? "" : f.feature)}
                    aria-pressed={ativa}
                    className={cn(
                      "group flex min-h-11 w-full min-w-40 items-center justify-between gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-accent",
                      ativa && "text-primary",
                    )}
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="leading-snug font-medium">{rotulo ?? f.feature}</span>
                      {rotulo ? <span className="font-mono text-[11px] text-muted-foreground">{comQuebras(f.feature)}</span> : null}
                    </span>
                    <ChevronRight aria-hidden="true" className={cn("size-4 shrink-0 text-muted-foreground transition-opacity", ativa ? "opacity-100" : "opacity-0 group-hover:opacity-60")} />
                  </button>
                </TableCell>
                {mostrarPsi ? <TableCell className="text-right font-medium tabular-nums">{f.psi === null ? "—" : fmtNum(f.psi, 3)}</TableCell> : null}
                <TableCell>
                  <Badge variant={selo.variante}>{selo.texto}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{fmtInt(f.n_amostra)}</TableCell>
                <TableCell className="text-right whitespace-nowrap tabular-nums">
                  {f.tipo === "numerica" ? (
                    <>
                      <span>{fmtNum(e?.media_log, 2)}</span>
                      <span className="text-muted-foreground"> / </span>
                      <span className="text-muted-foreground">{fmtNum(e?.media_treino, 2)}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="pr-4 text-right tabular-nums" title="Deslocamento da média, em desvios-padrão do treino">
                  {f.tipo === "numerica" ? fmtNum(e?.deslocamento_desvios, 2) : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
