import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DesignCraftWorkspace, { spreadLabels, spreadPages } from "./DesignCraftWorkspace";

const pdfApi = vi.hoisted(() => ({ instances: [] }));
vi.mock("jspdf", () => ({
  jsPDF: vi.fn(function jsPDF(options) {
    this.options = options;
    this.addPage = vi.fn();
    this.addImage = vi.fn();
    this.setFillColor = vi.fn();
    this.rect = vi.fn();
    this.setDrawColor = vi.fn();
    this.setLineWidth = vi.fn();
    this.line = vi.fn();
    this.save = vi.fn();
    pdfApi.instances.push(this);
  }),
}));
vi.mock("html2canvas", () => ({
  default: vi.fn(async () => ({ toDataURL: () => "data:image/jpeg;base64,eA==" })),
}));

beforeEach(() => {
  pdfApi.instances.length = 0;
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 460, height: 650, right: 460, bottom: 650, x: 0, y: 0 });
  URL.createObjectURL = vi.fn(() => "blob:download");
  URL.revokeObjectURL = vi.fn();
});

const pageEl = (key) => document.querySelector(`[data-page="${key}"]`);
const canvas = () => screen.getByTestId("design-canvas");
function drawOn(key, from, to, init = {}) {
  fireEvent.pointerDown(pageEl(key), { clientX: from[0], clientY: from[1], ...init });
  fireEvent.pointerMove(canvas(), { clientX: to[0], clientY: to[1] });
  fireEvent.pointerUp(canvas());
}
const tool = (name) => fireEvent.click(screen.getByTitle(new RegExp(`^${name} \\(`)));
const frames = (type) => document.querySelectorAll(`[data-frame-type="${type}"]`);

describe("MMDesign — barra de ferramentas", () => {
  it("cada ferramenta tem ícone próprio, aria-label e aria-pressed", () => {
    render(<DesignCraftWorkspace assets={[]} onOpenFiles={vi.fn()} />);
    const names = ["Seleção", "Seleção direta", "Texto", "Quadro", "Caneta", "Linha", "Mão", "Zoom"];
    const bar = within(screen.getByRole("complementary", { name: "Ferramentas do MMDesign" }));
    const buttons = names.map((name) => bar.getByRole("button", { name }));
    const icons = buttons.map((button) => [...button.querySelector("svg").classList].find((c) => c.startsWith("lucide-")));
    expect(new Set(icons).size).toBe(names.length);
    expect(icons[names.indexOf("Linha")]).toBe("lucide-minus");
    expect(icons[names.indexOf("Seleção direta")]).toBe("lucide-mouse-pointer-click");
    expect(buttons[0]).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(bar.getByRole("button", { name: "Linha" }));
    expect(bar.getByRole("button", { name: "Linha" })).toHaveAttribute("aria-pressed", "true");
    expect(buttons[0]).toHaveAttribute("aria-pressed", "false");
  });
});

describe("MMDesign", () => {
  it("computes spreads like InDesign", () => {
    expect(spreadLabels(8)).toEqual(["1", "2–3", "4–5", "6–7", "8"]);
    expect(spreadLabels(9)).toEqual(["1", "2–3", "4–5", "6–7", "8–9"]);
    expect(spreadPages("2–3")).toEqual(["2", "3"]);
  });

  it("draws rectangle and ellipse frames and edits them through controlled properties", () => {
    render(<DesignCraftWorkspace assets={[]} onOpenFiles={vi.fn()} />);
    tool("Quadro");
    drawOn("2", [46, 65], [138, 195]);
    expect(frames("rect")).toHaveLength(1);
    expect(screen.getByLabelText("X")).toHaveValue("21 mm");
    expect(screen.getByLabelText("Largura")).toHaveValue("42 mm");
    fireEvent.change(screen.getByLabelText("Largura"), { target: { value: "100" } });
    expect(frames("rect")[0].style.width).toBe(`${(100 / 210) * 100}%`);
    drawOn("3", [10, 10], [100, 100], { altKey: true });
    expect(frames("ellipse")).toHaveLength(1);
  });

  it("selection tool moves frames, direct selection resizes, Delete and undo work", () => {
    render(<DesignCraftWorkspace assets={[]} onOpenFiles={vi.fn()} />);
    tool("Quadro");
    drawOn("2", [0, 0], [92, 65]);
    tool("Seleção");
    fireEvent.pointerDown(frames("rect")[0], { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(canvas(), { clientX: 56, clientY: 75 });
    fireEvent.pointerUp(canvas());
    expect(screen.getByLabelText("X")).toHaveValue("21 mm");
    tool("Seleção direta");
    fireEvent.pointerDown(frames("rect")[0], { clientX: 60, clientY: 80 });
    fireEvent.pointerMove(canvas(), { clientX: 106, clientY: 80 });
    fireEvent.pointerUp(canvas());
    expect(screen.getByLabelText("Largura")).toHaveValue("63 mm");
    fireEvent.keyDown(canvas(), { key: "Delete" });
    expect(frames("rect")).toHaveLength(0);
    fireEvent.keyDown(canvas(), { key: "z", ctrlKey: true });
    expect(frames("rect")).toHaveLength(1);
  });

  it("creates and edits text frames, applying font, type presets and paragraph styles", () => {
    render(<DesignCraftWorkspace assets={[]} onOpenFiles={vi.fn()} />);
    tool("Texto");
    fireEvent.pointerDown(pageEl("3"), { clientX: 50, clientY: 50 });
    fireEvent.pointerUp(canvas());
    const text = frames("text")[0];
    expect(text).toHaveAttribute("contenteditable", "true");
    text.textContent = "Manchete";
    fireEvent.blur(text);
    expect(frames("text")[0]).toHaveTextContent("Manchete");
    fireEvent.change(screen.getByLabelText("Fonte"), { target: { value: "Montserrat" } });
    expect(frames("text")[0].style.fontFamily).toContain("Montserrat");
    fireEvent.click(screen.getByText("Regular · 12 pt"));
    expect(screen.getByText("Semibold · 18 pt")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Entrelinha 22 pt"));
    expect(screen.getByText("Entrelinha 18 pt")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Estilos"));
    fireEvent.click(screen.getByText("Título principal"));
    expect(frames("text")[0].style.fontWeight).toBe("900");
  });

  it("draws lines and pen paths, pans with the hand and zooms with the zoom tool", () => {
    render(<DesignCraftWorkspace assets={[]} onOpenFiles={vi.fn()} />);
    tool("Linha");
    drawOn("2", [0, 0], [100, 100]);
    expect(document.querySelectorAll("line[data-frame-id]")).toHaveLength(1);
    tool("Caneta");
    fireEvent.pointerDown(pageEl("3"), { clientX: 10, clientY: 10 });
    fireEvent.pointerDown(pageEl("3"), { clientX: 80, clientY: 40 });
    fireEvent.doubleClick(pageEl("3"));
    expect(document.querySelectorAll("polyline[data-frame-id]")).toHaveLength(1);
    tool("Mão");
    fireEvent.pointerDown(pageEl("2"), { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(canvas(), { clientX: 30, clientY: 20 });
    fireEvent.pointerUp(canvas());
    expect(pageEl("2").parentElement.style.transform).toBe("translate(30px, 20px) scale(0.58)");
    tool("Zoom");
    fireEvent.pointerDown(pageEl("2"), { clientX: 5, clientY: 5 });
    expect(screen.getByText("68%")).toBeInTheDocument();
  });

  it("adds pages, opens the master page and switches left tabs", () => {
    render(<DesignCraftWorkspace assets={[]} onOpenFiles={vi.fn()} />);
    fireEvent.click(screen.getByText("Adicionar página"));
    expect(screen.getByText("Publicação sem título · 9 páginas · RGB")).toBeInTheDocument();
    expect(screen.getByText("Páginas 8–9")).toBeInTheDocument();
    fireEvent.click(screen.getByText("A-Mestre"));
    expect(pageEl("A")).not.toBeNull();
    tool("Quadro");
    drawOn("A", [0, 0], [50, 50]);
    fireEvent.click(screen.getByText("4–5"));
    expect(pageEl("4").querySelector('[data-frame-type="rect"]')).not.toBeNull();
    fireEvent.click(screen.getByText("Camadas", { selector: "button" }));
    expect(screen.getByText(/Nenhum objeto criado/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Links"));
    expect(screen.getByText("Nenhuma imagem colocada.")).toBeInTheDocument();
  });

  it("hides canvas content of hidden layers", () => {
    render(<DesignCraftWorkspace assets={[]} onOpenFiles={vi.fn()} />);
    fireEvent.click(screen.getByText("Textos"));
    expect(screen.getByText("Conteúdo com estrutura").style.visibility).toBe("hidden");
  });

  it("places images from Recursos into the selected frame", () => {
    const assets = [{ id: "i", name: "Capa.jpg", type: "image/jpeg", url: "blob:capa" }];
    render(<DesignCraftWorkspace assets={assets} onOpenFiles={vi.fn()} />);
    tool("Quadro");
    drawOn("2", [0, 0], [92, 65]);
    fireEvent.click(screen.getByText("Recursos"));
    fireEvent.click(screen.getByText("Capa.jpg"));
    expect(frames("rect")[0].querySelector("img")).toHaveAttribute("src", "blob:capa");
    expect(screen.getByText("1 vínculos")).toBeInTheDocument();
  });

  it("menubar runs real commands", () => {
    render(<DesignCraftWorkspace assets={[]} onOpenFiles={vi.fn()} />);
    fireEvent.click(screen.getByText("Layout"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Adicionar página" }));
    expect(screen.getByText(/9 páginas/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Editar"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Desfazer" }));
    expect(screen.getByText(/8 páginas/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Tabela"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Inserir tabela" }));
    expect(screen.getByRole("status")).toHaveTextContent(/não estão disponíveis/);
  });

  it("saves the publication as a real JSON file and reopens it", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<DesignCraftWorkspace assets={[]} onOpenFiles={vi.fn()} />);
    tool("Quadro");
    drawOn("2", [0, 0], [92, 65]);
    fireEvent.click(screen.getByText("Salvar"));
    await waitFor(() => expect(click).toHaveBeenCalled());
    const blob = URL.createObjectURL.mock.calls.at(-1)[0];
    const saved = JSON.parse(await blob.text());
    expect(saved.schema).toBe("mm-design/v1");
    expect(saved.frames["2"]).toHaveLength(1);
    fireEvent.keyDown(canvas(), { key: "Delete" });
    const file = new File([JSON.stringify(saved)], "pub.mmdesign.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText("Abrir publicação"), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Publicação aberta"));
    fireEvent.click(screen.getByText("2–3"));
    expect(frames("rect")).toHaveLength(1);
  });

  it("rejects invalid publication files without changing the document", async () => {
    render(<DesignCraftWorkspace assets={[]} onOpenFiles={vi.fn()} />);
    const file = new File(["{\"schema\":\"x\"}"], "bad.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText("Abrir publicação"), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("inválido"));
    expect(screen.getByText(/8 páginas/)).toBeInTheDocument();
  });

  it("publishes a real PDF with jsPDF using export options", async () => {
    render(<DesignCraftWorkspace assets={[]} onOpenFiles={vi.fn()} />);
    fireEvent.click(screen.getByText("Páginas", { selector: "span" }));
    expect(screen.getByText("Atual ▾")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Publicar PDF"));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("PDF publicado: 2 página(s), sangria 3 mm."));
    const pdf = pdfApi.instances.at(-1);
    expect(pdf.options.format).toEqual([228, 315]);
    expect(pdf.addPage).toHaveBeenCalledTimes(1);
    expect(pdf.addImage).toHaveBeenCalledTimes(2);
    expect(pdf.line).toHaveBeenCalled();
    expect(pdf.save).toHaveBeenCalledWith("publicacao-mediamind.pdf");
    fireEvent.click(screen.getByText("Cor", { selector: "span" }));
    expect(screen.getByRole("status")).toHaveTextContent(/CMYK não está disponível/);
  });
});
