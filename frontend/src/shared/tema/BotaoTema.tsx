import { useCallback, useState } from "react";

import { IconeLua, IconeSol } from "@/shared/ui/icones";

type Tema = "light" | "dark";

function temaAtual(): Tema {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

/** Substitui o st._config.set_option do legado: data-theme no <html> + localStorage em try/catch. */
export function BotaoTema() {
  // O estado inicial lê o data-theme que o script inline do index.html já definiu antes da hidratação.
  const [tema, setTema] = useState<Tema>(() => temaAtual());

  const alternar = useCallback(() => {
    const proximo: Tema = temaAtual() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", proximo);
    try {
      localStorage.setItem("tema", proximo);
    } catch {
      /* modo privado ou armazenamento bloqueado: o tema vale só para esta visita */
    }
    setTema(proximo);
  }, []);

  const rotulo = tema === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro";
  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={rotulo}
      title={rotulo}
      className="flex h-11 w-11 items-center justify-center rounded-card border border-borda bg-superficie text-texto hover:bg-superficie-alta"
    >
      {tema === "dark" ? <IconeSol /> : <IconeLua />}
    </button>
  );
}
