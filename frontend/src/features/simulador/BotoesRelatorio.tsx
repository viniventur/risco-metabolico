import { Download, LoaderCircle, Printer } from "lucide-react";

import { useRelatorio } from "@/shared/api/endpoints/predicoes";
import type { EntradaTriagem } from "@/shared/api/endpoints/tipos";
import type { ErroApi } from "@/shared/api/http";
import { avisar } from "@/shared/ui/avisos";
import { Button } from "@/shared/ui/button";

import { textoDoErro } from "./textoDoErro";

const ARQUIVO = "relatorio-triagem.html";

/** Substitui o components.html + document.write do legado: Blob + <a download> e window.print() com @media print. */
export function BotoesRelatorio({ entrada, nome }: { entrada: EntradaTriagem; nome: string }) {
  const relatorio = useRelatorio();

  async function baixar() {
    try {
      const html = await relatorio.mutateAsync({ entrada, nome });
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = ARQUIVO;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      avisar.sucesso("Relatório baixado", ARQUIVO);
    } catch (e) {
      // useRelatorio só rejeita com o envelope de erro da API (paraErroApi).
      avisar.erro("Não foi possível gerar o relatório", textoDoErro(e as ErroApi));
    }
  }

  return (
    <div className="nao-imprimir flex flex-wrap items-center gap-2">
      <Button variant="outline" onClick={() => void baixar()} disabled={relatorio.isPending}>
        {relatorio.isPending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Download aria-hidden="true" />}
        {relatorio.isPending ? "Gerando…" : "Baixar relatório (HTML)"}
      </Button>
      <Button variant="ghost" onClick={() => window.print()}>
        <Printer aria-hidden="true" />
        Imprimir
      </Button>
    </div>
  );
}
