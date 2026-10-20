import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import VectorCraftWorkspace from "./VectorCraftWorkspace";

const SCALE = 0.72;
const at = (x, y, extra = {}) => ({ clientX: 100 + x * SCALE, clientY: 100 + y * SCALE, ...extra });

function setup() {
  let generatedId = 0;
  vi.stubGlobal("crypto", { randomUUID: () => `tool-object-${generatedId++}` });
  const view = render(
    <VectorCraftWorkspace assets={[]} selected={null} onSelect={vi.fn()} onOpenFiles={vi.fn()} />,
  );
  const artboard = screen.getByLabelText("Prancheta vetorial");
  vi.spyOn(artboard, "getBoundingClientRect").mockReturnValue({
    left: 100, top: 100, width: 820 * SCALE, height: 620 * SCALE, right: 100 + 820 * SCALE, bottom: 100 + 620 * SCALE, x: 100, y: 100, toJSON: () => {},
  });
  return { ...view, artboard };
}
const onCanvas = (name) => screen.getByRole("button", { name: `${name} na prancheta` });
const pickFromGroup = (group, name) => {
  fireEvent.click(screen.getByRole("button", { name: `Abrir grupo de ${group}` }));
  fireEvent.click(screen.getByRole("button", { name }));
};
const drag = (element, from, to, extra = {}) => {
  fireEvent.pointerDown(element, at(...from, extra));
  fireEvent.pointerMove(window, at(...to, extra));
  fireEvent.pointerUp(window, at(...to, extra));
};
const status = () => screen.getByRole("status").textContent;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("MMVector — ferramentas de forma", () => {
  it("desenha estrela, espiral e linha como caminhos SVG reais", () => {
    const { artboard } = setup();
    pickFromGroup("Retângulo", "Estrela");
    drag(artboard, [100, 100], [300, 300]);
    const star = onCanvas("Estrela 10");
    expect(star).toHaveStyle({ left: "100px", top: "100px", width: "200px", height: "200px" });
    expect(star.querySelector("path").getAttribute("d")).toMatch(/^M50 0 .* Z$/);

    pickFromGroup("Estrela", "Espiral");
    drag(artboard, [400, 100], [500, 200]);
    expect(onCanvas("Espiral 11").querySelector("path").getAttribute("fill")).toBe("none");

    pickFromGroup("Espiral", "Segmento de linha (\\)");
    drag(artboard, [100, 400], [300, 450]);
    const line = onCanvas("Linha 12");
    expect(line.querySelector("path").getAttribute("d")).toBe("M0 0 L200 50");
  }, 30000);
});

describe("MMVector — Caneta, Curvatura, Lápis, Pincel, Borracha e Laço", () => {
  const pathOf = (name) => onCanvas(name).querySelector("path").getAttribute("d");

  it("Caneta: cliques criam cantos, arraste cria alças Bézier e clique no primeiro ponto fecha", () => {
    const { artboard } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Caneta (P)" }));
    fireEvent.pointerDown(artboard, at(100, 100));
    fireEvent.pointerUp(window, at(100, 100));
    fireEvent.pointerDown(artboard, at(300, 100));
    fireEvent.pointerUp(window, at(300, 100));
    expect(pathOf("Traçado 10")).toBe("M0 0 L200 0");
    drag(artboard, [300, 300], [350, 300]);
    expect(pathOf("Traçado 10")).toMatch(/^M0 0 L200 0 C200 0 150 200 200 200$/);
    fireEvent.pointerDown(artboard, at(102, 101));
    fireEvent.pointerUp(window);
    const closed = pathOf("Traçado 10");
    expect(closed).toMatch(/ Z$/);
    expect(onCanvas("Traçado 10").querySelector("path").getAttribute("fill")).toBe("#22d3ee");

    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(pathOf("Traçado 10")).not.toMatch(/Z$/);
  }, 30000);

  it("Caneta: Enter conclui o caminho e o próximo clique inicia outro", () => {
    const { artboard } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Caneta (P)" }));
    for (const point of [[100, 100], [200, 150]]) {
      fireEvent.pointerDown(artboard, at(...point));
      fireEvent.pointerUp(window);
    }
    fireEvent.keyDown(window, { key: "Enter" });
    expect(status()).toBe("Caminho concluído.");
    fireEvent.pointerDown(artboard, at(400, 400));
    fireEvent.pointerUp(window);
    expect(pathOf("Traçado 10")).toBe("M0 0 L100 50");
    expect(pathOf("Traçado 11")).toBe("M0 0");
  }, 30000);

  it("Curvatura: pontos clicados viram curva suave", () => {
    const { artboard } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Curvatura (Shift+~)" }));
    for (const point of [[100, 300], [200, 100], [300, 300]]) {
      fireEvent.pointerDown(artboard, at(...point));
      fireEvent.pointerUp(window);
    }
    expect(pathOf("Traçado 10")).toMatch(/^M0 200 C.* C.* 200 200$/);
  }, 30000);

  it("Lápis segue o ponteiro e clique sem arrastar não cria objeto", () => {
    const { artboard } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Lápis (N)" }));
    fireEvent.pointerDown(artboard, at(100, 100));
    fireEvent.pointerUp(window);
    expect(screen.queryByRole("button", { name: "Traçado 10 na prancheta" })).not.toBeInTheDocument();
    fireEvent.pointerDown(artboard, at(100, 100));
    for (const point of [[150, 160], [200, 100], [250, 160], [300, 100]]) fireEvent.pointerMove(window, at(...point));
    fireEvent.pointerUp(window);
    expect(pathOf("Traçado 10")).toBe("M0 0 L50 60 L100 0 L150 60 L200 0");
    expect(onCanvas("Traçado 10")).toHaveStyle({ left: "100px", top: "100px" });
  }, 30000);

  it("Borracha apaga só a área arrastada: corta caminhos e mascara formas preenchidas", () => {
    const { artboard } = setup();
    pickFromGroup("Retângulo", "Segmento de linha (\\)");
    drag(artboard, [100, 100], [300, 100]);
    fireEvent.click(screen.getByRole("button", { name: "Borracha (Shift+E)" }));
    drag(artboard, [200, 80], [200, 120]);
    const line = pathOf("Linha 10");
    expect(line.match(/M/g)).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Seleção (V)" }));
    fireEvent.click(screen.getByRole("button", { name: "+ Retângulo" }));
    fireEvent.click(screen.getByRole("button", { name: "Borracha (Shift+E)" }));
    const rectangle = onCanvas("Retângulo 11");
    fireEvent.pointerDown(rectangle, at(250, 290));
    fireEvent.pointerMove(window, at(300, 290));
    fireEvent.pointerMove(window, at(350, 290));
    fireEvent.pointerUp(window);
    const erased = onCanvas("Retângulo 11");
    expect(erased.querySelector("mask")).not.toBeNull();
    expect(erased.querySelector("mask path").getAttribute("stroke-width")).toBe("20");
    expect(status()).toMatch(/apagado/);
  }, 30000);

  it("Laço com Alt sobre um objeto seleciona à mão livre sem mover", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Laço (Q)" }));
    const circle = onCanvas("Forma circular");
    fireEvent.pointerDown(circle, at(560, 200, { altKey: true }));
    for (const point of [[700, 200], [700, 330], [560, 330]]) fireEvent.pointerMove(window, at(...point, { altKey: true }));
    fireEvent.pointerUp(window);
    fireEvent.click(circle);
    expect(circle).toHaveStyle({ left: "530px", top: "170px" });
    expect(circle).toHaveClass("outline-orange-400");
    expect(status()).toBe("1 objeto(s) selecionado(s).");
  }, 30000);
});

describe("MMVector — desfazer/refazer", () => {
  it("desfaz e refaz pelo teclado e pelo menu Editar", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "+ Retângulo" }));
    expect(onCanvas("Retângulo 10")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(screen.queryByRole("button", { name: "Retângulo 10 na prancheta" })).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: "z", ctrlKey: true, shiftKey: true });
    expect(onCanvas("Retângulo 10")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Desfazer" }));
    expect(screen.queryByRole("button", { name: "Retângulo 10 na prancheta" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Refazer" }));
    expect(onCanvas("Retângulo 10")).toBeInTheDocument();
  }, 30000);

  it("ignora atalhos quando o MMVector está numa aba oculta ou o foco está em outra ferramenta", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "hidden-object" });
    const { rerender } = render(
      <div hidden><VectorCraftWorkspace assets={[]} selected={null} onSelect={vi.fn()} onOpenFiles={vi.fn()} /></div>,
    );
    fireEvent.keyDown(window, { key: "r" });
    expect(screen.getByRole("button", { name: "Seleção (V)", hidden: true })).toHaveClass("bg-[#202020]");
    rerender(
      <div>
        <button>Outra ferramenta</button>
        <VectorCraftWorkspace assets={[]} selected={null} onSelect={vi.fn()} onOpenFiles={vi.fn()} />
      </div>,
    );
    fireEvent.keyDown(screen.getByRole("button", { name: "Outra ferramenta" }), { key: "r" });
    expect(screen.getByRole("button", { name: "Seleção (V)" })).toHaveClass("bg-[#202020]");
    fireEvent.keyDown(window, { key: "r" });
    expect(screen.getByRole("button", { name: "Girar (R)" })).toHaveClass("bg-[#202020]");
  }, 30000);

  it("um arraste inteiro vira um único passo de histórico", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "+ Retângulo" }));
    const rectangle = onCanvas("Retângulo 10");
    fireEvent.pointerDown(rectangle, { clientX: 200, clientY: 200 });
    fireEvent.pointerMove(window, { clientX: 210, clientY: 200 });
    fireEvent.pointerMove(window, { clientX: 236, clientY: 218 });
    fireEvent.pointerUp(window);
    expect(rectangle).toHaveStyle({ left: "270px", top: "245px" });
    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(onCanvas("Retângulo 10")).toHaveStyle({ left: "220px", top: "220px" });
  }, 30000);
});

describe("MMVector — navegação", () => {
  it("Zoom aproxima com clique e afasta com Alt", () => {
    const { artboard } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Zoom (Z)" }));
    fireEvent.pointerDown(artboard, at(100, 100));
    expect(screen.getByText("100%")).toBeInTheDocument();
    fireEvent.pointerDown(artboard, at(100, 100, { altKey: true }));
    expect(screen.getByText("72%")).toBeInTheDocument();
  }, 30000);

  it("Mão desloca a área de rolagem", () => {
    const { artboard } = setup();
    const container = artboard.parentElement;
    let left = 200;
    let top = 100;
    Object.defineProperty(container, "scrollLeft", { configurable: true, get: () => left, set: (value) => { left = value; } });
    Object.defineProperty(container, "scrollTop", { configurable: true, get: () => top, set: (value) => { top = value; } });
    fireEvent.click(screen.getByRole("button", { name: "Mão (H)" }));
    fireEvent.pointerDown(artboard, { clientX: 300, clientY: 300 });
    fireEvent.pointerMove(window, { clientX: 250, clientY: 280 });
    fireEvent.pointerUp(window);
    expect(left).toBe(250);
    expect(top).toBe(120);
  }, 30000);
});

describe("MMVector — transformação", () => {
  it("Girar, Refletir, Escala e Inclinar alteram o objeto clicado", () => {
    setup();
    const circle = onCanvas("Forma circular");
    fireEvent.keyDown(window, { key: "r" });
    expect(screen.getByRole("button", { name: "Girar (R)" })).toHaveClass("bg-[#202020]");
    // centro do círculo: (622.5, 262.5)
    drag(circle, [722.5, 262.5], [622.5, 362.5]);
    expect(circle).toHaveStyle({ transform: "rotate(90deg)" });

    fireEvent.keyDown(window, { key: "o" });
    fireEvent.pointerDown(circle, at(622, 262));
    expect(circle.style.transform).toBe("rotate(90deg) scale(-1, 1)");

    fireEvent.keyDown(window, { key: "s" });
    drag(circle, [722.5, 262.5], [822.5, 262.5]);
    expect(circle).toHaveStyle({ width: "370px", height: "370px" });

    pickFromGroup("Escala", "Inclinar");
    fireEvent.pointerDown(circle, at(600, 300));
    fireEvent.pointerMove(window, at(700, 300));
    fireEvent.pointerUp(window);
    expect(circle.style.transform).toMatch(/skewX\(\d+deg\)/);
  }, 30000);

  it("botões de inverter, alinhar e incremento do teclado funcionam", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Prancheta 1" }));
    fireEvent.change(screen.getByLabelText("Incremento do teclado"), { target: { value: "5 px" } });
    fireEvent.click(screen.getByRole("button", { name: "Texto", expanded: false }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Novo texto" }));
    fireEvent.click(screen.getByRole("button", { name: "+ Retângulo" }));
    const rectangle = onCanvas("Retângulo 11");
    fireEvent.click(screen.getByTitle("Inverter horizontalmente"));
    expect(rectangle.style.transform).toBe("rotate(0deg) scale(-1, 1)");
    fireEvent.click(screen.getByTitle("Inverter verticalmente"));
    expect(rectangle.style.transform).toBe("rotate(0deg) scale(-1, -1)");

    fireEvent.click(screen.getByRole("button", { name: "Alinhar à esquerda" }));
    expect(rectangle).toHaveStyle({ left: "0px" });
    fireEvent.click(screen.getByRole("button", { name: "Alinhar à base" }));
    expect(rectangle).toHaveStyle({ top: "480px" });

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(rectangle).toHaveStyle({ left: "5px" });
    fireEvent.keyDown(window, { key: "ArrowRight", shiftKey: true });
    expect(rectangle).toHaveStyle({ left: "55px" });
  }, 30000);

  it("unidades do documento mudam a régua de informações", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Prancheta 1" }));
    fireEvent.change(screen.getByDisplayValue("Pixels"), { target: { value: "Pontos" } });
    expect(screen.getByText("L 615 pt")).toBeInTheDocument();
    expect(screen.getByText("A 465 pt")).toBeInTheDocument();
  }, 30000);
});

describe("MMVector — cor", () => {
  it("Gradiente aplica gradiente linear e Conta-gotas copia a aparência", () => {
    setup();
    const circle = onCanvas("Forma circular");
    fireEvent.keyDown(window, { key: "g" });
    fireEvent.pointerDown(circle, at(600, 250));
    fireEvent.pointerUp(window);
    expect(circle.style.background).toContain("linear-gradient");

    fireEvent.click(screen.getByRole("button", { name: "Seleção (V)" }));
    fireEvent.click(circle);
    fireEvent.keyDown(window, { key: "i" });
    fireEvent.pointerDown(onCanvas("Onda vetorial"), at(300, 450));
    expect(circle).toHaveStyle({ background: "#6366f1" });
    expect(status()).toContain("Onda vetorial");
  }, 30000);

  it("ferramenta sem implementação informa honestamente", () => {
    const { artboard } = setup();
    pickFromGroup("Gradiente", "Malha (U)");
    fireEvent.pointerDown(artboard, at(100, 100));
    expect(status()).toMatch(/ainda não está disponível/);
  }, 30000);
});

describe("MMVector — edição de caminhos", () => {
  it("Tesoura divide uma linha e Faca corta um retângulo", () => {
    const { artboard } = setup();
    pickFromGroup("Retângulo", "Segmento de linha (\\)");
    drag(artboard, [100, 100], [300, 100]);
    fireEvent.keyDown(window, { key: "c" });
    fireEvent.pointerDown(onCanvas("Linha 10"), at(200, 100));
    expect(onCanvas("Linha 10").querySelector("path").getAttribute("d")).toBe("M0 0 L100 0");
    expect(onCanvas("Linha 10 (parte)").querySelector("path").getAttribute("d")).toBe("M0 0 L100 0");

    fireEvent.click(screen.getByRole("button", { name: "Seleção (V)" }));
    fireEvent.click(screen.getByRole("button", { name: "+ Retângulo" }));
    pickFromGroup("Tesoura", "Faca");
    drag(artboard, [310, 200], [310, 400]);
    const left = onCanvas("Retângulo 12");
    const right = onCanvas("Retângulo 12 (parte)");
    expect(left).toHaveStyle({ left: "220px", width: "90px" });
    expect(right).toHaveStyle({ left: "310px", width: "90px" });
    expect(left.querySelector("path").getAttribute("d")).toMatch(/Z$/);
  }, 30000);

  it("Inflar converte a forma em caminho deformado", () => {
    const { artboard } = setup();
    fireEvent.click(screen.getByRole("button", { name: "+ Retângulo" }));
    pickFromGroup("Largura", "Inflar");
    drag(artboard, [225, 290], [226, 290]);
    const shape = onCanvas("Retângulo 10");
    expect(shape.querySelector("path")).not.toBeNull();
    expect(Number.parseFloat(shape.style.left)).toBeLessThan(220);
  }, 30000);

  it("Pathfinder: Unir combina dois objetos selecionados com Shift", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "+ Retângulo" }));
    fireEvent.click(screen.getByRole("button", { name: "+ Elipse" }));
    fireEvent.pointerDown(onCanvas("Retângulo 10"), { clientX: 10, clientY: 10, shiftKey: true });
    fireEvent.click(onCanvas("Retângulo 10"));
    fireEvent.click(screen.getByRole("button", { name: "Pathfinder" }));
    fireEvent.click(screen.getByRole("button", { name: "Unir" }));
    expect(screen.queryByRole("button", { name: "Retângulo 10 na prancheta" })).not.toBeInTheDocument();
    const compound = onCanvas("Forma composta 12");
    expect(compound.querySelector("path").getAttribute("fill-rule")).toBe("nonzero");
    fireEvent.click(screen.getByRole("button", { name: "Excluir sobreposição" }));
    expect(status()).toMatch(/dois ou mais/);
  }, 30000);

  it("ações rápidas: deslocar caminho, simplificar e trazer para frente", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "+ Retângulo" }));
    fireEvent.click(screen.getByRole("button", { name: "Deslocar caminho" }));
    expect(onCanvas("Retângulo 10 (deslocado)")).toHaveStyle({ left: "210px", top: "210px", width: "200px", height: "160px" });
    fireEvent.click(screen.getByRole("button", { name: "Simplificar" }));
    expect(status()).toMatch(/Expandir/);
    fireEvent.click(screen.getByRole("button", { name: "Expandir forma" }));
    expect(onCanvas("Retângulo 10").querySelector("path")).not.toBeNull();
  }, 30000);
});

describe("MMVector — arquivo", () => {
  function mockDownloads() {
    const blobs = [];
    const names = [];
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn((blob) => { blobs.push(blob); return `blob:${blobs.length}`; }), revokeObjectURL: vi.fn() }));
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function click() { names.push(this.download); });
    return { blobs, names };
  }

  it("Salvar baixa o documento JSON", async () => {
    const { blobs, names } = mockDownloads();
    setup();
    fireEvent.click(screen.getByRole("button", { name: /Salvar/ }));
    expect(names).toEqual(["documento.mmvector.json"]);
    const saved = JSON.parse(await blobs[0].text());
    expect(saved.schema).toBe("mmvector/v1");
    expect(saved.objects.some((object) => object.id === "circle")).toBe(true);
    expect(status()).toMatch(/documento\.mmvector\.json/);
  }, 30000);

  it("Exportar gera SVG real e PNG via canvas", async () => {
    const { blobs, names } = mockDownloads();
    class FakeImage {
      set src(value) { this._src = value; setTimeout(() => this.onload?.(), 0); }
      get src() { return this._src; }
    }
    vi.stubGlobal("Image", FakeImage);
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage });
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => callback(new Blob(["png"], { type: "image/png" })));
    setup();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Exportar/ }));
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(names).toEqual(["mmvector.svg", "mmvector.png"]);
    const svg = await blobs[0].text();
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg" width="820" height="620"');
    expect(svg).toContain("<ellipse");
    expect(svg).toContain("<tspan");
    expect(drawImage).toHaveBeenCalled();
    expect(status()).toMatch(/mmvector\.svg e mmvector\.png/);
  }, 30000);

  it("menu Objeto executa comandos reais", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "+ Retângulo" }));
    fireEvent.click(screen.getByRole("button", { name: "Objeto" }));
    const menu = screen.getByRole("menu", { name: "Menu Objeto" });
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Inverter verticalmente" }));
    expect(onCanvas("Retângulo 10").style.transform).toBe("rotate(0deg) scale(1, -1)");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Efeito" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Sombra projetada" }));
    expect(onCanvas("Retângulo 10").style.filter).toContain("drop-shadow");
  }, 30000);
});

describe("MMVector — painel Aparência flutuante", () => {
  it("começa fechado e abre pelo menu Janela", () => {
    localStorage.clear();
    setup();
    expect(screen.queryByRole("region", { name: "Aparência flutuante" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Janela" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Aparência flutuante" }));
    expect(screen.getByRole("region", { name: "Aparência flutuante" })).toBeInTheDocument();
  });
});
