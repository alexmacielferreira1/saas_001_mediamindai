import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listMock = vi.fn();
const toastMock = vi.fn();

vi.mock("@/components/ui/use-toast", () => ({ toast: (...args) => toastMock(...args) }));

vi.mock('@/api/base44Client', () => ({
  base44: {
    entities: {
      ProducaoProjeto: {
        list: listMock,
        bulkCreate: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    },
  },
}));

describe('production project store loading', () => {
  beforeEach(() => {
    vi.resetModules();
    listMock.mockReset().mockResolvedValue([]);
    toastMock.mockReset();
  });

  it('does not request protected production data merely by importing the module', async () => {
    await import('./producaoStore');
    expect(listMock).not.toHaveBeenCalled();
  });

  it('loads production data when an authenticated screen subscribes to the store', async () => {
    const store = await import('./producaoStore');
    renderHook(() => store.useProducaoProjetos());

    await waitFor(() => expect(listMock).toHaveBeenCalledWith('ordem', 200));
  });

  it('keeps linked media and editing metadata through load and save', async () => {
    listMock.mockResolvedValue([{id:'edit-source',titulo:'Master',materiais:[{id:'m1',nome:'master.mp4',url:'/master.mp4'}],edicao_status:'corte_fino',edicao_obs:'Ajustar áudio',prazo_edicao:'2026-10-20'}]);
    const store=await import('./producaoStore');
    const {result}=renderHook(()=>store.useProducaoProjetos());
    await waitFor(()=>expect(result.current.find(item=>item.id==='edit-source')?.materiais?.[0]?.url).toBe('/master.mp4'));
    const {base44}=await import('@/api/base44Client');
    base44.entities.ProducaoProjeto.update.mockResolvedValue({});
    store.updateProjeto('edit-source',{edicao_obs:'Áudio corrigido'});
    expect(base44.entities.ProducaoProjeto.update).toHaveBeenCalledWith('edit-source',expect.objectContaining({materiais:[{id:'m1',nome:'master.mp4',url:'/master.mp4'}],edicao_obs:'Áudio corrigido',edicao_status:'corte_fino',prazo_edicao:'2026-10-20'}));
  });

  it("marks a failed update as not saved, keeps the edit and warns instead of swallowing the error", async () => {
    listMock.mockResolvedValue([{ id: "p1", titulo: "Real" }]);
    const store = await import("./producaoStore");
    const { result } = renderHook(() => store.useProducaoProjetos());
    await waitFor(() => expect(result.current[0]?.id).toBe("p1"));
    const { base44 } = await import("@/api/base44Client");
    base44.entities.ProducaoProjeto.update.mockReset().mockRejectedValue(new Error("Servidor fora"));

    const ok = await store.updateProjeto("p1", { titulo: "Editado" });

    expect(ok).toBe(false);
    expect(store.getSaveState("p1")).toEqual({ status: "error", error: "A alteração não foi salva no servidor: Servidor fora" });
    expect(store.getProjetos().find((p) => p.id === "p1").titulo).toBe("Editado");
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive", title: "Falha ao salvar produção" }));
  });

  it("reports saved only after the server confirms and retries through salvarProjeto", async () => {
    listMock.mockResolvedValue([{ id: "p1", titulo: "Real" }]);
    const store = await import("./producaoStore");
    renderHook(() => store.useProducaoProjetos());
    await waitFor(() => expect(store.getProjetos()[0]?.id).toBe("p1"));
    const { base44 } = await import("@/api/base44Client");
    let resolve;
    base44.entities.ProducaoProjeto.update.mockReset().mockImplementation(() => new Promise((r) => { resolve = r; }));

    const pending = store.salvarProjeto("p1");
    expect(store.getSaveState("p1").status).toBe("saving");
    resolve({});
    await expect(pending).resolves.toBe(true);
    expect(store.getSaveState("p1").status).toBe("saved");
    await expect(store.salvarProjeto("inexistente")).resolves.toBe(false);
  });

  it("creates a new project once even when edits arrive while the create is in flight", async () => {
    const store = await import("./producaoStore");
    renderHook(() => store.useProducaoProjetos());
    await waitFor(() => expect(listMock).toHaveBeenCalled());
    const { base44 } = await import("@/api/base44Client");
    let resolveCreate;
    base44.entities.ProducaoProjeto.create.mockReset().mockImplementation(() => new Promise((r) => { resolveCreate = r; }));
    base44.entities.ProducaoProjeto.update.mockReset().mockResolvedValue({});

    const id = store.addProjeto({ titulo: "Nova" });
    const second = store.updateProjeto(id, { titulo: "Nova editada" });
    resolveCreate({ id: "srv-1" });

    await expect(second).resolves.toBe(true);
    expect(base44.entities.ProducaoProjeto.create).toHaveBeenCalledTimes(1);
    expect(base44.entities.ProducaoProjeto.update).toHaveBeenLastCalledWith("srv-1", expect.objectContaining({ titulo: "Nova editada" }));
    expect(store.getProjetos().find((p) => p.id === id)._entityId).toBe("srv-1");
  });

  it("fails a create without server id instead of pretending it was saved", async () => {
    const store = await import("./producaoStore");
    renderHook(() => store.useProducaoProjetos());
    await waitFor(() => expect(listMock).toHaveBeenCalled());
    const { base44 } = await import("@/api/base44Client");
    base44.entities.ProducaoProjeto.create.mockReset().mockResolvedValue(undefined);

    const id = store.addProjeto({ titulo: "Nova" });
    await waitFor(() => expect(store.getSaveState(id)?.status).toBe("error"));
    expect(toastMock).toHaveBeenCalled();
  });

  it("does not fall back to mock data when loading fails and exposes the error", async () => {
    listMock.mockRejectedValue(new Error("Sem conexão"));
    const store = await import("./producaoStore");
    const { result } = renderHook(() => ({ list: store.useProducaoProjetos(), error: store.useProducaoLoadError(), ready: store.useProducaoReady() }));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.list).toEqual([]);
    expect(result.current.error).toBe("Sem conexão");
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Falha ao carregar produções" }));
  });

  it("clears tenant data from memory on reset (logout)", async () => {
    listMock.mockResolvedValue([{ id: "p1", titulo: "Real" }]);
    const store = await import("./producaoStore");
    renderHook(() => store.useProducaoProjetos());
    await waitFor(() => expect(store.getProjetos()[0]?.id).toBe("p1"));

    store.resetProducaoStore();

    expect(store.getProjetos()).toEqual([]);
    expect(store.getSaveState("p1")).toBeNull();
  });

  it("reverts a stage change refused by the server (409) and shows the server message", async () => {
    listMock.mockResolvedValue([{ id: "p1", titulo: "Real", etapa: "rascunho", historico: [] }]);
    const store = await import("./producaoStore");
    renderHook(() => store.useProducaoProjetos());
    await waitFor(() => expect(store.getProjetos()[0]?.id).toBe("p1"));
    const { base44 } = await import("@/api/base44Client");
    const refused = Object.assign(new Error("Mudança de etapa fora da ordem do fluxo de produção."), { status: 409, code: "PRODUCTION_STAGE_TRANSITION_INVALID" });
    base44.entities.ProducaoProjeto.update.mockReset().mockRejectedValue(refused);

    const ok = await store.transicionar("p1", "finalizado", { obs: "salto" });

    expect(ok).toBe(false);
    const p = store.getProjetos().find((x) => x.id === "p1");
    expect(p.etapa).toBe("rascunho");
    expect(p.historico).toEqual([]);
    expect(store.getSaveState("p1")).toEqual({ status: "error", error: "Mudança de etapa recusada pelo servidor: Mudança de etapa fora da ordem do fluxo de produção." });
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Mudança de etapa recusada", variant: "destructive" }));
  });

  it("also reverts on 422 PRODUCTION_STAGE_INVALID and keeps unrelated local edits", async () => {
    listMock.mockResolvedValue([{ id: "p1", titulo: "Real", etapa: "gravacoes" }]);
    const store = await import("./producaoStore");
    renderHook(() => store.useProducaoProjetos());
    await waitFor(() => expect(store.getProjetos()[0]?.id).toBe("p1"));
    const { base44 } = await import("@/api/base44Client");
    base44.entities.ProducaoProjeto.update.mockReset().mockRejectedValue(Object.assign(new Error("Etapa de produção desconhecida."), { status: 422, code: "PRODUCTION_STAGE_INVALID" }));

    await store.updateProjeto("p1", { etapa: "xpto", titulo: "Novo título" });

    expect(store.getProjetos()[0]).toMatchObject({ etapa: "gravacoes", titulo: "Novo título" });
  });

  it("serializes writes per project so quick moves reach the server in order", async () => {
    listMock.mockResolvedValue([{ id: "p1", titulo: "Real", etapa: "rascunho" }]);
    const store = await import("./producaoStore");
    renderHook(() => store.useProducaoProjetos());
    await waitFor(() => expect(store.getProjetos()[0]?.id).toBe("p1"));
    const { base44 } = await import("@/api/base44Client");
    const resolvers = [];
    base44.entities.ProducaoProjeto.update.mockReset().mockImplementation((id, data) => new Promise((r) => resolvers.push(() => r({ id, ...data }))));

    const first = store.moverEtapa("p1", 1);
    const second = store.setEtapa("p1", "gravacoes");

    expect(base44.entities.ProducaoProjeto.update).toHaveBeenCalledTimes(1);
    expect(base44.entities.ProducaoProjeto.update.mock.calls[0][1].etapa).toBe("agendamentos");
    resolvers[0]();
    await waitFor(() => expect(base44.entities.ProducaoProjeto.update).toHaveBeenCalledTimes(2));
    expect(base44.entities.ProducaoProjeto.update.mock.calls[1][1].etapa).toBe("gravacoes");
    expect(store.getSaveState("p1").status).toBe("saving");
    resolvers[1]();
    await expect(second).resolves.toBe(true);
    await expect(first).resolves.toBe(true);
    expect(store.getSaveState("p1").status).toBe("saved");
  });

  it("creates with the initial stage and sends later stage moves as separate updates", async () => {
    const store = await import("./producaoStore");
    renderHook(() => store.useProducaoProjetos());
    await waitFor(() => expect(listMock).toHaveBeenCalled());
    const { base44 } = await import("@/api/base44Client");
    let resolveCreate;
    base44.entities.ProducaoProjeto.create.mockReset().mockImplementation(() => new Promise((r) => { resolveCreate = r; }));
    base44.entities.ProducaoProjeto.update.mockReset().mockImplementation(async (id, data) => ({ id, ...data }));

    const id = store.addProjeto({ titulo: "Nova" });
    store.setEtapa(id, "agendamentos");
    const last = store.setEtapa(id, "gravacoes");

    expect(base44.entities.ProducaoProjeto.create).toHaveBeenCalledWith(expect.objectContaining({ etapa: "rascunho" }));
    resolveCreate({ id: "srv-9", etapa: "rascunho" });
    await expect(last).resolves.toBe(true);
    expect(base44.entities.ProducaoProjeto.update.mock.calls.map(([entityId, data]) => [entityId, data.etapa])).toEqual([["srv-9", "agendamentos"], ["srv-9", "gravacoes"]]);
  });

  it("shows example projects on an empty tenant without writing them to the database", async () => {
    const { base44: mocked } = await import("@/api/base44Client");
    mocked.entities.ProducaoProjeto.bulkCreate.mockReset();
    mocked.entities.ProducaoProjeto.create.mockReset();
    const store = await import("./producaoStore");
    const { result } = renderHook(() => store.useProducaoProjetos());
    await waitFor(() => expect(listMock).toHaveBeenCalled());
    const { base44 } = await import("@/api/base44Client");
    expect(result.current.length).toBeGreaterThan(0);
    expect(result.current.every((p) => p.is_demo === true)).toBe(true);
    expect(base44.entities.ProducaoProjeto.bulkCreate).not.toHaveBeenCalled();
    expect(base44.entities.ProducaoProjeto.create).not.toHaveBeenCalled();
  });

  it("refuses to save an example project, warns once and never creates it on the server", async () => {
    const store = await import("./producaoStore");
    const { result } = renderHook(() => store.useProducaoProjetos());
    await waitFor(() => expect(listMock).toHaveBeenCalled());
    const { base44 } = await import("@/api/base44Client");
    base44.entities.ProducaoProjeto.create.mockReset();
    base44.entities.ProducaoProjeto.update.mockReset();
    const demo = result.current[0];

    await expect(store.updateProjeto(demo.id, { titulo: "Editado" })).resolves.toBe(false);
    await expect(store.setEtapa(demo.id, "gravacoes")).resolves.toBe(false);

    expect(base44.entities.ProducaoProjeto.create).not.toHaveBeenCalled();
    expect(base44.entities.ProducaoProjeto.update).not.toHaveBeenCalled();
    expect(store.getSaveState(demo.id)).toEqual(expect.objectContaining({ status: "error" }));
    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Projeto de demonstração" }));
  });

  it("still saves a new production created next to the examples", async () => {
    const store = await import("./producaoStore");
    renderHook(() => store.useProducaoProjetos());
    await waitFor(() => expect(listMock).toHaveBeenCalled());
    const { base44 } = await import("@/api/base44Client");
    base44.entities.ProducaoProjeto.create.mockReset().mockResolvedValue({ id: "srv-1", etapa: "rascunho" });

    const id = store.addProjeto({ titulo: "Nova real" });

    await waitFor(() => expect(store.getSaveState(id)?.status).toBe("saved"));
    expect(base44.entities.ProducaoProjeto.create).toHaveBeenCalledTimes(1);
    expect(base44.entities.ProducaoProjeto.create.mock.calls[0][0]).not.toHaveProperty("is_demo");
  });
});
