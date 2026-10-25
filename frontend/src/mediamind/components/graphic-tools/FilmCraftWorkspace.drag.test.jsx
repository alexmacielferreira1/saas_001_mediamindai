import { act, createEvent, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import FilmCraftWorkspace from "./FilmCraftWorkspace";

// Arraste fluido da timeline (pointer events + prévia por requestAnimationFrame).
// Zoom padrão: 12 px por segundo; no jsdom as faixas começam em x = 0 e o topo da timeline em y = 0
// (régua de 74 px e faixas de 56 px: V3, V2, V1, A1, A2, A3).
const PX = 12;
const HEADER = 144;
const RULER_H = 74;
const TRACK_H = 56;
const ORDER = ["V3", "V2", "V1", "A1", "A2", "A3"];
const yOf = (track) => RULER_H + ORDER.indexOf(track) * TRACK_H + 20;

let frames = [];
function flushFrames() {
  const pending = frames;
  frames = [];
  act(() => pending.forEach((callback) => callback(performance.now())));
}

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});
beforeEach(() => {
  localStorage.clear();
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (callback) => frames.push(callback));
  vi.stubGlobal("cancelAnimationFrame", () => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function lane(container, track = "V1") {
  return container.querySelector(`[data-track-id="${track}"]`);
}
function clipsOn(container, track = "V1") {
  return [...lane(container, track).querySelectorAll("[data-clip-id]")];
}
function geometry(container, track = "V1") {
  return clipsOn(container, track)
    .map((node) => [Number(node.dataset.start), Number(node.dataset.duration)])
    .sort((a, b) => a[0] - b[0])
    .map(([start, duration]) => [Math.round(start * 1000) / 1000, Math.round(duration * 1000) / 1000]);
}
function fireWithX(kind, target, seconds, init) {
  const event = createEvent[kind](target, init);
  if (seconds !== undefined) Object.defineProperty(event, "clientX", { value: seconds * PX });
  fireEvent(target, event);
}
function dropMedia(container, { id, name, seconds = 0, track = "V1", kind = "video", duration = 8 }) {
  const mimeType = kind === "audio" ? "audio/mpeg" : "video/mp4";
  const payload = { id, name, kind, src: `/api/v1/media/assets/${id}/stream`, duration, mimeType };
  fireWithX("drop", lane(container, track), seconds, {
    dataTransfer: { getData: (type) => (type === "application/x-timeline2-media" ? JSON.stringify(payload) : "") },
  });
}
// Agarra o clipe em `from` segundos (na faixa dele) e arrasta até `to` segundos / faixa `track`.
function press(node, seconds, track, init = {}) {
  fireEvent.pointerDown(node, { button: 0, pointerId: 1, clientX: seconds * PX, clientY: yOf(track), ...init });
}
function moveTo(seconds, track, init = {}) {
  fireEvent.pointerMove(window, { pointerId: 1, clientX: seconds * PX, clientY: yOf(track), ...init });
}
function release(seconds, track, init = {}) {
  fireEvent.pointerUp(window, { pointerId: 1, clientX: seconds * PX, clientY: yOf(track), ...init });
}
const ghost = (container, node) => container.querySelector(`[data-ghost-id="${node.dataset.clipId}"]`);

describe("MMFilm — mover clipe com prévia ao vivo", () => {
  it("a prévia acompanha o ponteiro (transform) e só grava no soltar", () => {
    const { container } = render(<FilmCraftWorkspace />);
    dropMedia(container, { id: "a", name: "A" });
    const [video] = clipsOn(container, "V1");
    press(video, 2, "V1");
    moveTo(12, "V1");
    flushFrames();
    expect(ghost(container, video).style.transform).toBe(`translate(${10 * PX}px, 0px)`);
    expect(video.dataset.dragging).toBe("true");
    // O par vinculado (A1) também aparece na prévia.
    expect(ghost(container, clipsOn(container, "A1")[0]).style.transform).toBe(`translate(${10 * PX}px, 0px)`);
    expect(geometry(container, "V1")).toEqual([[0, 8]]);
    release(12, "V1");
    expect(geometry(container, "V1")).toEqual([[10, 8]]);
    expect(geometry(container, "A1")).toEqual([[10, 8]]);
    expect(container.querySelector("[data-ghost-id]")).toBeNull();
  });

  it("o ímã encaixa ao vivo e desenha a linha de encaixe", () => {
    const { container } = render(<FilmCraftWorkspace />);
    dropMedia(container, { id: "a", name: "A" });
    dropMedia(container, { id: "b", name: "B", seconds: 20, track: "V2" });
    const [video] = clipsOn(container, "V1");
    press(video, 0, "V1");
    // Fim de A (8 + 11,7 = 19,7 s) fica a 3,6 px do início de B (20 s): encaixa o fim? Não — a entrada (11,7) não
    // encosta em nada; a saída (19,7) encaixa em 20 s, então o clipe vai para 12 s.
    moveTo(11.7, "V1");
    flushFrames();
    expect(ghost(container, video).style.transform).toBe(`translate(${12 * PX}px, 0px)`);
    const line = container.querySelector("[data-snap-line]");
    expect(line.style.display).toBe("block");
    expect(line.style.left).toBe(`${HEADER + 20 * PX}px`);
    release(11.7, "V1");
    expect(geometry(container, "V1")).toEqual([[12, 8]]);
    expect(line.style.display).toBe("none");
  });

  it("Esc e pointercancel cancelam sem alterar os clipes", () => {
    const { container } = render(<FilmCraftWorkspace />);
    dropMedia(container, { id: "a", name: "A" });
    let [video] = clipsOn(container, "V1");
    press(video, 1, "V1");
    moveTo(15, "V1");
    flushFrames();
    fireEvent.keyDown(window, { key: "Escape" });
    release(15, "V1");
    expect(geometry(container, "V1")).toEqual([[0, 8]]);
    expect(container.querySelector("[data-ghost-id]")).toBeNull();

    [video] = clipsOn(container, "V1");
    press(video, 1, "V1");
    moveTo(15, "V1");
    fireEvent.pointerCancel(window, { pointerId: 1 });
    release(15, "V1");
    expect(geometry(container, "V1")).toEqual([[0, 8]]);
    expect(geometry(container, "A1")).toEqual([[0, 8]]);
    expect(container.querySelector("[data-ghost-id]")).toBeNull();
    // Nada foi gravado: o Desfazer volta direto para antes de soltar a mídia.
    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(geometry(container, "V1")).toEqual([]);
  });

  it("clique sem arrastar só seleciona (sem mover nem gravar histórico)", () => {
    const { container } = render(<FilmCraftWorkspace />);
    dropMedia(container, { id: "a", name: "A" });
    const [video] = clipsOn(container, "V1");
    press(video, 1, "V1");
    moveTo(1.1, "V1");
    release(1.1, "V1");
    fireEvent.click(video);
    expect(geometry(container, "V1")).toEqual([[0, 8]]);
    expect(clipsOn(container, "V1")[0].className).toContain("ring-2");
    expect(clipsOn(container, "A1")[0].className).toContain("ring-2");
  });

  it("soltar sobre outro clipe sobrescreve; com Ctrl insere e empurra; com Alt duplica", () => {
    const { container } = render(<FilmCraftWorkspace />);
    dropMedia(container, { id: "a", name: "A" });
    dropMedia(container, { id: "b", name: "B", seconds: 20, duration: 4 });
    let b = clipsOn(container, "V1").find((node) => node.textContent.includes("B"));
    press(b, 20, "V1");
    release(24, "V1", { ctrlKey: true });
    // Ctrl: B entra em 24 s empurrando nada (nada depois); agora insere no meio de A.
    b = clipsOn(container, "V1").find((node) => node.textContent.includes("B"));
    press(b, 24, "V1");
    release(4, "V1", { ctrlKey: true });
    expect(geometry(container, "V1")).toEqual([[0, 4], [4, 4], [8, 4]]);
    expect(geometry(container, "A1")).toEqual([[0, 4], [4, 4], [8, 4]]);
    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    b = clipsOn(container, "V1").find((node) => node.textContent.includes("B"));
    press(b, 24, "V1");
    release(4, "V1");
    expect(geometry(container, "V1")).toEqual([[0, 4], [4, 4]]);
    expect(geometry(container, "A1")).toEqual([[0, 4], [4, 4]]);
    b = clipsOn(container, "V1").find((node) => node.dataset.start === "4");
    press(b, 4, "V1");
    release(10, "V1", { altKey: true });
    expect(geometry(container, "V1")).toEqual([[0, 4], [4, 4], [10, 4]]);
    expect(geometry(container, "A1")).toEqual([[0, 4], [4, 4], [10, 4]]);
  });

  it("arraste vertical troca para faixa compatível e nunca para incompatível", () => {
    const { container } = render(<FilmCraftWorkspace />);
    dropMedia(container, { id: "a", name: "A" });
    const [video] = clipsOn(container, "V1");
    press(video, 1, "V1");
    moveTo(1, "V2");
    flushFrames();
    expect(ghost(container, video).style.transform).toBe(`translate(0px, ${-TRACK_H}px)`);
    release(1, "V2");
    expect(geometry(container, "V2")).toEqual([[0, 8]]);
    expect(geometry(container, "A1")).toEqual([[0, 8]]);
    // Vídeo não desce para faixa de áudio.
    press(clipsOn(container, "V2")[0], 1, "V2");
    release(1, "A2");
    expect(geometry(container, "V2")).toEqual([[0, 8]]);
    expect(geometry(container, "A2")).toEqual([]);
    // O áudio do par (tipo video/mp4) não sobe para faixa de vídeo, mas troca de faixa de áudio.
    fireEvent.click(screen.getByRole("button", { name: "Seleção vinculada" }));
    press(clipsOn(container, "A1")[0], 1, "A1");
    release(1, "V3");
    expect(geometry(container, "V3")).toEqual([]);
    expect(geometry(container, "A1")).toEqual([[0, 8]]);
    press(clipsOn(container, "A1")[0], 1, "A1");
    release(1, "A3");
    expect(geometry(container, "A3")).toEqual([[0, 8]]);
  });
});

describe("MMFilm — alças de aparo na ferramenta Seleção", () => {
  it("a alça da direita apara a saída com prévia e grava no soltar (par vinculado junto)", () => {
    const { container } = render(<FilmCraftWorkspace />);
    dropMedia(container, { id: "a", name: "A" });
    const [video] = clipsOn(container, "V1");
    const handle = video.querySelector('[data-trim="out"]');
    press(handle, 8, "V1");
    moveTo(6, "V1");
    flushFrames();
    expect(ghost(container, video).style.width).toBe(`${6 * PX}px`);
    expect(geometry(container, "V1")).toEqual([[0, 8]]);
    release(6, "V1");
    expect(geometry(container, "V1")).toEqual([[0, 6]]);
    expect(geometry(container, "A1")).toEqual([[0, 6]]);
    // Não estica além da mídia (8 s).
    press(clipsOn(container, "V1")[0].querySelector('[data-trim="out"]'), 6, "V1");
    release(30, "V1");
    expect(geometry(container, "V1")).toEqual([[0, 8]]);
  });

  it("a alça da esquerda apara a entrada e não passa do início da mídia", () => {
    const { container } = render(<FilmCraftWorkspace />);
    dropMedia(container, { id: "a", name: "A", seconds: 4 });
    const [video] = clipsOn(container, "V1");
    press(video.querySelector('[data-trim="in"]'), 4, "V1");
    moveTo(6, "V1");
    flushFrames();
    expect(ghost(container, video).style.transform).toBe(`translate(${2 * PX}px, 0px)`);
    release(6, "V1");
    expect(geometry(container, "V1")).toEqual([[6, 6]]);
    expect(geometry(container, "A1")).toEqual([[6, 6]]);
    press(clipsOn(container, "V1")[0].querySelector('[data-trim="in"]'), 6, "V1");
    release(0, "V1");
    expect(geometry(container, "V1")).toEqual([[4, 8]]);
  });

  it("as alças só existem na ferramenta Seleção", () => {
    const { container } = render(<FilmCraftWorkspace />);
    dropMedia(container, { id: "a", name: "A" });
    expect(clipsOn(container, "V1")[0].querySelector('[data-trim="in"]')).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Razor (C)" }));
    expect(clipsOn(container, "V1")[0].querySelector('[data-trim="in"]')).toBeNull();
  });
});

describe("MMFilm — prévia das ferramentas de arraste", () => {
  it("Ripple mostra a nova borda durante o arraste e grava no soltar", () => {
    const { container } = render(<FilmCraftWorkspace />);
    dropMedia(container, { id: "a", name: "A" });
    fireEvent.click(screen.getByRole("button", { name: "Edição ripple (B)" }));
    const [video] = clipsOn(container, "V1");
    press(video, 7, "V1");
    moveTo(5, "V1");
    flushFrames();
    expect(ghost(container, video).style.width).toBe(`${6 * PX}px`);
    expect(container.querySelector("[data-drag-label]").textContent).toMatch(/Ripple/);
    expect(geometry(container, "V1")).toEqual([[0, 8]]);
    release(5, "V1");
    expect(geometry(container, "V1")).toEqual([[0, 6]]);
  });
});

describe("MMFilm — mídia arrastada do painel Projeto", () => {
  it("dragOver mostra o fantasma na posição com ímã e o soltar usa essa posição", () => {
    const { container } = render(<FilmCraftWorkspace />);
    dropMedia(container, { id: "a", name: "A" });
    const item = screen.getByRole("button", { name: "A" });
    fireEvent.dragStart(item, { dataTransfer: { setData: () => {}, effectAllowed: "" } });
    fireWithX("dragOver", lane(container, "V2"), 8.3, { dataTransfer: { types: [], dropEffect: "" } });
    flushFrames();
    const drop = container.querySelector("[data-drop-ghost]");
    expect(drop.style.display).toBe("block");
    expect(drop.style.left).toBe(`${HEADER + 8 * PX}px`);
    expect(drop.style.width).toBe(`${8 * PX}px`);
    expect(drop.style.top).toBe(`${RULER_H + ORDER.indexOf("V2") * TRACK_H + 4}px`);
    expect(container.querySelector("[data-snap-line]").style.display).toBe("block");
    fireEvent.drop(lane(container, "V2"), {
      dataTransfer: { getData: (type) => (type === "application/x-filmcraft-asset" ? "a" : "") },
    });
    expect(geometry(container, "V2")).toEqual([[8, 8]]);
    expect(drop.style.display).toBe("none");
    fireEvent.dragEnd(item);
  });
});

describe("MMFilm — indicador (playhead)", () => {
  it("o scrub atualiza por requestAnimationFrame e termina no soltar", () => {
    const { container } = render(<FilmCraftWorkspace />);
    const ruler = container.querySelector("[data-timeline-ruler]");
    fireEvent.pointerDown(ruler, { clientX: 5 * PX, button: 0, pointerId: 1 });
    expect(ruler).toHaveAttribute("aria-valuenow", "5");
    fireEvent.pointerMove(window, { clientX: 10 * PX, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 12 * PX, pointerId: 1 });
    expect(ruler).toHaveAttribute("aria-valuenow", "5");
    expect(frames).toHaveLength(1);
    flushFrames();
    expect(ruler).toHaveAttribute("aria-valuenow", "12");
    fireEvent.pointerCancel(window, { pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 20 * PX, pointerId: 1 });
    flushFrames();
    expect(ruler).toHaveAttribute("aria-valuenow", "12");
  });

  it("a reprodução avança por requestAnimationFrame (não por intervalos de 100 ms)", () => {
    const { container } = render(<FilmCraftWorkspace />);
    dropMedia(container, { id: "a", name: "A" });
    const now = vi.spyOn(performance, "now");
    fireEvent.click(screen.getByRole("button", { name: "Reproduzir Programa" }));
    expect(frames.length).toBeGreaterThan(0);
    const step = (time) => {
      const pending = frames;
      frames = [];
      act(() => pending.forEach((callback) => callback(time)));
    };
    now.mockReturnValue(1000);
    step(1000);
    step(2000);
    const ruler = container.querySelector("[data-timeline-ruler]");
    expect(Number(ruler.getAttribute("aria-valuenow"))).toBeCloseTo(1, 1);
    expect(screen.getByRole("button", { name: "Arrastar playhead" }).style.left).toBe(`${HEADER + 1 * PX}px`);
    fireEvent.click(screen.getByRole("button", { name: "Pausar Programa" }));
  });

  it("com a aba oculta (sem quadros de tela) a reprodução ainda para no fim do conteúdo", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    try {
      const { container } = render(<FilmCraftWorkspace />);
      dropMedia(container, { id: "a", name: "A", duration: 2 });
      const now = vi.spyOn(performance, "now").mockReturnValue(0);
      fireEvent.click(screen.getByRole("button", { name: "Reproduzir Programa" }));
      // Navegador não entrega rAF em aba oculta: os quadros pendentes nunca rodam.
      frames = [];
      now.mockReturnValue(1000);
      act(() => vi.advanceTimersByTime(1000));
      expect(screen.getByRole("button", { name: "Pausar Programa" })).toBeInTheDocument();
      now.mockReturnValue(3000);
      act(() => vi.advanceTimersByTime(1000));
      expect(screen.getByRole("button", { name: "Reproduzir Programa" })).toBeInTheDocument();
      expect(container.querySelector("[data-timeline-ruler]")).toHaveAttribute("aria-valuenow", "2");
    } finally {
      visibility.mockRestore();
      vi.useRealTimers();
    }
  });
});
