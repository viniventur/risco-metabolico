import type { RespostaDeriva } from "@/shared/api/endpoints/tipos";
import { fmtInt, fmtNum } from "@/shared/format/ptBR";

type Props = { dado: RespostaDeriva; featureSelecionada: string; aoSelecionar: (feature: string) => void };

const TOM: Record<string, string> = {
  estavel: "text-sucesso",
  atencao: "text-alerta",
  "deriva significativa": "text-perigo",
  "amostra insuficiente": "text-texto-fraco",
};

/**
 * Uma linha por feature, na ordem do backend (PSI desc). A coluna de PSI SOME quando a amostra
 * está abaixo do mínimo: amostra insuficiente é resultado, não falha (§7.6).
 */
export function TabelaDeriva({ dado, featureSelecionada, aoSelecionar }: Props) {
  const mostrarPsi = dado.n_amostra >= dado.n_minimo;
  const estatisticas = new Map((dado.estatisticas ?? []).map((e) => [e.feature, e]));
  return (
    <div className="cartao overflow-x-auto p-2">
      <table className="w-full border-collapse text-sm">
        <caption className="px-2 py-1 text-left text-xs text-texto-fraco">
          Clique numa feature para comparar treino e log faixa a faixa.
        </caption>
        <thead>
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-texto-fraco">
            <th scope="col" className="border-b border-borda px-2 py-1">
              Feature
            </th>
            {mostrarPsi ? (
              <th scope="col" className="border-b border-borda px-2 py-1 text-right">
                PSI
              </th>
            ) : null}
            <th scope="col" className="border-b border-borda px-2 py-1">
              Classificação
            </th>
            <th scope="col" className="border-b border-borda px-2 py-1 text-right">
              n (log)
            </th>
            <th scope="col" className="border-b border-borda px-2 py-1 text-right">
              Média no log
            </th>
            <th scope="col" className="border-b border-borda px-2 py-1 text-right">
              Média no treino
            </th>
            <th scope="col" className="border-b border-borda px-2 py-1 text-right">
              Desloc. (desvios)
            </th>
          </tr>
        </thead>
        <tbody>
          {(dado.features ?? []).map((f) => {
            const e = estatisticas.get(f.feature);
            const ativa = f.feature === featureSelecionada;
            return (
              <tr key={f.feature} className={`odd:bg-superficie-alta/40 ${ativa ? "outline outline-2 outline-primaria" : ""}`}>
                <td className="px-2 py-1">
                  <button
                    type="button"
                    onClick={() => aoSelecionar(ativa ? "" : f.feature)}
                    aria-pressed={ativa}
                    className="min-h-9 rounded px-1 text-left font-mono text-xs hover:bg-superficie-alta"
                  >
                    {f.feature}
                  </button>
                </td>
                {mostrarPsi ? <td className="px-2 py-1 text-right tabular-nums">{f.psi === null ? "—" : fmtNum(f.psi, 3)}</td> : null}
                <td className={`px-2 py-1 ${TOM[f.classificacao] ?? ""}`}>{f.classificacao}</td>
                <td className="px-2 py-1 text-right tabular-nums">{fmtInt(f.n_amostra)}</td>
                <td className="px-2 py-1 text-right tabular-nums">{f.tipo === "numerica" ? fmtNum(e?.media_log, 2) : "—"}</td>
                <td className="px-2 py-1 text-right tabular-nums">{f.tipo === "numerica" ? fmtNum(e?.media_treino, 2) : "—"}</td>
                <td className="px-2 py-1 text-right tabular-nums">{f.tipo === "numerica" ? fmtNum(e?.deslocamento_desvios, 2) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
