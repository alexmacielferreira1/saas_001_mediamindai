import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import FilmCraftWorkspace from "./FilmCraftWorkspace";

// Painéis do MMFilm que antes só mudavam a aparência: modelos de Gráficos essenciais, interruptores do Lumetri,
// abas do Som essencial, listas da exportação, Patch de origem V e linhas de Informações.
const PX = 12;

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

function lane(container, track = "V1") {
  return container.querySelector(`[data-track-id="${track}"]`);
}
function clipsOn(container, track = "V1") {
  return [...lane(container, track).children].filter((node) => node.tagName === "BUTTON");
}
function clipNamed(container, name, track = "V1") {
  return clipsOn(container, track).find((node) => node.textContent.includes(name));
}
function movePlayhead(seconds) {
  const ruler = document.querySelector("[data-timeline-ruler]");
  fireEvent.pointerDown(ruler, { clientX: seconds * PX, button: 0 });
  fireEvent.pointerUp(window, { clientX: seconds * PX });
}
function drop(container, { id, name, seconds = 0, duration = 8, track = "V1" }) {
  const payload = { id, name, kind: "video", src: `/api/v1/media/assets/${id}/stream`, duration, mimeType: "video/mp4" };
  fireEvent.drop(lane(container, track), {
    clientX: seconds * PX,
    dataTransfer: { getData: (type) => (type === "application/x-timeline2-media" ? JSON.stringify(payload) : "") },
  });
}
function chooseWorkspace(name) {
  const trigger = [...document.querySelectorAll('[aria-haspopup="menu"][aria-expanded]')].find((node) => node.textContent.includes("▾"));
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole("menuitem", { name }));
}
function withClip() {
  const view = render(<FilmCraftWorkspace />);
  drop(view.container, { id: "a", name: "Cena" });
  fireEvent.click(clipNamed(view.container, "Cena"));
  return view;
}
async function withTitle() {
  const view = render(<FilmCraftWorkspace />);
  drop(view.container, { id: "a", name: "Base" });
  fireEvent.click(screen.getByRole("button", { name: "Texto (T)" }));
  fireEvent.click(clipNamed(view.container, "Base"), { clientX: 2 * PX });
  const dialog = await screen.findByRole("dialog", { name: "Texto do título" });
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Texto do título" }), { target: { value: "Abertura" } });
  fireEvent.click(within(dialog).getByRole("button", { name: "OK" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Texto do título" })).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "Seleção (V)" }));
  fireEvent.click(clipNamed(view.container, "Abertura", "V2"));
  movePlayhead(3);
  fireEvent.click(screen.getByRole("button", { name: "Gráficos essenciais" }));
  return view;
}
const previewText = () => screen.getAllByText(/^abertura$/i).find((node) => node.style?.fontSize);
const programVideo = (container) => [...container.querySelectorAll("video")].find((node) => node.style.filter);

describe("Gráficos essenciais — modelos aplicam um estilo de verdade", () => {
  it("cada modelo vira o captionStyle do título selecionado (prévia muda, texto fica)", async () => {
    await withTitle();
    const boxed = screen.getByRole("button", { name: /Title – Boxed/ });
    expect(boxed).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(boxed);
    expect(boxed).toHaveAttribute("aria-pressed", "true");
    expect(previewText().style.backgroundColor).not.toBe("");
    expect(previewText().style.color).toBe("rgb(30, 41, 59)");
    const boxedSize = parseFloat(previewText().style.fontSize);
    fireEvent.click(screen.getByRole("button", { name: /Lower Third – Slab/ }));
    expect(previewText().textContent).toBe("ABERTURA");
    expect(previewText().style.textAlign).toBe("left");
    expect(parseFloat(previewText().style.fontSize)).toBeCloseTo((boxedSize * 48) / 72, 5);
  });

  it("sem título selecionado os modelos ficam desabilitados", () => {
    withClip();
    fireEvent.click(screen.getByRole("button", { name: "Gráficos essenciais" }));
    const card = screen.getByRole("button", { name: /Title – Centered/ });
    expect(card).toBeDisabled();
    expect(card).toHaveAttribute("title", "Selecione um título na timeline para editar o estilo");
  });
});

describe("Cor Lumetri — interruptores afetam a prévia", () => {
  it("Correção básica desligada volta a prévia ao neutro sem perder os valores", () => {
    const { container } = withClip();
    chooseWorkspace("Cor");
    const panel = screen.getByText("Cor Lumetri ☰").parentElement;
    const saturation = within(panel).getAllByRole("slider").find((node) => node.closest("label")?.textContent.startsWith("Saturação"));
    fireEvent.change(saturation, { target: { value: "0" } });
    expect(programVideo(container).style.filter).toContain("saturate(0%)");
    const basic = within(panel).getByRole("switch", { name: "Ativar Correção básica" });
    expect(basic).toHaveAttribute("aria-checked", "true");
    fireEvent.click(basic);
    expect(basic).toHaveAttribute("aria-checked", "false");
    expect(programVideo(container).style.filter).toContain("saturate(100%)");
    expect(saturation).toHaveValue("0");
    fireEvent.click(basic);
    expect(programVideo(container).style.filter).toContain("saturate(0%)");
  });

  it("Criativo liga/desliga; seções sem efeito ficam desabilitadas", () => {
    render(<FilmCraftWorkspace />);
    chooseWorkspace("Cor");
    expect(screen.getByRole("switch", { name: "Ativar Correção básica" })).toBeDisabled();
    for (const name of ["Curvas", "Rodas de cor e correspondência", "HSL Secundário", "Vinheta"]) {
      const toggle = screen.getByRole("switch", { name: `Ativar ${name}` });
      expect(toggle).toBeDisabled();
      expect(toggle).toHaveAttribute("title", "Ainda não disponível");
    }
  });
});

describe("Som essencial — abas Procurar/Editar", () => {
  it("Editar atribui o tipo; Procurar mostra a contagem real por tipo", () => {
    withClip();
    chooseWorkspace("Áudio");
    const tabs = screen.getByRole("tablist", { name: "Som essencial" });
    expect(within(tabs).getByRole("tab", { name: "Editar" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("button", { name: /Música/ }));
    fireEvent.click(within(tabs).getByRole("tab", { name: "Procurar" }));
    expect(screen.queryByRole("button", { name: /Música/ })).toBeNull();
    expect(screen.getByText("Música").nextSibling).toHaveTextContent("1 clipe");
    expect(screen.getByText("Diálogo").nextSibling).toHaveTextContent("0 clipes");
  });
});

describe("Exportar — listas sem efeito ficam desabilitadas", () => {
  it("Ordem dos campos, Aspecto e Perfil mostram o valor real e não mudam", () => {
    render(<FilmCraftWorkspace />);
    fireEvent.click(within(document.querySelector(".mmfilm-project-header nav")).getByRole("button", { name: "Exportar" }));
    for (const [name, value] of [
      ["Ordem dos campos", "Progressivo"],
      ["Aspecto", "Pixels quadrados (1,0)"],
      ["Perfil", "Automático (navegador)"],
    ]) {
      const select = screen.getByRole("combobox", { name });
      expect(select).toBeDisabled();
      expect(select).toHaveAttribute("title", "Ainda não disponível");
      expect(select).toHaveValue(value);
    }
  });
});

describe("Patch de origem V — define a faixa de vídeo de inserção", () => {
  function importMedia(container) {
    const created = [];
    const original = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag, options) => {
      const element = original(tag, options);
      if (tag === "video") created.push(element);
      return element;
    });
    fireEvent.change(container.querySelector('input[accept="video/*,audio/*,image/*"]'), {
      target: { files: [new File(["v"], "Take.mp4", { type: "video/mp4" })] },
    });
    const probe = created.find((element) => element.preload === "metadata");
    Object.defineProperty(probe, "duration", { value: 5 });
    act(() => probe.onloadedmetadata());
    return screen.getByRole("button", { name: /Take\.mp4/ });
  }

  it("só uma faixa V fica com patch; Sobrescrever pela Origem coloca nela (áudio no A do patch)", () => {
    const { container } = render(<FilmCraftWorkspace />);
    const v1 = screen.getByRole("button", { name: "Patch de origem V1" });
    const v2 = screen.getByRole("button", { name: "Patch de origem V2" });
    expect(v1).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(v2);
    expect(v2).toHaveAttribute("aria-pressed", "true");
    expect(v1).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("combobox", { name: "Faixa de destino" })).toHaveValue("V2");
    const asset = importMedia(container);
    fireEvent.click(asset);
    fireEvent.click(screen.getByRole("button", { name: "Sobrescrever" }));
    expect(clipsOn(container, "V2")).toHaveLength(1);
    expect(clipsOn(container, "V1")).toHaveLength(0);
    expect(clipsOn(container, "A1")).toHaveLength(1);
  });

  it("a Faixa de destino da Origem troca o patch e Inserir usa essa faixa", () => {
    const { container } = render(<FilmCraftWorkspace />);
    fireEvent.change(screen.getByRole("combobox", { name: "Faixa de destino" }), { target: { value: "V3" } });
    expect(screen.getByRole("button", { name: "Patch de origem V3" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Patch de origem V1" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(importMedia(container));
    fireEvent.click(screen.getByRole("button", { name: "Inserir" }));
    expect(clipsOn(container, "V3")).toHaveLength(1);
    expect(clipsOn(container, "V1")).toHaveLength(0);
  });

  it("Direcionar V2 → Sobrescrever pela Origem cai em V2 (patch acompanha)", () => {
    const { container } = render(<FilmCraftWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Direcionar V2" }));
    expect(screen.getByRole("button", { name: "Patch de origem V2" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Patch de origem V1" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("combobox", { name: "Faixa de destino" })).toHaveValue("V2");
    fireEvent.click(importMedia(container));
    fireEvent.click(screen.getByRole("button", { name: "Sobrescrever" }));
    expect(clipsOn(container, "V2")).toHaveLength(1);
    expect(clipsOn(container, "V1")).toHaveLength(0);
  });

  it("mudar a Faixa de destino (ou o Patch V) move o destaque do Direcionar", () => {
    render(<FilmCraftWorkspace />);
    expect(screen.getByRole("button", { name: "Direcionar V1" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(screen.getByRole("combobox", { name: "Faixa de destino" }), { target: { value: "V3" } });
    expect(screen.getByRole("button", { name: "Direcionar V3" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Direcionar V1" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "Patch de origem V2" }));
    expect(screen.getByRole("button", { name: "Direcionar V2" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("Título sem faixa livre", () => {
  it("sobrescreve o trecho de baixo e avisa (Ctrl+Z desfaz)", async () => {
    const { container } = render(<FilmCraftWorkspace />);
    for (const track of ["V1", "V2", "V3"]) drop(container, { id: `m-${track}`, name: `Base ${track}`, track });
    fireEvent.click(screen.getByRole("button", { name: "Texto (T)" }));
    fireEvent.click(clipNamed(container, "Base V1"), { clientX: 2 * PX });
    const dialog = await screen.findByRole("dialog", { name: "Texto do título" });
    fireEvent.change(within(dialog).getByRole("textbox", { name: "Texto do título" }), { target: { value: "Placa" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "OK" }));
    expect(await screen.findByText(/sobrescreveu um trecho do clipe dessa faixa \(Ctrl\+Z desfaz\)/)).toBeInTheDocument();
    expect(clipNamed(container, "Placa", "V1")).toBeTruthy();
  });

  it("com faixa livre não fala em sobrescrever", async () => {
    await withTitle();
    expect(screen.queryByText(/sobrescreveu/)).toBeNull();
  });
});

describe("Montagem — Informações com valores reais", () => {
  const row = (label) => screen.getByText(label, { selector: "dt" }).nextSibling.textContent;

  it("sem seleção mostra a sequência; com clipe mostra o clipe", () => {
    const { container } = render(<FilmCraftWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "⌂" }));
    expect(screen.queryByText("Ícones livres")).toBeNull();
    expect(row("Sequência")).toBe("Sequência 01");
    expect(row("Clipes")).toBe("0");
    expect(row("Duração")).toBe("0,00 s");
    // Soltar a mídia seleciona o par: as linhas passam a ser do clipe.
    drop(container, { id: "a", name: "Cena", duration: 6 });
    expect(row("Clipe")).toBe("Cena");
    expect(row("Faixa")).toBe("V1");
    expect(row("Início")).toBe("0,00 s");
    expect(row("Fim")).toBe("6,00 s");
  });
});
