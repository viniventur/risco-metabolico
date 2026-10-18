import { cn } from "@/shared/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

type Coluna = { chave: string; rotulo: string; alinhar?: "left" | "right" };

type Props = {
  legenda: string;
  colunas: Coluna[];
  linhas: Record<string, string | number | null | undefined>[];
};

/** A tabela acessível equivalente a um gráfico: os mesmos números, legíveis por leitor de tela. */
export function TabelaEquivalente({ legenda, colunas, linhas }: Props) {
  return (
    <Table className="text-[13px]">
      <caption className="sr-only">{legenda}</caption>
      <TableHeader className="sticky top-0 z-10 bg-muted">
        <TableRow className="hover:bg-transparent">
          {colunas.map((c) => (
            <TableHead key={c.chave} className={cn("h-9", c.alinhar === "right" && "text-right")}>
              {c.rotulo}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {linhas.map((linha, i) => (
          <TableRow key={i}>
            {colunas.map((c) => (
              <TableCell key={c.chave} className={cn("py-2", c.alinhar === "right" && "text-right tabular-nums")}>
                {linha[c.chave] ?? "—"}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
