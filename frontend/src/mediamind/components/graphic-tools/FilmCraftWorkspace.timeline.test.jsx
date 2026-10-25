import { act, createEvent, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import FilmCraftWorkspace from "./FilmCraftWorkspace";
import { clearAudioBufferCache } from "./filmcraftAudio";
import { FakeAudioContext, fakeMediaFetch } from "./filmcraftTestAudio";

// Zoom padrão da timeline: 12 px por segundo; no jsdom as faixas e a régua começam em x = 0.
const PX = 12;
const HEADER = 144;

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});
beforeEach(() => {
  localStorage.clear();
  clearAudioBufferCache();
  FakeAudioContext.instances = [];
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function lane(container, track = "V1") {
  return container.querySelector(`[data-track-id="${track}"]`);
}
function clipsOn(container, track = "V1") {
  return [...lane(container, track).children].filter((node) => node.tagName === "BUTTON");
}
function position(node) {
  return [Number.parseFloat(node.style.left) / PX, Number.parseFloat(node.style.width) / PX];
}
function ruler(container) {
  return container.querySelector("[data-timeline-ruler]");
}
// O jsdom não preenche clientX em eventos de arrastar: o valor é definido no próprio evento.
function fireWithX(kind, target, seconds, init) {
  const event = createEvent[kind](target, init);
  if (seconds !== undefined) Object.defineProperty(event, "clientX", { value: seconds * PX });
  fireEvent(target, event);
}
function payloadData(payload) {
  return { getData: (type) => (type === "application/x-timeline2-media" ? JSON.stringify(payload) : "") };
}
function dropMedia(container, { id, name, seconds = 0, track = "V1", kind = "video", duration = 8 }) {
  const mimeType = kind === "audio" ? "audio/mpeg" : kind === "image" ? "image/png" : "video/mp4";
  const payload = { id, name, kind, src: `/api/v1/media/assets/${id}/stream`, duration, mimeType };
  fireWithX("drop", lane(container, track), seconds, { dataTransfer: payloadData(payload) });
}
// Arrasta um clipe da timeline (pointer events): agarra em `grab` segundos do início e solta em `at` segundos.
// No jsdom a faixa começa em x = 0 e o topo da timeline em y = 0 (régua de 74 px, faixas de 56 px).
const TRACK_ROWS = ["V3", "V2", "V1", "A1", "A2", "A3"];
function dragClip(container, node, { grab, at, track = "V1" }) {
  const left = Number.parseFloat(node.style.left);
  const y = 74 + TRACK_ROWS.indexOf(track) * 56 + 20;
  fireEvent.pointerDown(node, { button: 0, pointerId: 1, clientX: left + grab * PX, clientY: y });
  fireEvent.pointerMove(window, { pointerId: 1, clientX: at * PX, clientY: y });
  fireEvent.pointerUp(window, { pointerId: 1, clientX: at * PX, clientY: y });
}
function seek(container, seconds) {
  fireEvent.pointerDown(ruler(container), { clientX: seconds * PX, button: 0 });
  fireEvent.pointerUp(window, { clientX: seconds * PX });
}
function programMonitor() {
  return screen.getByText("Programa ☰").closest(".flex-col");
}

describe("MMFilm timeline — vídeo com áudio vinculado (P1)", () => {
  it("soltar vídeo em V1 cria o par vídeo + áudio em A1 com o mesmo trecho e vínculo", () => {
    const { container } = render(<FilmCraftWorkspace />);
    dropMedia(container, { id: "cena", name: "Cena", seconds: 2 });
    const [video] = clipsOn(container, "V1");
    const [audio] = clipsOn(container, "A1");
    expect(video).toBeTruthy();
    expect(audio).toBeTruthy();
    expect(audio.textContent).toContain("Cena");
    expect(position(audio)).toEqual(position(video));
    expect(position(video)).toEqual([2, 8]);
  });

  it("áudio só vai para a faixa de áudio e imagem só para a de vídeo", () => {
    const { container } = render(<FilmCraftWorkspace />);
    dropMedia(container, { id: "som", name: "Som", track: "A2", kind: "audio" });
    dropMedia(container, { id: "foto", name: "Foto", track: "V2", kind: "image", seconds: 10 });
    expect(clipsOn(container, "A2")).toHaveLength(1);
    expect(clipsOn(container, "V1")).toHaveLength(0);
    expect(clipsOn(container, "V2")).toHaveLength(1);
    expect(clipsOn(container, "A1")).toHaveLength(0);
  });

  it("vídeo solto numa faixa de áudio coloca o vídeo em V1 e o áudio na faixa escolhida", () => {
    const { container } = render(<FilmCraftWorkspace />);
    dropMedia(container, { id: "cena", name: "Cena", track: "A2", seconds: 4 });
    expect(clipsOn(container, "V1")).toHaveLength(1);
    expect(clipsOn(container, "A2")).toHaveLength(1);
    expect(position(clipsOn(container, "V1")[0])).toEqual([4, 8]);
  });

  it("o Patch de origem escolhe a faixa de áudio do par", () => {
    const { container } = render(<FilmCraftWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Patch de origem A1" }));
    fireEvent.click(screen.getByRole("button", { name: "Patch de origem A3" }));
    dropMedia(container, { id: "cena", name: "Cena" });
    expect(clipsOn(container, "A1")).toHaveLength(0);
    expect(clipsOn(container, "A3")).toHaveLength(1);
  });

  it("selecionar, cortar, mover e excluir agem no par vinculado", () => {
    const { container } = render(<FilmCraftWorkspace />);
    dropMedia(container, { id: "cena", name: "Cena" });
    fireEvent.click(clipsOn(container, "V1")[0]);
    expect(clipsOn(container, "A1")[0].className).toContain("ring-2");

    fireEvent.click(screen.getByRole("button", { name: "Razor (C)" }));
    fireEvent.click(clipsOn(container, "V1")[0], { clientX: 3 * PX });
    expect(clipsOn(container, "V1").map(position)).toEqual([[0, 3], [3, 5]]);
    expect(clipsOn(container, "A1").map(position)).toEqual([[0, 3], [3, 5]]);

    fireEvent.click(screen.getByRole("button", { name: "Seleção (V)" }));
    dragClip(container, clipsOn(container, "V1")[1], { grab: 1, at: 11 });
    expect(clipsOn(container, "V1").map(position)).toEqual([[0, 3], [10, 5]]);
    expect(clipsOn(container, "A1").map(position)).toEqual([[0, 3], [10, 5]]);

    fireEvent.click(clipsOn(container, "V1")[1]);
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    expect(clipsOn(container, "V1")).toHaveLength(1);
    expect(clipsOn(container, "A1")).toHaveLength(1);
  });

  it("com Seleção vinculada desligada, mover só leva o clipe arrastado", () => {
    const { container } = render(<FilmCraftWorkspace />);
    dropMedia(container, { id: "cena", name: "Cena" });
    fireEvent.click(screen.getByRole("button", { name: "Seleção vinculada" }));
    dragClip(container, clipsOn(container, "V1")[0], { grab: 0, at: 20 });
    expect(position(clipsOn(container, "V1")[0])[0]).toBe(20);
    expect(position(clipsOn(container, "A1")[0])[0]).toBe(0);
  });

  it("o par toca o som uma vez só (o vídeo não duplica o áudio de A1)", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.stubGlobal("fetch", fakeMediaFetch({ duration: 30 }));
    const { container } = render(<FilmCraftWorkspace />);
    dropMedia(container, { id: "cena", name: "Cena" });
    fireEvent.click(screen.getByRole("button", { name: "Reproduzir" }));
    await waitFor(() => expect(FakeAudioContext.instances[0]?.sources.length).toBeGreaterThan(0));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(FakeAudioContext.instances[0].sources).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Reproduzir" }));
  });
});

describe("MMFilm timeline — som no navegador (gesto, plano B e avisos)", () => {
  it("Reproduzir retoma o AudioContext dentro do próprio clique (Safari/tablet)", () => {
    const calls = [];
    let inClick = false;
    class SuspendedContext extends FakeAudioContext {
      constructor(options) {
        super(options);
        this.state = "suspended";
        this.resume = vi.fn(() => {
          calls.push(inClick);
          this.state = "running";
          return Promise.resolve();
        });
      }
    }
    vi.stubGlobal("AudioContext", SuspendedContext);
    vi.stubGlobal("fetch", fakeMediaFetch());
    const { container } = render(<FilmCraftWorkspace />);
    dropMedia(container, { id: "cena", name: "Cena" });
    const enter = () => {
      inClick = true;
    };
    const leave = () => {
      inClick = false;
    };
    document.addEventListener("click", enter, true);
    window.addEventListener("click", leave);
    try {
      fireEvent.click(screen.getByRole("button", { name: "Reproduzir" }));
    } finally {
      document.removeEventListener("click", enter, true);
      window.removeEventListener("click", leave);
    }
    expect(calls[0]).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Reproduzir" }));
  });

  it("som que não toca nem pelo plano B fica marcado no clipe (aviso persistente)", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.stubGlobal("fetch", fakeMediaFetch({ fail: ["/api/v1/media/assets/cena/stream"] }));
    vi.spyOn(HTMLMediaElement.prototype, "play").mockRejectedValue(new Error("bloqueado"));
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
    const { container } = render(<FilmCraftWorkspace />);
    dropMedia(container, { id: "cena", name: "Cena" });
    fireEvent.click(screen.getByRole("button", { name: "Reproduzir" }));
    await waitFor(() => expect(clipsOn(container, "A1")[0].querySelector('[data-audio-issue="error"]')).not.toBeNull());
    const badge = clipsOn(container, "A1")[0].querySelector('[data-audio-issue="error"]');
    expect(badge.getAttribute("title")).toMatch(/Sem som/);
    fireEvent.click(screen.getByRole("button", { name: "Reproduzir" }));
    // Continua visível depois de parar (não é um aviso de 5 s).
    expect(clipsOn(container, "A1")[0].querySelector('[data-audio-issue="error"]')).not.toBeNull();
  });
});

describe("MMFilm timeline — régua e posicionamento (P2/P3/P4/P7)", () => {
  it("a área da timeline soma o cabeçalho das faixas e os rótulos da régua ficam no tempo exato", () => {
    const { container } = render(<FilmCraftWorkspace />);
    const canvas = ruler(container).closest(".overflow-x-auto").firstElementChild;
    expect(canvas.style.width).toBe(`${HEADER + (60 + 5) * PX}px`);
    const ticks = [...ruler(container).children];
    expect(ticks).toHaveLength(13);
    expect(ticks[1].textContent).toBe("00:05");
    expect(ticks[1].style.left).toBe(`${5 * PX}px`);
    expect(ticks[12].style.left).toBe(`${60 * PX}px`);
    expect(screen.queryByRole("button", { name: "00:05" })).toBeNull();
  });

  it("clicar na régua posiciona o indicador no ponto exato, sem arredondar para 5 s", () => {
    const { container } = render(<FilmCraftWorkspace />);
    seek(container, 7.3);
    fireEvent.click(ruler(container).children[1]);
    expect(screen.getAllByText("00:00:07:09").length).toBeGreaterThan(0);
    expect(screen.getByRole("slider", { name: "Régua da timeline" })).toHaveAttribute("aria-valuenow", "7.3");
  });

  it("marcadores e indicador usam o mesmo deslocamento do cabeçalho", () => {
    const { container } = render(<FilmCraftWorkspace />);
    seek(container, 10);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar marcador" }));
    expect(screen.getByRole("button", { name: "Arrastar playhead" }).style.left).toBe(`${HEADER + 10 * PX}px`);
    const marker = container.querySelector('[title="Marcador em 00:10"]');
    expect(marker.parentElement.style.left).toBe(`${HEADER}px`);
    expect(marker.style.left).toBe(`${10 * PX}px`);
  });

  it("soltar mídia não arredonda para segundo inteiro; o ímã encaixa em bordas próximas", () => {
    const { container } = render(<FilmCraftWorkspace />);
    dropMedia(container, { id: "a", name: "A", seconds: 7.3 });
    expect(position(clipsOn(container, "V1")[0])[0]).toBeCloseTo(7.3, 5);
    // 15,4 s está a 0,1 s (1,2 px) do fim de A (15,3 s): encaixa.
    dropMedia(container, { id: "b", name: "B", seconds: 15.4, track: "V2" });
    expect(position(clipsOn(container, "V2")[0])[0]).toBeCloseTo(15.3, 5);
  });

  it("arrastar um clipe mantém o ponto onde foi agarrado e encaixa em outros clipes", () => {
    const { container } = render(<FilmCraftWorkspace />);
    dropMedia(container, { id: "a", name: "A" });
    dropMedia(container, { id: "b", name: "B", seconds: 20, track: "V2" });
    dragClip(container, clipsOn(container, "V1")[0], { grab: 3, at: 13 });
    expect(position(clipsOn(container, "V1")[0])[0]).toBe(10);
    // Início em 19,6 s fica a 4,8 px do início de B (20 s): o ímã encaixa.
    dragClip(container, clipsOn(container, "V1")[0], { grab: 3, at: 22.6 });
    expect(position(clipsOn(container, "V1")[0])[0]).toBe(20);
    // Não passa do zero.
    dragClip(container, clipsOn(container, "V1")[0], { grab: 6, at: 2 });
    expect(position(clipsOn(container, "V1")[0])[0]).toBe(0);
  });

  it("sem ímã o clipe fica no quadro mais próximo do ponto solto", () => {
    const { container } = render(<FilmCraftWorkspace />);
    dropMedia(container, { id: "a", name: "A" });
    dropMedia(container, { id: "b", name: "B", seconds: 20, track: "V2" });
    fireEvent.click(screen.getByRole("button", { name: "Snapping" }));
    dragClip(container, clipsOn(container, "V1")[0], { grab: 0, at: 19.6 });
    expect(position(clipsOn(container, "V1")[0])[0]).toBeCloseTo(19.6, 5);
  });

  it("IN/OUT da Origem só valem para a mídia aberta na Origem", () => {
    const { container } = render(<FilmCraftWorkspace />);
    fireEvent.change(container.querySelector('input[accept="video/*,audio/*,image/*"]'), {
      target: { files: [new File(["v"], "Origem.mp4", { type: "video/mp4" })] },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "OUT" }), { target: { value: "3" } });
    dropMedia(container, { id: "outra", name: "Outra", duration: 12 });
    expect(position(clipsOn(container, "V1")[0])[1]).toBe(12);
    fireEvent.doubleClick(lane(container, "V2"));
    expect(position(clipsOn(container, "V2")[0])[1]).toBe(3);
  });
});

describe("MMFilm timeline — rolagem e fim da reprodução (P5)", () => {
  function scroller(container, width = 400) {
    const node = lane(container).closest(".overflow-x-auto");
    let left = 0;
    Object.defineProperty(node, "clientWidth", { configurable: true, get: () => width });
    Object.defineProperty(node, "scrollLeft", { configurable: true, get: () => left, set: (value) => { left = value; } });
    return () => left;
  }

  it("rola por página quando o indicador sai da área visível e mantém a posição ao mudar o zoom", () => {
    const { container } = render(<FilmCraftWorkspace />);
    const scrollLeft = scroller(container);
    seek(container, 10);
    expect(scrollLeft()).toBe(0);
    seek(container, 30);
    expect(scrollLeft()).toBe(30 * PX);
    fireEvent.change(screen.getByRole("slider", { name: "Zoom da timeline" }), { target: { value: "20" } });
    // O indicador continua no mesmo ponto da tela: 30 s × 20 px − 0 px de distância da borda.
    expect(scrollLeft()).toBe(30 * 20);
    fireEvent.keyDown(window, { key: "Home" });
    expect(scrollLeft()).toBe(0);
  });

  it("a reprodução para no fim do conteúdo", () => {
    vi.useFakeTimers();
    const { container } = render(<FilmCraftWorkspace />);
    dropMedia(container, { id: "a", name: "A", duration: 2 });
    fireEvent.click(screen.getByRole("button", { name: "Reproduzir Programa" }));
    expect(screen.getByRole("button", { name: "Pausar Programa" })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByRole("button", { name: "Reproduzir Programa" })).toBeInTheDocument();
    expect(screen.getAllByText("00:00:02:00").length).toBeGreaterThan(0);
  });
});

describe("MMFilm timeline — controles reais (P6)", () => {
  it("o Programa sempre tem transporte da sequência, passos de quadro e progresso", () => {
    const { container } = render(<FilmCraftWorkspace />);
    dropMedia(container, { id: "a", name: "A", duration: 8 });
    seek(container, 20);
    const program = programMonitor();
    expect(within(program).queryByText(/Fit/)).toBeNull();
    expect(within(program).queryByText(/1\/2/)).toBeNull();
    fireEvent.click(within(program).getByRole("button", { name: "Próximo quadro Programa" }));
    expect(screen.getAllByText("00:00:20:01").length).toBeGreaterThan(0);
    fireEvent.click(within(program).getByRole("button", { name: "Quadro anterior Programa" }));
    fireEvent.click(within(program).getByRole("button", { name: "Quadro anterior Programa" }));
    expect(screen.getAllByText("00:00:19:29").length).toBeGreaterThan(0);
    const progress = within(program).getByRole("slider", { name: "Progresso Programa" });
    expect(progress).toHaveAttribute("max", "8");
    fireEvent.change(progress, { target: { value: "4.5" } });
    expect(screen.getAllByText("00:00:04:15").length).toBeGreaterThan(0);
    fireEvent.click(within(program).getByRole("button", { name: "Reproduzir Programa" }));
    expect(within(program).getByRole("button", { name: "Pausar Programa" })).toBeInTheDocument();
  });

  it("timecodes mostram o tempo real do indicador (HH:MM:SS:QQ)", () => {
    const { container } = render(<FilmCraftWorkspace />);
    seek(container, 45.5);
    expect(screen.getAllByText("00:00:45:15").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/^00:00:45:(00|23)$/)).toBeNull();
  });

  it("Sincronização e Gravar ficam desativados até existir implementação", () => {
    render(<FilmCraftWorkspace />);
    for (const name of ["Sincronização V1", "Sincronização A1", "Gravar A1"]) {
      const button = screen.getByRole("button", { name });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("title", "Ainda não disponível");
    }
  });

  it("há um único botão de ímã e as ferramentas têm ícones distintos", () => {
    render(<FilmCraftWorkspace />);
    expect(screen.getAllByRole("button", { name: "Snapping" })).toHaveLength(1);
    const tools = within(screen.getByLabelText("Ferramentas de edição"));
    const icon = (name) => tools.getByRole("button", { name }).querySelector("svg").getAttribute("class");
    expect(icon("Slip e slide (Y)")).toContain("arrow-left-right");
    expect(icon("Selecionar faixa (A)")).toContain("arrow-right-to-line");
    expect(icon("Rate stretch (R)")).toContain("gauge");
    const icons = ["Seleção (V)", "Selecionar faixa (A)", "Edição ripple (B)", "Rate stretch (R)", "Razor (C)", "Slip e slide (Y)", "Caneta (P)", "Mão (H)", "Texto (T)"].map(icon);
    expect(new Set(icons).size).toBe(icons.length);
    expect(screen.getByRole("button", { name: "Dividir" }).querySelector("svg").getAttribute("class")).not.toContain("scissors");
  });

  it("atalhos funcionam com o foco no zoom e o Espaço não aciona o botão focado", () => {
    render(<FilmCraftWorkspace />);
    const zoom = screen.getByRole("slider", { name: "Zoom da timeline" });
    zoom.focus();
    fireEvent.keyDown(zoom, { key: " " });
    expect(screen.getByRole("button", { name: "Pausar Programa" })).toBeInTheDocument();
    const play = screen.getByRole("button", { name: "Reproduzir" });
    play.focus();
    expect(fireEvent.keyDown(play, { key: " " })).toBe(false);
    expect(screen.getByRole("button", { name: "Reproduzir Programa" })).toBeInTheDocument();
    const name = screen.getByRole("spinbutton", { name: "IN" });
    fireEvent.keyDown(name, { key: " " });
    expect(screen.getByRole("button", { name: "Reproduzir Programa" })).toBeInTheDocument();
  });
});
