import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FigCraftWorkspace, { baseNode, createDocument, exportSvgMarkup, layoutFrame, normalize, sanitizeDocument } from "./FigCraftWorkspace";
import { GraphicDraftProvider } from "../../lib/graphicDrafts";

// Vista inicial: zoom 0.5 com deslocamento (80, 80). Tela (x, y) => mundo ((x - 80) * 2, (y - 80) * 2).
const canvas = () => screen.getByLabelText("Canvas do MMFig");
function drag(el, from, to, init = {}) {
  fireEvent.pointerDown(el, { clientX: from[0], clientY: from[1], button: 0, pointerId: 1, ...init });
  fireEvent.pointerMove(window, { clientX: (from[0] + to[0]) / 2, clientY: (from[1] + to[1]) / 2, pointerId: 1, ...init });
  fireEvent.pointerMove(window, { clientX: to[0], clientY: to[1], pointerId: 1, ...init });
  fireEvent.pointerUp(window, { clientX: to[0], clientY: to[1], pointerId: 1, ...init });
}
function draw(toolLabel, from, to) {
  fireEvent.click(screen.getByRole("button", { name: toolLabel }));
  drag(canvas(), from, to);
}
const value = (label) => Number(screen.getByLabelText(label).value);
const nodeEls = () => [...canvas().querySelectorAll("[data-node-id]")];
const layerNames = () => within(screen.getByRole("tree", { name: "Camadas" })).getAllByRole("button", { name: /^Camada / }).map((b) => b.textContent);
const key = (k, init = {}) => fireEvent.keyDown(canvas(), { key: k, ...init });

describe("MMFig", () => {
  it("creates shapes with the toolbar tools and lists them as layers", () => {
    render(<FigCraftWorkspace />);
    draw("Retângulo (R)", [180, 180], [230, 230]);
    expect(screen.getByRole("button", { name: "Camada Retângulo 1" })).toBeInTheDocument();
    expect(value("Posição X")).toBe(200);
    expect(value("Largura")).toBe(100);
    expect(screen.getByRole("button", { name: "Mover (V)" })).toHaveAttribute("aria-pressed", "true");
    draw("Elipse (O)", [300, 180], [340, 220]);
    draw("Seta (Shift+L)", [100, 400], [200, 400]);
    fireEvent.click(screen.getByRole("button", { name: "Texto (T)" }));
    fireEvent.pointerDown(canvas(), { clientX: 400, clientY: 400, button: 0 });
    const editor = screen.getByLabelText("Editar texto");
    fireEvent.change(editor, { target: { value: "Olá MMFig" } });
    fireEvent.blur(editor);
    expect(layerNames()).toEqual(["Olá MMFig", "Seta 1", "Elipse 1", "Retângulo 1"]);
  });

  it("moves, resizes with handles, deletes and undoes/redoes", () => {
    render(<FigCraftWorkspace />);
    draw("Retângulo (R)", [180, 180], [230, 230]);
    drag(nodeEls()[0], [200, 200], [250, 225]);
    expect(value("Posição X")).toBe(300);
    expect(value("Posição Y")).toBe(250);
    drag(screen.getByLabelText("Redimensionar se"), [280, 280], [305, 330]);
    expect(value("Largura")).toBe(150);
    expect(value("Altura")).toBe(200);
    drag(screen.getByLabelText("Redimensionar nw"), [205, 205], [215, 215]);
    expect(value("Posição X")).toBe(320);
    expect(value("Largura")).toBe(130);
    key("z", { ctrlKey: true });
    expect(value("Largura")).toBe(150);
    key("z", { ctrlKey: true });
    key("z", { ctrlKey: true });
    expect(value("Posição X")).toBe(200);
    key("z", { ctrlKey: true, shiftKey: true });
    expect(value("Posição X")).toBe(300);
    key("Delete");
    expect(screen.queryByRole("button", { name: "Camada Retângulo 1" })).not.toBeInTheDocument();
    key("z", { ctrlKey: true });
    expect(screen.getByRole("button", { name: "Camada Retângulo 1" })).toBeInTheDocument();
  });

  it("selects with shift and marquee, groups with Ctrl+G and ungroups", () => {
    render(<FigCraftWorkspace />);
    draw("Retângulo (R)", [180, 180], [200, 200]);
    draw("Elipse (O)", [260, 180], [280, 200]);
    drag(canvas(), [500, 500], [500, 500]);
    expect(screen.getByText("Frames predefinidos")).toBeInTheDocument();
    drag(canvas(), [150, 150], [300, 260]);
    expect(screen.getByText("2 camadas selecionadas")).toBeInTheDocument();
    key("g", { ctrlKey: true });
    expect(screen.getByRole("button", { name: "Camada Grupo 1" })).toBeInTheDocument();
    expect(value("Posição X")).toBe(200);
    expect(value("Largura")).toBe(200);
    key("g", { ctrlKey: true, shiftKey: true });
    expect(screen.queryByRole("button", { name: "Camada Grupo 1" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Camada Retângulo 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Camada Elipse 1" }), { shiftKey: true });
    expect(screen.getByText("2 camadas selecionadas")).toBeInTheDocument();
  });

  it("renames, hides, locks and reorders layers", () => {
    render(<FigCraftWorkspace />);
    draw("Retângulo (R)", [180, 180], [200, 200]);
    draw("Retângulo (R)", [260, 180], [280, 200]);
    fireEvent.doubleClick(screen.getByRole("button", { name: "Camada Retângulo 1" }));
    const input = screen.getByLabelText("Renomear camada Retângulo 1");
    fireEvent.change(input, { target: { value: "Fundo" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(layerNames()).toEqual(["Retângulo 2", "Fundo"]);
    const rows = screen.getAllByRole("treeitem");
    fireEvent.dragStart(rows[1]);
    fireEvent.drop(rows[0], { clientY: 2 });
    expect(layerNames()).toEqual(["Fundo", "Retângulo 2"]);
    fireEvent.click(screen.getByRole("button", { name: "Camada Fundo" }));
    key("[", { ctrlKey: true, code: "BracketLeft" });
    expect(layerNames()).toEqual(["Retângulo 2", "Fundo"]);
    fireEvent.click(screen.getByRole("button", { name: "Ocultar Fundo" }));
    expect(nodeEls()).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Mostrar Fundo" }));
    fireEvent.click(screen.getByRole("button", { name: "Bloquear Fundo" }));
    expect(screen.getByRole("button", { name: "Desbloquear Fundo" })).toBeInTheDocument();
    expect(nodeEls().find((el) => el.style.pointerEvents === "none")).toBeTruthy();
  });

  it("copies, pastes and duplicates layers", () => {
    render(<FigCraftWorkspace />);
    draw("Retângulo (R)", [180, 180], [200, 200]);
    key("c", { ctrlKey: true });
    key("v", { ctrlKey: true });
    expect(screen.getAllByRole("button", { name: "Camada Retângulo 1" })).toHaveLength(2);
    expect(value("Posição X")).toBe(220);
    key("d", { ctrlKey: true });
    expect(screen.getAllByRole("button", { name: "Camada Retângulo 1" })).toHaveLength(3);
    expect(value("Posição X")).toBe(240);
  });

  it("applies auto layout to a frame and recomputes children positions", () => {
    render(<FigCraftWorkspace />);
    draw("Frame (F)", [100, 100], [400, 300]);
    draw("Retângulo (R)", [120, 120], [145, 145]);
    draw("Retângulo (R)", [200, 120], [240, 160]);
    expect(layerNames()).toEqual(["Frame 1", "Retângulo 2", "Retângulo 1"]);
    fireEvent.click(screen.getByRole("button", { name: "Camada Frame 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar auto layout" }));
    expect(value("Largura")).toBe(160);
    expect(value("Altura")).toBe(100);
    fireEvent.change(screen.getByLabelText("Espaçamento entre itens"), { target: { value: "20" } });
    expect(value("Largura")).toBe(170);
    fireEvent.click(screen.getByRole("button", { name: "Camada Retângulo 2" }));
    expect(value("Posição X")).toBe(80);
    expect(screen.getByLabelText("Posição X")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Camada Frame 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Direção vertical" }));
    fireEvent.click(screen.getByRole("button", { name: "Camada Retângulo 2" }));
    expect(value("Posição X")).toBe(10);
    expect(value("Posição Y")).toBe(80);
  });

  it("keeps instances in sync with their main component", () => {
    render(<FigCraftWorkspace />);
    draw("Retângulo (R)", [180, 180], [200, 200]);
    fireEvent.click(screen.getByRole("button", { name: "Criar componente" }));
    expect(screen.getByRole("button", { name: "Camada Componente 1" })).toBeInTheDocument();
    key("d", { ctrlKey: true });
    expect(screen.getByText("Instância de Componente 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Largura")).toBeDisabled();
    fireEvent.click(screen.getAllByRole("button", { name: "Camada Retângulo 1" })[0]);
    const hex = screen.getByLabelText("Hex do preenchimento");
    fireEvent.change(hex, { target: { value: "FF0000" } });
    fireEvent.blur(hex);
    expect(canvas().querySelectorAll('rect[fill="#FF0000"]')).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: "Camada Componente 1" })[1]);
    fireEvent.change(screen.getByLabelText("Largura"), { target: { value: "90" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Camada Componente 1" })[0]);
    expect(value("Largura")).toBe(90);
    fireEvent.click(screen.getByRole("button", { name: "Desanexar instância" }));
    expect(screen.queryByText("Instância de Componente 1")).not.toBeInTheDocument();
  });

  it("overrides instance text and inserts instances from Assets", () => {
    render(<FigCraftWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Texto (T)" }));
    fireEvent.pointerDown(canvas(), { clientX: 200, clientY: 200, button: 0 });
    fireEvent.change(screen.getByLabelText("Editar texto"), { target: { value: "Botão" } });
    fireEvent.blur(screen.getByLabelText("Editar texto"));
    key("k", { ctrlKey: true, altKey: true });
    fireEvent.click(screen.getByRole("tab", { name: "Assets" }));
    fireEvent.click(screen.getByRole("button", { name: "Inserir instância de Componente 1" }));
    fireEvent.change(screen.getByLabelText("Texto de Botão"), { target: { value: "Enviar" } });
    expect(canvas().textContent).toContain("Enviar");
    expect(canvas().textContent).toContain("Botão");
  });

  it("links frames with interactions and navigates in the presentation", () => {
    render(<FigCraftWorkspace />);
    draw("Frame (F)", [100, 100], [200, 200]);
    draw("Frame (F)", [300, 100], [400, 200]);
    fireEvent.click(screen.getByRole("button", { name: "Camada Frame 1" }));
    fireEvent.click(screen.getByRole("tab", { name: "Protótipo" }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar interação" }));
    expect(screen.getByLabelText("Destino da interação")).toHaveDisplayValue("Frame 2");
    fireEvent.change(screen.getByLabelText("Transição"), { target: { value: "dissolve" } });
    expect(canvas().querySelector('[aria-label="Conexão de Frame 1 para Frame 2"]')).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Apresentar" })[0]);
    const dialog = screen.getByRole("dialog", { name: "Apresentação do protótipo" });
    expect(within(dialog).getByLabelText("Tela Frame 1")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Interação: Frame 1" }));
    expect(within(dialog).getByLabelText("Tela Frame 2")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Voltar" }));
    expect(within(dialog).getByLabelText("Tela Frame 1")).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("creates frames from device presets", () => {
    render(<FigCraftWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Criar frame iPhone 14" }));
    expect(screen.getByRole("button", { name: "Camada iPhone 14 1" })).toBeInTheDocument();
    expect(value("Largura")).toBe(390);
    expect(value("Altura")).toBe(844);
    expect(screen.getByLabelText("Predefinição do frame")).toHaveValue("iphone14");
    fireEvent.change(screen.getByLabelText("Predefinição do frame"), { target: { value: "desktop" } });
    expect(value("Largura")).toBe(1440);
  });

  it("applies constraints when a frame is resized", () => {
    render(<FigCraftWorkspace />);
    draw("Frame (F)", [100, 100], [200, 200]);
    draw("Retângulo (R)", [170, 110], [190, 130]);
    fireEvent.change(screen.getByLabelText("Restrição horizontal"), { target: { value: "right" } });
    expect(value("Posição X")).toBe(140);
    fireEvent.click(screen.getByRole("button", { name: "Camada Frame 1" }));
    fireEvent.change(screen.getByLabelText("Largura"), { target: { value: "300" } });
    fireEvent.click(screen.getByRole("button", { name: "Camada Retângulo 1" }));
    expect(value("Posição X")).toBe(240);
  });

  it("pans with the hand tool and zooms with the toolbar", () => {
    render(<FigCraftWorkspace />);
    expect(screen.getByLabelText("Zoom atual")).toHaveTextContent("50%");
    fireEvent.click(screen.getByRole("button", { name: "Aumentar zoom" }));
    expect(screen.getByLabelText("Zoom atual")).toHaveTextContent("63%");
    fireEvent.click(screen.getByRole("button", { name: "Mão (H)" }));
    const svgGroup = canvas().querySelector("svg > g");
    const before = svgGroup.getAttribute("transform");
    drag(canvas(), [100, 100], [160, 130]);
    expect(canvas().querySelector("svg > g").getAttribute("transform")).not.toBe(before);
    fireEvent.wheel(canvas(), { deltaY: -100, ctrlKey: true, clientX: 300, clientY: 300 });
    expect(screen.getByLabelText("Zoom atual")).not.toHaveTextContent("63%");
  });

  it("adds a page and a comment", () => {
    render(<FigCraftWorkspace />);
    fireEvent.click(screen.getByRole("tab", { name: "Páginas" }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar página" }));
    expect(screen.getByRole("button", { name: "Página Página 2" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Comentário (C)" }));
    fireEvent.pointerDown(canvas(), { clientX: 300, clientY: 300, button: 0 });
    fireEvent.change(screen.getByLabelText("Texto do comentário"), { target: { value: "Ajustar margem" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar comentário" }));
    expect(screen.getByRole("button", { name: "Comentário 1" })).toHaveAttribute("title", "Ajustar margem");
  });

  it("runs commands from the menubar", () => {
    render(<FigCraftWorkspace />);
    draw("Retângulo (R)", [180, 180], [200, 200]);
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Duplicar/ }));
    expect(screen.getAllByRole("button", { name: "Camada Retângulo 1" })).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Desfazer/ }));
    expect(screen.getAllByRole("button", { name: "Camada Retângulo 1" })).toHaveLength(1);
  });
});

describe("MMFig export and project files", () => {
  let blobs;
  class FakeImage {
    set src(value) {
      this.current = value;
      setTimeout(() => this.onload?.(), 0);
    }
    get src() {
      return this.current;
    }
  }
  beforeEach(() => {
    blobs = [];
    URL.createObjectURL = vi.fn((blob) => {
      blobs.push(blob);
      return "blob:mmfig";
    });
    URL.revokeObjectURL = vi.fn();
    vi.stubGlobal("Image", FakeImage);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ({ scale: vi.fn(), drawImage: vi.fn() }));
    HTMLCanvasElement.prototype.toBlob = function toBlob(callback, type) {
      callback(new Blob(["png"], { type }));
    };
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete URL.createObjectURL;
    delete URL.revokeObjectURL;
    delete HTMLCanvasElement.prototype.toBlob;
  });

  it("exports the selection as PNG and SVG files", async () => {
    render(<FigCraftWorkspace />);
    draw("Retângulo (R)", [180, 180], [230, 230]);
    fireEvent.change(screen.getByLabelText("Escala de exportação"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Exportar Retângulo 1" }));
    await waitFor(() => expect(blobs).toHaveLength(1));
    expect(blobs[0].type).toBe("image/png");
    expect(screen.getByRole("status", { name: "Mensagens do MMFig" })).toHaveTextContent("retangulo-1@2x.png");
    expect(screen.getByRole("status", { name: "Mensagens do MMFig" })).toHaveTextContent("200×200");
    fireEvent.change(screen.getByLabelText("Formato de exportação"), { target: { value: "svg" } });
    fireEvent.click(screen.getByRole("button", { name: "Exportar Retângulo 1" }));
    await waitFor(() => expect(blobs).toHaveLength(2));
    expect(blobs[1].type).toBe("image/svg+xml");
    const svg = await blobs[1].text();
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"');
    expect(svg).toContain('fill="#D9D9D9"');
    expect(svg).not.toContain("data-node-id");
  });

  it("reports PNG failures instead of pretending success", async () => {
    HTMLCanvasElement.prototype.toBlob = function toBlob(callback) {
      callback(null);
    };
    render(<FigCraftWorkspace />);
    draw("Retângulo (R)", [180, 180], [230, 230]);
    fireEvent.click(screen.getByRole("button", { name: "Exportar Retângulo 1" }));
    await waitFor(() => expect(screen.getByRole("status", { name: "Mensagens do MMFig" })).toHaveTextContent("Falha ao exportar"));
    expect(blobs).toHaveLength(0);
  });

  it("downloads the project as JSON and imports it back", async () => {
    const first = render(<FigCraftWorkspace />);
    draw("Retângulo (R)", [180, 180], [230, 230]);
    fireEvent.click(screen.getByRole("button", { name: "Baixar projeto" }));
    const json = await blobs[0].text();
    expect(JSON.parse(json).schema).toBe("mmfig/v1");
    first.unmount();
    render(<FigCraftWorkspace />);
    expect(screen.queryByRole("tree", { name: "Camadas" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Abrir projeto MMFig"), { target: { files: [new File([json], "p.mmfig.json", { type: "application/json" })] } });
    expect(await screen.findByRole("button", { name: "Camada Retângulo 1" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Abrir projeto MMFig"), { target: { files: [new File(["{nope"], "x.json", { type: "application/json" })] } });
    await waitFor(() => expect(screen.getByRole("status", { name: "Mensagens do MMFig" })).toHaveTextContent("Não foi possível importar"));
    expect(screen.getByRole("button", { name: "Camada Retângulo 1" })).toBeInTheDocument();
  });

  it("persists the project in the graphic draft store across remounts", async () => {
    const saved = new Map();
    vi.stubGlobal("indexedDB", {
      open: () => {
        const request = {};
        queueMicrotask(() => {
          request.result = {
            close() {},
            transaction: () => {
              const transaction = {
                objectStore: () => ({
                  get: (k) => {
                    const get = {};
                    queueMicrotask(() => {
                      get.result = saved.get(k);
                      get.onsuccess();
                    });
                    return get;
                  },
                  put: (v, k) => {
                    saved.set(k, v);
                    queueMicrotask(() => transaction.oncomplete());
                  },
                }),
              };
              return transaction;
            },
          };
          request.onsuccess();
        });
        return request;
      },
    });
    const first = render(<GraphicDraftProvider scope="empresa:usuario"><FigCraftWorkspace /></GraphicDraftProvider>);
    await screen.findByLabelText("Canvas do MMFig");
    draw("Retângulo (R)", [180, 180], [230, 230]);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
    });
    await screen.findByText("Rascunho salvo neste navegador");
    first.unmount();
    render(<GraphicDraftProvider scope="empresa:usuario"><FigCraftWorkspace /></GraphicDraftProvider>);
    expect(await screen.findByRole("button", { name: "Camada Retângulo 1" })).toBeInTheDocument();
  });
});

describe("MMFig model", () => {
  it("lays out auto layout children with padding, gap and alignment", () => {
    const doc = createDocument();
    const pageId = doc.pages[0].id;
    const frame = baseNode("frame", { w: 300, h: 200 });
    frame.autoLayout = { ...frame.autoLayout, on: true, hugW: false, hugH: false, justify: "center", align: "end" };
    const a = baseNode("rect", { w: 40, h: 40, parentId: frame.id });
    const b = baseNode("rect", { w: 60, h: 20, parentId: frame.id });
    frame.children = [a.id, b.id];
    Object.assign(doc.nodes, { [frame.id]: frame, [a.id]: a, [b.id]: b });
    doc.roots[pageId] = [frame.id];
    layoutFrame(doc, frame);
    expect([a.x, a.y, b.x, b.y]).toEqual([95, 150, 145, 170]);
  });

  it("rejects invalid project files and drops cycles and unsafe values", () => {
    expect(() => sanitizeDocument({ schema: "outro" })).toThrow(/mmfig\/v1/);
    const doc = createDocument();
    const pageId = doc.pages[0].id;
    const frame = baseNode("frame", { id: "f1", children: ["r1", "f1"], fill: { on: true, color: "url(javascript:alert(1))" } });
    const rect = baseNode("rect", { id: "r1", proto: { action: "url", url: "javascript:alert(1)" } });
    doc.nodes = { f1: frame, r1: rect, orphan: baseNode("rect", { id: "orphan" }) };
    doc.roots[pageId] = ["f1"];
    const clean = sanitizeDocument({ schema: "mmfig/v1", document: doc });
    expect(Object.keys(clean.nodes).sort()).toEqual(["f1", "r1"]);
    expect(clean.nodes.f1.children).toEqual(["r1"]);
    expect(clean.nodes.f1.fill.color).toBe("#FFFFFF");
    expect(clean.nodes.r1.proto.url).toBe("");
  });

  it("exports nested nodes with their absolute placement", () => {
    const doc = createDocument();
    const pageId = doc.pages[0].id;
    const frame = baseNode("frame", { id: "f", x: 100, y: 50, w: 200, h: 200 });
    const rect = baseNode("rect", { id: "r", x: 10, y: 20, w: 30, h: 40, parentId: "f" });
    frame.children = ["r"];
    doc.nodes = { f: frame, r: rect };
    doc.roots[pageId] = ["f"];
    normalize(doc);
    const { markup, width, height } = exportSvgMarkup(doc, ["r"]);
    expect([width, height]).toEqual([30, 40]);
    expect(markup).toContain('viewBox="110 70 30 40"');
    expect(markup).toContain("matrix(1 0 0 1 100 50)");
  });
});
