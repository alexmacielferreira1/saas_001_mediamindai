import { z } from "zod";
import { editingOptionsSchema } from "./editing-contract";

const STORAGE_KEY = "ai-edita-editing-template-library-v1";
const MAX_LIBRARY_BYTES = 512 * 1024;

export const editingTemplatePresetSchema = z.strictObject({
	id: z.string().regex(/^[a-z0-9][a-z0-9-]{2,99}$/),
	name: z.string().trim().min(1).max(80),
	description: z.string().trim().max(240),
	baseTemplateId: z.string().regex(/^[a-z0-9][a-z0-9-]{2,99}$/),
	baseVersion: z.number().int().min(1).max(99),
	options: editingOptionsSchema,
});

const librarySchema = z.strictObject({
	format: z.literal("ai-edita-editing-template-library"),
	version: z.literal(1),
	templates: z.array(editingTemplatePresetSchema).max(100),
});

export type EditingTemplatePreset = z.infer<typeof editingTemplatePresetSchema>;

export const BUILTIN_EDITING_TEMPLATE: EditingTemplatePreset = {
	id: "explicativo-clean",
	name: "Explicativo Clean",
	description: "Fala natural, legendas discretas e ideias em movimento.",
	baseTemplateId: "explicativo-clean",
	baseVersion: 1,
	options: editingOptionsSchema.parse({}),
};

// Energia Máxima is the free theme recipe in the Rust catalog. Other themes arrive as
// installed packs (see editing-template-packs.ts).
export const BUILTIN_EDITING_TEMPLATES: EditingTemplatePreset[] = [
	BUILTIN_EDITING_TEMPLATE,
	{
		id: "energia-maxima",
		name: "Energia Máxima",
		description:
			"Preto e amarelo, fala acelerada, legenda palavra a palavra, glitch e CTA final.",
		baseTemplateId: "energia-maxima",
		baseVersion: 1,
		options: editingOptionsSchema.parse({
			accent: "#FFD60A",
			captionPosition: 0.74,
		}),
	},
];
export const isBuiltinEditingTemplate = (id: string) =>
	BUILTIN_EDITING_TEMPLATES.some((template) => template.id === id);
export const isThemeEditingTemplate = (preset: EditingTemplatePreset) =>
	preset.baseTemplateId !== BUILTIN_EDITING_TEMPLATE.baseTemplateId;

function documentFor(templates: EditingTemplatePreset[]) {
	return librarySchema.parse({
		format: "ai-edita-editing-template-library",
		version: 1,
		templates,
	});
}

// The first Vendus preset files (vendus-v1-autoridade-sobria …) were generated before the
// theme engine existed and point at Explicativo Clean. They carried a theme name but edited
// like Explicativo Clean, so they are moved onto the theme their id names.
const LEGACY_THEME_PRESET = /^vendus-v\d-([a-z0-9-]+)$/;
// Copies made by older imports got random ids ("V2 · Editorial Papel importado"), so the
// theme is also recognized from the name those files always used.
const LEGACY_THEME_NAMES: Record<string, string> = {
	"autoridade sobria": "autoridade-sobria",
	"editorial papel": "editorial-papel",
	"energia maxima": "energia-maxima",
	"acolhedora clara": "acolhedora-clara",
	"tech neon": "tech-neon",
};
function legacyThemeFromName(name: string) {
	const plain = name
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase();
	const match = /^v\d\s*[·.\-–]\s*(.+?)(\s+(importado|\(copia\)))?$/.exec(plain.trim());
	return match ? LEGACY_THEME_NAMES[match[1].trim()] : undefined;
}
export function repairLegacyThemePresets(templates: EditingTemplatePreset[]) {
	let changed = false;
	const repaired = templates.map((template) => {
		const theme =
			LEGACY_THEME_PRESET.exec(template.id)?.[1] ?? legacyThemeFromName(template.name);
		if (!theme || template.baseTemplateId !== BUILTIN_EDITING_TEMPLATE.baseTemplateId)
			return template;
		changed = true;
		return { ...template, baseTemplateId: theme, baseVersion: 1 };
	});
	return { templates: repaired, changed };
}

export function loadEditingTemplatePresets(): {
	templates: EditingTemplatePreset[];
	warning: string;
} {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { templates: [], warning: "" };
		const parsed = librarySchema.parse(JSON.parse(raw) as unknown).templates;
		const { templates, changed } = repairLegacyThemePresets(parsed);
		if (changed) localStorage.setItem(STORAGE_KEY, JSON.stringify(documentFor(templates)));
		return { templates, warning: "" };
	} catch (error) {
		console.error("[AI Edita] Failed to restore editing templates.", error);
		return {
			templates: [],
			warning:
				"A biblioteca de templates não pôde ser lida. Os dados originais foram preservados.",
		};
	}
}

export function saveEditingTemplatePresets(
	templates: EditingTemplatePreset[],
): EditingTemplatePreset[] {
	const normalized = documentFor(templates).templates;
	const ids = new Set<string>();
	for (const template of normalized) {
		if (isBuiltinEditingTemplate(template.id) || ids.has(template.id))
			throw new Error("Identificador de template repetido.");
		ids.add(template.id);
	}
	const serialized = JSON.stringify(documentFor(normalized));
	if (serialized.length > MAX_LIBRARY_BYTES)
		throw new Error("A biblioteca de templates excede 512 KB.");
	localStorage.setItem(STORAGE_KEY, serialized);
	return normalized;
}

export function upsertEditingTemplatePreset({
	templates,
	preset,
}: {
	templates: EditingTemplatePreset[];
	preset: EditingTemplatePreset;
}) {
	const normalized = editingTemplatePresetSchema.parse(preset);
	const existing = templates.findIndex((item) => item.id === normalized.id);
	const next = [...templates];
	if (existing >= 0) next[existing] = normalized;
	else next.push(normalized);
	return saveEditingTemplatePresets(next);
}

export function removeEditingTemplatePreset({
	templates,
	id,
}: {
	templates: EditingTemplatePreset[];
	id: string;
}) {
	return saveEditingTemplatePresets(
		templates.filter((template) => template.id !== id),
	);
}

export function createEditingTemplatePreset({
	name,
	description,
	options,
	baseTemplateId = "explicativo-clean",
	baseVersion = 1,
}: {
	name: string;
	description: string;
	options: z.input<typeof editingOptionsSchema>;
	baseTemplateId?: string;
	baseVersion?: number;
}): EditingTemplatePreset {
	return editingTemplatePresetSchema.parse({
		id: `custom-${crypto.randomUUID().toLowerCase()}`,
		name,
		description,
		baseTemplateId,
		baseVersion,
		options,
	});
}

export function parseEditingTemplatePresetFile(text: string) {
	if (text.length > MAX_LIBRARY_BYTES)
		throw new Error("Arquivo de templates excede 512 KB.");
	return librarySchema.parse(JSON.parse(text.replace(/^\uFEFF/, "")) as unknown)
		.templates;
}

// ---- duplicate-aware import ----
// A preset counts as "the same" when it has the same id, or the same name (ignoring the
// " importado" / " (cópia)" suffixes older imports added) on the same base template.
const COPY_SUFFIX = /\s+(importado|\(cópia\)|\(copia\)|copy)(\s+\d+)?$/i;
const sameName = (value: string) =>
	value.replace(COPY_SUFFIX, "").trim().toLocaleLowerCase("pt-BR");
const sameContent = (a: EditingTemplatePreset, b: EditingTemplatePreset) =>
	a.baseTemplateId === b.baseTemplateId &&
	a.baseVersion === b.baseVersion &&
	a.description === b.description &&
	sameName(a.name) === sameName(b.name) &&
	JSON.stringify(editingOptionsSchema.parse(a.options)) ===
		JSON.stringify(editingOptionsSchema.parse(b.options));

export type PresetImportConflict = {
	imported: EditingTemplatePreset;
	existing: EditingTemplatePreset;
	/** Nothing would change: same template, same settings. */
	identical: boolean;
};

export function planPresetImport({
	existing,
	imported,
}: {
	existing: EditingTemplatePreset[];
	imported: EditingTemplatePreset[];
}) {
	const fresh: EditingTemplatePreset[] = [];
	const conflicts: PresetImportConflict[] = [];
	for (const template of repairLegacyThemePresets(imported).templates) {
		const match =
			existing.find((item) => item.id === template.id) ??
			existing.find(
				(item) =>
					item.baseTemplateId === template.baseTemplateId &&
					sameName(item.name) === sameName(template.name),
			);
		if (match)
			conflicts.push({
				imported: template,
				existing: match,
				identical: sameContent(match, template),
			});
		else if (!fresh.some((item) => item.id === template.id)) fresh.push(template);
	}
	return { fresh, conflicts };
}

export type PresetImportChoice = "replace" | "keep" | "skip";

/** Builds the next personal library for a planned import and the person's choice. */
export function applyPresetImport({
	existing,
	fresh,
	conflicts,
	choice,
}: {
	existing: EditingTemplatePreset[];
	fresh: EditingTemplatePreset[];
	conflicts: PresetImportConflict[];
	choice: PresetImportChoice;
}) {
	let next = [...existing];
	let replaced = 0;
	let copied = 0;
	for (const conflict of conflicts) {
		if (conflict.identical || choice === "skip") continue;
		if (choice === "replace") {
			next = next.map((item) =>
				item.id === conflict.existing.id
					? { ...conflict.imported, id: conflict.existing.id }
					: item,
			);
			replaced += 1;
		} else {
			next.push(
				createEditingTemplatePreset({
					name: `${conflict.imported.name.replace(COPY_SUFFIX, "")} (cópia)`,
					description: conflict.imported.description,
					options: conflict.imported.options,
					baseTemplateId: conflict.imported.baseTemplateId,
					baseVersion: conflict.imported.baseVersion,
				}),
			);
			copied += 1;
		}
	}
	for (const template of fresh)
		next.push(
			existing.some((item) => item.id === template.id) || isBuiltinEditingTemplate(template.id)
				? { ...template, id: `custom-${crypto.randomUUID().toLowerCase()}` }
				: template,
		);
	return { templates: next, added: fresh.length, replaced, copied };
}

/** Ids of exact repeats already in the library (the first of each group is kept). */
export function findDuplicatePresets(templates: EditingTemplatePreset[]) {
	const duplicates: string[] = [];
	templates.forEach((template, index) => {
		if (templates.slice(0, index).some((earlier) => sameContent(earlier, template)))
			duplicates.push(template.id);
	});
	return duplicates;
}

export function exportEditingTemplatePreset(preset: EditingTemplatePreset) {
	const blob = new Blob([JSON.stringify(documentFor([preset]), null, 2)], {
		type: "application/json",
	});
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = `${preset.id}.aiedita-template`;
	anchor.click();
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
