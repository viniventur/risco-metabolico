import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type SortingState } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, FilterX } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import type { Direcao } from "@/shared/api/endpoints/registros";
import { QueryState } from "@/shared/estados/QueryState";
import { fmtInt } from "@/shared/format/ptBR";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";

import { useMetadataDiabetes } from "../api/modelo";
import { useFatoresDiabetes } from "../api/painel";
import { useRegistrosDiabetes } from "../api/registros";
import type { CampoPainelDiabetes } from "../api/tipos";
import { FILTRO_VAZIO_DIABETES, paraQueryStringDiabetes } from "../filtros/filtroDiabetes";
import { rotuloDoValor, useCamposDiabetes } from "../filtros/useCamposDiabetes";
import { useFiltrosDiabetes } from "../filtros/useFiltrosDiabetes";
import { useLimparFiltrosDiabetes } from "../filtros/useLimparFiltrosDiabetes";
import { CAMPOS_FORA_DOS_FATORES, COLUNA_IMC, COLUNAS_DIABETES, campoDaColuna, type ColunaDiabetes } from "./colunas";

type Registro = Record<string, unknown>;
type Rotulos = { campos: Map<string, CampoPainelDiabetes>; rotuloImc?: string };

const TAMANHO_PAGINA = 200;
const ALTURA_LINHA = 40;
const ORDEM_INICIAL = "IMC";

/**
 * Os rótulos das 23 colunas e dos valores delas, todos da API: os 16 fatores de /diabetes/painel/fatores,
 * as outras colunas de /diabetes/painel/por-categoria sem filtro e o IMC de /diabetes/metadata. São as
 * mesmas consultas, sem filtro, que a Visão Geral faz: o cache é o mesmo.
 */
function useRotulosDaConsulta(): Rotulos {
  const fatores = useFatoresDiabetes(FILTRO_VAZIO_DIABETES);
  const outros = useCamposDiabetes(CAMPOS_FORA_DOS_FATORES);
  const metadata = useMetadataDiabetes();
  return useMemo(() => {
    const campos = new Map(outros);
    for (const c of fatores.data?.campos ?? []) if (!campos.has(c.campo)) campos.set(c.campo, c);
    const rotuloImc = metadata.data?.grupos.flatMap((g) => g.campos).find((c) => c.nome === COLUNA_IMC)?.rotulo;
    return { campos, rotuloImc };
  }, [outros, fatores.data, metadata.data]);
}

/** O cabeçalho da coluna: o rótulo da API (enquanto ele não chega, o nome da coluna). */
function rotuloDaColuna(coluna: ColunaDiabetes, rotulos: Rotulos): string {
  if (coluna.chave === COLUNA_IMC) return rotulos.rotuloImc ?? coluna.chave;
  return rotulos.campos.get(campoDaColuna(coluna.chave))?.rotulo ?? coluna.chave;
}

/** A célula: o IMC da base é inteiro (a pesquisa o arredondou), as escalas e os dias mostram o rótulo da API. */
function textoDaCelula(coluna: ColunaDiabetes, valor: unknown, rotulos: Rotulos): string {
  if (valor === null || valor === undefined) return "—";
  if (coluna.chave === COLUNA_IMC) return fmtInt(valor as number);
  return rotuloDoValor(rotulos.campos.get(campoDaColuna(coluna.chave)), String(valor));
}

function IconeDeOrdem({ ordem }: { ordem: false | "asc" | "desc" }) {
  if (ordem === "asc") return <ArrowUp aria-hidden="true" className="size-3.5 shrink-0 text-foreground" />;
  if (ordem === "desc") return <ArrowDown aria-hidden="true" className="size-3.5 shrink-0 text-foreground" />;
  return <ArrowUpDown aria-hidden="true" className="size-3.5 shrink-0 opacity-40 group-hover:opacity-80" />;
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
 * A tabela da Consulta da vertente, no desenho da tabela da obesidade: TanStack Table + TanStack
 * Virtual (só ~30 linhas no DOM), ordenação e paginação NO SERVIDOR, ordem inicial por IMC
 * decrescente, cabeçalho fixo com o ícone de ordem em toda coluna e a primeira coluna (o diagnóstico)
 * fixa à esquerda, com o ponto violeta de quem tem diabetes. Os rótulos da API são longos: o
 * cabeçalho quebra em até duas linhas.
 */
export function TabelaRegistrosDiabetes() {
  const { filtros } = useFiltrosDiabetes();
  const { vazio: semFiltro, limpar } = useLimparFiltrosDiabetes();
  const rotulos = useRotulosDaConsulta();
  const chaveRecorte = JSON.stringify(paraQueryStringDiabetes(filtros));
  // A página volta para 1 quando o recorte muda — estado derivado no render, sem efeito.
  const [estadoPagina, setEstadoPagina] = useState({ chave: chaveRecorte, pagina: 1 });
  const pagina = estadoPagina.chave === chaveRecorte ? estadoPagina.pagina : 1;
  const [ordenacao, setOrdenacao] = useState<SortingState>([{ id: ORDEM_INICIAL, desc: true }]);
  const ordenarPor = ordenacao[0]?.id ?? ORDEM_INICIAL;
  const direcao: Direcao = ordenacao[0] && !ordenacao[0].desc ? "asc" : "desc";
  const q = useRegistrosDiabetes(filtros, pagina, TAMANHO_PAGINA, ordenarPor, direcao);

  const colunas = useMemo<ColumnDef<Registro>[]>(
    () =>
      COLUNAS_DIABETES.map((c) => ({
        id: c.chave,
        accessorKey: c.chave,
        header: rotuloDaColuna(c, rotulos),
        size: c.largura,
        meta: { numerica: c.numerica ?? false },
        cell: (info) => textoDaCelula(c, info.getValue(), rotulos),
      })),
    [rotulos],
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
  const colunaDaOrdem = COLUNAS_DIABETES.find((c) => c.chave === ordenarPor);
  const rotuloDaOrdem = colunaDaOrdem ? rotuloDaColuna(colunaDaOrdem, rotulos) : ordenarPor;

  return (
    <Card className="flex min-w-0 flex-col overflow-hidden">
      <section aria-label="Respostas do recorte" className="flex min-w-0 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {q.data ? (
              <>
                <span className="font-semibold text-foreground tabular-nums">{fmtInt(total)} respostas</span>
                {` · página ${fmtInt(pagina)} de ${fmtInt(paginas)} · ordem: ${rotuloDaOrdem} ${direcao === "desc" ? "decrescente" : "crescente"}`}
              </>
            ) : (
              "Carregando respostas…"
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
            tituloVazio="Nenhuma resposta no recorte"
            mensagemVazio="Nenhuma resposta atende a todos os filtros ao mesmo tempo. Tire um filtro para ampliar o recorte."
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
                  Respostas do recorte, ordenadas por {rotuloDaOrdem} ({direcao === "desc" ? "decrescente" : "crescente"})
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
                              "sticky top-0 z-10 h-11 border-b bg-muted p-0 text-left align-middle text-xs font-semibold text-muted-foreground",
                              i === 0 && "left-0 z-20 border-r",
                            )}
                          >
                            <button
                              type="button"
                              onClick={h.column.getToggleSortingHandler()}
                              className={cn(
                                "group flex min-h-11 w-full items-center gap-1.5 px-3 py-1 transition-colors hover:bg-accent hover:text-accent-foreground",
                                numerica && "justify-end",
                                ordem && "text-foreground",
                              )}
                            >
                              <span className={cn("line-clamp-2 leading-tight", numerica ? "text-right" : "text-left")}>
                                {flexRender(h.column.columnDef.header, h.getContext())}
                              </span>
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
                      <td style={{ height: topo }} colSpan={COLUNAS_DIABETES.length} />
                    </tr>
                  ) : null}
                  {itens.map((vi) => {
                    const row = rows[vi.index];
                    if (!row) return null;
                    return (
                      // A zebra segue o índice da resposta, não a posição no DOM: as linhas espaçadoras
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
                                  <span
                                    aria-hidden="true"
                                    className={cn("size-2 shrink-0 rounded-full", cell.getValue() === "Sim" ? "bg-diabetes" : "border border-muted-foreground/60")}
                                  />
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
                      <td style={{ height: base }} colSpan={COLUNAS_DIABETES.length} />
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
