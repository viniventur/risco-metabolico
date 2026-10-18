import { useCallback, useState } from "react";

/**
 * O menu lateral recolhido é uma escolha de cada pessoa, lembrada neste navegador. É conveniência,
 * não dado: toda leitura e escrita do localStorage passa por try/catch, e qualquer falha cai no
 * padrão EXPANDIDO — quem nunca escolheu não pode abrir o sistema num trilho de ícones sem rótulo.
 */
const CHAVE = "menu-lateral";

function lerRecolhido(): boolean {
  try {
    return localStorage.getItem(CHAVE) === "recolhido";
  } catch {
    return false;
  }
}

function salvarRecolhido(recolhido: boolean): void {
  try {
    localStorage.setItem(CHAVE, recolhido ? "recolhido" : "expandido");
  } catch {
    /* sem armazenamento: vale até recarregar */
  }
}

export function useMenuLateral(): { recolhido: boolean; alternar: () => void } {
  const [recolhido, setRecolhido] = useState(lerRecolhido);
  const alternar = useCallback(() => {
    setRecolhido((atual) => {
      salvarRecolhido(!atual);
      return !atual;
    });
  }, []);
  return { recolhido, alternar };
}
