type Item = { rotulo: string; cor: string; valor?: string; ativo?: boolean; aoClicar?: () => void; forma?: "quadrado" | "circulo" | "losango" | "triangulo" };

/** Legenda em HTML fora do SVG: focável, legível por leitor de tela e não entra no viewBox (7.3). */
export function LegendaHtml({ itens, titulo }: { itens: Item[]; titulo?: string }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-texto" aria-label={titulo ?? "Legenda"}>
      {itens.map((item) => {
        const conteudo = (
          <>
            <span
              aria-hidden="true"
              className="inline-block h-3 w-3"
              style={{
                background: item.cor,
                opacity: item.ativo === false ? 0.35 : 1,
                borderRadius: item.forma === "circulo" ? "50%" : 2,
                transform: item.forma === "losango" ? "rotate(45deg) scale(0.85)" : undefined,
                clipPath: item.forma === "triangulo" ? "polygon(50% 0, 100% 100%, 0 100%)" : undefined,
              }}
            />
            <span>{item.rotulo}</span>
            {item.valor ? <span className="text-texto-fraco">{item.valor}</span> : null}
          </>
        );
        return (
          <li key={item.rotulo} className="flex items-center gap-1.5">
            {item.aoClicar ? (
              <button type="button" onClick={item.aoClicar} aria-pressed={item.ativo} className="flex items-center gap-1.5 rounded px-1 hover:bg-superficie-alta">
                {conteudo}
              </button>
            ) : (
              conteudo
            )}
          </li>
        );
      })}
    </ul>
  );
}
