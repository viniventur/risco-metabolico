import { useEffect, useState } from "react";

import { pedeMovimentoReduzido } from "./movimento";

const HEXA = "0123456789abcdef";
const DURACAO_MS = 1100;

/** O texto com as posições a partir de `revelados` sorteadas. */
function embaralhar(texto: string, revelados: number): string {
  return texto
    .split("")
    .map((c, i) => (i < revelados ? c : HEXA[Math.floor(Math.random() * HEXA.length)]))
    .join("");
}

/**
 * Um texto que se "decifra" da esquerda para a direita quando `ativo` liga (o DecryptedText do React
 * Bits): cada posição ainda não revelada sorteia um caractere hexadecimal a cada quadro. Feito para
 * hashes, como a versão dos dados. Antes de ligar, e com `prefers-reduced-motion`, mostra o texto
 * final. O leitor de tela recebe só o texto final; o sorteio é para os olhos.
 */
export function TextoDecifrado({ texto, ativo, className }: { texto: string; ativo: boolean; className?: string }) {
  const [reduzido] = useState(pedeMovimentoReduzido);
  const [visivel, setVisivel] = useState(texto);

  useEffect(() => {
    if (!ativo || reduzido) return;
    let inicio: number | null = null;
    let quadro = requestAnimationFrame(function passo(agora: number) {
      inicio ??= agora;
      const progresso = Math.min((agora - inicio) / DURACAO_MS, 1);
      setVisivel(progresso < 1 ? embaralhar(texto, Math.floor(progresso * texto.length)) : texto);
      if (progresso < 1) quadro = requestAnimationFrame(passo);
    });
    return () => cancelAnimationFrame(quadro);
  }, [ativo, reduzido, texto]);

  return (
    <span className={className}>
      <span className="sr-only">{texto}</span>
      <span aria-hidden="true">{reduzido ? texto : visivel}</span>
    </span>
  );
}
