import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import FilmCraftWorkspace from "./FilmCraftWorkspace";
import { currentMCPActions } from "../../lib/mcpActions";
import { ensureTranscription } from "../../lib/clipEngineService";

vi.mock("../../lib/clipEngineService", () => ({ ensureTranscription: vi.fn() }));

const ASSET = "11111111-2222-4333-8444-555555555555";

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => "blob:arquivo");
  URL.revokeObjectURL = vi.fn();
});
beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  ensureTranscription.mockReset();
});

function lane(container, track = "V1") {
  return container.querySelector(`[data-track-id="${track}"]`);
}
function clipsOn(container, track = "V1") {
  return [...lane(container, track).children].filter((node) => node.tagName === "BUTTON");
}
function drop(container, { id, name, duration = 12, track = "V1" }) {
  const payload = { id, name, kind: "video", src: `/api/v1/media/assets/${id}/stream`, duration, mimeType: "video/mp4" };
  fireEvent.drop(lane(container, track), {
    clientX: 0,
    dataTransfer: { getData: (type) => (type === "application/x-timeline2-media" ? JSON.stringify(payload) : "") },
  });
}

async function setup() {
  const view = render(<FilmCraftWorkspace active />);
  drop(view.container, { id: ASSET, name: "Entrevista" });
  await waitFor(() => expect(clipsOn(view.container)).toHaveLength(1));
  return { ...view, provider: currentMCPActions() };
}

describe("MMFilm · provedor do MCP", () => {
  it("rodapé mostra a sequência, troca as trilhas alvo e abre o SRT", async () => {
    const { container, provider } = await setup();
    const footer = provider.footer();
    expect(footer.info).toBe("Sequência 01 · 1920×1080 · 29,97 fps · 8,0 s");
    expect(footer.buttons.map((button) => [button.id, button.tab])).toEqual([
      ["transcrever", "transcricao"],
      ["srt", undefined],
      ["legendas", "legendas"],
    ]);
    const input = container.querySelector('input[aria-label="Importar legendas SRT ou VTT (MCP)"]');
    const click = vi.spyOn(input, "click");
    footer.buttons[1].onClick();
    expect(click).toHaveBeenCalledTimes(1);
    expect(footer.chips.map((chip) => chip.label)).toEqual(["A3 SFX", "V3 Legendas"]);
    act(() => footer.chips[0].onClick());
    act(() => provider.footer().chips[1].onClick());
    expect(provider.footer().chips.map((chip) => chip.label)).toEqual(["A2 SFX", "V2 Legendas"]);
    expect(provider.catalogue().tools.find((tool) => tool.id === "sfx.auto").params.find((param) => param.key === "track").default).toBe("A2");
    await act(() => provider.apply("transcribe.importsrt", {}));
    expect(click).toHaveBeenCalledTimes(2);
  });

  it("guarda backup antes de alterar, restaura e faz backup manual", async () => {
    const { container, provider } = await setup();
    fireEvent.click(clipsOn(container)[0]);
    await act(() => provider.apply("motion.punch", {}));
    let backups = provider.catalogue().tools.find((tool) => tool.id === "backup.restore").params[0].options;
    expect(backups).toHaveLength(1);
    expect(backups[0][1]).toMatch(/^\d\d:\d\d · Antes de “Punch in”$/);
    await act(() => provider.apply("motion.zoom", { backup: false }));
    expect(provider.catalogue().tools.find((tool) => tool.id === "backup.restore").params[0].options).toHaveLength(1);
    const restored = await act(() => provider.apply("backup.restore", { backupId: backups[0][0] }));
    expect(restored.summary).toMatch(/^Sequência restaurada para “Antes de “Punch in””/);
    expect(container.querySelector("video").style.transform).toContain("scale(1)");
    await act(() => provider.apply("backup.create", {}));
    backups = provider.catalogue().tools.find((tool) => tool.id === "backup.restore").params[0].options;
    expect(backups.map(([, label]) => label.split(" · ")[1])).toEqual(["Backup manual", "Antes de “Punch in”"]);
  });

  it("prévia diz que nada foi alterado, exporta SRT, move o indicador e toca a prévia de som", async () => {
    const { container, provider } = await setup();
    const preview = await act(() => provider.analyze("sfx.library", {}));
    expect(preview.summary).toMatch(/^Nenhum som no projeto/);
    const anchor = { click: vi.fn() };
    const create = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag, options) => (tag === "a" ? Object.assign(create("a"), anchor) : create(tag, options)));
    fireEvent.change(container.querySelector('input[aria-label="Importar legendas SRT ou VTT (MCP)"]'), {
      target: { files: [new File(["1\n00:00:00,000 --> 00:00:02,000\nOlá\n"], "f.srt", { type: "text/plain" })] },
    });
    await waitFor(() => expect(clipsOn(container, "V3")).toHaveLength(1));
    const exported = await act(() => provider.apply("captions.exportsrt", {}));
    expect(exported).toMatchObject({ ok: true, count: 1 });
    expect(exported.download).toBeUndefined();
    expect(anchor.click).toHaveBeenCalled();
    act(() => provider.seek(-3));
    act(() => provider.seek(4));
    expect(container.textContent).toContain("00:04");
    const played = [];
    vi.stubGlobal(
      "Audio",
      vi.fn(function Audio(url) {
        this.url = url;
        this.pause = vi.fn();
        this.play = vi.fn(() => Promise.reject(new Error("bloqueado")));
        played.push(this);
      }),
    );
    provider.preview({ id: "desconhecido" });
    fireEvent.change(container.querySelector('input[accept="video/*,audio/*,image/*"]'), {
      target: { files: [new File(["a"], "whoosh.wav", { type: "audio/wav" })] },
    });
    const sound = await waitFor(() => {
      const found = provider.catalogue().tools.find((tool) => tool.id === "sfx.library").params[0].options;
      expect(found.map(([value]) => value)).toContain("Whoosh");
      return found;
    });
    expect(sound).toBeTruthy();
    const media = (await act(() => provider.analyze("sfx.library", {}))).items[0];
    provider.preview(media);
    provider.preview(media);
    expect(played).toHaveLength(2);
    expect(played[0].pause).toHaveBeenCalled();
    expect(played[1].play).toHaveBeenCalled();
  });

  it("transcreve pelo serviço do Acervo com progresso e explica a mudança de cena indisponível", async () => {
    ensureTranscription.mockResolvedValue({ segments: [{ start_ms: 500, end_ms: 2500, texto: "olá do acervo" }], reused: true });
    const { container, provider } = await setup();
    const progress = vi.fn();
    const result = await act(() => provider.apply("transcribe.run", {}, { onProgress: progress }));
    expect(ensureTranscription).toHaveBeenCalledWith(expect.objectContaining({ id: ASSET, title: "Entrevista" }), { durationSeconds: 12 });
    expect(progress).toHaveBeenCalledWith(0.3, "Transcrevendo Entrevista…");
    expect(result).toMatchObject({ ok: true, count: 1 });
    await waitFor(() => expect(clipsOn(container, "V3")).toHaveLength(1));
    await expect(provider.analyze("cuts.pauses", { mode: "cena" })).rejects.toThrow(/Não foi possível ler os quadros do vídeo/);
  });

  it("sem Audio no ambiente, a prévia de som não faz nada", async () => {
    const { provider } = await setup();
    vi.stubGlobal("Audio", undefined);
    expect(() => provider.preview({ id: ASSET })).not.toThrow();
  });
});
