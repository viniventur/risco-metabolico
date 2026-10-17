import { useRelatorio } from "@/shared/api/endpoints/predicoes";
import type { EntradaTriagem } from "@/shared/api/endpoints/tipos";
import { IconeBaixar, IconeImprimir } from "@/shared/ui/icones";

/** Substitui o components.html + document.write do legado: Blob + <a download> e window.print() com @media print. */
export function BotoesRelatorio({ entrada, nome }: { entrada: EntradaTriagem; nome: string }) {
  const relatorio = useRelatorio();

  async function baixar() {
    const html = await relatorio.mutateAsync({ entrada, nome });
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "relatorio-triagem.html";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="nao-imprimir flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void baixar()}
        disabled={relatorio.isPending}
        className="flex min-h-11 items-center gap-2 rounded-card border border-borda bg-superficie px-3 text-sm text-texto hover:bg-superficie-alta disabled:opacity-60"
      >
        <IconeBaixar /> {relatorio.isPending ? "Gerando…" : "Baixar relatório (HTML)"}
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="flex min-h-11 items-center gap-2 rounded-card border border-borda bg-superficie px-3 text-sm text-texto hover:bg-superficie-alta"
      >
        <IconeImprimir /> Imprimir
      </button>
      {relatorio.isError ? (
        <span className="text-xs text-perigo" role="alert">
          {relatorio.error.mensagem}
        </span>
      ) : null}
    </div>
  );
}
