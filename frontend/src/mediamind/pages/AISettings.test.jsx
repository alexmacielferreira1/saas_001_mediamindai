import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AISettings from "./AISettings";
const api = vi.hoisted(() => ({
  getAICompanies: vi.fn(),
  getAIConnections: vi.fn(),
  saveAIConnections: vi.fn(),
}));
vi.mock("../../api/generation", () => api);
vi.mock("../lib/empresaContext", () => ({
  useEmpresa: () => ({ currentEmpresa: { id: "acme", nome: "Acme" } }),
}));
const config = {
  can_manage: true,
  connections: [
    {
      id: "images",
      name: "Imagens",
      provider: "compatible",
      base_url: "https://images.example.test/v1",
      model: "image",
      enabled: true,
      key_configured: true,
    },
  ],
  default_connection_id: "images",
  tool_connections: {},
};
describe("company AI connections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getAICompanies.mockResolvedValue({
      companies: [
        { id: "acme", name: "Acme" },
        { id: "other", name: "Outra" },
      ],
      is_superadmin: true,
    });
    api.getAIConnections.mockResolvedValue(config);
    api.saveAIConnections.mockResolvedValue(config);
  });
  it("saves horizontal tool selection and preserves an existing key", async () => {
    render(<AISettings />);
    const checkbox = await screen.findByRole("checkbox", {
      name: "Gerador de Imagem · Imagens",
    });
    fireEvent.click(checkbox);
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar configurações da empresa" }),
    );
    await screen.findByText("Configurações salvas para Acme.");
    expect(api.saveAIConnections).toHaveBeenCalledWith(
      expect.objectContaining({
        tool_connections: { "image-generator": null },
      }),
      "acme",
    );
    expect(
      api.saveAIConnections.mock.calls[0][0].connections[0],
    ).not.toHaveProperty("api_key");
  });
  it("lets a superadmin load another company without reusing its key", async () => {
    render(<AISettings />);
    await screen.findByRole("checkbox", {
      name: "Todas as ferramentas · Imagens",
    });
    fireEvent.change(screen.getByLabelText("Chave da API 1"), {
      target: { value: "unsaved-secret" },
    });
    fireEvent.change(screen.getByLabelText("Configurar empresa"), {
      target: { value: "other" },
    });
    await waitFor(() =>
      expect(api.getAIConnections).toHaveBeenCalledWith("other"),
    );
    expect(await screen.findByLabelText("Chave da API 1")).toHaveValue("");
  });
  it("fills provider defaults and keeps the custom name while clearing the key", async () => {
    render(<AISettings />);
    await screen.findByLabelText("Provedor 1");
    fireEvent.change(screen.getByLabelText("Nome da conexão 1"), {
      target: { value: "Minha IA" },
    });
    fireEvent.change(screen.getByLabelText("Chave da API 1"), {
      target: { value: "unsaved" },
    });
    fireEvent.change(screen.getByLabelText("Provedor 1"), {
      target: { value: "claude" },
    });
    expect(screen.getByLabelText("Nome da conexão 1")).toHaveValue("Minha IA");
    expect(screen.getByLabelText("Modelo 1")).toHaveValue("claude-sonnet-5-5");
    expect(screen.getByLabelText("Endereço da API 1")).toHaveValue(
      "https://api.anthropic.com/v1",
    );
    expect(screen.getByLabelText("Chave da API 1")).toHaveValue("");
    expect(screen.getByText("IA do sistema")).toBeInTheDocument();
  });
});
