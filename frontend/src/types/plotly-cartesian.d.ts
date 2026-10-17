// O bundle cartesian do Plotly (~1,4 MB) não traz tipos; só o que PlotlyFigure usa.
declare module "plotly.js-cartesian-dist-min" {
  export type PlotlyModulo = {
    react(
      el: HTMLElement,
      data: unknown[],
      layout?: Record<string, unknown>,
      config?: Record<string, unknown>,
    ): Promise<unknown>;
    purge(el: HTMLElement): void;
    Plots: { resize(el: HTMLElement): void };
  };
  const Plotly: PlotlyModulo;
  export default Plotly;
}
