import { editingCatalogSchema, editingOptionsSchema, type EditingOptions } from "./editing-contract";
import {
	BUILTIN_EDITING_TEMPLATES,
	loadEditingTemplatePresets,
} from "./editing-template-library";
import {
	installedTemplateCard,
	loadInstalledEditingTemplatePacks,
} from "./editing-template-packs";
import { templateEngine } from "./engine";

export type GalleryTemplate = {
	/** Unique card key (preset id). */
	key: string;
	presetId: string;
	name: string;
	description: string;
	templateId: string;
	version: number;
	themed: boolean;
	recipe: Record<string, unknown>;
	options: EditingOptions;
	origin: "builtin" | "pack" | "personal";
	packName?: string;
	/** Name of the engine template a personal preset is based on. */
	baseName?: string;
	/** False when a personal preset's theme pack is not installed in this browser. */
	available: boolean;
};

/**
 * Everything a person can pick when editing: built-in recipes, installed packs and their
 * own saved presets. Presets whose theme pack is missing are listed as unavailable.
 */
export async function loadTemplateGallery(): Promise<GalleryTemplate[]> {
	const catalog = editingCatalogSchema.parse(
		await templateEngine({ op: "editing_catalog" }),
	);
	const recipes = new Map<string, Record<string, unknown>>();
	const names = new Map<string, string>();
	for (const template of catalog.templates) {
		recipes.set(`${template.id}@${template.version}`, template.recipe);
		names.set(template.id, template.name);
	}
	const cards: GalleryTemplate[] = [];
	for (const preset of BUILTIN_EDITING_TEMPLATES) {
		const recipe = recipes.get(`${preset.baseTemplateId}@${preset.baseVersion}`);
		if (!recipe) continue;
		cards.push({
			key: preset.id,
			presetId: preset.id,
			name: preset.name,
			description: preset.description,
			templateId: preset.baseTemplateId,
			version: preset.baseVersion,
			themed: recipe.engine === "theme",
			recipe,
			options: preset.options,
			origin: "builtin",
			available: true,
		});
	}
	for (const pack of loadInstalledEditingTemplatePacks())
		for (const template of pack.templates) {
			recipes.set(`${template.id}@${template.version}`, template.recipe);
			names.set(template.id, template.name);
			const card = installedTemplateCard(template);
			cards.push({
				key: card.id,
				presetId: card.id,
				name: card.name,
				description: card.description,
				templateId: template.id,
				version: template.version,
				themed: true,
				recipe: template.recipe,
				options: card.options,
				origin: "pack",
				packName: pack.manifest.name,
				available: true,
			});
		}
	for (const preset of loadEditingTemplatePresets().templates) {
		const recipe = recipes.get(`${preset.baseTemplateId}@${preset.baseVersion}`);
		cards.push({
			key: preset.id,
			presetId: preset.id,
			name: preset.name,
			description: preset.description,
			templateId: preset.baseTemplateId,
			version: preset.baseVersion,
			themed: recipe ? recipe.engine === "theme" : true,
			recipe: recipe ?? {},
			options: editingOptionsSchema.parse(preset.options),
			origin: "personal",
			baseName: names.get(preset.baseTemplateId),
			available: Boolean(recipe),
		});
	}
	return cards;
}

export const briefOf = (template: GalleryTemplate) =>
	typeof template.recipe.brief === "string" ? template.recipe.brief : "";
