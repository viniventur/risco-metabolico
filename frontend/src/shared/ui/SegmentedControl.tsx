type Opcao = { valor: string; rotulo: string; n?: number };

type Props = {
  rotulo: string;
  opcoes: Opcao[];
  selecionados: string[];
  aoAlternar: (valor: string) => void;
};

/** Para dimensões de 2 valores (gênero, histórico): dropdown é excessivo (7.4). Multi-seleção por alternância. */
export function SegmentedControl({ rotulo, opcoes, selecionados, aoAlternar }: Props) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-xs font-semibold uppercase tracking-wide text-texto-fraco">{rotulo}</legend>
      <div className="flex overflow-hidden rounded-card border border-borda" role="group" aria-label={rotulo}>
        {opcoes.map((o) => {
          const ativo = selecionados.includes(o.valor);
          return (
            <button
              key={o.valor}
              type="button"
              aria-pressed={ativo}
              onClick={() => aoAlternar(o.valor)}
              className={`flex min-h-11 flex-1 items-center justify-center gap-1 px-3 text-sm ${ativo ? "bg-primaria text-primaria-contraste" : "bg-superficie text-texto hover:bg-superficie-alta"}`}
            >
              {o.rotulo}
              {o.n !== undefined ? <span className={ativo ? "opacity-80" : "text-texto-fraco"}>({o.n})</span> : null}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
