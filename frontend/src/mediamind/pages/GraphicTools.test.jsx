import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GraphicToolsContent as GraphicTools } from "./GraphicTools";

describe("GraphicTools", () => {
  it("preserves an edited scene when switching to another editor and back", () => {
    render(<GraphicTools />);
    fireEvent.click(screen.getByRole("tab", { name: /MM3D/ }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar objeto" }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar esfera" }));
    fireEvent.click(screen.getByRole("tab", { name: /MMPhoto/ }));
    fireEvent.click(screen.getByRole("tab", { name: /MM3D/ }));
    expect(screen.getByRole("button", { name: "Objeto Esfera 1" })).toBeInTheDocument();
  });
  it("cada aba de programa tem um ícone próprio (Word não repete o do MMPDF)", () => {
    render(<GraphicTools />);
    const tabs = [...screen.getByRole("tablist", { name: "Programas das Ferramentas Gráficas" }).querySelectorAll('[role="tab"]')];
    const iconOf = (tab) => [...tab.querySelector("svg").classList].find((name) => name.startsWith("lucide-"));
    const icons = tabs.map(iconOf);
    expect(new Set(icons).size).toBe(icons.length);
    expect(iconOf(screen.getByRole("tab", { name: /Word/ }))).toMatch(/^lucide-file-type-?2$/);
    expect(iconOf(screen.getByRole("tab", { name: /MMPDF/ }))).toBe("lucide-file-text");
  });
  it("opens the MMFig interface design workspace", () => {
    window.history.replaceState({}, "", "/ferramentas-graficas?tool=figcraft");
    render(<GraphicTools />);
    expect(screen.getByRole("tab", { name: /MMFig/ })).toHaveAttribute("aria-selected", "true");
  });

  it("shows the MM programs plus MMSom, Word, Excel and PowerPoint at the end", () => {
    render(<GraphicTools />);
    const programTabs = screen.getByRole("tablist", { name: "Programas das Ferramentas Gráficas" }).querySelectorAll('[role="tab"]');
    expect(programTabs).toHaveLength(14);
    expect([...programTabs].slice(-4).map((tab) => tab.textContent)).toEqual(expect.arrayContaining([expect.stringContaining("MMSom"), expect.stringContaining("Word"), expect.stringContaining("Excel"), expect.stringContaining("PowerPoint")]));
    fireEvent.click(screen.getByRole("tab", { name: /MM3D/ }));
    expect(screen.getByRole("heading", { name: "MM3D" })).toBeInTheDocument();
    expect(screen.getByLabelText("Viewport 3D")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /MMLibs/ }));
    expect(
      screen.getByRole("heading", { name: "MM Library" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/biblioteca comum dos sete editores/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /criar imagem/i })).toHaveAttribute(
      "href",
      "/estudio-de-arte",
    );
    expect(screen.getByRole("link", { name: /criar vídeo/i })).toHaveAttribute(
      "href",
      "/ferramentas-ia?tool=video-studio",
    );
    fireEvent.click(screen.getByRole("button", { name: "Pastas" }));
    expect(screen.getAllByRole("button", { name: /Projetos/ })).toHaveLength(2);
    fireEvent.click(
      screen.getByRole("button", { name: /visualização em lista/i }),
    );
  });

  it("opens the existing MMSom, Word, Excel and PowerPoint workspaces inside graphic tools", () => {
    render(<GraphicTools />);
    fireEvent.click(screen.getByRole("tab", { name: /MMSom/ }));
    expect(screen.getByText("MMSOM 0.5")).toBeInTheDocument();
    const programs = screen.getByRole("tablist", { name: "Programas das Ferramentas Gráficas" });
    fireEvent.click(programs.querySelector('[role="tab"]:nth-last-child(3)'));
    expect(within(programs).getByRole("tab", { name: "Word" })).toHaveAttribute("aria-selected", "true");
    // O menu principal já escolhe o aplicativo: sem o submenu repetido Word/Excel/PowerPoint.
    expect(screen.queryByRole("tablist", { name: "Aplicativos de documentos" })).toBeNull();
    expect(screen.queryByText("Ferramentas de documentos")).toBeNull();
    for (const [position, name] of [[2, "Excel"], [1, "PowerPoint"], [3, "Word"]]) {
      fireEvent.click(programs.querySelector(`[role="tab"]:nth-last-child(${position})`));
      expect(within(programs).getByRole("tab", { name })).toHaveAttribute("aria-selected", "true");
      expect(screen.getAllByRole("tab", { name })).toHaveLength(1);
    }
  });

  it("keeps the MM program switcher visible inside desktop editors", () => {
    window.history.replaceState({}, "", "/ferramentas-graficas?tool=photocraft");
    render(<GraphicTools />);
    expect(
      screen.getByRole("heading", { name: "Ferramentas Gráficas" }).closest("header"),
    ).not.toHaveClass("sr-only");
    expect(screen.getByRole("tablist", { name: "Programas das Ferramentas Gráficas" })).not.toHaveClass("sr-only");
    fireEvent.click(screen.getByRole("tab", { name: /MMEffect/ }));
    expect(screen.getByRole("tablist", { name: "Programas das Ferramentas Gráficas" })).not.toHaveClass("sr-only");
  });

  it("switches the main workspace when the selected route tool changes", () => {
    const { rerender } = render(<GraphicTools requestedTool="filmcraft" />);
    expect(screen.getByRole("tab", { name: /MMFilm/ })).toHaveAttribute("aria-selected", "true");

    rerender(<GraphicTools requestedTool="photocraft" />);

    expect(screen.getByRole("tab", { name: /MMPhoto/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "MMPhoto" })).toBeInTheDocument();
  });

  it("uses distinct professional workspaces for effects, photo and vector", () => {
    render(<GraphicTools />);

    fireEvent.click(screen.getByRole("tab", { name: /MMEffect/ }));
    expect(
      screen.getByRole("heading", { name: "MMEffect" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Área de trabalho do MMEffect")).toHaveValue(
      "Padrão",
    );
    const graphEditor = screen.getByRole("button", { name: "Editor de gráficos" });
    expect(graphEditor).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(graphEditor);
    expect(graphEditor).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(screen.getByLabelText("Agulha da timeline"), { target: { value: "5" } });

    fireEvent.click(screen.getByRole("tab", { name: /MMPhoto/ }));
    expect(
      screen.getByRole("heading", { name: "MMPhoto" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Área de trabalho do MMPhoto")).toHaveValue(
      "Essenciais",
    );

    fireEvent.click(screen.getByRole("tab", { name: /MMVector/ }));
    expect(
      screen.getByRole("heading", { name: "MMVector" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Área de trabalho do MMVector")).toHaveValue(
      "Essenciais clássicos",
    );
  });

  it("edits the selected MMPhoto layer with Photoshop-style controls", () => {
    render(<GraphicTools />);
    fireEvent.click(screen.getByRole("tab", { name: /MMPhoto/ }));
    fireEvent.click(screen.getByRole("button", { name: "Pessoa recortada" }));
    fireEvent.change(screen.getByLabelText("Posição X da camada"), { target: { value: "48" } });
    fireEvent.change(screen.getByLabelText("Escala da camada"), { target: { value: "125" } });
    fireEvent.change(screen.getByLabelText("Modo de mesclagem da camada"), { target: { value: "multiply" } });
    expect(screen.getByLabelText("Camada Pessoa recortada no documento")).toHaveStyle({ transform: "translate(48px, 0px) scale(1.25) rotate(0deg)", mixBlendMode: "multiply" });
  });

  it("duplicates, masks and removes MMPhoto layers with undo history", () => {
    render(<GraphicTools />);
    fireEvent.click(screen.getByRole("tab", { name: /MMPhoto/ }));
    fireEvent.click(screen.getByRole("button", { name: "Pessoa recortada" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Duplicar camada" })[0]);
    expect(screen.getByRole("button", { name: "Pessoa recortada cópia" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar máscara de camada" }));
    expect(screen.getAllByLabelText("Máscara de Pessoa recortada cópia")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Excluir camada" }));
    expect(screen.queryByRole("button", { name: "Pessoa recortada cópia" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(screen.getByRole("button", { name: "Pessoa recortada cópia" })).toBeInTheDocument();
  });

  it("reorders and hides MMPhoto layers", () => {
    render(<GraphicTools />);
    fireEvent.click(screen.getByRole("tab", { name: /MMPhoto/ }));
    fireEvent.click(screen.getByRole("button", { name: "Pessoa recortada" }));
    fireEvent.click(screen.getByRole("button", { name: "Mover camada para baixo" }));
    expect(screen.getByTestId("photo-layer-list").children[2]).toHaveAccessibleName("Pessoa recortada");
    fireEvent.click(screen.getByRole("button", { name: "Ocultar Pessoa recortada" }));
    expect(screen.queryByLabelText("Camada Pessoa recortada no documento")).not.toBeInTheDocument();
  });

  it("uses MMPhoto toolbar tools on the document", () => {
    window.history.replaceState({}, "", "/ferramentas-graficas?tool=photocraft");
    render(<GraphicTools />);
    fireEvent.click(screen.getByRole("button", { name: "Texto (T)" }));
    fireEvent.pointerDown(screen.getByLabelText("Documento do MMPhoto"), { clientX: 540, clientY: 300 });
    expect(screen.getByRole("button", { name: "Texto 5" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Zoom (Z)" }));
    fireEvent.pointerDown(screen.getByLabelText("Documento do MMPhoto"), { clientX: 540, clientY: 300 });
    expect(screen.getByLabelText("Zoom do documento")).toHaveValue("91.7");
  });

  it("runs MMPhoto menu commands instead of only highlighting menus", () => {
    window.history.replaceState({}, "", "/ferramentas-graficas?tool=photocraft");
    render(<GraphicTools />);
    fireEvent.click(screen.getByRole("button", { name: "Camada" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Duplicar camada" })[0]);
    expect(screen.getByRole("button", { name: "Pessoa recortada cópia" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Janela" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Ajustes" })[0]);
    expect(screen.getByText("Ajustes não destrutivos")).toBeInTheDocument();
  });

  it("moves and trims an MMEffect layer directly on the timeline", () => {
    render(<GraphicTools />);
    fireEvent.click(screen.getByRole("tab", { name: /MMEffect/ }));

    const clip = screen.getByRole("button", { name: /Mover MMEffect na timeline/i });
    expect(clip).toHaveAttribute("aria-valuetext", "Início 0.00s, duração 10.00s");
    fireEvent.pointerDown(clip, { pointerId: 1, clientX: 100 });
    fireEvent.pointerMove(clip, { pointerId: 1, clientX: 160 });
    fireEvent.pointerUp(clip, { pointerId: 1, clientX: 160 });
    expect(screen.getByRole("button", { name: /Mover MMEffect na timeline/i })).toHaveAttribute("aria-valuetext", "Início 1.00s, duração 9.00s");

    const trimEnd = screen.getByRole("button", { name: /Aparar fim de MMEffect/i });
    fireEvent.pointerDown(trimEnd, { pointerId: 2, clientX: 600 });
    fireEvent.pointerMove(trimEnd, { pointerId: 2, clientX: 540 });
    fireEvent.pointerUp(trimEnd, { pointerId: 2, clientX: 540 });
    expect(screen.getByRole("button", { name: /Mover MMEffect na timeline/i })).toHaveAttribute("aria-valuetext", "Início 1.00s, duração 8.00s");
  });

  it("creates a property keyframe at the current MMEffect playhead", () => {
    render(<GraphicTools />);
    fireEvent.click(screen.getByRole("tab", { name: /MMEffect/ }));
    fireEvent.change(screen.getByLabelText("Agulha da timeline"), { target: { value: "4.25" } });
    fireEvent.click(screen.getByRole("button", { name: /Criar keyframe de scale/i }));
    expect(screen.getByRole("button", { name: "Keyframe scale em 4.25s" })).toBeInTheDocument();
  });

  it("automatically creates the next keyframe when an animated value changes", () => {
    window.history.replaceState({}, "", "/ferramentas-graficas?tool=effectcraft");
    render(<GraphicTools />);
    fireEvent.click(screen.getByRole("button", { name: "MMEffect" }));
    fireEvent.change(screen.getByLabelText("Agulha da timeline"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: /Criar keyframe de scale/i }));
    fireEvent.change(screen.getByLabelText("Agulha da timeline"), { target: { value: "6" } });
    fireEvent.change(screen.getByLabelText("Valor Escala da camada"), { target: { value: "135" } });

    expect(screen.getByRole("button", { name: "Keyframe scale em 2.00s" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keyframe scale em 6.00s" })).toBeInTheDocument();
  });

  it("interpolates an animated transform between two keyframes", () => {
    window.history.replaceState({}, "", "/ferramentas-graficas?tool=effectcraft");
    render(<GraphicTools />);
    fireEvent.click(screen.getByRole("button", { name: "MMEffect" }));
    fireEvent.change(screen.getByLabelText("Agulha da timeline"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: /Criar keyframe de scale/i }));
    fireEvent.change(screen.getByLabelText("Agulha da timeline"), { target: { value: "6" } });
    fireEvent.change(screen.getByLabelText("Valor Escala da camada"), { target: { value: "140" } });
    fireEvent.change(screen.getByLabelText("Agulha da timeline"), { target: { value: "4" } });

    expect(screen.getByLabelText("Valor Escala da camada")).toHaveValue("120");
    expect(screen.getByLabelText("Camada MMEffect na composição")).toHaveStyle({ transform: "translate(0%, 0%) scale(1.2) rotate(0deg)" });
  });

  it("presents compact After Effects controls with synchronized numeric values and sliders", () => {
    window.history.replaceState({}, "", "/ferramentas-graficas?tool=effectcraft");
    render(<GraphicTools />);
    const numericX = screen.getByLabelText("Valor X da camada");
    const sliderX = screen.getByLabelText("X da camada");
    expect(numericX).toHaveValue("960");
    fireEvent.change(numericX, { target: { value: "720" } });
    expect(sliderX).toHaveValue("720");
    expect(screen.getByLabelText("Valor de Fuzziness")).toHaveValue("0");
    expect(screen.getByRole("button", { name: "Recolher Color Range" })).toHaveAttribute("aria-expanded", "true");
  });

  it("applies transform controls to the selected composition layer", () => {
    render(<GraphicTools />);
    fireEvent.click(screen.getByRole("tab", { name: /MMEffect/ }));
    fireEvent.click(screen.getByRole("button", { name: "MMEffect" }));
    fireEvent.change(screen.getByLabelText("Escala da camada"), { target: { value: "150" } });
    expect(screen.getByLabelText("Camada MMEffect na composição")).toHaveStyle({ transform: "translate(0%, 0%) scale(1.5) rotate(0deg)" });
  });

  it("aligns the selected MMEffect layer from the right panel", () => {
    render(<GraphicTools />);
    fireEvent.click(screen.getByRole("tab", { name: /MMEffect/ }));
    fireEvent.change(screen.getByLabelText("X da camada"), { target: { value: "300" } });
    fireEvent.click(screen.getByRole("button", { name: "Centralizar horizontalmente" }));
    // Centraliza a caixa real da camada (não a âncora): a caixa do exemplo não começa no centro.
    expect(screen.getByLabelText("X da camada")).toHaveValue("896");
  });

  it("expands layer properties and edits parenting and blend modes", () => {
    render(<GraphicTools />);
    fireEvent.click(screen.getByRole("tab", { name: /MMEffect/ }));
    fireEvent.click(screen.getByRole("button", { name: "Expandir propriedades de MMEffect" }));
    expect(screen.getByRole("button", { name: "Posição de MMEffect" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Escala de MMEffect" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Pai de MMEffect"), { target: { value: "shape" } });
    expect(screen.getByLabelText("Pai de MMEffect")).toHaveValue("shape");

    fireEvent.change(screen.getByLabelText("Modo de mesclagem de MMEffect"), { target: { value: "multiply" } });
    expect(screen.getByLabelText("Modo de mesclagem de MMEffect")).toHaveValue("multiply");
  }, 15000);

  it("offers After Effects layer switches, track matte and parenting controls", () => {
    window.history.replaceState({}, "", "/ferramentas-graficas?tool=effectcraft");
    render(<GraphicTools />);

    const audio = screen.getByRole("button", { name: "Silenciar áudio de MMEffect" });
    const solo = screen.getByRole("button", { name: "Ativar solo de MMEffect" });
    fireEvent.click(audio);
    fireEvent.click(solo);
    expect(audio).toHaveAttribute("aria-pressed", "true");
    expect(solo).toHaveAttribute("aria-pressed", "true");

    fireEvent.change(screen.getByLabelText("Track matte de MMEffect"), {
      target: { value: "alpha" },
    });
    fireEvent.change(screen.getByLabelText("Pai de MMEffect"), {
      target: { value: "shape" },
    });
    expect(screen.getByLabelText("Track matte de MMEffect")).toHaveValue("alpha");
    expect(screen.getByLabelText("Pai de MMEffect")).toHaveValue("shape");

    const modes = screen.getByRole("button", { name: "Modos" });
    expect(modes).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(modes);
    expect(screen.queryByLabelText("Track matte de MMEffect")).not.toBeInTheDocument();
  });

  it("adds composition and layer markers at the current timeline time", () => {
    window.history.replaceState({}, "", "/ferramentas-graficas?tool=effectcraft");
    render(<GraphicTools />);
    fireEvent.change(screen.getByLabelText("Agulha da timeline"), { target: { value: "4.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar marcador de MMEffect" }));
    expect(screen.getByRole("button", { name: "Marcador de MMEffect em 4.50s" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marcador da composição em 5.80s" })).toBeInTheDocument();
  });

  it("changes the interpolation of a selected MMEffect keyframe", () => {
    render(<GraphicTools />);
    fireEvent.click(screen.getByRole("tab", { name: /MMEffect/ }));
    fireEvent.change(screen.getByLabelText("Agulha da timeline"), { target: { value: "2.5" } });
    fireEvent.click(screen.getByRole("button", { name: /Criar keyframe de scale/i }));
    fireEvent.click(screen.getByRole("button", { name: "Keyframe scale em 2.50s" }));
    fireEvent.click(screen.getByRole("button", { name: "Editor de gráficos" }));
    fireEvent.click(screen.getByRole("button", { name: "Manter" }));
    fireEvent.click(screen.getByRole("button", { name: "Editor de gráficos" }));
    expect(screen.getByRole("button", { name: "Keyframe scale em 2.50s" })).toHaveAttribute("data-interpolation", "hold");
  }, 15000);

  it("renames a layer only after double clicking its name", () => {
    window.history.replaceState({}, "", "/ferramentas-graficas?tool=effectcraft");
    render(<GraphicTools />);
    const layerName = screen.getByRole("button", { name: "MMEffect" });
    fireEvent.click(layerName);
    expect(screen.queryByLabelText("Renomear MMEffect")).not.toBeInTheDocument();
    fireEvent.doubleClick(layerName);
    const editor = screen.getByLabelText("Renomear MMEffect");
    fireEvent.change(editor, { target: { value: "Título principal" } });
    fireEvent.keyDown(editor, { key: "Enter" });
    expect(screen.getByRole("button", { name: "Título principal" })).toBeInTheDocument();
  });

  it("parents a layer by dragging its pick whip to another layer", () => {
    window.history.replaceState({}, "", "/ferramentas-graficas?tool=effectcraft");
    render(<GraphicTools />);
    const whip = screen.getByRole("button", { name: "Vincular MMEffect a outra camada" });
    fireEvent.pointerDown(whip, { pointerId: 12, clientX: 500, clientY: 300 });
    fireEvent.pointerMove(whip, { pointerId: 12, clientX: 620, clientY: 420 });
    fireEvent.pointerUp(screen.getByRole("button", { name: "Controller" }), { pointerId: 12 });
    expect(screen.getByLabelText("Pai de MMEffect")).toHaveValue("shape");
  });

  it("uses the active creation tool inside the composition viewer", () => {
    window.history.replaceState({}, "", "/ferramentas-graficas?tool=effectcraft");
    render(<GraphicTools />);
    fireEvent.click(screen.getByRole("button", { name: "Texto (T)" }));
    fireEvent.pointerDown(screen.getByLabelText("Visualizador da composição"), { clientX: 620, clientY: 280 });
    expect(screen.getByRole("button", { name: "Texto 9" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Forma (Q)" }));
    fireEvent.pointerDown(screen.getByLabelText("Visualizador da composição"), { clientX: 700, clientY: 340 });
    expect(screen.getByRole("button", { name: "Forma 10" })).toBeInTheDocument();
  });

  it("changes panels and graph editor when choosing the Animation workspace", () => {
    window.history.replaceState({}, "", "/ferramentas-graficas?tool=effectcraft");
    render(<GraphicTools />);
    fireEvent.click(screen.getAllByRole("button", { name: "Animação" }).at(-1));
    expect(screen.getAllByRole("button", { name: "Efeitos e predefinições" }).at(-1)).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Pré-visualização" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Editor de gráficos" })).toHaveAttribute("aria-pressed", "true");
  });
});
