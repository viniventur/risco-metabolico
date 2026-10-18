import { cn } from "@/shared/lib/utils";

export type FormaDaLegenda = "quadrado" | "circulo" | "losango" | "triangulo";

type Item = { rotulo: string; cor: string; valor?: string; ativo?: boolean; aoClicar?: () => void; forma?: FormaDaLegenda };

function Amostra({ cor, forma, apagada }: { cor: string; forma?: FormaDaLegenda; apagada: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-2.5 shrink-0"
      style={{
        background: cor,
        opacity: apagada ? 0.35 : 1,
        borderRadius: forma === "circulo" ? "50%" : 2,
        transform: forma === "losango" ? "rotate(45deg) scale(0.85)" : undefined,
        clipPath: forma === "triangulo" ? "polygon(50% 0, 100% 100%, 0 100%)" : undefined,
      }}
    />
  );
}

/**
 * Legenda em HTML fora do SVG (§7.3): focável, legível por leitor de tela e fora do viewBox. Quando
 * o item filtra, vira um botão com `aria-pressed` e alvo de 44 px (.alvo-toque).
 */
export function LegendaHtml({ itens, titulo }: { itens: Item[]; titulo?: string }) {
  return (
    <ul className="flex flex-wrap gap-x-1 gap-y-1 text-xs" aria-label={titulo ?? "Legenda"}>
      {itens.map((item) => {
        const apagada = item.ativo === false;
        const conteudo = (
          <>
            <Amostra cor={item.cor} forma={item.forma} apagada={apagada} />
            <span className={cn(apagada ? "text-muted-foreground" : "text-foreground")}>{item.rotulo}</span>
            {item.valor ? <span className="text-muted-foreground tabular-nums">{item.valor}</span> : null}
          </>
        );
        return (
          <li key={item.rotulo}>
            {item.aoClicar ? (
              <button
                type="button"
                onClick={item.aoClicar}
                aria-pressed={item.ativo}
                className="alvo-toque inline-flex h-7 items-center gap-1.5 rounded-full px-2 transition-colors hover:bg-muted"
              >
                {conteudo}
              </button>
            ) : (
              <span className="inline-flex h-7 items-center gap-1.5 px-2">{conteudo}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
