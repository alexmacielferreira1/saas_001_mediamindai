import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GenerativeStudio from "./GenerativeStudio";

const generationApi = vi.hoisted(() => ({
  getImageGenerationStatus: vi.fn(),
  getAISettings: vi.fn(),
  saveAISettings: vi.fn(),
  generateImage: vi.fn(),
}));

vi.mock("../../../api/generation", () => generationApi);

describe("GenerativeStudio", () => {
  beforeEach(() => {
    generationApi.getImageGenerationStatus.mockReset();
    generationApi.getAISettings.mockReset();
    generationApi.saveAISettings.mockReset();
    generationApi.generateImage.mockReset();
    generationApi.getImageGenerationStatus.mockResolvedValue({
      configured: false,
      provider: null,
      model: null,
    });
    generationApi.getAISettings.mockResolvedValue({
      provider: "compatible",
      base_url: "https://api.openai.com/v1",
      model: "gpt-image-1",
      key_configured: false,
      can_manage: true,
    });
  });

  it("edits image generation settings and explains when the provider is unavailable", async () => {
    render(<GenerativeStudio type="image-generator" />);
    fireEvent.change(screen.getByLabelText("Descreva a imagem"), { target: { value: "Retrato cinematográfico" } });
    fireEvent.change(screen.getByLabelText("Proporção da geração"), { target: { value: "16:9" } });
    expect(screen.getByLabelText("Descreva a imagem")).toHaveValue("Retrato cinematográfico");
    expect(screen.getByLabelText("Proporção da geração")).toHaveValue("16:9");
    await waitFor(() => expect(screen.getByRole("button", { name: "Gerar imagem" })).toBeDisabled());
    expect(screen.getByText("Provedor de geração não configurado")).toBeInTheDocument();
  });

  it("generates and displays an image when the provider is configured", async () => {
    generationApi.getImageGenerationStatus.mockResolvedValue({
      configured: true,
      provider: "compatible",
      model: "image-pro",
    });
    generationApi.generateImage.mockResolvedValue({
      images: [{ url: "data:image/png;base64,aW1hZ2U=" }],
      provider: "compatible",
      model: "image-pro",
    });
    render(<GenerativeStudio type="image-generator" />);
    fireEvent.change(screen.getByLabelText("Descreva a imagem"), {
      target: { value: "Um farol sob chuva" },
    });

    const button = await screen.findByRole("button", { name: "Gerar imagem" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);

    expect(await screen.findByRole("img", { name: "Geração 1" })).toHaveAttribute(
      "src",
      "data:image/png;base64,aW1hZ2U=",
    );
    expect(screen.getByText("Provedor conectado: compatible")).toBeInTheDocument();
  });

  it("routes provider management to the shared company settings page", async () => {
    render(<MemoryRouter><GenerativeStudio type="image-generator" /></MemoryRouter>);
    expect(await screen.findByRole("link", { name: "Abrir configuração geral de IA" })).toHaveAttribute("href", "/configuracoes/ia");
    expect(screen.queryByLabelText("Chave da API de IA")).not.toBeInTheDocument();
  });

  it("offers video-specific duration, audio and frame controls", () => {
    render(<GenerativeStudio type="video-generator" />);
    fireEvent.change(screen.getByLabelText("Duração do vídeo"), { target: { value: "9" } });
    fireEvent.click(screen.getByLabelText("Gerar áudio"));
    expect(screen.getByText("9s")).toBeInTheDocument();
    expect(screen.getByLabelText("Gerar áudio")).toBeChecked();
    expect(screen.getByText("Quadro inicial")).toBeInTheDocument();
    expect(screen.getByText("Quadro final")).toBeInTheDocument();
  });
});
