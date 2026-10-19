import { describe, expect, it } from "vitest";
import {
  VIDEO_STUDIO_STAGES,
  buildVideoStudioPrompt,
  exportVideoStudioProject,
  markAllStagesStale,
  markDownstreamStale,
} from "./videoStudioPipeline";

describe("videoStudioPipeline", () => {
  it("defines the complete eight-stage production flow", () => {
    expect(VIDEO_STUDIO_STAGES.map(({ id }) => id)).toEqual([
      "roteiro",
      "elementos",
      "mood_style",
      "character_sheets",
      "shot_list",
      "storyboard",
      "prompts",
      "multiplanos",
    ]);
    expect(VIDEO_STUDIO_STAGES.map(({ label }) => label)).toEqual([
      "Roteiro",
      "Elementos",
      "Mood & style",
      "Character sheets",
      "Shot list",
      "Storyboard",
      "Prompts",
      "Multiplanos",
    ]);
  });

  it("starts from an idea and includes the selected video engine in its prompt", () => {
    const prompt = buildVideoStudioPrompt("roteiro", {
      idea: "Uma médica volta à cidade onde cresceu",
      engine: "Kling 3.0",
    });
    expect(prompt).toContain("Uma médica volta à cidade onde cresceu");
    expect(prompt).toContain("roteiro");
  });

  it("preserves a saved channel script as source material when generating the roteiro stage", () => {
    const prompt = buildVideoStudioPrompt("roteiro", {
      idea: "Um farol abandonado",
      outputs: { roteiro: { text: "Abertura aprovada pela equipe" } },
    });
    expect(prompt).toContain("Um farol abandonado");
    expect(prompt).toContain("Abertura aprovada pela equipe");
  });

  it("passes only required approved context to the next stage", () => {
    const prompt = buildVideoStudioPrompt("elementos", {
      idea: "Uma ideia que não deve substituir o roteiro",
      outputs: { roteiro: { text: "ROTEIRO APROVADO" } },
    });
    expect(prompt).toContain("ROTEIRO APROVADO");
    expect(prompt).not.toContain("Uma ideia que não deve substituir o roteiro");
  });

  it("requires the preceding stage before building downstream prompts", () => {
    expect(() => buildVideoStudioPrompt("storyboard", { outputs: {} })).toThrow(
      "Gere primeiro as etapas necessárias",
    );
  });

  it("does not build on a result marked stale after an upstream edit", () => {
    expect(() => buildVideoStudioPrompt("elementos", {
      outputs: { roteiro: { text: "roteiro desatualizado", stale: true } },
    })).toThrow("Gere primeiro as etapas necessárias");
  });

  it("marks downstream material stale without deleting generated work", () => {
    const outputs = {
      roteiro: { text: "roteiro revisado" },
      elementos: { text: "elementos antigos" },
      shot_list: { text: "planos antigos" },
    };
    const updated = markDownstreamStale(outputs, "roteiro");
    expect(updated.roteiro).toEqual(outputs.roteiro);
    expect(updated.elementos).toMatchObject({ text: "elementos antigos", stale: true });
    expect(updated.shot_list).toMatchObject({ text: "planos antigos", stale: true });
  });

  it("marks generated stages stale after changing the source idea or video engine", () => {
    const outputs = {
      roteiro: { text: "roteiro" },
      prompts: { text: "prompts" },
      multiplanos: { text: "blocos" },
    };
    expect(markAllStagesStale(outputs)).toEqual({
      roteiro: { text: "roteiro", stale: true },
      prompts: { text: "prompts", stale: true },
      multiplanos: { text: "blocos", stale: true },
    });
    expect(outputs.roteiro.stale).toBeUndefined();
  });

  it("exports idea, selected engine and all generated stages as a portable document", () => {
    const text = exportVideoStudioProject({
      title: "Projeto teste",
      idea: "Uma viagem no tempo",
      engine: "Seedance 2.0",
      outputs: { roteiro: { text: "Cena um" }, prompts: { text: "Prompt em inglês" } },
    });
    expect(text).toContain("Projeto teste");
    expect(text).toContain("Seedance 2.0");
    expect(text).toContain("Cena um");
    expect(text).toContain("Prompt em inglês");
  });
});
