import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import EffectCraftWorkspace from "./EffectCraftWorkspace";

function renderWorkspace(props = {}) {
  return render(
    <EffectCraftWorkspace assets={[]} selected={null} onSelect={vi.fn()} onOpenFiles={vi.fn()} {...props} />,
  );
}

function runMenu(menu, command) {
  fireEvent.click(screen.getAllByRole("button", { name: menu })[0]);
  fireEvent.click(screen.getByRole("button", { name: command }));
}

function layerElement() {
  return screen.getByLabelText(/^Camada .* na composição$/);
}

function mockRect(element, rect = { left: 0, top: 0, width: 200, height: 100 }) {
  element.getBoundingClientRect = () => ({ ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height, x: rect.left, y: rect.top });
}

vi.setConfig({ testTimeout: 40000 });

afterEach(() => {
  vi.useRealTimers();
  delete window.MediaRecorder;
  delete HTMLCanvasElement.prototype.captureStream;
});

describe("MMEffect — histórico e projeto", () => {
  it("desfaz e refaz edições de propriedade pelo menu e pelo teclado", () => {
    renderWorkspace();
    fireEvent.change(screen.getByLabelText("Valor Escala da camada"), { target: { value: "150" } });
    expect(screen.getByLabelText("Valor Escala da camada")).toHaveValue(150);
    runMenu("Editar", "Desfazer");
    expect(screen.getByLabelText("Valor Escala da camada")).toHaveValue(100);
    runMenu("Editar", "Refazer");
    expect(screen.getByLabelText("Valor Escala da camada")).toHaveValue(150);
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(screen.getByLabelText("Valor Escala da camada")).toHaveValue(100);
    fireEvent.keyDown(window, { key: "z", ctrlKey: true, shiftKey: true });
    expect(screen.getByLabelText("Valor Escala da camada")).toHaveValue(150);
  });

  it("desfaz a exclusão de uma camada e de um quadro-chave", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Tagline" }));
    runMenu("Editar", "Excluir camada");
    expect(screen.queryByRole("button", { name: "Tagline" })).not.toBeInTheDocument();
    runMenu("Editar", "Desfazer");
    expect(screen.getByRole("button", { name: "Tagline" })).toBeInTheDocument();
    runMenu("Editar", "Desfazer");
    expect(screen.getByRole("status", { name: "Status do MMEffect" })).toHaveTextContent("Nada para desfazer.");
  });

  it("adiciona quadro-chave (não marcador) na propriedade ativa e na agulha", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "MMEffect" }));
    const markersBefore = screen.getAllByRole("button", { name: /Marcador da composição/ }).length;
    fireEvent.change(screen.getByLabelText("Agulha da timeline"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Valor Escala da camada"), { target: { value: "120" } });
    runMenu("Animação", "Adicionar quadro-chave");
    expect(screen.getByRole("button", { name: "Keyframe scale em 4.00s" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Marcador da composição/ })).toHaveLength(markersBefore);
  });

  it("cria uma composição vazia e preserva as camadas ao alternar", () => {
    vi.spyOn(window, "prompt").mockReturnValue("Abertura");
    renderWorkspace();
    runMenu("Composição", "Nova composição");
    expect(screen.getByText("Composição: Abertura")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "MMEffect" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Texto (T)" }));
    fireEvent.pointerDown(screen.getByLabelText("Visualizador da composição"), { clientX: 10, clientY: 10 });
    expect(screen.getByRole("button", { name: "Texto 1" })).toBeInTheDocument();
    expect(screen.getByLabelText("Camada Texto 1 na composição")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Projeto" })[0]);
    fireEvent.doubleClick(screen.getByRole("button", { name: /EffectCraft Intro/ }));
    expect(screen.getByRole("button", { name: "MMEffect" })).toBeInTheDocument();
    fireEvent.doubleClick(screen.getByRole("button", { name: /Abertura/ }));
    expect(screen.getByRole("button", { name: "Texto 1" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "MMEffect" })).not.toBeInTheDocument();
  });

  it("salva o projeto como arquivo JSON e só cria novo projeto após confirmação", async () => {
    const createObjectURL = vi.fn(() => "blob:projeto");
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderWorkspace();
    runMenu("Arquivo", "Salvar projeto");
    expect(click).toHaveBeenCalled();
    const blob = createObjectURL.mock.calls[0][0];
    const saved = JSON.parse(await blob.text());
    expect(saved.schema).toBe("mmeffect-project/v1");
    expect(saved.layers.map((layer) => layer.name)).toContain("MMEffect");
    expect(screen.getByRole("status", { name: "Status do MMEffect" })).toHaveTextContent("effectcraft-intro.mmeffect.json");

    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    runMenu("Arquivo", "Novo projeto");
    expect(screen.getByRole("button", { name: "MMEffect" })).toBeInTheDocument();
    confirm.mockReturnValue(true);
    runMenu("Arquivo", "Novo projeto");
    expect(screen.queryByRole("button", { name: "MMEffect" })).not.toBeInTheDocument();
    expect(screen.getByText("Composição: Composição 1")).toBeInTheDocument();
  });

  it("abre um projeto salvo pelo botão Importar e rejeita arquivos inválidos", async () => {
    const onOpenFiles = vi.fn();
    renderWorkspace({ onOpenFiles });
    const project = { schema: "mmeffect-project/v1", composition: "Salva", layers: [{ id: "a", name: "Camada salva", kind: "T", color: "bg-fuchsia-500", visible: true, locked: false, start: 0, duration: 4 }], selectedLayer: "a" };
    const input = document.getElementById("mmeffect-import");
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File([JSON.stringify(project)], "salvo.mmeffect.json", { type: "application/json" })] } });
    });
    expect(await screen.findByText("Composição: Salva")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Camada salva" })).toBeInTheDocument();
    expect(onOpenFiles).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.change(input, { target: { files: [new File(["{}"], "ruim.mmeffect.json", { type: "application/json" })] } });
    });
    expect(await screen.findByText(/não é um projeto MMEffect válido/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Camada salva" })).toBeInTheDocument();
  });
});

describe("MMEffect — ferramentas do visualizador", () => {
  it("Mão desloca a visualização e Zoom amplia a composição", () => {
    renderWorkspace();
    const viewer = screen.getByLabelText("Visualizador da composição");
    fireEvent.click(screen.getByRole("button", { name: "Mão (H)" }));
    fireEvent.pointerDown(viewer, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(viewer, { clientX: 130, clientY: 120 });
    fireEvent.pointerUp(viewer);
    expect(screen.getByLabelText("Quadro da composição").style.transform).toBe("translate(30px, 20px)");

    fireEvent.keyDown(window, { key: "z" });
    fireEvent.pointerDown(viewer, { clientX: 100, clientY: 100 });
    expect(screen.getByText(/Resolução: Completa · 125%/)).toBeInTheDocument();
    expect(screen.getByLabelText("Quadro da composição").style.transform).toBe("translate(30px, 20px) scale(1.25)");
    fireEvent.pointerDown(viewer, { clientX: 100, clientY: 100, altKey: true });
    expect(screen.getByText(/Resolução: Completa · 100%/)).toBeInTheDocument();
  });

  it("Rotação (W) gira a camada selecionada arrastando", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "MMEffect" }));
    mockRect(layerElement(), { left: -50, top: -50, width: 100, height: 100 });
    fireEvent.keyDown(window, { key: "w" });
    const viewer = screen.getByLabelText("Visualizador da composição");
    fireEvent.pointerDown(viewer, { clientX: 100, clientY: 0 });
    fireEvent.pointerMove(viewer, { clientX: 0, clientY: 100 });
    fireEvent.pointerUp(viewer);
    expect(screen.getByLabelText("Valor Rotação da camada")).toHaveValue(90);
    expect(layerElement().style.transform).toContain("rotate(90deg)");
    runMenu("Editar", "Desfazer");
    expect(screen.getByLabelText("Valor Rotação da camada")).toHaveValue(0);
  });

  it("Âncora (Y) move o ponto de ancoragem da camada", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "MMEffect" }));
    mockRect(layerElement());
    fireEvent.keyDown(window, { key: "y" });
    const viewer = screen.getByLabelText("Visualizador da composição");
    fireEvent.pointerDown(viewer, { clientX: 50, clientY: 25 });
    fireEvent.pointerMove(viewer, { clientX: 150, clientY: 75 });
    fireEvent.pointerUp(viewer);
    expect(layerElement().style.transformOrigin).toBe("75% 75%");
  });

  it("Caneta desenha e fecha um traçado de máscara na camada selecionada", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "MMEffect" }));
    mockRect(layerElement());
    fireEvent.click(screen.getByRole("button", { name: "Caneta (G)" }));
    const viewer = screen.getByLabelText("Visualizador da composição");
    fireEvent.pointerDown(viewer, { clientX: 20, clientY: 10 });
    fireEvent.pointerDown(viewer, { clientX: 180, clientY: 10 });
    fireEvent.pointerDown(viewer, { clientX: 100, clientY: 90 });
    expect(screen.getByLabelText("Traçado da caneta")).toHaveAttribute("data-closed", "false");
    fireEvent.pointerDown(viewer, { clientX: 21, clientY: 11 });
    expect(screen.getByLabelText("Traçado da caneta")).toHaveAttribute("data-closed", "true");
    expect(screen.getByLabelText("Texto renderizado da camada").parentElement.style.clipPath).toBe("polygon(10% 10%, 90% 10%, 50% 90%)");
    expect(screen.queryByRole("button", { name: /^Forma \d+$/ })).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Delete" });
    expect(screen.queryByLabelText("Traçado da caneta")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "MMEffect" })).toBeInTheDocument();
  });

  it("Ajustar encaixa a camada no centro da composição ao arrastar", () => {
    renderWorkspace();
    const layer = layerElement();
    // Caixa padrão: x=22, w=60 → centro em 50 - 30 = 20; arrastar 16px (= 2%) aproxima de 20.
    fireEvent.pointerDown(layer, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(layer, { clientX: -12, clientY: 0 });
    fireEvent.pointerUp(layer);
    expect(layer.style.left).toBe("20%");
    fireEvent.click(screen.getByLabelText("Ajustar (encaixe)"));
    expect(screen.getByLabelText("Ajustar (encaixe)")).not.toBeChecked();
    fireEvent.pointerDown(layer, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(layer, { clientX: 4, clientY: 0 });
    fireEvent.pointerUp(layer);
    expect(layer.style.left).toBe("20.5%");
  });

  it("não reage a atalhos quando o MMEffect está oculto", () => {
    render(<EffectCraftWorkspace active={false} assets={[]} selected={null} onSelect={vi.fn()} onOpenFiles={vi.fn()} />);
    fireEvent.keyDown(window, { key: "Delete" });
    expect(screen.getByRole("button", { name: "Controller" })).toBeInTheDocument();
  });
});

describe("MMEffect — prévia, transformação, efeitos e texto", () => {
  it("transporte da prévia vai ao início, ao fim e avança quadro a quadro", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Pré-visualização" }));
    fireEvent.click(screen.getByRole("button", { name: "Ir para o primeiro quadro" }));
    expect(screen.getAllByText("00:00:00:00").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Próximo quadro" }));
    fireEvent.click(screen.getByRole("button", { name: "Próximo quadro" }));
    expect(screen.getAllByText("00:00:00:02").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Quadro anterior" }));
    expect(screen.getAllByText("00:00:00:01").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Ir para o último quadro" }));
    expect(screen.getAllByText("00:00:10:00").length).toBeGreaterThan(0);
  });

  it("Redefinir restaura a transformação e remove os quadros-chave da camada", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "MMEffect" }));
    fireEvent.click(screen.getByRole("button", { name: /Criar keyframe de scale/ }));
    fireEvent.change(screen.getByLabelText("Valor Escala da camada"), { target: { value: "150" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Redefinir" }).find((button) => button.closest("h4")));
    expect(screen.getByLabelText("Valor Escala da camada")).toHaveValue(100);
    expect(screen.queryByRole("button", { name: /Keyframe scale/ })).not.toBeInTheDocument();
  });

  it("aplica parâmetros do efeito ao visualizador e respeita a chave fx", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "MMEffect" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Efeitos e predefinições" })[0]);
    fireEvent.doubleClick(screen.getByRole("button", { name: /Desfoque gaussiano/ }));
    fireEvent.change(screen.getByLabelText("Valor de Desfoque"), { target: { value: "5" } });
    expect(layerElement().style.filter).toBe("blur(5px)");
    fireEvent.click(screen.getByRole("button", { name: "Efeitos de MMEffect" }));
    expect(layerElement().style.filter).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Efeitos de MMEffect" }));
    fireEvent.click(screen.getByRole("button", { name: "Redefinir Desfoque gaussiano" }));
    expect(screen.getByLabelText("Valor de Desfoque")).toHaveValue(0);
    expect(layerElement().style.filter).toBe("");
  });

  it("parâmetros do CC Particle World alteram as partículas", () => {
    renderWorkspace();
    fireEvent.click(screen.getAllByRole("button", { name: "Projeto" })[0]);
    fireEvent.doubleClick(screen.getByRole("button", { name: /^▣Particles/ }));
    expect(screen.getByLabelText("Prévia de partículas")).toHaveAttribute("data-particles", "34");
    fireEvent.change(screen.getByLabelText("Valor de Birth Rate"), { target: { value: "1" } });
    expect(screen.getByLabelText("Prévia de partículas")).toHaveAttribute("data-particles", "68");
  });

  it("fonte, peso, alinhamento e opções da camada afetam a camada", () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "MMEffect" }));
    fireEvent.change(screen.getByLabelText("Peso da fonte"), { target: { value: "Regular" } });
    fireEvent.change(screen.getByLabelText("Fonte do texto"), { target: { value: "Source Sans 3" } });
    const text = screen.getByLabelText("Texto renderizado da camada");
    expect(text.style.fontWeight).toBe("400");
    expect(text.style.fontFamily).toContain("Source Sans 3");
    fireEvent.change(screen.getByLabelText("Tamanho do texto"), { target: { value: "96 px" } });
    expect(screen.getByLabelText("Tamanho do texto")).toHaveValue("96 px");
    fireEvent.click(screen.getByRole("button", { name: "Alinhar texto à esquerda" }));
    expect(text.parentElement.style.textAlign).toBe("left");

    fireEvent.click(screen.getByRole("button", { name: "Controller" }));
    fireEvent.click(screen.getByLabelText("Desfoque de movimento"));
    fireEvent.click(screen.getByLabelText("Camada 3D"));
    expect(layerElement()).toHaveAttribute("data-motion-blur", "on");
    expect(layerElement()).toHaveAttribute("data-three-d", "on");
    expect(screen.getByRole("button", { name: "Desfoque de movimento de Controller" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("MMEffect — fila de renderização", () => {
  it("mantém Renderizar desativado com motivo quando o navegador não grava canvas", () => {
    renderWorkspace();
    runMenu("Arquivo", "Adicionar à fila de renderização");
    const button = screen.getByRole("button", { name: "Renderizar" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", expect.stringContaining("MediaRecorder"));
  });

  it("renderiza a composição em WebM com MediaRecorder e baixa o arquivo", async () => {
    vi.useFakeTimers();
    const context = new Proxy({}, { get: (target, key) => (key in target ? target[key] : typeof key === "string" && ["createRadialGradient", "createLinearGradient"].includes(key) ? () => ({ addColorStop() {} }) : () => {}), set: (target, key, value) => { target[key] = value; return true; } });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    HTMLCanvasElement.prototype.captureStream = vi.fn(() => ({ getTracks: () => [{ stop: vi.fn() }] }));
    class FakeRecorder {
      static isTypeSupported(type) { return type === "video/webm;codecs=vp9"; }
      constructor(stream, options) { this.options = options; this.state = "inactive"; }
      start() { this.state = "recording"; }
      stop() { this.state = "inactive"; this.ondataavailable?.({ data: new Blob(["webm-data"], { type: "video/webm" }) }); this.onstop?.(); }
    }
    window.MediaRecorder = FakeRecorder;
    URL.createObjectURL = vi.fn(() => "blob:video");
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const onOpenFiles = vi.fn();
    renderWorkspace({ onOpenFiles });
    runMenu("Arquivo", "Adicionar à fila de renderização");
    fireEvent.change(screen.getByLabelText("Ação pós-renderização"), { target: { value: "Importar" } });
    const panel = screen.getByRole("button", { name: "Voltar à Timeline" }).closest("div").parentElement;
    expect(within(panel).getByText(/WebM · VP9/)).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Renderizar" }));
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(11000);
    });
    expect(click).toHaveBeenCalled();
    expect(screen.getByText(/Renderização concluída: effectcraft-intro\.webm/)).toBeInTheDocument();
    expect(onOpenFiles).toHaveBeenCalledWith([expect.any(File)]);
  });
});

describe("MMEffect — menus da barra superior", () => {
  it("abre o menu em portal fixo ancorado ao botão (fora da barra com rolagem)", () => {
    renderWorkspace();
    const trigger = screen.getAllByRole("button", { name: "Arquivo" })[0];
    trigger.getBoundingClientRect = () => ({ left: 40, top: 0, width: 50, height: 28, right: 90, bottom: 28, x: 40, y: 0 });
    fireEvent.click(trigger);
    const menu = screen.getByRole("menu", { name: "Menu Arquivo" });
    expect(menu.parentElement).toBe(document.body);
    expect(menu).toHaveClass("fixed");
    expect(menu.style.left).toBe("40px");
    expect(menu.style.top).toBe("28px");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu", { name: "Menu Arquivo" })).toBeNull();
  });
});
