import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { currentMCPActions, defaultParams, describeParams, registerMCPActions, useMCPActions } from "./mcpActions";

const cleanups = [];
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
});
const register = (provider) => {
  const cleanup = registerMCPActions(provider);
  cleanups.push(cleanup);
  return cleanup;
};

describe("registro de ações locais do MCP", () => {
  it("registra, avisa por evento e limpa ao sair", () => {
    const listener = vi.fn();
    window.addEventListener("mm:mcp-actions", listener);
    const provider = { source: "mmfilm" };
    const unregister = register(provider);
    expect(currentMCPActions()).toBe(provider);
    expect(listener.mock.calls.at(-1)[0].detail).toBe(provider);
    unregister();
    expect(currentMCPActions()).toBeNull();
    expect(listener.mock.calls.at(-1)[0].detail).toBeNull();
    window.removeEventListener("mm:mcp-actions", listener);
  });

  it("saída de um provedor antigo não apaga o provedor atual", () => {
    const first = { source: "a" };
    const second = { source: "b" };
    const unregisterFirst = register(first);
    register(second);
    unregisterFirst();
    expect(currentMCPActions()).toBe(second);
  });

  it("o hook começa com o provedor atual e acompanha trocas", () => {
    const first = { source: "a" };
    register(first);
    const { result, unmount } = renderHook(() => useMCPActions());
    expect(result.current).toBe(first);
    const second = { source: "b" };
    let unregister;
    act(() => {
      unregister = register(second);
    });
    expect(result.current).toBe(second);
    act(() => unregister());
    expect(result.current).toBeNull();
    unmount();
  });
});

describe("parâmetros das ferramentas", () => {
  const tool = {
    params: [
      { key: "sensitivity", label: "Sensibilidade", type: "range", default: 5 },
      { key: "minSilence", label: "Silêncio mínimo", type: "range", default: 0.5, unit: "s" },
      { key: "scope", label: "Trecho", type: "select", default: "sequence", options: [["sequence", "Sequência inteira"], ["selection", "Seleção"]] },
      { key: "zoomOut", label: "Alternar", type: "toggle", default: true },
      { key: "tracks", label: "Faixas", type: "multi", default: ["A1", "V1"] },
      { key: "aviso", label: "Aviso", type: "info" },
    ],
  };

  it("valores iniciais", () => {
    expect(defaultParams(tool)).toEqual({ sensitivity: 5, minSilence: 0.5, scope: "sequence", zoomOut: true, tracks: ["A1", "V1"], aviso: undefined });
    expect(defaultParams(undefined)).toEqual({});
    expect(defaultParams({})).toEqual({});
  });

  it("texto curto com os valores padrão e escolhidos", () => {
    expect(describeParams(tool)).toBe("Sensibilidade 5 · Silêncio mínimo 0,5 s · Trecho: Sequência inteira · Alternar · Faixas: 2");
    expect(describeParams(tool, { sensitivity: 8, scope: "outro", zoomOut: false, tracks: ["A1"] })).toBe(
      "Sensibilidade 8 · Silêncio mínimo 0,5 s · Trecho: outro · Faixas: 1",
    );
    expect(describeParams(tool, { scope: "selection" })).toContain("Trecho: Seleção");
    expect(describeParams({ params: [{ key: "sons", label: "Sons", type: "multi" }] })).toBe("Sons: 0");
    expect(describeParams(null)).toBe("");
  });
});
