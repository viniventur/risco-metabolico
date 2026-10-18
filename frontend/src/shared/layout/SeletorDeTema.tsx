import { Moon, Sun } from "lucide-react";
import type { MouseEvent } from "react";

import { cn } from "@/shared/lib/utils";
import { useTema } from "@/shared/tema/useTema";
import { Button } from "@/shared/ui/button";

/**
 * Troca de tema, com a revelação radial a partir do clique (useTema). O rótulo diz o que o clique
 * FAZ, e vem do tema VIGENTE no DOM: é o que o botão antigo errava quando o script de tema era
 * bloqueado (redesenho, 1.9). Os dois ícones ficam montados e trocam por opacidade e rotação, sem
 * a largura do botão piscar. A classe `seletor-de-tema` dá ao botão um `view-transition-name`
 * próprio (tokens.css): sem ela ele entraria nas duas fotos da revelação e viraria um fantasma.
 */
export function SeletorDeTema({ className }: { className?: string }) {
  const { tema, alternar } = useTema();
  const escuro = tema === "dark";
  const rotulo = escuro ? "Mudar para tema claro" : "Mudar para tema escuro";

  function aoClicar(evento: MouseEvent<HTMLButtonElement>) {
    // Pelo teclado (Enter/Espaço) o clique não tem coordenada: a onda parte do centro do botão.
    if (evento.detail === 0) {
      const r = evento.currentTarget.getBoundingClientRect();
      alternar({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      return;
    }
    alternar({ x: evento.clientX, y: evento.clientY });
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={aoClicar}
      aria-label={rotulo}
      title={rotulo}
      className={cn("seletor-de-tema text-muted-foreground hover:text-foreground", className)}
    >
      <span className="relative inline-flex size-[18px] items-center justify-center">
        <Sun aria-hidden="true" className={cn("absolute size-[18px] transition-all duration-200", escuro ? "scale-50 rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100")} />
        <Moon aria-hidden="true" className={cn("absolute size-[18px] transition-all duration-200", escuro ? "scale-100 rotate-0 opacity-100" : "scale-50 -rotate-90 opacity-0")} />
      </span>
    </Button>
  );
}
