import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LightCraftWorkspace, PdfCraftWorkspace } from "./RemainingCraftWorkspaces";
import { parsePdfInfo } from "./pdfcraftParse";

const photos = [
  { id: "a", name: "Praia.jpg", type: "image/jpeg", url: "blob:a" },
  { id: "b", name: "Retrato.png", type: "image/png", url: "blob:b" },
  { id: "c", name: "Evento.jpg", type: "image/jpeg", url: "blob:c" },
];

function fakeContext() {
  return {
    drawImage: vi.fn(),
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4).fill(120) }),
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: vi.fn(),
  };
}

let contexts;
beforeEach(() => {
  contexts = [];
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => {
    const ctx = fakeContext();
    contexts.push(ctx);
    return ctx;
  });
  HTMLCanvasElement.prototype.toBlob = function toBlob(cb, type) {
    cb(new Blob(["x"], { type }));
  };
  HTMLCanvasElement.prototype.toDataURL = () => "data:image/jpeg;base64,eA==";
  window.Image = class {
    constructor() {
      this.naturalWidth = 8;
      this.naturalHeight = 6;
    }
    set src(value) {
      this._src = value;
      setTimeout(() => (value === "blob:broken" ? this.onerror?.() : this.onload?.()), 0);
    }
    get src() {
      return this._src;
    }
  };
  URL.createObjectURL = vi.fn(() => "blob:download");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.useRealTimers());

function Light({ initial = photos, onOpenFiles = vi.fn() }) {
  const [selected, setSelected] = useState(initial[0]);
  return (
    <LightCraftWorkspace assets={initial} selected={selected} onSelect={setSelected} onOpenFiles={onOpenFiles} />
  );
}
const slider = (name) => screen.getByText(name, { selector: "span" }).closest("label").querySelector("input");

describe("MMLight", () => {
  it("renders the edited preview through the pixel pipeline when sliders change", async () => {
    render(<Light />);
    await waitFor(() => expect(contexts.some((ctx) => ctx.putImageData.mock.calls.length)).toBe(true));
    const before = contexts.flatMap((ctx) => ctx.putImageData.mock.calls).at(-1)[0].data[0];
    fireEvent.change(slider("realces"), { target: { value: "-100" } });
    fireEvent.change(slider("sombras"), { target: { value: "100" } });
    const after = contexts.flatMap((ctx) => ctx.putImageData.mock.calls).at(-1)[0].data[0];
    expect(after).not.toBe(before);
    expect(slider("sombras")).toHaveValue("100");
  });

  it("keeps rating and settings per photo and synchronizes them to picked photos", async () => {
    render(<Light />);
    fireEvent.click(screen.getByLabelText("5 estrela(s)"));
    fireEvent.change(slider("claridade"), { target: { value: "55" } });
    fireEvent.click(screen.getByLabelText("Retrato.png"));
    expect(screen.getByLabelText("5 estrela(s)").querySelector("svg")).not.toHaveClass("fill-amber-400");
    expect(slider("claridade")).toHaveValue("8");
    fireEvent.click(screen.getByLabelText("Praia.jpg"));
    expect(screen.getByLabelText("5 estrela(s)").querySelector("svg")).toHaveClass("fill-amber-400");
    fireEvent.click(screen.getByText("Sincronizar ajustes"));
    expect(screen.getByRole("status")).toHaveTextContent(/Selecione outras fotos/);
    fireEvent.click(screen.getByLabelText("Retrato.png"), { ctrlKey: true });
    fireEvent.click(screen.getByText("Sincronizar ajustes"));
    expect(screen.getByRole("status")).toHaveTextContent("Ajustes sincronizados com 1 foto(s).");
    fireEvent.click(screen.getByLabelText("Retrato.png"));
    expect(slider("claridade")).toHaveValue("55");
  });

  it("filters the catalog by search, flag, rating and collections", () => {
    render(<Light />);
    fireEvent.change(screen.getByPlaceholderText("Pesquisar no catálogo"), { target: { value: "retr" } });
    expect(screen.queryByLabelText("Praia.jpg")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Retrato.png")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Pesquisar no catálogo"), { target: { value: "" } });
    fireEvent.click(screen.getByText("Bandeira"));
    fireEvent.click(screen.getByText("Fotos sinalizadas"));
    expect(screen.getByLabelText("Praia.jpg")).toBeInTheDocument();
    expect(screen.queryByLabelText("Evento.jpg")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Todas as fotografias"));
    const data = { getData: () => JSON.stringify(["c"]) };
    fireEvent.drop(screen.getByText("▸ Retratos", { exact: false }), { dataTransfer: data });
    fireEvent.click(screen.getByText("▸ Retratos", { exact: false }));
    expect(screen.getByLabelText("Evento.jpg")).toBeInTheDocument();
    expect(screen.queryByLabelText("Praia.jpg")).not.toBeInTheDocument();
  });

  it("dá nome acessível aos botões do catálogo, pastas e coleções", () => {
    render(<Light />);
    expect(screen.getByRole("button", { name: /^Todas as fotografias \(\d+\)$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Cinco estrelas \(\d+\)$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pasta Eventos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Coleção Retratos" })).toBeInTheDocument();
  });

  it("switches before, after and compare views", async () => {
    render(<Light />);
    fireEvent.click(screen.getByText("Antes"));
    expect(screen.getByAltText("Original")).toBeInTheDocument();
    expect(screen.queryByLabelText("Prévia revelada")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Comparar Y|Y"));
    expect(screen.getByAltText("Original")).toBeInTheDocument();
    expect(screen.getByLabelText("Prévia revelada")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Depois"));
    expect(screen.queryByAltText("Original")).not.toBeInTheDocument();
  });

  it("exports the developed photo as a real image file", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<Light />);
    fireEvent.click(screen.getByText("Exportar"));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Exportado: Praia-editada.jpg"));
    expect(click).toHaveBeenCalled();
    expect(URL.createObjectURL.mock.calls.at(-1)[0].type).toBe("image/jpeg");
  });

  it("reports undecodable RAW files instead of pretending", async () => {
    render(<Light initial={[{ id: "r", name: "x.dng", type: "image/x-adobe-dng", url: "blob:broken" }]} />);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/Não foi possível decodificar/));
    fireEvent.click(screen.getByText("Exportar"));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/Não foi possível exportar/));
  });

  it("creates local masks edited by the sliders and explains AI masks", () => {
    render(<Light />);
    fireEvent.click(screen.getByText("Céu"));
    expect(screen.getByRole("status")).toHaveTextContent(/segmentação por IA/);
    fireEvent.click(screen.getByText("Linear"));
    expect(screen.getByText("Linear")).toHaveAttribute("aria-pressed", "true");
    expect(slider("realces")).toHaveValue("0");
    fireEvent.change(slider("exposição"), { target: { value: "40" } });
    fireEvent.click(screen.getByText("Linear"));
    expect(slider("exposição")).toHaveValue("0");
    expect(slider("realces")).toHaveValue("-18");
    fireEvent.contextMenu(screen.getByText("Linear"));
    expect(screen.getByRole("status")).toHaveTextContent("Máscara Linear removida.");
  });

  it("module tabs change the view: library grid, slideshow and honest messages", () => {
    vi.useFakeTimers();
    render(<Light />);
    fireEvent.click(screen.getByText("Biblioteca"));
    expect(screen.getByAltText("Retrato.png")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Mapa"));
    expect(screen.getByRole("status")).toHaveTextContent(/GPS/);
    fireEvent.click(screen.getByText("Apresentação"));
    act(() => vi.advanceTimersByTime(3100));
    expect(screen.getByLabelText("Retrato.png")).toHaveClass("border-teal-400");
  });
});

const pdf = { id: "p", name: "Relatório.pdf", type: "application/pdf", url: "blob:pdf" };
function Pdf({ assets = [pdf] }) {
  const [selected, setSelected] = useState(assets[0] || null);
  return <PdfCraftWorkspace assets={assets} selected={selected} onSelect={setSelected} onOpenFiles={vi.fn()} />;
}
// O MMPDF usa diálogo próprio (window.prompt é bloqueado no painel embutido): responde e confirma.
async function answer(label, text) {
  const input = await screen.findByRole("textbox", { name: label });
  fireEvent.change(input, { target: { value: text } });
  await act(async () => {
    fireEvent.submit(screen.getByRole("dialog", { name: label }));
  });
}
const SAMPLE = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R /Outlines 6 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R >> endobj
4 0 obj << /Type /Page /Parent 2 0 R >> endobj
6 0 obj << /Type /Outlines /First 7 0 R /Count 1 >> endobj
7 0 obj << /Title (Conclus\\343o) /Parent 6 0 R /Dest [4 0 R /Fit] >> endobj
%%EOF`;

describe("MMPDF", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode(SAMPLE).buffer,
      blob: async () => new Blob([SAMPLE], { type: "application/pdf" }),
    }));
  });

  it("parses page count and bookmarks", () => {
    const info = parsePdfInfo(SAMPLE);
    expect(info.pages).toBe(2);
    expect(info.outline).toEqual([{ title: "Conclusão", page: 2 }]);
    expect(parsePdfInfo("nada").valid).toBe(false);
  });

  it("zooms and rotates the viewer and shows real page count", async () => {
    render(<Pdf />);
    await waitFor(() => expect(screen.getByText("Página 1 de 2")).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText("Aumentar zoom"));
    expect(screen.getByText("125%")).toBeInTheDocument();
    expect(screen.getByTestId("pdf-view").style.width).toBe("125%");
    fireEvent.click(screen.getByLabelText("Reduzir zoom"));
    fireEvent.click(screen.getByLabelText("Reduzir zoom"));
    expect(screen.getByText("75%")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Girar à direita"));
    expect(screen.getByTestId("pdf-view").style.transform).toBe("rotate(90deg)");
    fireEvent.click(screen.getByLabelText("Girar à esquerda"));
    expect(screen.getByTestId("pdf-view").style.transform).toBe("");
  });

  it("bookmarks tab navigates the viewer to the destination page", async () => {
    render(<Pdf />);
    fireEvent.click(screen.getByText("Marcadores"));
    fireEvent.click(await screen.findByText("▸ Conclusão"));
    expect(screen.getByText("Página 2 de 2")).toBeInTheDocument();
    expect(screen.getByTitle("Relatório.pdf").getAttribute("src")).toBe("blob:pdf#page=2");
  });

  it("adds, persists in state and removes annotations", async () => {
    vi.spyOn(window, "prompt").mockReturnValue(null);
    render(<Pdf />);
    fireEvent.click(screen.getByText("Comentar"));
    fireEvent.click(screen.getByText("Nota"));
    await answer("Texto da nota:", "Revisar este trecho");
    expect(window.prompt).not.toHaveBeenCalled();
    const layer = screen.getByTestId("pdf-annotation-layer");
    expect(layer.style.pointerEvents).toBe("auto");
    fireEvent.pointerDown(layer, { clientX: 0, clientY: 0 });
    expect(screen.getByText("Revisar este trecho")).toBeInTheDocument();
    expect(layer.style.pointerEvents).toBe("none");
    fireEvent.click(screen.getByText("Realçar"));
    fireEvent.pointerDown(layer, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(layer, { clientX: 0.5, clientY: 0.2 });
    fireEvent.pointerUp(layer);
    expect(layer.querySelector('[data-annotation="Realçar"]')).not.toBeNull();
    fireEvent.doubleClick(screen.getByText("Revisar este trecho"));
    expect(screen.queryByText("Revisar este trecho")).not.toBeInTheDocument();
  });

  it("adds a watermark and a signature", async () => {
    vi.spyOn(window, "prompt").mockReturnValue(null);
    render(<Pdf />);
    fireEvent.click(screen.getByText("Marca d'água"));
    expect(await screen.findByRole("textbox", { name: "Texto da marca d'água:" })).toHaveValue("CONFIDENCIAL");
    await answer("Texto da marca d'água:", "Alex Ferreira");
    expect(screen.getByTestId("pdf-annotation-layer").querySelector('[data-annotation="watermark"]')).toHaveTextContent("Alex Ferreira");
    fireEvent.click(screen.getByText("Preencher e assinar"));
    fireEvent.click(screen.getByText("Adicionar assinatura"));
    await answer("Nome para a assinatura:", "Alex Ferreira");
    fireEvent.pointerDown(screen.getByTestId("pdf-annotation-layer"), { clientX: 0, clientY: 0 });
    expect(screen.getByTestId("pdf-annotation-layer").querySelector('[data-annotation="signature"]')).toHaveTextContent("Alex Ferreira");
  });

  it("rejects non-http links", async () => {
    render(<Pdf />);
    fireEvent.click(screen.getByText("Criar link"));
    await answer("Endereço do link (https://…):", "javascript:alert(1)");
    expect(screen.getByRole("status")).toHaveTextContent(/Link inválido/);
  });

  it("todas as ferramentas de texto usam o diálogo próprio (prompt nativo bloqueado)", async () => {
    vi.spyOn(window, "prompt").mockReturnValue(null);
    render(<Pdf />);
    const layer = () => screen.getByTestId("pdf-annotation-layer");
    fireEvent.click(screen.getByText("Adicionar texto"));
    await answer("Texto a adicionar:", "  Parágrafo novo  ");
    fireEvent.pointerDown(layer(), { clientX: 0, clientY: 0 });
    expect(layer().querySelector('[data-annotation="text"]')).toHaveTextContent("Parágrafo novo");

    fireEvent.click(screen.getByText("Criar link"));
    await answer("Endereço do link (https://…):", "https://mediamind.test/doc");
    await answer("Texto do link:", "Ver documento");
    fireEvent.pointerDown(layer(), { clientX: 0, clientY: 0 });
    expect(screen.getByRole("link", { name: "Ver documento" })).toHaveAttribute("href", "https://mediamind.test/doc");

    fireEvent.click(screen.getByText("Cabeçalho e rodapé"));
    await answer("Texto do cabeçalho e rodapé:", "Confidencial 2026");
    expect(layer().querySelector('[data-annotation="headerfooter"]')).toHaveTextContent("Confidencial 2026");

    fireEvent.click(screen.getByText("Comentar"));
    fireEvent.click(screen.getByText("Carimbo"));
    await answer("Texto do carimbo:", "revisado");
    fireEvent.pointerDown(layer(), { clientX: 0, clientY: 0 });
    expect(layer().querySelector('[data-annotation="stamp"]')).toHaveTextContent("REVISADO");

    fireEvent.click(screen.getByText("Preencher e assinar"));
    fireEvent.click(screen.getByText("Adicionar iniciais"));
    await answer("Suas iniciais:", "AF");
    fireEvent.pointerDown(layer(), { clientX: 0, clientY: 0 });
    expect(layer().querySelector('[data-annotation="signature"]')).toHaveTextContent("AF");
    expect(window.prompt).not.toHaveBeenCalled();
  });

  it("cancelar o diálogo não arma ferramenta nem cria anotação", async () => {
    render(<Pdf />);
    fireEvent.click(screen.getByText("Adicionar texto"));
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByTestId("pdf-annotation-layer").style.pointerEvents).toBe("none");
  });

  it("modos têm ícones distintos e aria-pressed", () => {
    render(<Pdf />);
    const modes = ["Editar", "Comentar", "Organizar", "Preencher e assinar", "Proteger", "Exportar"];
    const buttons = modes.map((name) => screen.getByRole("button", { name }));
    const icon = (el) => [...el.querySelector("svg").classList].find((c) => c.startsWith("lucide-"));
    const icons = buttons.map(icon);
    expect(new Set([...icons, icon(screen.getByRole("button", { name: "Salvar cópia" }))]).size).toBe(modes.length + 1);
    expect(icons[1]).toBe("lucide-message-square");
    expect(icons[5]).toBe("lucide-file-output");
    expect(buttons[0]).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(buttons[5]);
    expect(buttons[5]).toHaveAttribute("aria-pressed", "true");
    expect(buttons[0]).toHaveAttribute("aria-pressed", "false");
  });

  it("saves a real copy of the PDF bytes", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<Pdf />);
    fireEvent.click(screen.getByText("Salvar cópia"));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Cópia do PDF salva."));
    expect(click).toHaveBeenCalled();
    expect(URL.createObjectURL.mock.calls.at(-1)[0].type).toBe("application/pdf");
  });

  it("says clearly when a tool needs an unavailable PDF engine", () => {
    render(<Pdf />);
    fireEvent.click(screen.getByText("Proteger"));
    fireEvent.click(screen.getByText("Criptografar com senha"));
    expect(screen.getByRole("status")).toHaveTextContent(/não está instalado/);
    fireEvent.click(screen.getByText("Organizar"));
    fireEvent.click(screen.getByText("Girar"));
    expect(screen.getByTestId("pdf-view").style.transform).toBe("rotate(90deg)");
  });

  it("asks to open a PDF when there is no document", () => {
    render(<Pdf assets={[]} />);
    fireEvent.click(screen.getByText("Salvar cópia"));
    expect(screen.getByRole("status")).toHaveTextContent("Abra um PDF primeiro.");
  });
});
