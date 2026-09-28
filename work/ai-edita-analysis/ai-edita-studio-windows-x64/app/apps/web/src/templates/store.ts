"use client";
import { create } from "zustand";
import { z } from "zod";
import { templateEngine } from "./engine";
import {
	modelSchema,
	packSchema,
	packageManifestSchema,
	type EditModel,
	type PackageManifest,
} from "./contract";

const STORAGE_KEY = "ai-edita-model-library-v3";
const LEGACY_V2_STORAGE_KEY = "ai-edita-model-library-v2";
const LEGACY_V1_STORAGE_KEY = "ai-edita-models-v1";
const installedPackSchema = z.object({
	manifest: packageManifestSchema,
	templates: z.array(modelSchema),
});
const librarySchema = z.object({
	format: z.literal("ai-edita-model-library"),
	version: z.literal(3),
	personal: z.array(modelSchema),
	installedPacks: z.array(installedPackSchema),
});
const legacyLibrarySchema = z.object({
	format: z.literal("ai-edita-model-library"),
	version: z.literal(2),
	personal: z.array(modelSchema),
	installedPacks: z.array(installedPackSchema),
});
export type InstalledPack = z.infer<typeof installedPackSchema>;
export const useModelStore = create<{
	bundled: EditModel[];
	installed: EditModel[];
	installedPacks: InstalledPack[];
	personal: EditModel[];
	loaded: boolean;
	storageWarning: string;
}>(() => ({
	bundled: [],
	installed: [],
	installedPacks: [],
	personal: [],
	loaded: false,
	storageWarning: "",
}));
let loading: Promise<void> | undefined;
let storageSnapshot: string | null = null;
async function validateModels(models: EditModel[]) {
	if (!models.length) return [];
	return packSchema.parse(
		await templateEngine({
			op: "import",
			document: { format: "ai-edita-models", version: 1, templates: models },
		}),
	).templates;
}
function serializeLibrary({
	personal,
	installedPacks,
}: {
	personal: EditModel[];
	installedPacks: InstalledPack[];
}) {
	return JSON.stringify({
		format: "ai-edita-model-library",
		version: 3,
		personal,
		installedPacks,
	});
}
function persistLibrary({
	personal,
	installedPacks,
}: {
	personal: EditModel[];
	installedPacks: InstalledPack[];
}) {
	const serialized = serializeLibrary({ personal, installedPacks });
	if (serialized.length > 4 * 1024 * 1024)
		throw new Error(
			"A biblioteca excede 4 MB. Remova um pacote ou exporte seus modelos / Library exceeds 4 MB. Remove a pack or export your models.",
		);
	if (localStorage.getItem(STORAGE_KEY) !== storageSnapshot)
		throw new Error(
			"A biblioteca mudou em outra aba. Recarregue antes de salvar / Library changed in another tab. Reload before saving.",
		);
	try {
		localStorage.setItem(STORAGE_KEY, serialized);
		storageSnapshot = serialized;
	} catch {
		throw new Error(
			"Armazenamento cheio. Exporte os modelos antes de liberar espaço / Storage full. Export models before freeing space.",
		);
	}
}
export async function loadModels() {
	if (useModelStore.getState().loaded) return;
	loading ??= (async () => {
		const builtins = packSchema.parse(await templateEngine({ op: "builtins" }));
		let personal: EditModel[] = [],
			installedPacks: InstalledPack[] = [],
			storageWarning = "",
			migrated = false;
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			storageSnapshot = saved;
			if (saved) {
				const library = librarySchema.parse(JSON.parse(saved) as unknown);
				personal = await validateModels(library.personal);
				installedPacks = await Promise.all(
					library.installedPacks.map(async (pack) => ({
						manifest: pack.manifest,
						templates: await validateModels(pack.templates),
					})),
				);
			} else {
				const legacyV2 = localStorage.getItem(LEGACY_V2_STORAGE_KEY);
				const legacyV1 = localStorage.getItem(LEGACY_V1_STORAGE_KEY);
				if (legacyV2) {
					const library = legacyLibrarySchema.parse(
						JSON.parse(legacyV2) as unknown,
					);
					personal = await validateModels(library.personal);
					installedPacks = await Promise.all(
						library.installedPacks.map(async (pack) => ({
							manifest: pack.manifest,
							templates: await validateModels(pack.templates),
						})),
					);
					migrated = true;
				} else if (legacyV1) {
					personal = packSchema.parse(
						await templateEngine({
							op: "import",
							document: JSON.parse(legacyV1) as unknown,
						}),
					).templates;
					migrated = true;
				}
			}
			const ids = new Set(builtins.templates.map((item) => item.id));
			for (const model of [
				...installedPacks.flatMap((pack) => pack.templates),
				...personal,
			]) {
				if (ids.has(model.id)) throw new Error("Duplicate template ID.");
				ids.add(model.id);
			}
			if (migrated) persistLibrary({ personal, installedPacks });
		} catch (error) {
			console.error("[AI Edita] Failed to restore the model library.", error);
			storageWarning =
				"Não foi possível ler os modelos salvos. O armazenamento original foi preservado / Saved models could not be read. Original storage was preserved.";
		}
		useModelStore.setState({
			bundled: builtins.templates,
			installed: installedPacks.flatMap((pack) => pack.templates),
			installedPacks,
			personal,
			loaded: true,
			storageWarning,
		});
	})().catch((error) => {
		loading = undefined;
		throw error;
	});
	await loading;
}
export async function getModels() {
	await loadModels();
	const { bundled, installed, personal } = useModelStore.getState();
	return [...bundled, ...installed, ...personal];
}
export async function getModel(id: string) {
	const model = (await getModels()).find((item) => item.id === id);
	if (!model) throw new Error("Modelo não encontrado / Model not found.");
	return model;
}
export async function saveModels(models: EditModel[]) {
	await loadModels();
	const current = useModelStore.getState();
	if (current.storageWarning) throw new Error(current.storageWarning);
	const seen = new Set(
		[...current.bundled, ...current.installed, ...current.personal].map(
			(t) => t.id,
		),
	);
	const additions = models.filter((t) => {
		if (seen.has(t.id)) return false;
		seen.add(t.id);
		return true;
	});
	const next = [...current.personal, ...additions];
	if (!additions.length) return 0;
	if (next.length > 300)
		throw new Error(
			"Limite de 300 modelos pessoais / Limit of 300 personal models.",
		);
	const validated = await validateModels(next);
	// Persist before reporting success. Quota errors do not overwrite the old library.
	persistLibrary({
		personal: validated,
		installedPacks: current.installedPacks,
	});
	useModelStore.setState({ personal: validated });
	return additions.length;
}
export async function installModelPack({
	manifest,
	templates,
}: {
	manifest: PackageManifest;
	templates: EditModel[];
}) {
	await loadModels();
	const current = useModelStore.getState();
	if (current.storageWarning) throw new Error(current.storageWarning);
	const normalizedManifest = packageManifestSchema.parse(manifest);
	const validated = await validateModels(templates);
	if (
		!validated.every((model) =>
			model.layers.some((layer) => layer.type === "text"),
		)
	)
		throw new Error(
			"Este pacote declara estilos de texto, mas contém modelo sem texto / This text style pack contains a template without text.",
		);
	const bundledIds = new Set(current.bundled.map((model) => model.id));
	const installable = validated.filter((model) => !bundledIds.has(model.id));
	const previous = current.installedPacks.find(
		(pack) => pack.manifest.id === normalizedManifest.id,
	);
	const reserved = new Set([
		...current.personal.map((model) => model.id),
		...current.installedPacks
			.filter((pack) => pack.manifest.id !== normalizedManifest.id)
			.flatMap((pack) => pack.templates.map((model) => model.id)),
	]);
	if (installable.some((model) => reserved.has(model.id)))
		throw new Error(
			"O pacote conflita com modelos já instalados / Package conflicts with installed models.",
		);
	const installedPacks = [
		...current.installedPacks.filter(
			(pack) => pack.manifest.id !== normalizedManifest.id,
		),
		{ manifest: normalizedManifest, templates: installable },
	];
	persistLibrary({ personal: current.personal, installedPacks });
	useModelStore.setState({
		installedPacks,
		installed: installedPacks.flatMap((pack) => pack.templates),
	});
	return { installed: installable.length, updated: Boolean(previous) };
}
export function exportModelFile(models: EditModel[]) {
	const blob = new Blob(
		[
			JSON.stringify(
				{ format: "ai-edita-models", version: 1, templates: models },
				null,
				2,
			),
		],
		{ type: "application/json" },
	);
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = "ai-edita-meus-modelos.aiedita";
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 10000);
}
