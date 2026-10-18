import { useCallback, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";

export type Tema = "light" | "dark";

/** Ponto da tela de onde a revelação radial parte (o clique). */
export type OrigemDaTroca = { x: number; y: number } | undefined;

/** A View Transitions API, onde existir (o tipo é declarado aqui para não depender da versão do lib.dom). */
type DocumentoComTransicao = Document & {
  startViewTransition?: (callback: () => void) => { ready: Promise<void>; finished: Promise<void> };
};

const DURACAO_MS = 550;
const SUAVIZACAO = "cubic-bezier(0.4, 0, 0.2, 1)";

/**
 * O tema vigente lido do DOM, que é a fonte única: `public/tema-inicial.js` escreve `data-theme`
 * antes da hidratação, e `escolher` escreve no mesmo lugar. Sem o atributo (script bloqueado ou
 * JavaScript desligado), vale o sistema — a mesma regra da `@media` de `tokens.css`. Ler daqui, e
 * não de um estado próprio, é o que impede o botão de anunciar "claro" com a tela escura.
 */
function lerTema(): Tema {
  const atributo = document.documentElement.getAttribute("data-theme");
  if (atributo === "light" || atributo === "dark") return atributo;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// Um tema só para a página inteira: cada useTema() assina esta lista, e a troca avisa todos de uma
// vez — o seletor, o Toaster e os gráficos (que recebem a cor como valor) mudam juntos.
const ouvintes = new Set<() => void>();

function avisar(): void {
  ouvintes.forEach((ouvinte) => ouvinte());
}

function assinar(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  const consulta = window.matchMedia?.("(prefers-color-scheme: dark)");
  consulta?.addEventListener("change", ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
    consulta?.removeEventListener("change", ouvinte);
  };
}

/** A escolha da pessoa: vai para o `<html>` e fica salva (localStorage em try/catch). */
function escolher(tema: Tema): void {
  document.documentElement.setAttribute("data-theme", tema);
  try {
    localStorage.setItem("tema", tema);
  } catch {
    /* modo privado ou armazenamento bloqueado: o tema vale só para esta visita */
  }
  avisar();
}

function pedeMovimentoReduzido(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/**
 * Troca o tema revelando o novo numa onda circular a partir do clique (a mesma revelação do front de
 * referência do autor). A View Transitions API fotografa a tela, o tema troca DENTRO do callback e um
 * `clipPath` animado descobre o resultado. O `flushSync` é obrigatório: sem ele o React renderiza
 * depois, a foto "nova" sai com as cores antigas dos gráficos e a revelação mostra a tela velha
 * sobre ela mesma. Sem suporte à API, ou com movimento reduzido pedido pelo sistema, a troca é seca:
 * a funcionalidade nunca depende da animação.
 */
function trocarComRevelacao(novo: Tema, origem?: OrigemDaTroca): void {
  const doc = document as DocumentoComTransicao;
  if (typeof doc.startViewTransition !== "function" || pedeMovimentoReduzido()) {
    escolher(novo);
    return;
  }
  const transicao = doc.startViewTransition(() => {
    flushSync(() => escolher(novo));
  });
  transicao.ready
    .then(() => {
      const cx = origem?.x ?? window.innerWidth / 2;
      const cy = origem?.y ?? window.innerHeight / 2;
      // Raio até o canto mais distante: o círculo cobre a tela toda, sem sobra do tema antigo.
      const raio = Math.hypot(Math.max(cx, window.innerWidth - cx), Math.max(cy, window.innerHeight - cy));
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${cx}px ${cy}px)`, `circle(${raio}px at ${cx}px ${cy}px)`] },
        { duration: DURACAO_MS, easing: SUAVIZACAO, pseudoElement: "::view-transition-new(root)" },
      );
    })
    .catch(() => {
      // `ready` rejeita quando o navegador pula a transição (aba em segundo plano, outra em curso):
      // o tema já trocou, nada a fazer.
    });
}

export function useTema(): { tema: Tema; alternar: (origem?: OrigemDaTroca) => void } {
  const tema = useSyncExternalStore(assinar, lerTema, () => "light" as Tema);
  // Lê o tema na hora do clique, não do render: dois cliques rápidos não repetem a mesma troca.
  const alternar = useCallback((origem?: OrigemDaTroca) => trocarComRevelacao(lerTema() === "dark" ? "light" : "dark", origem), []);
  return { tema, alternar };
}
