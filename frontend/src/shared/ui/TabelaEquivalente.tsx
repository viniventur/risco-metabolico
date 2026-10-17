type Coluna = { chave: string; rotulo: string; alinhar?: "left" | "right" };

type Props = {
  legenda: string;
  colunas: Coluna[];
  linhas: Record<string, string | number | null | undefined>[];
};

/** A tabela acessível equivalente a um gráfico: os mesmos números, legíveis por leitor de tela. */
export function TabelaEquivalente({ legenda, colunas, linhas }: Props) {
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">{legenda}</caption>
      <thead>
        <tr>
          {colunas.map((c) => (
            <th
              key={c.chave}
              scope="col"
              className={`border-b border-borda px-2 py-1 text-xs font-semibold uppercase tracking-wide text-texto-fraco ${c.alinhar === "right" ? "text-right" : "text-left"}`}
            >
              {c.rotulo}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {linhas.map((linha, i) => (
          <tr key={i} className="odd:bg-superficie-alta/40">
            {colunas.map((c) => (
              <td key={c.chave} className={`px-2 py-1 ${c.alinhar === "right" ? "text-right tabular-nums" : "text-left"}`}>
                {linha[c.chave] ?? "—"}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
