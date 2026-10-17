import { act, renderHook, waitFor } from "@testing-library/react";
import { withNuqsTestingAdapter, type OnUrlUpdateFunction } from "nuqs/adapters/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCrossFilter, useDestaque } from "./useCrossFilter";

describe("useCrossFilter", () => {
  beforeEach(() => {
    useDestaque.getState().limparDestaque();
  });

  it("destaca os valores selecionados na URL e apaga os demais", () => {
    const { result } = renderHook(() => useCrossFilter("por-nivel", "nivel"), {
      wrapper: withNuqsTestingAdapter({ searchParams: "?nivel=Obesidade%20I" }),
    });
    expect(result.current.selecionados).toEqual(["Obesidade I"]);
    expect(result.current.opacidade("Obesidade I")).toBe(1);
    expect(result.current.opacidade("Peso Normal")).toBe(0.35);
  });

  it("sem filtro tudo fica em opacidade 1; o hover no próprio gráfico destaca só aquele valor", () => {
    const { result } = renderHook(() => useCrossFilter("por-nivel", "nivel"), {
      wrapper: withNuqsTestingAdapter({}),
    });
    expect(result.current.opacidade("Peso Normal")).toBe(1);
    act(() => result.current.aoEntrar("Peso Normal"));
    expect(result.current.opacidade("Peso Normal")).toBe(1);
    expect(result.current.opacidade("Obesidade I")).toBe(0.35);
    act(() => result.current.aoSair());
    expect(result.current.opacidade("Obesidade I")).toBe(1);
  });

  it("o hover de um gráfico não apaga os outros (só o de origem destaca)", () => {
    const { result } = renderHook(() => useCrossFilter("genero", "genero"), {
      wrapper: withNuqsTestingAdapter({}),
    });
    act(() => useDestaque.getState().destacar("por-nivel", "Peso Normal"));
    expect(result.current.opacidade("Feminino")).toBe(1);
  });

  it("o clique alterna o valor no filtro da URL (e o gráfico de origem não se filtra)", async () => {
    const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
    const { result } = renderHook(() => useCrossFilter("por-nivel", "nivel"), {
      wrapper: withNuqsTestingAdapter({ searchParams: "?nivel=Obesidade%20I", onUrlUpdate, rateLimitFactor: 0 }),
    });
    act(() => result.current.aoClicar("Peso Normal"));
    await waitFor(() => expect(result.current.selecionados).toEqual(["Obesidade I", "Peso Normal"]));
    expect(onUrlUpdate).toHaveBeenCalled();
    expect(onUrlUpdate.mock.calls.at(-1)?.[0].options.history).toBe("push");
    act(() => result.current.aoClicar("Obesidade I"));
    await waitFor(() => expect(result.current.selecionados).toEqual(["Peso Normal"]));
    expect(result.current.opacidade("Peso Normal")).toBe(1);
    expect(result.current.opacidade("Obesidade I")).toBe(0.35);
  });
});
