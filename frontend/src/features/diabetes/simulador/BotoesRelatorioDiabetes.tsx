import { Download, LoaderCircle, Printer } from "lucide-react";

import { textoDoErro } from "@/features/simulador/textoDoErro";
import type { ErroApi } from "@/shared/api/http";
import { avisar } from "@/shared/ui/avisos";
import { Button } from "@/shared/ui/button";

import { useRelatorioDiabetes } from "../api/predicoes";
import type { EntradaDiabetes } from "../api/tipos";

const ARQUIVO = "relatorio-triagem-diabetes.html";

/** O relatório HTML da vertente (POST /diabetes/predicoes/relatorio) para baixar, e a impressão da tela. */
export function BotoesRelatorioDiabetes({ entrada, nome }: { entrada: EntradaDiabetes; nome: string }) {
  const relatorio = useRelatorioDiabetes();

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
      // useRelatorioDiabetes só rejeita com o envelope de erro da API (paraErroApi).
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
