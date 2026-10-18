import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type SortingState } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, FilterX } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import { useMetadata } from "@/shared/api/endpoints/metadata";
import { useRegistros, type Direcao } from "@/shared/api/endpoints/registros";
import { QueryState } from "@/shared/estados/QueryState";
import { paraStringLegivel } from "@/shared/filtros/paraQueryString";
import { useFiltros } from "@/shared/filtros/useFiltros";
import { useLimparFiltros } from "@/shared/filtros/useLimparFiltros";
import { useRotulos } from "@/shared/filtros/useRotulos";
import { fmtImc, fmtInt, fmtNum } from "@/shared/format/ptBR";
import { cn } from "@/shared/lib/utils";
import { MACRO_FAIXA } from "@/shared/tema/useChartTheme";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";

type Registro = Record<string, unknown>;
type Rotulador = (campo: string, valor: string) => string;

const TAMANHO_PAGINA = 200;
const ALTURA_LINHA = 40;

const texto = (v: unknown) => (v === null || v === undefined ? "—" : String(v));

/** Classe literal do ponto de cada macro-faixa (o Tailwind só gera classe que aparece escrita). */
const PONTO_DA_FAIXA: Record<string, string> = {
  abaixo: "bg-faixa-abaixo",
  normal: "bg-faixa-normal",
  sobrepeso: "bg-faixa-sobrepeso",
  obesidade: "bg-faixa-obesidade",
};

// As 18 colunas de §7.4, na ordem do painel de referência, com largura por coluna. As escalas
// ordinais mostram o RÓTULO de /metadata e ordenam pelo inteiro no servidor: antes, "Tempo em telas 1"
// aparecia no lugar de "3 a 5 horas/dia" (redesenho, 1.15).
const COLUNAS: Array<{ chave: string; rotulo: string; largura: number; numerica?: boolean; formatar?: (v: unknown, r: Rotulador) => string }> = [
  { chave: "Nivel_Obesidade", rotulo: "Nível", largura: 150 },
  { chave: "IMC", rotulo: "IMC", largura: 84, numerica: true, formatar: (v) => fmtImc(v as number) },
  { chave: "Altura", rotulo: "Altura (m)", largura: 104, numerica: true, formatar: (v) => fmtNum(v as number, 2) },
  { chave: "Peso", rotulo: "Peso (kg)", largura: 100, numerica: true, formatar: (v) => fmtNum(v as number, 1) },
  { chave: "Idade", rotulo: "Idade", largura: 84, numerica: true, formatar: (v) => fmtNum(v as number, 1) },
  { chave: "Atividade_Fisica_Frequencia", rotulo: "Atividade física", largura: 150, formatar: (v, r) => r("atividade", texto(v)) },
  { chave: "Consumo_Agua_Diario", rotulo: "Água por dia", largura: 130, formatar: (v, r) => r("Consumo_Agua_Diario", texto(v)) },
  { chave: "Consumo_Alcool", rotulo: "Álcool", largura: 150 },
  { chave: "Consumo_Calorico_Frequente", rotulo: "Calóricos", largura: 110 },
  { chave: "Consumo_Alimentos_Entre_Refeicoes", rotulo: "Lanches", largura: 150 },
  { chave: "Consumo_Vegetais", rotulo: "Vegetais", largura: 110, formatar: (v, r) => r("Consumo_Vegetais", texto(v)) },
  { chave: "Fumante", rotulo: "Fumante", largura: 100 },
  { chave: "Genero", rotulo: "Gênero", largura: 110 },
  { chave: "Historico_Familiar_Sobrepeso", rotulo: "Hist. familiar", largura: 130 },
  { chave: "Meio_Transporte", rotulo: "Transporte", largura: 170 },
  { chave: "Monitoramento_Calorias", rotulo: "Monitora calorias", largura: 150 },
  { chave: "Numero_Refeicoes_Principais", rotulo: "Refeições", largura: 130, formatar: (v, r) => r("Numero_Refeicoes_Principais", texto(v)) },
  { chave: "Tempo_Dispositivos_Tecnologicos", rotulo: "Tempo em telas", largura: 160, formatar: (v, r) => r("Tempo_Dispositivos_Tecnologicos", texto(v)) },
];

/** Rótulos das escalas ordinais: os de /dimensoes (atividade curta, água) e, para o resto, os de /metadata. */
function useRotulador(): Rotulador {
  const rotuloDoFiltro = useRotulos();
  const metadata = useMetadata();
  const porCampo = useMemo(() => {
    const mapa = new Map<string, Map<string, string>>();
    for (const c of metadata.data?.grupos.flatMap((g) => g.campos) ?? []) {
      mapa.set(c.nome, new Map((c.opcoes ?? []).map((o) => [String(o.valor), o.rotulo])));
    }
    return mapa;
  }, [metadata.data]);
  return useCallback(
    (campo: string, valor: string) => {
      if (campo === "atividade") return rotuloDoFiltro("atividade", valor);
      if (campo === "Consumo_Agua_Diario") return rotuloDoFiltro("agua", valor);
      return porCampo.get(campo)?.get(valor) ?? valor;
    },
    [porCampo, rotuloDoFiltro],
  );
}

function IconeDeOrdem({ ordem }: { ordem: false | "asc" | "desc" }) {
  if (ordem === "asc") return <ArrowUp aria-hidden="true" className="size-3.5 text-foreground" />;
  if (ordem === "desc") return <ArrowDown aria-hidden="true" className="size-3.5 text-foreground" />;
  return <ArrowUpDown aria-hidden="true" className="size-3.5 opacity-40 group-hover:opacity-80" />;
}

function EsqueletoTabela() {
  return (
    <div className="flex flex-col gap-2 p-1">
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: 10 }, (_, i) => (
        <Skeleton key={i} className="h-8 w-full opacity-70" />
      ))}
    </div>
  );
}

/**
 * TanStack Table (modelo de linhas) + TanStack Virtual (só ~30 linhas no DOM): ordenação e
 * paginação acontecem NO SERVIDOR (`ordenar_por`, `direcao`, `pagina`, `tamanho`); ordem inicial
 * por IMC desc (§7.4). Desenho de ui/table: cabeçalho fixo de 44 px com ícone de ordem em toda
 * coluna, primeira coluna fixa à esquerda (a linha não perde o nível ao rolar), zebra opaca.
 */
export function TabelaRegistros() {
  const { filtros } = useFiltros();
  const { vazio: semFiltro, limpar } = useLimparFiltros();
  const rotulo = useRotulador();
  const chaveRecorte = paraStringLegivel(filtros);
  // A página volta para 1 quando o recorte muda — estado derivado no render, sem efeito.
  const [estadoPagina, setEstadoPagina] = useState({ chave: chaveRecorte, pagina: 1 });
  const pagina = estadoPagina.chave === chaveRecorte ? estadoPagina.pagina : 1;
  const [ordenacao, setOrdenacao] = useState<SortingState>([{ id: "IMC", desc: true }]);
  const ordenarPor = ordenacao[0]?.id ?? "IMC";
  const direcao: Direcao = ordenacao[0] && !ordenacao[0].desc ? "asc" : "desc";
  const q = useRegistros(filtros, pagina, TAMANHO_PAGINA, ordenarPor, direcao);

  const colunas = useMemo<ColumnDef<Registro>[]>(
    () =>
      COLUNAS.map((c) => ({
        id: c.chave,
        accessorKey: c.chave,
        header: c.rotulo,
        size: c.largura,
        meta: { numerica: c.numerica ?? false },
        cell: (info) => (c.formatar ? c.formatar(info.getValue(), rotulo) : texto(info.getValue())),
      })),
    [rotulo],
  );
  const linhas = useMemo(() => (q.data?.linhas ?? []) as Registro[], [q.data]);
  // eslint-disable-next-line react-hooks/incompatible-library -- a instância da tabela não é memoizada de propósito
  const tabela = useReactTable({
    data: linhas,
    columns: colunas,
    state: { sorting: ordenacao },
    onSortingChange: setOrdenacao,
    manualSorting: true,
    enableSortingRemoval: false,
    getCoreRowModel: getCoreRowModel(),
  });
  const rows = tabela.getRowModel().rows;

  const conteiner = useRef<HTMLDivElement>(null);
  const virtual = useVirtualizer({
    count: rows.length,
    getScrollElement: () => conteiner.current,
    estimateSize: () => ALTURA_LINHA,
    overscan: 6,
  });
  const itens = virtual.getVirtualItems();
  const topo = itens[0]?.start ?? 0;
  const base = itens.length ? virtual.getTotalSize() - (itens[itens.length - 1]?.end ?? 0) : 0;

  const total = q.data?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / TAMANHO_PAGINA));
  const mudarPagina = (p: number) => {
    setEstadoPagina({ chave: chaveRecorte, pagina: Math.min(Math.max(1, p), paginas) });
    conteiner.current?.scrollTo({ top: 0 });
  };
  const rotuloDaColuna = COLUNAS.find((c) => c.chave === ordenarPor)?.rotulo ?? ordenarPor;

  return (
    <Card className="flex min-w-0 flex-col overflow-hidden">
      <section aria-label="Registros do recorte" className="flex min-w-0 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {q.data ? (
              <>
                <span className="font-semibold text-foreground tabular-nums">{fmtInt(total)} registros</span>
                {` · página ${fmtInt(pagina)} de ${fmtInt(paginas)} · ordem: ${rotuloDaColuna} ${direcao === "desc" ? "decrescente" : "crescente"}`}
              </>
            ) : (
              "Carregando registros…"
            )}
          </p>
          <nav aria-label="Paginação" className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => mudarPagina(pagina - 1)} disabled={pagina <= 1}>
              <ChevronLeft aria-hidden="true" />
              Anterior
            </Button>
            <Button variant="outline" size="sm" onClick={() => mudarPagina(pagina + 1)} disabled={pagina >= paginas}>
              Próxima
              <ChevronRight aria-hidden="true" />
            </Button>
          </nav>
        </div>
        <div className="border-t">
          <QueryState
            carregando={q.isPending}
            erro={q.error}
            atualizando={q.isFetching && !q.isPending}
            vazio={q.data?.total === 0}
            aoTentarNovamente={() => void q.refetch()}
            esqueleto={<EsqueletoTabela />}
            mensagemVazio="Nenhum registro atende a todos os filtros ao mesmo tempo. Tire um filtro para ampliar o recorte."
            acaoVazio={
              semFiltro ? null : (
                <Button variant="outline" size="sm" onClick={limpar}>
                  <FilterX aria-hidden="true" />
                  Limpar filtros
                </Button>
              )
            }
            className="min-h-60"
          >
            <div ref={conteiner} className="h-[clamp(360px,calc(100vh-300px),680px)] overflow-auto">
              <table className="border-separate border-spacing-0 text-sm" style={{ width: tabela.getTotalSize(), tableLayout: "fixed" }}>
                <caption className="sr-only">
                  Registros do recorte, ordenados por {rotuloDaColuna} ({direcao === "desc" ? "decrescente" : "crescente"})
                </caption>
                <thead>
                  {tabela.getHeaderGroups().map((grupo) => (
                    <tr key={grupo.id}>
                      {grupo.headers.map((h, i) => {
                        const ordem = h.column.getIsSorted();
                        const numerica = (h.column.columnDef.meta as { numerica?: boolean } | undefined)?.numerica;
                        return (
                          <th
                            key={h.id}
                            scope="col"
                            style={{ width: h.getSize() }}
                            aria-sort={ordem === "asc" ? "ascending" : ordem === "desc" ? "descending" : "none"}
                            className={cn(
                              "sticky top-0 z-10 h-11 border-b bg-muted p-0 text-left text-xs font-semibold text-muted-foreground",
                              i === 0 && "left-0 z-20 border-r",
                            )}
                          >
                            <button
                              type="button"
                              onClick={h.column.getToggleSortingHandler()}
                              className={cn(
                                "group flex h-11 w-full items-center gap-1.5 px-3 transition-colors hover:bg-accent hover:text-accent-foreground",
                                numerica && "justify-end",
                                ordem && "text-foreground",
                              )}
                            >
                              <span className="truncate">{flexRender(h.column.columnDef.header, h.getContext())}</span>
                              <IconeDeOrdem ordem={ordem} />
                            </button>
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {topo > 0 ? (
                    <tr aria-hidden="true">
                      <td style={{ height: topo }} colSpan={COLUNAS.length} />
                    </tr>
                  ) : null}
                  {itens.map((vi) => {
                    const row = rows[vi.index];
                    if (!row) return null;
                    return (
                      // A zebra segue o índice do registro, não a posição no DOM: as linhas espaçadoras
                      // da virtualização trocariam a paridade a cada rolagem.
                      <tr key={row.id} className={cn("hover:bg-accent", vi.index % 2 ? "bg-zebra" : "bg-card")} style={{ height: vi.size }}>
                        {row.getVisibleCells().map((cell, i) => {
                          const numerica = (cell.column.columnDef.meta as { numerica?: boolean } | undefined)?.numerica;
                          const valor = flexRender(cell.column.columnDef.cell, cell.getContext());
                          return (
                            <td
                              key={cell.id}
                              style={{ width: cell.column.getSize() }}
                              className={cn(
                                "truncate border-b border-border/60 bg-inherit px-3",
                                numerica && "text-right tabular-nums",
                                i === 0 && "sticky left-0 z-[1] border-r font-medium",
                              )}
                            >
                              {i === 0 ? (
                                <span className="flex items-center gap-2">
                                  <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", PONTO_DA_FAIXA[MACRO_FAIXA[String(cell.getValue())] ?? ""])} />
                                  <span className="truncate">{valor}</span>
                                </span>
                              ) : (
                                valor
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {base > 0 ? (
                    <tr aria-hidden="true">
                      <td style={{ height: base }} colSpan={COLUNAS.length} />
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </QueryState>
        </div>
      </section>
    </Card>
  );
}
