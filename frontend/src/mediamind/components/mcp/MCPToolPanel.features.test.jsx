import { act, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearLastAction, recordLastAction, useLastAction } from "../../lib/mcpActions";
import MCPToolPanel from "./MCPToolPanel";

const TabIcon = () => <svg data-testid="icone-guia" />;

const ITEMS = [
  { id: "s1", label: "Silêncio 1", timecode: "00:01", time: 1 },
  { id: "s2", label: "Silêncio 2", timecode: "00:05", time: 5 },
  { id: "s3", label: "Silêncio 3", timecode: "00:09", time: 9, selected: false },
];

function makeProvider(overrides = {}) {
  return {
    source: "recursos",
    label: "Editor",
    catalogue: () => ({
      tabs: [
        { id: "corte", label: "Cortes", icon: TabIcon, description: "Ferramentas que cortam a sequência." },
        { id: "breve", label: "Breve" },
      ],
      tools: [
        {
          id: "silencio",
          tab: "corte",
          label: "Remover silêncios",
          description: "Apaga pausas",
          live: true,
          confirm: "Isso vai cortar a sequência. Continuar?",
          params: [
            { key: "nivel", label: "Sensibilidade", type: "stepper", default: 5, min: 1, max: 10, section: "Detecção" },
            { key: "modo", label: "Modo", type: "chips", default: "auto", options: [["auto", "Automático"], ["manual", "Manual"]], section: "Detecção" },
            { key: "limite", label: "Limite manual", type: "range", default: -40, min: -60, max: 0, section: "Detecção", when: { key: "modo", equals: "manual" } },
            { key: "aviso", label: "Funciona melhor com fala", type: "info" },
            { key: "margem", label: "Margem", type: "range", default: 0.2, min: 0, max: 1, step: 0.1, unit: "s", section: "Acabamento" },
          ],
        },
        {
          id: "estatico",
          tab: "corte",
          label: "Normalizar",
          description: "Sem prévia ao vivo",
          applyLabel: "Normalizar agora",
          params: [{ key: "alvo", label: "Alvo", type: "range", default: -14, min: -30, max: 0 }],
        },
        { id: "marcas", tab: "corte", label: "Marcar cenas", description: "Lista vazia", applyLabel: "Marcar", params: [] },
        { id: "futuro", tab: "breve", label: "Legendas IA", description: "Gera legendas", status: "soon", soonReason: "aguardando a API de transcrição.", params: [{ key: "x", label: "X", type: "range", default: 1 }] },
        { id: "futuro2", tab: "breve", label: "Dublagem", description: "Dubla", status: "soon" },
      ],
    }),
    analyze: vi.fn(async (toolId, params) => {
      if (toolId === "silencio")
        return {
          ok: true,
          summary: `Prévia nível ${params.nivel}`,
          items: ITEMS,
          headline: { count: 3, text: "silêncios", aside: params.nivel === 5 ? "1,2 s no total" : undefined },
          waveform: { peaks: [0.2, 0.8], duration: 10, regions: [{ start: 1, end: 2, kind: "silencio" }], threshold: 0.3 },
        };
      if (toolId === "marcas") return { ok: true, summary: "Nenhuma cena", items: [] };
      return { ok: true, summary: "Prévia simples" };
    }),
    apply: vi.fn(async () => ({ ok: true, summary: "Aplicado", count: 2 })),
    undo: vi.fn(() => true),
    canUndo: vi.fn(() => true),
    ...overrides,
  };
}

const card = (name) => screen.getByRole("button", { name, expanded: false });
const detail = () => screen.getByLabelText(/^Detalhes: /);

beforeEach(() => localStorage.clear());
afterEach(() => {
  act(() => clearLastAction("recursos"));
  vi.restoreAllMocks();
});

describe("MCPToolPanel: seções, guias e ferramentas em breve", () => {
  it("agrupa parâmetros por seção, mantém os sem seção e esconde pelo `when`", () => {
    render(<MCPToolPanel provider={makeProvider()} />);
    fireEvent.click(card("Remover silêncios"));
    const box = detail();
    const groups = box.querySelectorAll("fieldset");
    expect([...groups].map((node) => node.querySelector("legend")?.textContent)).toEqual(["Detecção", "Acabamento"]);
    expect(within(box).getByText("Funciona melhor com fala").closest("fieldset")).toBeNull();
    expect(within(box).queryByLabelText(/Limite manual/)).toBeNull();
    fireEvent.click(within(box).getByRole("radio", { name: "Manual" }));
    expect(within(box).getByLabelText(/Limite manual/)).toBeInTheDocument();
    fireEvent.click(within(box).getByRole("radio", { name: "Automático" }));
    expect(within(box).queryByLabelText(/Limite manual/)).toBeNull();
  });

  it("mostra ícone e descrição da guia", () => {
    render(<MCPToolPanel provider={makeProvider()} />);
    expect(screen.getByTestId("icone-guia")).toBeInTheDocument();
    expect(screen.queryByText("Ferramentas que cortam a sequência.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Cortes/ }));
    expect(screen.getByText("Ferramentas que cortam a sequência.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Breve/ }));
    expect(screen.queryByText("Ferramentas que cortam a sequência.")).toBeNull();
    expect(screen.getAllByText("em breve")).toHaveLength(2);
  });

  it("ferramenta em breve explica o motivo e não tem botões de ação", () => {
    render(<MCPToolPanel provider={makeProvider()} onEnqueue={vi.fn()} />);
    fireEvent.click(card(/Legendas IA/));
    expect(within(detail()).getByRole("note")).toHaveTextContent("Em breve: aguardando a API de transcrição.");
    expect(within(detail()).queryByRole("button", { name: /Analisar|Aplicar|Desfazer|fila/ })).toBeNull();
    expect(within(detail()).queryByLabelText(/X/)).toBeNull();
    fireEvent.click(card(/Dublagem/));
    expect(within(detail()).getByRole("note")).toHaveTextContent("Em breve: esta ferramenta ainda está sendo preparada.");
  });
});

describe("MCPToolPanel: prévia, seleção e aplicação", () => {
  it("mostra destaque, forma de onda e lista; aplica só os itens marcados após confirmar", async () => {
    const provider = makeProvider({ seek: vi.fn() });
    const onExecuted = vi.fn();
    render(<MCPToolPanel provider={provider} onExecuted={onExecuted} />);
    fireEvent.click(card("Remover silêncios"));
    fireEvent.click(within(detail()).getByRole("button", { name: /Analisar/ }));
    expect(await within(detail()).findByText("Prévia nível 5")).toBeInTheDocument();
    expect(within(detail()).getByText("silêncios")).toBeInTheDocument();
    expect(within(detail()).getByText("1,2 s no total")).toBeInTheDocument();
    expect(within(detail()).getByRole("img", { name: /Forma de onda com 1 região/ })).toBeInTheDocument();
    expect(within(detail()).getByText(/2 de 3 marcado/)).toBeInTheDocument();
    fireEvent.click(within(detail()).getByRole("button", { name: "00:05" }));
    expect(provider.seek).toHaveBeenCalledWith(5);

    fireEvent.click(within(detail()).getByRole("checkbox", { name: "Incluir Silêncio 1" }));
    fireEvent.click(within(detail()).getByRole("checkbox", { name: "Incluir Silêncio 3" }));
    expect(within(detail()).getByRole("button", { name: /Aplicar \(2\)/ })).toBeInTheDocument();
    fireEvent.click(within(detail()).getByRole("checkbox", { name: "Marcar todos os itens" }));
    expect(within(detail()).getByRole("button", { name: /Aplicar \(3\)/ })).toBeInTheDocument();
    fireEvent.click(within(detail()).getByRole("checkbox", { name: "Marcar todos os itens" }));
    expect(within(detail()).getByRole("button", { name: /Aplicar \(0\)/ })).toBeInTheDocument();
    fireEvent.click(within(detail()).getByRole("checkbox", { name: "Incluir Silêncio 2" }));
    fireEvent.click(within(detail()).getByRole("checkbox", { name: "Incluir Silêncio 3" }));
    fireEvent.click(within(detail()).getByRole("checkbox", { name: "Incluir Silêncio 3" }));

    fireEvent.click(within(detail()).getByRole("button", { name: /Aplicar \(1\)/ }));
    const dialog = screen.getByRole("alertdialog", { name: "Confirmar Remover silêncios" });
    expect(dialog).toHaveTextContent("Isso vai cortar a sequência. Continuar?");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(provider.apply).not.toHaveBeenCalled();

    fireEvent.click(within(detail()).getByRole("button", { name: /Aplicar \(1\)/ }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(provider.apply).toHaveBeenCalledWith("silencio", { nivel: 5, modo: "auto", limite: -40, aviso: undefined, margem: 0.2, selectedItems: ["s2"] }, expect.any(Object)));
    expect(await within(detail()).findByText("Aplicado")).toBeInTheDocument();
    expect(onExecuted).toHaveBeenCalledWith(expect.objectContaining({ params: expect.objectContaining({ selectedItems: ["s2"] }) }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("ajustar um parâmetro fecha a confirmação pendente", () => {
    render(<MCPToolPanel provider={makeProvider()} />);
    fireEvent.click(card("Remover silêncios"));
    fireEvent.click(within(detail()).getByRole("button", { name: /Aplicar agora/ }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    fireEvent.click(within(detail()).getByRole("button", { name: "Aumentar Sensibilidade" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("rótulo próprio com contagem e lista vazia: não registra última ação quando nada mudou", async () => {
    const provider = makeProvider({ apply: vi.fn(async () => ({ ok: true, summary: "Nada a marcar", count: 0 })) });
    render(<MCPToolPanel provider={provider} />);
    fireEvent.click(card("Marcar cenas"));
    fireEvent.click(within(detail()).getByRole("button", { name: /Analisar/ }));
    expect(await within(detail()).findByText("Nenhuma cena")).toBeInTheDocument();
    expect(within(detail()).queryByRole("checkbox", { name: "Marcar todos os itens" })).toBeNull();
    fireEvent.click(within(detail()).getByRole("button", { name: /Marcar \(0\)/ }));
    await waitFor(() => expect(provider.apply).toHaveBeenCalledWith("marcas", { selectedItems: [] }, expect.any(Object)));
    expect(await within(detail()).findByText("Nada a marcar")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Última ação" })).toBeNull();
  });

  it("aplicar após prévia sem itens não envia seleção; falha não registra última ação", async () => {
    const provider = makeProvider({ apply: vi.fn(async () => ({ ok: false, summary: "Sem áudio" })) });
    render(<MCPToolPanel provider={provider} />);
    fireEvent.click(card("Normalizar"));
    fireEvent.click(within(detail()).getByRole("button", { name: /Analisar/ }));
    expect(await within(detail()).findByText("Prévia simples")).toBeInTheDocument();
    fireEvent.click(within(detail()).getByRole("button", { name: /Normalizar agora/ }));
    await waitFor(() => expect(provider.apply).toHaveBeenCalledWith("estatico", { alvo: -14 }, expect.any(Object)));
    expect(await within(detail()).findByText("Sem áudio")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Última ação" })).toBeNull();
  });

  it("mostra o progresso enquanto a ferramenta roda e some ao terminar", async () => {
    let finish;
    const provider = makeProvider();
    provider.analyze.mockImplementationOnce(
      (_id, _params, options) =>
        new Promise((resolve) => {
          options.onProgress(0.4, "Lendo áudio");
          finish = () => resolve({ ok: true, summary: "Pronto" });
        }),
    );
    render(<MCPToolPanel provider={provider} />);
    fireEvent.click(card("Normalizar"));
    fireEvent.click(within(detail()).getByRole("button", { name: /Analisar/ }));
    expect(await screen.findByRole("progressbar", { name: "Lendo áudio" })).toHaveAttribute("aria-valuenow", "40");
    expect(within(detail()).getByRole("button", { name: /Processando…/ })).toBeDisabled();
    await act(async () => finish());
    expect(await within(detail()).findByText("Pronto")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});

describe("MCPToolPanel: prévia ao vivo", () => {
  it("ferramenta live recalcula com os novos parâmetros após a prévia (uma vez por rajada)", async () => {
    const provider = makeProvider();
    render(<MCPToolPanel provider={provider} />);
    fireEvent.click(card("Remover silêncios"));
    // antes de qualquer prévia, ajustar não dispara análise
    fireEvent.click(within(detail()).getByRole("button", { name: "Aumentar Sensibilidade" }));
    fireEvent.click(within(detail()).getByRole("button", { name: "Diminuir Sensibilidade" }));
    fireEvent.click(within(detail()).getByRole("button", { name: /Analisar/ }));
    expect(await within(detail()).findByText("Prévia nível 5")).toBeInTheDocument();
    expect(provider.analyze).toHaveBeenCalledTimes(1);
    fireEvent.click(within(detail()).getByRole("button", { name: "Aumentar Sensibilidade" }));
    fireEvent.click(within(detail()).getByRole("button", { name: "Aumentar Sensibilidade" }));
    expect(within(detail()).getByText("Prévia nível 5")).toBeInTheDocument();
    expect(await within(detail()).findByText("Prévia nível 7")).toBeInTheDocument();
    expect(provider.analyze).toHaveBeenCalledTimes(2);
    expect(provider.analyze).toHaveBeenLastCalledWith("silencio", expect.objectContaining({ nivel: 7 }), expect.any(Object));
    expect(within(detail()).queryByText("1,2 s no total")).toBeNull();
  });

  it("live com resultado de aplicação ou prévia com falha limpa o resultado", async () => {
    const provider = makeProvider();
    render(<MCPToolPanel provider={provider} />);
    fireEvent.click(card("Remover silêncios"));
    fireEvent.click(within(detail()).getByRole("button", { name: /Aplicar agora/ }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(await within(detail()).findByText("Aplicado")).toBeInTheDocument();
    fireEvent.click(within(detail()).getByRole("button", { name: "Aumentar Sensibilidade" }));
    expect(within(detail()).queryByText("Aplicado")).toBeNull();

    provider.analyze.mockRejectedValueOnce(new Error("Sem áudio"));
    fireEvent.click(within(detail()).getByRole("button", { name: /Analisar/ }));
    expect(await within(detail()).findByText("Sem áudio")).toBeInTheDocument();
    fireEvent.click(within(detail()).getByRole("button", { name: "Aumentar Sensibilidade" }));
    expect(within(detail()).queryByText("Sem áudio")).toBeNull();
    expect(provider.analyze).toHaveBeenCalledTimes(1);
  });

  it("ferramenta sem live limpa a prévia ao ajustar", async () => {
    const provider = makeProvider();
    const { unmount } = render(<MCPToolPanel provider={provider} />);
    fireEvent.click(card("Normalizar"));
    fireEvent.click(within(detail()).getByRole("button", { name: /Analisar/ }));
    expect(await within(detail()).findByText("Prévia simples")).toBeInTheDocument();
    fireEvent.change(within(detail()).getByLabelText(/Alvo/), { target: { value: "-10" } });
    expect(within(detail()).queryByText("Prévia simples")).toBeNull();
    unmount();
    expect(provider.analyze).toHaveBeenCalledTimes(1);
  });
});

describe("MCPToolPanel: última ação, rodapé e modo largo", () => {
  it("registra a última ação ao aplicar e desfaz pela barra", async () => {
    const provider = makeProvider();
    render(<MCPToolPanel provider={provider} />);
    fireEvent.click(card("Normalizar"));
    fireEvent.click(within(detail()).getByRole("button", { name: /Normalizar agora/ }));
    const bar = await screen.findByRole("status", { name: "Última ação" });
    expect(bar).toHaveTextContent(/Última ação: Normalizar \(\d{2}:\d{2}\)/);
    provider.undo.mockReturnValueOnce(false);
    fireEvent.click(within(bar).getByRole("button", { name: "Desfazer" }));
    expect(screen.getByRole("status", { name: "Última ação" })).toBeInTheDocument();
    fireEvent.click(within(bar).getByRole("button", { name: "Desfazer" }));
    expect(screen.queryByRole("status", { name: "Última ação" })).toBeNull();
    expect(provider.undo).toHaveBeenCalledTimes(2);
  });

  it("desfazer pelo detalhe limpa a barra; barra fica desabilitada sem histórico", async () => {
    const provider = makeProvider();
    const { rerender } = render(<MCPToolPanel provider={provider} />);
    fireEvent.click(card("Normalizar"));
    fireEvent.click(within(detail()).getByRole("button", { name: /Normalizar agora/ }));
    await screen.findByRole("status", { name: "Última ação" });
    fireEvent.click(within(detail()).getByRole("button", { name: /Desfazer/ }));
    expect(screen.queryByRole("status", { name: "Última ação" })).toBeNull();
    act(() => recordLastAction("recursos", "Outra ação"));
    rerender(<MCPToolPanel provider={{ ...provider, canUndo: () => false }} />);
    expect(within(screen.getByRole("status", { name: "Última ação" })).getByRole("button", { name: "Desfazer" })).toBeDisabled();
  });

  it("rodapé troca de guia pelos botões com `tab` e chama os demais", () => {
    const onClick = vi.fn();
    const provider = makeProvider({
      footer: () => ({
        buttons: [
          { id: "ir", label: "Ver em breve", tab: "breve" },
          { id: "outro", label: "Exportar", onClick },
        ],
        info: "Sequência 1",
      }),
    });
    render(<MCPToolPanel provider={provider} />);
    expect(screen.getByText("Sequência 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver em breve" }));
    expect(screen.getByRole("button", { name: /^Breve/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "Normalizar" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Exportar" }));
    expect(onClick).toHaveBeenCalled();
  });

  it("rodapé sem botões mostra só a informação", () => {
    render(<MCPToolPanel provider={makeProvider({ footer: () => ({ info: "Sem sequência" }) })} />);
    expect(screen.getByText("Sem sequência")).toBeInTheDocument();
  });

  it("modo largo abre o painel em portal no body e recolhe", () => {
    const { container } = render(<MCPToolPanel provider={makeProvider()} />);
    fireEvent.click(card("Remover silêncios"));
    fireEvent.click(screen.getByRole("button", { name: "Expandir painel" }));
    expect(screen.getByText("Painel aberto em modo largo.")).toBeInTheDocument();
    const region = screen.getByRole("region", { name: "Ferramentas Editor" });
    expect(container.contains(region)).toBe(false);
    expect(document.body.contains(region)).toBe(true);
    expect(region.className).toContain("fixed");
    expect(within(region).getByLabelText("Detalhes: Remover silêncios")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Recolher painel" }));
    expect(screen.queryByText("Painel aberto em modo largo.")).toBeNull();
    expect(container.contains(screen.getByRole("region", { name: "Ferramentas Editor" }))).toBe(true);
  });

  it("favoritos gravados em formato inesperado são ignorados", () => {
    localStorage.setItem("mm_mcp_tool_favorites_v1", JSON.stringify({ recursos: "silencio" }));
    const { unmount } = render(<MCPToolPanel provider={makeProvider()} />);
    expect(screen.getByRole("button", { name: /★ Favoritos/ })).toHaveTextContent("0");
    unmount();
    localStorage.setItem("mm_mcp_tool_favorites_v1", "null");
    render(<MCPToolPanel provider={makeProvider()} />);
    expect(screen.getByRole("button", { name: /★ Favoritos/ })).toHaveTextContent("0");
  });
});

describe("mcpActions: última ação por aplicativo", () => {
  it("registra com horário, avisa só o aplicativo certo e limpa", () => {
    const first = renderHook(() => useLastAction("app-a"));
    const second = renderHook(() => useLastAction("app-b"));
    expect(first.result.current).toBeNull();
    let action;
    act(() => {
      action = recordLastAction("app-a", "Cortar", new Date(2026, 9, 21, 9, 5));
    });
    expect(action).toEqual({ label: "Cortar", time: "09:05" });
    expect(first.result.current).toEqual(action);
    expect(second.result.current).toBeNull();
    const late = renderHook(() => useLastAction("app-a"));
    expect(late.result.current).toEqual(action);
    act(() => clearLastAction("app-a"));
    expect(first.result.current).toBeNull();
    expect(late.result.current).toBeNull();
    act(() => {
      recordLastAction("app-b", "Agora");
    });
    expect(second.result.current).toEqual({ label: "Agora", time: expect.stringMatching(/^\d{2}:\d{2}$/) });
    act(() => clearLastAction("app-b"));
    first.unmount();
    second.unmount();
    late.unmount();
  });

  it("o hook acompanha a troca de aplicativo", () => {
    act(() => {
      recordLastAction("app-c", "Na C");
    });
    const { result, rerender, unmount } = renderHook(({ source }) => useLastAction(source), { initialProps: { source: "app-d" } });
    expect(result.current).toBeNull();
    rerender({ source: "app-c" });
    expect(result.current).toEqual(expect.objectContaining({ label: "Na C" }));
    act(() => clearLastAction("app-c"));
    unmount();
  });
});
