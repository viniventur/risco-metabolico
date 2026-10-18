import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { desacelerar, useContagem } from "./useContagem";

/** Quadros na mão: o teste decide o carimbo de tempo de cada um. */
function quadrosManuais(): FrameRequestCallback[] {
  const fila: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => fila.push(cb));
  vi.stubGlobal("cancelAnimationFrame", () => {});
  return fila;
}

function pedirMovimentoReduzido(reduzido: boolean): void {
  vi.spyOn(window, "matchMedia").mockImplementation((q: string) => ({ matches: reduzido && q.includes("reduce"), media: q }) as MediaQueryList);
}

describe("useContagem", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("antes de ligar, fica em 0 e não pede quadro nenhum", () => {
    const fila = quadrosManuais();
    const { result } = renderHook(() => useContagem(98.8, false));
    expect(result.current).toBe(0);
    expect(fila).toHaveLength(0);
  });

  it("ligado, conta pelos quadros desacelerando e para no valor exato", () => {
    const fila = quadrosManuais();
    const { result } = renderHook(() => useContagem(200, true, 1000));
    act(() => fila.shift()?.(0));
    expect(result.current).toBe(0);
    act(() => fila.shift()?.(500));
    expect(result.current).toBeCloseTo(200 * desacelerar(0.5));
    act(() => fila.shift()?.(1000));
    expect(result.current).toBe(200);
    expect(fila).toHaveLength(0);
  });

  it("com a aba em segundo plano (um quadro só, bem depois), chega direto no alvo", () => {
    const fila = quadrosManuais();
    const { result } = renderHook(() => useContagem(17, true, 1000));
    act(() => fila.shift()?.(100));
    act(() => fila.shift()?.(60_000));
    expect(result.current).toBe(17);
  });

  it("com prefers-reduced-motion, entrega o alvo de cara, sem animar", () => {
    pedirMovimentoReduzido(true);
    const fila = quadrosManuais();
    const { result } = renderHook(() => useContagem(2111, true));
    expect(result.current).toBe(2111);
    expect(fila).toHaveLength(0);
  });

  it("com o alvo ainda desconhecido (a API não respondeu), não conta", () => {
    const fila = quadrosManuais();
    const { result } = renderHook(() => useContagem(undefined, true));
    expect(result.current).toBe(0);
    expect(fila).toHaveLength(0);
  });
});
