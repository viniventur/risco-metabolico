import type { Element, Root, RootContent } from "hast";

/** O texto de um nó, sem marcação (o título de uma coluna pode vir em negrito). */
function textoDe(no: Root | RootContent): string {
  if (no.type === "text") return no.value;
  if ("children" in no) return no.children.map(textoDe).join("");
  return "";
}

function filhos(no: Element, tag: string): Element[] {
  return no.children.filter((f): f is Element => f.type === "element" && f.tagName === tag);
}

function percorrer(no: Root | Element, aoAchar: (el: Element) => void): void {
  for (const filho of no.children) {
    if (filho.type !== "element") continue;
    aoAchar(filho);
    percorrer(filho, aoAchar);
  }
}

/**
 * Plugin rehype da Política de Privacidade: cada <td> recebe o título da sua coluna em `data-rotulo`,
 * e o CSS (legal.css) transforma a tabela em cartões no celular, com o rótulo em cima de cada valor
 * — quatro colunas de texto corrido não cabem em 360 px. A tabela de "campo e valor" (cabeçalho
 * vazio, o responsável) ganha a classe `tabela-campos`: sem cabeçalho, a primeira coluna é o rótulo.
 */
export function rehypeRotulosDasTabelas() {
  return (arvore: Root) => {
    percorrer(arvore, (tabela) => {
      if (tabela.tagName !== "table") return;
      const [thead] = filhos(tabela, "thead");
      const [linhaDoCabecalho] = thead ? filhos(thead, "tr") : [];
      const titulos = linhaDoCabecalho ? filhos(linhaDoCabecalho, "th").map((th) => textoDe(th).trim()) : [];
      if (titulos.every((t) => t === "")) {
        tabela.properties = { ...tabela.properties, className: ["tabela-campos"] };
        return;
      }
      for (const tbody of filhos(tabela, "tbody")) {
        for (const tr of filhos(tbody, "tr")) {
          filhos(tr, "td").forEach((td, i) => {
            const titulo = titulos[i];
            if (titulo) td.properties = { ...td.properties, dataRotulo: titulo };
          });
        }
      }
    });
  };
}
