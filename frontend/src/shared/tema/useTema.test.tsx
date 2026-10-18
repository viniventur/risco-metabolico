import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useTema } from "./useTema";

describe("useTema", () => {
  beforeEach(() => {
    document.documentElement.setAttribute("data-theme", "light");
    localStorage.clear();
  });
  afterEach(() => {
    Reflect.deleteProperty(document, "startViewTransition");
    vi.restoreAllMocks();
  });

  it("sem a View Transitions API, troca seco: data-theme, escolha salva e todas as instâncias juntas", () => {
    const a = renderHook(() => useTema());
    const b = renderHook(() => useTema());
    act(() => a.result.current.alternar({ x: 10, y: 10 }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem("tema")).toBe("dark");
    expect(a.result.current.tema).toBe("dark");
    expect(b.result.current.tema).toBe("dark");
  });

  it("com a API, troca dentro da transição e revela o tema novo num círculo a partir do clique", async () => {
    const animar = vi.fn();
    document.documentElement.animate = animar as unknown as typeof document.documentElement.animate;
    // O jsdom não tem a API: uma imitação que chama o callback na hora e resolve `ready`.
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: (callback: () => void) => {
        callback();
        return { ready: Promise.resolve(), finished: Promise.resolve() };
      },
    });
    const { result } = renderHook(() => useTema());
    await act(async () => {
      result.current.alternar({ x: 100, y: 40 });
      await Promise.resolve();
    });
    expect(result.current.tema).toBe("dark");
    expect(animar).toHaveBeenCalledTimes(1);
    const [quadros, opcoes] = animar.mock.calls[0] as [{ clipPath: string[] }, { pseudoElement: string }];
    expect(quadros.clipPath[0]).toBe("circle(0px at 100px 40px)");
    expect(opcoes.pseudoElement).toBe("::view-transition-new(root)");
  });
});
