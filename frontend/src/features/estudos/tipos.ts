// Contrato do JSON gerado por tools/nb2json.py (plano, §8.3). Os quatro `kind` são fechados.
export type SaidaPlotly = { kind: "plotly"; data: unknown[]; layout: Record<string, unknown> };
export type SaidaPng = { kind: "png"; src: string; alt: string };
export type SaidaHtml = { kind: "html"; html: string };
export type SaidaTexto = { kind: "texto"; texto: string };
export type Saida = SaidaPlotly | SaidaPng | SaidaHtml | SaidaTexto;

export type Ancora = { id: string; numero: string };

export type CelulaMarkdown = { type: "markdown"; source: string; anchors: Record<string, Ancora> };
export type CelulaCodigo = {
  type: "code";
  source: string;
  codeHtml: string;
  execution_count: number | null;
  outputs: Saida[];
};
export type Celula = CelulaMarkdown | CelulaCodigo;

export type ItemToc = { id: string; texto: string; nivel: number; numero: string };

export type DocEstudo = {
  slug: string;
  titulo: string;
  gerado_em: string;
  download: string;
  arquivo_origem: string;
  toc: ItemToc[];
  cells: Celula[];
};

export type EntradaManifesto = {
  slug: string;
  titulo: string;
  n_celulas: number;
  n_figuras: number;
  atualizado_em: string;
  arquivo_origem: string;
};
