import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import FilmCraftWorkspace from "./FilmCraftWorkspace";

// Zoom padrão da timeline: 12 px por segundo; no jsdom as faixas começam em x = 0.
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
// No jsdom o DragEvent não carrega clientX: a mídia solta cai no indicador, então posicionamos o indicador antes
// (clique na régua, que no jsdom começa em x = 0).
function movePlayhead(seconds) {
  const ruler = document.querySelector("[data-timeline-ruler]");
  fireEvent.pointerDown(ruler, { clientX: seconds * PX, button: 0 });
  fireEvent.pointerUp(window, { clientX: seconds * PX });
}
// Mídias fora do Monitor de Origem entram inteiras na timeline (8 s por padrão nestes testes).
function drop(container, { id, name, seconds, duration = 8, track = "V1", kind = "video" }) {
  movePlayhead(seconds);
  const payload = { id, name, kind, src: `/api/v1/media/assets/${id}/stream`, duration, mimeType: kind === "audio" ? "audio/mpeg" : "video/mp4" };
  fireEvent.drop(lane(container, track), {
    clientX: seconds * PX,
    dataTransfer: { getData: (type) => (type === "application/x-timeline2-media" ? JSON.stringify(payload) : "") },
  });
}
// O MMFilm usa um diálogo próprio no lugar de window.prompt (bloqueado em painéis embutidos).
async function answerPrompt(label, value) {
  const dialog = await screen.findByRole("dialog", { name: label });
  fireEvent.change(within(dialog).getByRole("textbox", { name: label }), { target: { value } });
  fireEvent.click(within(dialog).getByRole("button", { name: "OK" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: label })).toBeNull());
}
function chooseTool(label) {
  fireEvent.click(screen.getByRole("button", { name: label }));
}
function menuBar() {
  return screen.getByRole("button", { name: "Mídia" }).parentElement;
}
function runMenu(menu, item) {
  fireEvent.click(within(menuBar()).getByRole("button", { name: menu }));
  const entry = [...menuBar().querySelectorAll(".min-w-56 > button")].find((node) => node.firstChild.textContent === item);
  fireEvent.click(entry);
}
function info(clip) {
  return clip.querySelector("span")?.textContent.replace(/\s+/g, "");
}
function showMetadata(clip) {
  runMenu("Janela", "Projetos");
  fireEvent.click(clip);
  fireEvent.click(screen.getByRole("button", { name: "Metadados" }));
}
function metadataValue(label) {
  // Metadados são linhas só de leitura (<dt>rótulo</dt><dd>valor</dd>).
  const term = screen.getAllByText(label).find((node) => node.tagName === "DT");
  return term?.nextElementSibling?.textContent;
}

describe("MMFilm — ferramentas da timeline", () => {
  it("Navalha corta o clipe no ponto clicado, avança a origem da segunda parte e pode ser desfeita", () => {
    const { container } = render(<FilmCraftWorkspace />);
    drop(container, { id: "a", name: "Entrevista", seconds: 0 });
    chooseTool("Razor (C)");
    fireEvent.click(clipNamed(container, "Entrevista"), { clientX: 3 * PX });
    const parts = clipsOn(container);
    expect(parts).toHaveLength(2);
    expect(parts.map(info)).toEqual(["00:00·3.0s", "00:03·5.0s"]);
    chooseTool("Seleção (V)");
    showMetadata(clipsOn(container)[1]);
    expect(metadataValue("Entrada na origem")).toBe("3.00 s");
    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(clipsOn(container)).toHaveLength(1);
  });

  it("Edição ripple apara a saída no clique e puxa os clipes seguintes", () => {
    const { container } = render(<FilmCraftWorkspace />);
    drop(container, { id: "a", name: "Plano A", seconds: 0 });
    drop(container, { id: "b", name: "Plano B", seconds: 8 });
    chooseTool("Edição ripple (B)");
    const first = clipNamed(container, "Plano A");
    fireEvent.pointerDown(first, { clientX: 7 * PX, button: 0 });
    fireEvent.pointerUp(window, { clientX: 7 * PX });
    expect(info(clipNamed(container, "Plano A"))).toBe("00:00·7.0s");
    expect(info(clipNamed(container, "Plano B"))).toBe("00:07·8.0s");
  });

  it("Edição ripple por arraste da entrada remove o início sem abrir buraco", () => {
    const { container } = render(<FilmCraftWorkspace />);
    drop(container, { id: "a", name: "Plano A", seconds: 0 });
    drop(container, { id: "b", name: "Plano B", seconds: 8 });
    chooseTool("Edição ripple (B)");
    fireEvent.pointerDown(clipNamed(container, "Plano A"), { clientX: 1 * PX, button: 0 });
    fireEvent.pointerUp(window, { clientX: 3 * PX });
    expect(info(clipNamed(container, "Plano A"))).toBe("00:00·6.0s");
    expect(info(clipNamed(container, "Plano B"))).toBe("00:06·8.0s");
    chooseTool("Seleção (V)");
    showMetadata(clipNamed(container, "Plano A"));
    expect(metadataValue("Entrada na origem")).toBe("2.00 s");
  });

  it("Rate stretch altera duração e velocidade pelo arraste da borda", () => {
    const { container } = render(<FilmCraftWorkspace />);
    drop(container, { id: "a", name: "Câmera lenta", seconds: 0 });
    chooseTool("Rate stretch (R)");
    fireEvent.pointerDown(clipNamed(container, "Câmera lenta"), { clientX: 7.5 * PX, button: 0 });
    fireEvent.pointerUp(window, { clientX: 11.5 * PX });
    expect(info(clipNamed(container, "Câmera lenta"))).toBe("00:00·12.0s");
    chooseTool("Seleção (V)");
    showMetadata(clipNamed(container, "Câmera lenta"));
    expect(metadataValue("Velocidade")).toBe("66.7%");
    expect(metadataValue("Entrada na origem")).toBe("0.00 s");
  });

  it("Slip troca a entrada da mídia sem mover o clipe; Shift+arraste faz slide", () => {
    const { container } = render(<FilmCraftWorkspace />);
    // Plano A usa 8 s de uma mídia de 12 s (corta e exclui o final) para ter folga de slip.
    drop(container, { id: "a", name: "Plano A", seconds: 0, duration: 12 });
    chooseTool("Razor (C)");
    fireEvent.click(clipNamed(container, "Plano A"), { clientX: 8 * PX });
    chooseTool("Seleção (V)");
    fireEvent.click(clipsOn(container)[1]);
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    drop(container, { id: "b", name: "Plano B", seconds: 8 });
    chooseTool("Slip e slide (Y)");
    fireEvent.pointerDown(clipNamed(container, "Plano A"), { clientX: 4 * PX, button: 0 });
    fireEvent.pointerUp(window, { clientX: 2 * PX });
    expect(info(clipNamed(container, "Plano A"))).toBe("00:00·8.0s");
    fireEvent.pointerDown(clipNamed(container, "Plano B"), { clientX: 10 * PX, button: 0, shiftKey: true });
    fireEvent.pointerUp(window, { clientX: 9 * PX });
    expect(info(clipNamed(container, "Plano A"))).toBe("00:00·7.0s");
    expect(info(clipNamed(container, "Plano B"))).toBe("00:07·8.0s");
    chooseTool("Seleção (V)");
    showMetadata(clipNamed(container, "Plano A"));
    expect(metadataValue("Entrada na origem")).toBe("2.00 s");
  });

  it("Caneta adiciona um quadro-chave no tempo clicado e remove com novo clique", () => {
    const { container } = render(<FilmCraftWorkspace />);
    drop(container, { id: "a", name: "Plano", seconds: 0 });
    chooseTool("Caneta (P)");
    fireEvent.click(clipNamed(container, "Plano"), { clientX: 2 * PX });
    expect(clipNamed(container, "Plano").querySelector('[title="Keyframe 2.0 s"]')).not.toBeNull();
    fireEvent.click(clipNamed(container, "Plano"), { clientX: 2 * PX });
    expect(clipNamed(container, "Plano").querySelector("i")).toBeNull();
  });

  it("Mão arrasta a timeline horizontalmente", () => {
    const { container } = render(<FilmCraftWorkspace />);
    const scroller = lane(container).closest(".overflow-x-auto");
    let left = 100;
    Object.defineProperty(scroller, "scrollLeft", { configurable: true, get: () => left, set: (value) => { left = value; } });
    chooseTool("Mão (H)");
    fireEvent.pointerDown(lane(container), { clientX: 200, button: 0 });
    fireEvent.pointerMove(window, { clientX: 150 });
    expect(left).toBe(150);
    fireEvent.pointerUp(window, { clientX: 150 });
    fireEvent.pointerMove(window, { clientX: 0 });
    expect(left).toBe(150);
  });

  it("Texto cria um título no indicador, em faixa de vídeo livre, visível no Programa", async () => {
    const promptSpy = vi.spyOn(window, "prompt");
    const { container } = render(<FilmCraftWorkspace />);
    drop(container, { id: "a", name: "Base", seconds: 0 });
    chooseTool("Texto (T)");
    fireEvent.click(clipNamed(container, "Base"), { clientX: 2 * PX });
    await answerPrompt("Texto do título", "Abertura");
    expect(promptSpy).not.toHaveBeenCalled();
    expect(clipsOn(container, "V1")).toHaveLength(1);
    const title = clipNamed(container, "Abertura", "V2");
    expect(info(title)).toBe("00:02·5.0s");
    expect(screen.getAllByText("Abertura").length).toBeGreaterThan(1);
    expect(screen.queryByText("Mídia offline")).toBeNull();
  });

  it("Selecionar faixa seleciona o clipe clicado e os seguintes da mesma faixa", () => {
    const { container } = render(<FilmCraftWorkspace />);
    drop(container, { id: "a", name: "Um", seconds: 0 });
    drop(container, { id: "b", name: "Dois", seconds: 8 });
    drop(container, { id: "c", name: "Tres", seconds: 16 });
    drop(container, { id: "d", name: "Outra", seconds: 10, track: "V2" });
    chooseTool("Selecionar faixa (A)");
    fireEvent.click(clipNamed(container, "Dois"), { clientX: 9 * PX });
    expect(clipNamed(container, "Um").className).not.toContain("ring-2");
    expect(clipNamed(container, "Dois").className).toContain("ring-2");
    expect(clipNamed(container, "Tres").className).toContain("ring-2");
    expect(clipNamed(container, "Outra", "V2").className).not.toContain("ring-2");
  });

  it("modo inserção empurra os clipes ao soltar mídia na faixa", () => {
    const { container } = render(<FilmCraftWorkspace />);
    drop(container, { id: "a", name: "Primeiro", seconds: 0 });
    fireEvent.click(screen.getByRole("button", { name: "Inserção e sobrescrita" }));
    drop(container, { id: "b", name: "Novo", seconds: 0 });
    expect(info(clipNamed(container, "Primeiro"))).toBe("00:08·8.0s");
    expect(info(clipNamed(container, "Novo"))).toBe("00:00·8.0s");
  });
});

describe("MMFilm — menus, projeto e exportação", () => {
  it("nenhum item de menu responde mais com 'comando preparado'", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<FilmCraftWorkspace />);
    // amostra de menus que antes só exibiam "comando preparado" (no jsdom clicar os 45 itens é lento demais)
    const menus = ["Sequência", "Exibir", "Ajuda"];
    for (const menu of menus) {
      fireEvent.click(within(menuBar()).getByRole("button", { name: menu }));
      const labels = [...menuBar().querySelectorAll(".min-w-56 > button")].map((node) => node.firstChild.textContent);
      expect(labels.length).toBeGreaterThan(0);
      fireEvent.click(within(menuBar()).getByRole("button", { name: menu }));
      for (const label of labels) {
        fireEvent.click(within(menuBar()).getByRole("button", { name: menu }));
        const item = [...menuBar().querySelectorAll(".min-w-56 > button")].find((node) => node.firstChild.textContent === label);
        fireEvent.click(item);
        expect(document.body.textContent).not.toContain("comando preparado");
      }
    }
  }, 90000);

  it("itens sem implementação no navegador dizem claramente que estão indisponíveis", () => {
    render(<FilmCraftWorkspace />);
    runMenu("Mídia", "Gerenciar proxies");
    expect(screen.getByText(/Gerenciar proxies: indisponível/)).toBeInTheDocument();
  });

  it("copiar e colar duplica o clipe no indicador e marcadores navegam", () => {
    const { container } = render(<FilmCraftWorkspace />);
    drop(container, { id: "a", name: "Cena", seconds: 0 });
    fireEvent.click(clipNamed(container, "Cena"));
    runMenu("Editar", "Copiar");
    movePlayhead(20);
    runMenu("Editar", "Colar");
    expect(clipsOn(container).map(info)).toEqual(["00:00·8.0s", "00:20·8.0s"]);
    // O áudio vinculado (A1) é copiado e colado junto com o vídeo.
    expect(clipsOn(container, "A1").map(info)).toEqual(["00:00·8.0s", "00:20·8.0s"]);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar marcador" }));
    movePlayhead(0);
    runMenu("Marcadores", "Próximo marcador");
    expect(screen.getAllByText(/00:00:20:/).length).toBeGreaterThan(0);
    runMenu("Marcadores", "Limpar marcadores");
    expect(screen.getByText(/4 clipes · 0 marcadores/)).toBeInTheDocument();
  });

  it("Velocidade/Duração ajusta a duração conforme a velocidade", async () => {
    const { container } = render(<FilmCraftWorkspace />);
    drop(container, { id: "a", name: "Cena", seconds: 0 });
    fireEvent.click(clipNamed(container, "Cena"));
    runMenu("Clipe", "Velocidade/Duração…");
    await answerPrompt("Velocidade do clipe (%)", "200");
    expect(info(clipNamed(container, "Cena"))).toBe("00:00·4.0s");
  });

  it("Salvar guarda a mídia; ao recarregar a mídia local volta como offline para religar", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { container } = render(<FilmCraftWorkspace />);
    fireEvent.change(container.querySelector('input[accept="video/*,audio/*,image/*"]'), {
      target: { files: [new File(["v"], "Cena.mp4", { type: "video/mp4" })] },
    });
    fireEvent.doubleClick(lane(container));
    expect(clipsOn(container)).toHaveLength(1);
    runMenu("Arquivo", "Salvar");
    const saved = JSON.parse(localStorage.getItem("mmfilm:last-project"));
    expect(saved.media).toHaveLength(1);
    expect(saved.media[0]).toMatchObject({ name: "Cena.mp4", offline: true });
    expect(saved.media[0].url).toBeUndefined();
    runMenu("Arquivo", "Novo projeto");
    expect(clipsOn(container)).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /Cena\.mp4/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Recarregar" }));
    expect(clipsOn(container)).toHaveLength(1);
    expect(within(screen.getByLabelText("Pasta Projeto MMFilm")).getByRole("button", { name: "Cena.mp4" })).toHaveTextContent("Offline");
    expect(screen.getByRole("button", { name: "Religar mídia (1)" })).toBeEnabled();
  });

  it("Iniciar fila não finge renderização concluída", () => {
    render(<FilmCraftWorkspace />);
    fireEvent.click(screen.getAllByRole("button", { name: "Exportar" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "+ Adicionar" }));
    fireEvent.click(screen.getByRole("button", { name: "Iniciar fila" }));
    expect(screen.getByText("Não renderizado")).toBeInTheDocument();
    expect(screen.queryByText("Concluído")).toBeNull();
    expect(screen.getByText(/renderização local de vídeo ainda não está disponível/)).toBeInTheDocument();
  });

  it("importa legendas SRT como títulos na timeline", async () => {
    const { container } = render(<FilmCraftWorkspace />);
    runMenu("Janela", "Texto");
    fireEvent.click(screen.getByRole("button", { name: "Legendas" }));
    const srt = "1\n00:00:01,000 --> 00:00:03,500\nOlá mundo\n\n2\n00:00:04,000 --> 00:00:06,000\n<i>Segunda</i> linha\n";
    const file = new File([srt], "falas.srt", { type: "text/plain" });
    if (!file.text) file.text = () => Promise.resolve(srt);
    await act(async () => {
      fireEvent.change(container.querySelector('input[accept=".srt,.vtt"]'), { target: { files: [file] } });
    });
    await waitFor(() => expect(clipsOn(container, "V3")).toHaveLength(2));
    expect(clipsOn(container, "V3").map(info)).toEqual(["00:01·2.5s", "00:04·2.0s"]);
    expect(clipNamed(container, "Segunda linha", "V3")).toBeTruthy();
  });

  it("abas Info, Marcadores e Histórico do painel Projeto mostram dados reais", () => {
    const { container } = render(<FilmCraftWorkspace />);
    drop(container, { id: "a", name: "Cena", seconds: 0 });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar marcador" }));
    const panel = screen.getByLabelText("Pasta Projeto MMFilm");
    fireEvent.click(within(panel).getByRole("button", { name: "Marcadores" }));
    expect(within(panel).getByRole("button", { name: /00:00 · 0\.0 s/ })).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: "Histórico" }));
    expect(within(panel).getByText(/1 ação\(ões\) para desfazer/)).toBeInTheDocument();
  });
});

describe("MMFilm — diálogo de texto e abas do topo", () => {
  it("cancelar o diálogo de texto não cria título nem usa window.prompt", async () => {
    const promptSpy = vi.spyOn(window, "prompt");
    const { container } = render(<FilmCraftWorkspace />);
    drop(container, { id: "a", name: "Base", seconds: 0 });
    chooseTool("Texto (T)");
    fireEvent.click(clipNamed(container, "Base"), { clientX: 2 * PX });
    const dialog = await screen.findByRole("dialog", { name: "Texto do título" });
    expect(within(dialog).getByRole("textbox", { name: "Texto do título" })).toHaveValue("Título");
    fireEvent.keyDown(within(dialog).getByRole("textbox", { name: "Texto do título" }), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Texto do título" })).toBeNull());
    expect(clipsOn(container, "V2")).toHaveLength(0);
    expect(promptSpy).not.toHaveBeenCalled();
  });

  it("o sublinhado das abas do topo acompanha a área de trabalho atual", () => {
    const { container } = render(<FilmCraftWorkspace />);
    const nav = container.querySelector(".mmfilm-project-header nav");
    const current = () => nav.querySelector('[aria-current="page"]')?.textContent;
    expect(current()).toBe("Editar");
    fireEvent.click(within(nav).getByRole("button", { name: "Exportar" }));
    expect(current()).toBe("Exportar");
    expect(within(nav).getByRole("button", { name: "Editar" }).className).not.toContain("border-b-2");
    fireEvent.click(within(nav).getByRole("button", { name: "Editar" }));
    expect(current()).toBe("Editar");
    expect(within(nav).getByRole("button", { name: "Exportar" }).className).not.toContain("border-b-2");
  });
});
