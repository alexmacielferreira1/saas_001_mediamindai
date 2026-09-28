import { z } from "zod";
// Browser/worker transport shape. Portable semantics are validated in Rust.
export const modelLayerSchema = z.object({
	type: z.enum(["text", "graphic"]),
	definitionId: z.string().optional(),
	name: z.string(),
	start: z.number(),
	duration: z.number(),
	lane: z.number().int().optional(),
	params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
	animations: z.record(z.string(), z.array(z.number())),
});
export const modelSchema = z.object({
	id: z.string(),
	name: z.string(),
	category: z.string(),
	source: z.string(),
	canvas: z.object({ width: z.number(), height: z.number() }),
	duration: z.number(),
	layers: z.array(modelLayerSchema),
	warnings: z.array(z.string()),
});
export const packageManifestSchema = z.object({
	id: z.string().min(3).max(100),
	name: z.string().min(1).max(100),
	publisher: z.string().min(1).max(100),
	release: z.string().min(1).max(40),
	description: z.string().max(500),
	capabilities: z
		.array(z.enum(["captions", "text"]))
		.min(1)
		.max(2),
});
export const packSchema = z.object({
	format: z.literal("ai-edita-models"),
	version: z.literal(1),
	templates: z.array(modelSchema),
	manifest: packageManifestSchema.optional(),
	report: z
		.object({
			drafts: z.number(),
			textMaterials: z.number(),
			omittedNonTextLayers: z.number(),
			rejectedTextLayers: z.number(),
		})
		.optional(),
});
export const layoutSchema = z.object({
	layers: z.array(modelLayerSchema),
	warnings: z.array(z.string()),
});
export type EditModel = z.infer<typeof modelSchema>;
export type ModelLayer = z.infer<typeof modelLayerSchema>;
export type PackageManifest = z.infer<typeof packageManifestSchema>;
export const modelWarningLabels: Record<string, [string, string]> = {
	native_motion_reconstruction: [
		"Movimento recriado com keyframes nativos a partir do tipo da animação; não é o efeito proprietário original.",
		"Motion reconstructed with native keyframes from the animation type; not the original proprietary effect.",
	],
	style_approximation: [
		"Métricas de fonte e espaçamento aproximadas.",
		"Approximate font metrics and spacing.",
	],
	font_substitution: [
		"Fonte externa substituída por Arial.",
		"External font replaced with Arial.",
	],
	rich_text_flattened: [
		"Estilos diferentes na mesma frase unificados.",
		"Mixed styles within a phrase unified.",
	],
	text_outline_shadow_omitted: [
		"Contorno e sombra de texto não convertidos.",
		"Text outline and shadow not converted.",
	],
	non_text_layers_omitted: [
		"Vídeos, máscaras, áudio e outras camadas do original não incluídos.",
		"Original video, masks, audio and other layers not included.",
	],
	proprietary_effects_omitted: [
		"Efeitos proprietários do CapCut não incluídos.",
		"Proprietary CapCut effects not included.",
	],
	native_animation_substitute: [
		"Animação do CapCut recriada como fade editável.",
		"CapCut animation recreated as an editable fade.",
	],
	unsupported_keyframes: [
		"Canais de animação incompatíveis não incluídos.",
		"Incompatible animation channels not included.",
	],
	trimmed_keyframes: [
		"Keyframes fora do intervalo não incluídos.",
		"Out-of-range keyframes not included.",
	],
	linearized_easing: [
		"Curvas proprietárias convertidas em interpolação linear.",
		"Proprietary easing converted to linear interpolation.",
	],
	flip_omitted: [
		"Espelhamento de texto não incluído.",
		"Text flipping not included.",
	],
	invalid_text_omitted: [
		"Uma camada de texto inválida foi ignorada.",
		"An invalid text layer was skipped.",
	],
	missing_text_material: [
		"Um material de texto está ausente.",
		"A text material is missing.",
	],
	legacy_text_only: [
		"Somente textos/legendas do AI Edita; mídias, cortes e efeitos não migrados.",
		"AI Edita titles/captions only; media, cuts and effects not migrated.",
	],
	legacy_recipe_omitted: [
		"Importado o estilo de texto. Receitas antigas de velocidade, cortes, música e efeitos não são executadas.",
		"Text style imported. Legacy speed, cutting, music and effect recipes are not executed.",
	],
	legacy_assets_omitted: [
		"Arquivos e composições externas do pacote antigo não incluídos.",
		"External assets/compositions from the old pack not included.",
	],
	overlay_only: [
		"Modelo de sobreposição: não recorta nem organiza os vídeos de fundo.",
		"Overlay template: it does not crop or arrange background footage.",
	],
};
