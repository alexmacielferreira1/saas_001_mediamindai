"use client";
import { useEffect } from "react";
import { create } from "zustand";
import type { ContentAsset, WorkspaceSnapshot } from "./types";

export async function workspaceRequest<T = unknown>(
	body: Record<string, unknown>,
): Promise<T> {
	const response = await fetch("/api/workspace", {
		method: "POST",
		cache: "no-store",
		headers: {
			"Content-Type": "application/json",
			"x-opencut-client": "integrations",
		},
		body: JSON.stringify(body),
	});
	const result = await response.json();
	if (!response.ok)
		throw new Error(result.error || "Não foi possível concluir a operação.");
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Typed local transport boundary; all mutation inputs are validated by the server.
	return result as T;
}
export const useWorkspace = create<{
	data: WorkspaceSnapshot | null;
	error: string;
	accountId: string;
	refresh: () => Promise<void>;
	selectAccount: (id: string) => void;
}>((set, get) => ({
	data: null,
	error: "",
	accountId: "",
	selectAccount: (accountId) => set({ accountId }),
	refresh: async () => {
		try {
			const data = await workspaceRequest<WorkspaceSnapshot>({
				action: "snapshot",
			});
			const current = get().accountId;
			set({
				data,
				error: "",
				accountId: data.accounts.some((a) => a.id === current)
					? current
					: data.accounts[0]?.id || "",
			});
		} catch (error) {
			set({
				error:
					error instanceof Error ? error.message : "Servidor indisponível.",
			});
		}
	},
}));
export function useWorkspacePolling() {
	const refresh = useWorkspace((state) => state.refresh);
	useEffect(() => {
		void refresh();
		const timer = setInterval(() => void refresh(), 4000);
		return () => clearInterval(timer);
	}, [refresh]);
}
export async function uploadAsset({
	file,
	kind,
	projectId,
}: {
	file: File;
	kind: "source" | "export";
	projectId?: string;
}): Promise<ContentAsset> {
	if (file.size > 500 * 1024 * 1024)
		throw new Error("O limite por vídeo é 500 MB.");
	const response = await fetch("/api/workspace/assets", {
		method: "POST",
		headers: {
			"x-opencut-client": "integrations",
			"Content-Type": file.type || "video/mp4",
			"x-ai-filename": encodeURIComponent(file.name),
			"x-ai-kind": kind,
			...(projectId ? { "x-ai-project": projectId } : {}),
		},
		body: file,
	});
	const result = await response.json();
	if (!response.ok) throw new Error(result.error || "Falha ao enviar vídeo.");
	await useWorkspace.getState().refresh();
	return result;
}
export function assetUrl(id: string) {
	return "/api/workspace/assets?id=" + encodeURIComponent(id);
}
export const statusLabel: Record<string, string> = {
	queued: "Na fila",
	editing: "Editando",
	review: "Revisão",
	failed: "Falhou",
	cancelled: "Cancelado",
	scheduled: "Agendado",
	uploading: "Enviando",
	processing: "Processando na Meta",
	publishing: "Publicando",
	published: "Publicado",
	needs_review: "Conferir no Instagram",
	connected: "Conectado",
	unverified: "Validar conexão",
	error: "Conexão com erro",
};
