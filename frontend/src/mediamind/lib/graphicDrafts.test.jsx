import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GraphicDraftProvider, useGraphicDraftState } from "./graphicDrafts";
import Roteiro2 from "../pages/Roteiro2";
vi.mock("../../api/media", () => ({ listMediaAssets: vi.fn().mockResolvedValue([]) }));
vi.mock("../../api/scripts", () => ({ listScripts: vi.fn().mockResolvedValue([]), createScript: vi.fn().mockRejectedValue(new Error("offline")), updateScript: vi.fn().mockRejectedValue(new Error("offline")) }));

function Editor() {
  const [value, setValue] = useGraphicDraftState("photo:layers", "initial");
  return <input aria-label="Draft" value={value} onChange={event => setValue(event.target.value)} />;
}
let saved;
beforeEach(() => {
  saved = new Map();
  vi.stubGlobal("indexedDB", { open: () => {
    const request = {};
    queueMicrotask(() => {
      request.result = { close() {}, transaction: () => {
        const transaction = { objectStore: () => ({
          get: key => { const get = {}; queueMicrotask(() => { get.result = saved.get(key); get.onsuccess(); }); return get; },
          put: (value, key) => { saved.set(key, value); queueMicrotask(() => transaction.oncomplete()); },
        }) };
        return transaction;
      } };
      request.onsuccess();
    });
    return request;
  } });
});
describe("graphic autosave", () => {
  it("restores a real unsaved script form after a server error and remount", async () => {
    const first = render(<GraphicDraftProvider scope="company:user:roteiros"><Roteiro2 /></GraphicDraftProvider>);
    fireEvent.click(await screen.findByRole("button", { name: "Novo roteiro 2" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Título/ }), { target: { value: "Meu roteiro pendente" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));
    await screen.findByText(/Não foi possível salvar/);
    expect(screen.getByRole("textbox", { name: /Título/ })).toHaveValue("Meu roteiro pendente");
    await screen.findByText("Rascunho salvo neste navegador");
    first.unmount();
    render(<GraphicDraftProvider scope="company:user:roteiros"><Roteiro2 /></GraphicDraftProvider>);
    expect(await screen.findByRole("textbox", { name: /Título/ })).toHaveValue("Meu roteiro pendente");
  });
  it("keeps independent drafts when switching resource keys in the same component", async () => {
    function Resource({ id }) {
      const [text, setText] = useGraphicDraftState(`resource:${id}`, "");
      return <input aria-label="Resource" value={text} onChange={event => setText(event.target.value)} />;
    }
    const view = render(<GraphicDraftProvider scope="company:user"><Resource id="one" /></GraphicDraftProvider>);
    fireEvent.change(await screen.findByLabelText("Resource"), { target: { value: "first work" } });
    view.rerender(<GraphicDraftProvider scope="company:user"><Resource id="two" /></GraphicDraftProvider>);
    expect(screen.getByLabelText("Resource")).toHaveValue("");
    fireEvent.change(screen.getByLabelText("Resource"), { target: { value: "second work" } });
    view.rerender(<GraphicDraftProvider scope="company:user"><Resource id="one" /></GraphicDraftProvider>);
    expect(screen.getByLabelText("Resource")).toHaveValue("first work");
  });
  it("omits credentials from archived form data", async () => {
    function SafeForm() {
      useGraphicDraftState("form", { title: "My work", api_key: "secret-test", password: "password-test", nested: { access_token: "token-test", text: "safe" } });
      return <p>Form ready</p>;
    }
    render(<GraphicDraftProvider scope="company:user"><SafeForm /></GraphicDraftProvider>);
    await screen.findByText("Form ready");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Rascunho salvo"));
    expect(saved.get("company:user").form).toEqual({ title: "My work", nested: { text: "safe" } });
  });
  it("rejects an invalid recovery file without replacing the working document", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<GraphicDraftProvider scope="acme:alex"><Editor /></GraphicDraftProvider>);
    fireEvent.change(await screen.findByLabelText("Draft"), { target: { value: "keep my work" } });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Rascunho salvo"));
    fireEvent.change(screen.getByLabelText("Abrir arquivo de recuperação"), { target: { files: [{ text: async () => '{"schema":"wrong"}' }] } });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("trabalho atual foi preservado"));
    expect(screen.getByLabelText("Draft")).toHaveValue("keep my work");
  });
  it("restores the previous valid draft and keeps the replaced draft as backup", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<GraphicDraftProvider scope="acme:alex"><Editor /></GraphicDraftProvider>);
    fireEvent.change(await screen.findByLabelText("Draft"), { target: { value: "first version" } });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Rascunho salvo"));
    fireEvent.change(screen.getByLabelText("Draft"), { target: { value: "second version" } });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Rascunho salvo"));
    fireEvent.click(screen.getByRole("button", { name: "Restaurar cópia anterior" }));
    await waitFor(() => expect(screen.getByLabelText("Draft")).toHaveValue("first version"));
    expect(saved.get("acme:alex:previous")["photo:layers"]).toBe("second version");
  });
  it("archives imported media as a Blob and restores a fresh usable URL", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(["image bytes"], { type: "image/png" }) }));
    URL.createObjectURL = vi.fn(() => "blob:restored-image");
    const first = render(<GraphicDraftProvider scope="acme:alex"><Editor /></GraphicDraftProvider>);
    fireEvent.change(await screen.findByLabelText("Draft"), { target: { value: "blob:imported-image" } });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Rascunho salvo"));
    expect(saved.get("acme:alex")["photo:layers"].blob).toBeInstanceOf(Blob);
    first.unmount();
    render(<GraphicDraftProvider scope="acme:alex"><Editor /></GraphicDraftProvider>);
    expect(await screen.findByLabelText("Draft")).toHaveValue("blob:restored-image");
  });
  it("restores edits after unmount and isolates another company/user", async () => {
    const first = render(<GraphicDraftProvider scope="acme:alex"><Editor /></GraphicDraftProvider>);
    fireEvent.change(await screen.findByLabelText("Draft"), { target: { value: "edited layers" } });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Rascunho salvo"));
    first.unmount();
    const second = render(<GraphicDraftProvider scope="acme:alex"><Editor /></GraphicDraftProvider>);
    expect(await screen.findByLabelText("Draft")).toHaveValue("edited layers");
    second.unmount();
    render(<GraphicDraftProvider scope="another:alex"><Editor /></GraphicDraftProvider>);
    expect(await screen.findByLabelText("Draft")).toHaveValue("initial");
  });
  it("reports unavailable storage without claiming the draft was saved", async () => {
    vi.stubGlobal("indexedDB", { open: () => { throw new Error("quota"); } });
    render(<GraphicDraftProvider scope="acme:alex"><Editor /></GraphicDraftProvider>);
    fireEvent.change(await screen.findByLabelText("Draft"), { target: { value: "edited" } });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Armazenamento local indisponível"));
  });
});
