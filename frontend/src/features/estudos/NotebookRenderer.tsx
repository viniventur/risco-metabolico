import { CellCode } from "./CellCode";
import { CellMarkdown } from "./CellMarkdown";
import type { Celula } from "./tipos";

/** Percorre as células e delega para CellMarkdown ou CellCode. */
export function NotebookRenderer({ cells }: { cells: Celula[] }) {
  return (
    <div className="flex flex-col gap-4">
      {cells.map((c, i) => (c.type === "markdown" ? <CellMarkdown key={i} celula={c} /> : <CellCode key={i} celula={c} />))}
    </div>
  );
}
