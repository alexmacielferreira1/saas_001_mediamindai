import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("../components/ai-tools/VideoStudio", () => ({
  default: () => <div data-testid="video-studio">Estúdio recuperado</div>,
}));

import VideoGeneration from "./VideoGeneration";

describe("VideoGeneration", () => {
  it("presents the dedicated video generation page and its pipeline", () => {
    render(<MemoryRouter><VideoGeneration /></MemoryRouter>);

    expect(screen.getByRole("heading", { name: "Geração de vídeo" })).toBeInTheDocument();
    expect(screen.getByText("Pipeline de 8 etapas")).toBeInTheDocument();
    expect(screen.getByTestId("video-studio")).toBeInTheDocument();
  });
});
