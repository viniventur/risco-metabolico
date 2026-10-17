type Props = {
  rotulo: string;
  valor: string;
  unidade?: string;
  /** texto secundário (ex.: "n = 351") */
  detalhe?: string;
  variante?: "numero" | "texto";
  carregando?: boolean;
};

/** Cartão de KPI sem Recharts (7.3). */
export function KpiCard({ rotulo, valor, unidade, detalhe, variante = "numero", carregando }: Props) {
  return (
    <div className="cartao flex min-h-24 flex-col justify-between p-4" aria-busy={carregando || undefined}>
      <span className="text-xs font-semibold uppercase tracking-wide text-texto-fraco">{rotulo}</span>
      <span
        className={`${variante === "texto" ? "text-xl" : "text-3xl"} font-bold tabular-nums text-texto`}
        title={detalhe}
      >
        {carregando ? "…" : valor}
        {unidade && !carregando ? <span className="ml-1 text-base font-normal text-texto-fraco">{unidade}</span> : null}
      </span>
      {detalhe ? <span className="text-xs text-texto-fraco">{detalhe}</span> : null}
    </div>
  );
}
