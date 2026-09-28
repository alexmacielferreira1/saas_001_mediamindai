import { create } from "zustand";
import { z } from "zod";
import type { EditorCore } from "@/core";
import type { MediaAsset } from "@/media/types";
import { processMediaAssets } from "@/media/processing";
import { storageService } from "@/services/storage/service";
import { templateEngine } from "@/templates/engine";
import {
	EMPTY_ELEMENT_LIBRARY,
	elementUpdateSchema,
	elementFilesSchema,
	libraryAssetSchema,
	librarySnapshotSchema,
	type ElementLibrary,
	type LibraryAsset,
} from "./element-library-contract";

const endpoint = "/api/element-library";
const headers = { "x-opencut-client": "integrations" };
export const useLocalElementLibrary = create<{
	library: ElementLibrary;
	assets: LibraryAsset[];
	directory: string;
	loading: boolean;
	error: string;
	warnings: string[];
}>(() => ({
	library: EMPTY_ELEMENT_LIBRARY,
	assets: [],
	directory: "",
	loading: false,
	error: "",
	warnings: [],
}));
async function request(body?: object | FormData) {
	const response = await fetch(endpoint, {
		method: body ? "POST" : "GET",
		cache: "no-store",
		headers:
			body instanceof FormData
				? headers
				: { ...headers, "content-type": "application/json" },
		body:
			body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
	});
	const result: unknown = await response.json();
	if (!response.ok) {
		const parsed = z.object({ error: z.string() }).safeParse(result);
		throw new Error(
			parsed.success
				? parsed.data.error
				: "Não foi possível acessar a biblioteca do computador.",
		);
	}
	return result;
}
let loading: Promise<void> | null = null;
let mutationVersion = 0;
export function loadLocalElementLibrary() {
	if (!loading) {
		useLocalElementLibrary.setState({ loading: true });
		const version = mutationVersion;
		loading = request({ action: "sync" })
			.then((value) => {
				if (version === mutationVersion)
					useLocalElementLibrary.setState({
						...librarySnapshotSchema.parse(value),
						error: "",
					});
			})
			.catch((error: unknown) => {
				useLocalElementLibrary.setState({
					error:
						error instanceof Error
							? error.message
							: "Falha ao carregar a biblioteca.",
				});
			})
			.finally(() => {
				loading = null;
				useLocalElementLibrary.setState({ loading: false });
			});
	}
	return loading;
}
function notifyOtherTabs() {
	// This key is only a change signal. The catalog and files live on disk, not in localStorage.
	try {
		localStorage.setItem(
			"ai-edita-element-library-updated",
			`${Date.now()}-${Math.random()}`,
		);
	} catch {
		/* private browsing */
	}
}
export async function createElementFolder({
	folderId,
	name,
}: {
	folderId?: string;
	name: string;
}) {
	const result = elementUpdateSchema.parse(
		await request({ action: "folder", folderId, name }),
	);
	mutationVersion++;
	useLocalElementLibrary.setState({ library: result.library });
	notifyOtherTabs();
	return result.folderId;
}
export async function importLocalElements({
	folderId,
	files,
	onProgress,
	cancelled,
}: {
	folderId: string;
	files: File[];
	onProgress: (text: string) => void;
	cancelled: () => boolean;
}) {
	const folder = useLocalElementLibrary
		.getState()
		.library.folders.find((f) => f.id === folderId);
	if (!folder) throw new Error("Pasta não encontrada na biblioteca.");
	await templateEngine({
		op: "element_files",
		files: files.map((f) => ({
			name: f.name,
			size: f.size,
			sha256: "0".repeat(64),
		})),
	});
	const descriptors = [];
	for (const [index, file] of files.entries()) {
		if (cancelled())
			return { imported: 0, duplicates: 0, failed: [], stopped: true };
		onProgress(`Conferindo imagens: ${index + 1}/${files.length}`);
		const digest =
			file.size <= 30 * 1024 * 1024
				? await crypto.subtle.digest("SHA-256", await file.arrayBuffer())
				: new Uint8Array(32).buffer;
		descriptors.push({
			name: file.name,
			size: file.size,
			sha256: Array.from(new Uint8Array(digest), (b) =>
				b.toString(16).padStart(2, "0"),
			).join(""),
		});
	}
	const plan = elementFilesSchema.parse(
		await templateEngine({
			op: "element_files",
			files: descriptors,
			existingHashes: folder.items.map((i) => i.sha256),
		}),
	);
	let imported = 0,
		duplicates = plan.duplicates;
	const failed = plan.rejected.map((f) => `${f.name}: ${f.reason}`);
	const responseSchema = elementUpdateSchema.extend({
		asset: libraryAssetSchema,
		duplicate: z.boolean(),
	});
	for (const [index, entry] of plan.accepted.entries()) {
		if (cancelled()) break;
		const source = files[entry.index];
		onProgress(
			`Importando: ${index + 1}/${plan.accepted.length} · ${source.name}`,
		);
		const file = new File([source], source.name, {
			type: entry.mime,
			lastModified: source.lastModified,
		});
		const [processed] = await processMediaAssets({ files: [file] });
		if (!processed) {
			failed.push(`${source.name}: não foi possível abrir a imagem.`);
			continue;
		}
		try {
			const body = new FormData();
			body.set("file", file);
			body.set("folderId", folderId);
			body.set("lastModified", String(source.lastModified));
			body.set(
				"preview",
				JSON.stringify({
					width: processed.width,
					height: processed.height,
					thumbnailUrl: processed.thumbnailUrl,
				}),
			);
			const result = responseSchema.parse(await request(body));
			mutationVersion++;
			useLocalElementLibrary.setState((state) => ({
				library: result.library,
				assets: [
					...state.assets.filter((a) => a.id !== result.asset.id),
					result.asset,
				],
			}));
			if (result.duplicate) duplicates++;
			else imported++;
		} catch (error) {
			failed.push(
				`${source.name}: ${error instanceof Error ? error.message : "falha ao salvar"}`,
			);
		} finally {
			if (processed.url) URL.revokeObjectURL(processed.url);
		}
	}
	notifyOtherTabs();
	return { imported, duplicates, failed, stopped: cancelled() };
}

const attachments = new Map<string, Promise<MediaAsset>>();
/** Copy only a used element into the project's native media storage, keeping Canvas/export unchanged. */
export function attachLibraryElement({
	editor,
	id,
}: {
	editor: EditorCore;
	id: string;
}): Promise<MediaAsset> {
	const projectId = editor.project.getActive().metadata.id;
	const key = `${projectId}:${id}`;
	const active = editor.media.getAssets().find((a) => a.id === id);
	if (active) return Promise.resolve(active);
	const pending = attachments.get(key);
	if (pending) return pending;
	const task = (async () => {
		const metadata = useLocalElementLibrary
			.getState()
			.assets.find((a) => a.id === id);
		if (!metadata)
			throw new Error("Elemento não encontrado. Atualize a biblioteca.");
		const response = await fetch(`${endpoint}?file=${encodeURIComponent(id)}`, {
			headers,
			cache: "no-store",
		});
		if (!response.ok)
			throw new Error(
				"Não foi possível abrir o elemento na biblioteca do computador.",
			);
		const file = new File([await response.blob()], metadata.name, {
			type: metadata.mime,
			lastModified: metadata.lastModified,
		});
		const asset: MediaAsset = {
			...metadata,
			file,
			url: URL.createObjectURL(file),
		};
		let attached = false;
		try {
			if (editor.project.getActiveOrNull()?.metadata.id !== projectId)
				throw new Error("O projeto mudou. Adicione o elemento novamente.");
			await storageService.saveMediaAsset({ projectId, mediaAsset: asset });
			if (editor.project.getActiveOrNull()?.metadata.id !== projectId)
				throw new Error("O projeto mudou. Adicione o elemento novamente.");
			editor.media.setAssets({ assets: [...editor.media.getAssets(), asset] });
			attached = true;
			return asset;
		} finally {
			if (!attached && asset.url) URL.revokeObjectURL(asset.url);
		}
	})().finally(() => attachments.delete(key));
	attachments.set(key, task);
	return task;
}
