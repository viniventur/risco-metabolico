import "@testing-library/jest-dom/vitest";

// ResizeObserver e matchMedia não existem no jsdom; o Recharts e o tema precisam deles.
class ResizeObserverFalso {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? (ResizeObserverFalso as unknown as typeof ResizeObserver);

if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// O ResponsiveContainer do Recharts mede o contêiner com getBoundingClientRect, que no jsdom
// devolve 0 x 0 (e o gráfico não desenha). Nos testes todo elemento mede 600 x 400.
const medidaFalsa = { x: 0, y: 0, top: 0, left: 0, right: 600, bottom: 400, width: 600, height: 400, toJSON: () => ({}) };
HTMLElement.prototype.getBoundingClientRect = () => medidaFalsa as DOMRect;
