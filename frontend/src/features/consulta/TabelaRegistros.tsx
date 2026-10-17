import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type SortingState } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMemo, useRef, useState } from "react";

import { useRegistros, type Direcao } from "@/shared/api/endpoints/registros";
import { paraStringLegivel } from "@/shared/filtros/paraQueryString";
import { useFiltros } from "@/shared/filtros/useFiltros";
import { fmtImc, fmtInt, fmtNum } from "@/shared/format/ptBR";
import { QueryState } from "@/shared/ui/QueryState";

import { useRotulos } from "../painel/useRotulos";

type Registro = Record<string, unknown>;
type Rotulador = (campo: string, valor: string) => string;

const TAMANHO_PAGINA = 200;
const ALTURA_LINHA = 36;

const texto = (v: unknown) => (v === null || v === undefined ? "—" : String(v));

// As 18 colunas de §7.4, na ordem do painel de referência, com largura por coluna.
const COLUNAS: Array<{ chave: string; rotulo: string; largura: number; numerica?: boolean; formatar?: (v: unknown, r: Rotulador) => string }> = [
  { chave: "Nivel_Obesidade", rotulo: "Nível", largura: 130 },
  { chave: "IMC", rotulo: "IMC", largura: 74, numerica: true, formatar: (v) => fmtImc(v as number) },
  { chave: "Altura", rotulo: "Altura (m)", largura: 86, numerica: true, formatar: (v) => fmtNum(v as number, 2) },
  { chave: "Peso", rotulo: "Peso (kg)", largura: 86, numerica: true, formatar: (v) => fmtNum(v as number, 1) },
  { chave: "Idade", rotulo: "Idade", largura: 70, numerica: true, formatar: (v) => fmtNum(v as number, 1) },
  { chave: "Atividade_Fisica_Frequencia", rotulo: "Atividade física", largura: 120, formatar: (v, r) => r("atividade", texto(v)) },
  { chave: "Consumo_Agua_Diario", rotulo: "Água/dia", largura: 90, formatar: (v, r) => r("agua", texto(v)) },
  { chave: "Consumo_Alcool", rotulo: "Álcool", largura: 120 },
  { chave: "Consumo_Calorico_Frequente", rotulo: "Calóricos", largura: 90 },
  { chave: "Consumo_Alimentos_Entre_Refeicoes", rotulo: "Lanches", largura: 120 },
  { chave: "Consumo_Vegetais", rotulo: "Vegetais", largura: 86, numerica: true, formatar: (v) => texto(v) },
  { chave: "Fumante", rotulo: "Fumante", largura: 84 },
  { chave: "Genero", rotulo: "Gênero", largura: 96 },
  { chave: "Historico_Familiar_Sobrepeso", rotulo: "Hist. familiar", largura: 110 },
  { chave: "Meio_Transporte", rotulo: "Transporte", largura: 150 },
  { chave: "Monitoramento_Calorias", rotulo: "Monitora calorias", largura: 130 },
  { chave: "Numero_Refeicoes_Principais", rotulo: "Refeições/dia", largura: 110, numerica: true, formatar: (v) => texto(v) },
  { chave: "Tempo_Dispositivos_Tecnologicos", rotulo: "Tempo em telas", largura: 120, numerica: true, formatar: (v) => texto(v) },
];

/**
 * TanStack Table (modelo de linhas) + TanStack Virtual (só ~30 linhas no DOM): ordenação e
 * paginação acontecem NO SERVIDOR (`ordenar_por`, `direcao`, `pagina`, `tamanho`); ordem inicial
 * por IMC desc (§7.4). Cabeçalho sticky e scroll horizontal próprio para as 18 colunas.
 */
export function TabelaRegistros() {
  const { filtros } = useFiltros();
  const rotulo = useRotulos();
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

  const contêiner = useRef<HTMLDivElement>(null);
  const virtual = useVirtualizer({
    count: rows.length,
    getScrollElement: () => contêiner.current,
    estimateSize: () => ALTURA_LINHA,
    overscan: 6,
  });
  const itens = virtual.getVirtualItems();
  const topo = itens[0]?.start ?? 0;
  const base = itens.length ? virtual.getTotalSize() - (itens[itens.length - 1]?.end ?? 0) : 0;

  const total = q.data?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / TAMANHO_PAGINA));
  const mudarPagina = (p: number) => setEstadoPagina({ chave: chaveRecorte, pagina: Math.min(Math.max(1, p), paginas) });

  return (
    <section className="cartao flex flex-col gap-2 p-3" aria-label="Registros do recorte">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p aria-live="polite">
          {q.data ? `Página ${fmtInt(pagina)} de ${fmtInt(paginas)} · ${fmtInt(total)} registros` : "Carregando…"}
        </p>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => mudarPagina(pagina - 1)} disabled={pagina <= 1} className="min-h-11 rounded-card border border-borda px-3 disabled:opacity-50">
            Anterior
          </button>
          <button
            type="button"
            onClick={() => mudarPagina(pagina + 1)}
            disabled={pagina >= paginas}
            className="min-h-11 rounded-card border border-borda px-3 disabled:opacity-50"
          >
            Próxima
          </button>
        </div>
      </div>
      <QueryState carregando={q.isPending} erro={q.error} atualizando={q.isFetching && !q.isPending} vazio={q.data?.total === 0}>
        <div ref={contêiner} className="overflow-auto rounded-card border border-borda" style={{ height: 560 }}>
          <table className="border-collapse text-sm" style={{ width: tabela.getTotalSize(), tableLayout: "fixed" }}>
            <caption className="sr-only">Registros do recorte, ordenados por {ordenarPor} ({direcao})</caption>
            <thead className="sticky top-0 z-10 bg-superficie">
              {tabela.getHeaderGroups().map((grupo) => (
                <tr key={grupo.id}>
                  {grupo.headers.map((h) => {
                    const ordem = h.column.getIsSorted();
                    const numerica = (h.column.columnDef.meta as { numerica?: boolean } | undefined)?.numerica;
                    return (
                      <th
                        key={h.id}
                        scope="col"
                        style={{ width: h.getSize() }}
                        aria-sort={ordem === "asc" ? "ascending" : ordem === "desc" ? "descending" : "none"}
                        className="border-b border-borda px-1 py-1 text-left text-xs font-semibold uppercase tracking-wide text-texto-fraco"
                      >
                        <button
                          type="button"
                          onClick={h.column.getToggleSortingHandler()}
                          className={`flex min-h-9 w-full items-center gap-1 rounded px-1 hover:bg-superficie-alta ${numerica ? "justify-end" : ""}`}
                        >
                          <span className="truncate">{flexRender(h.column.columnDef.header, h.getContext())}</span>
                          <span aria-hidden="true">{ordem === "asc" ? "▲" : ordem === "desc" ? "▼" : ""}</span>
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
                  <tr key={row.id} className="odd:bg-superficie-alta/40" style={{ height: vi.size }}>
                    {row.getVisibleCells().map((cell) => {
                      const numerica = (cell.column.columnDef.meta as { numerica?: boolean } | undefined)?.numerica;
                      return (
                        <td key={cell.id} style={{ width: cell.column.getSize() }} className={`truncate px-2 ${numerica ? "text-right tabular-nums" : ""}`}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
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
    </section>
  );
}
