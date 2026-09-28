import { z } from "zod";
import { modelLayerSchema } from "./contract";

const index = z.number().int().min(0).max(3999);
const wordRange = { fromWord: index, toWord: index };
// Optional editorial blocks are lenient: unknown keys are stripped and texts up to 200
// characters pass, because the planner skips (and reports) pieces that do not fit.
const text = z.string().trim().max(200);
const anchoredText = () => z.object({ wordIndex: index, text });
export const editingOptionsSchema = z.strictObject({
	pacing: z.enum(["natural", "steady"]).default("natural"),
	brandName: z.string().trim().max(48).default(""),
	accent: z
		.string()
		.regex(/^#[\da-fA-F]{6}$/)
		.default("#B9F443"),
	// Omitted: Explicativo Clean uses 0.64 and theme recipes use their own height.
	captionPosition: z.number().min(0.52).max(0.8).optional(),
	soundEffects: z.boolean().default(true),
	enhanceVoice: z.boolean().default(true),
	enhanceImage: z.boolean().default(true),
	// Theme recipes only; Explicativo Clean ignores these fields.
	tagline: z.string().trim().max(60).default(""),
	ctaLabel: z.string().trim().max(28).default(""),
	music: z.boolean().default(true),
});
const keywordGroupSchema = z.object({
	...wordRange,
	items: z.array(anchoredText()).max(8),
});
export const applyEditingTemplateSchema = z.strictObject({
	templateId: z.string().regex(/^[a-z0-9][a-z0-9-]{2,99}$/),
	version: z.number().int().min(1).max(99),
	presetId: z
		.string()
		.regex(/^[a-z0-9][a-z0-9-]{2,99}$/)
		.optional(),
	presetName: z.string().trim().min(1).max(80).optional(),
	transcriptId: z.string().min(1).max(200),
	keepRanges: z.array(z.strictObject(wordRange)).min(1).max(80).optional(),
	// Explicativo Clean: up to three single-word keywords.
	emphasisWords: z.array(index).max(3).default([]),
	// Theme recipes: fixed caption text, stacked keywords, zoom emphasis and panels.
	corrections: z
		.array(z.object({ ...wordRange, text }))
		.max(60)
		.optional(),
	hook: keywordGroupSchema.optional(),
	commands: keywordGroupSchema.optional(),
	emphasisRanges: z.array(z.object(wordRange)).max(12).optional(),
	highlightWords: z.array(index).max(12).optional(),
	motion: z
		.object({
			...wordRange,
			headline: text.optional(),
			items: z.array(anchoredText()).max(8).default([]),
			stat: z
				.object({
					wordIndex: index,
					before: text.optional(),
					after: text,
					delta: text.optional(),
				})
				.optional(),
		})
		.optional(),
	panel: z
		.object({
			...wordRange,
			headline: text.optional(),
			items: z.array(anchoredText()).max(8),
			price: z
				.object({ wordIndex: index, text, label: text.optional() })
				.optional(),
		})
		.optional(),
	options: editingOptionsSchema.default(() => editingOptionsSchema.parse({})),
});
export const editingCatalogSchema = z.object({
	format: z.literal("ai-edita-editing-templates"),
	version: z.literal(1),
	templates: z.array(
		z.object({
			id: z.string(),
			version: z.number().int(),
			name: z.string(),
			description: z.string(),
			source: z.string(),
			recipe: z.record(z.string(), z.unknown()),
		}),
	),
});
const seconds = z.number().finite().nonnegative();
export const editingPlanSchema = z.object({
	templateId: z.string(),
	templateName: z.string().optional(),
	version: z.number().int(),
	width: z.literal(1080),
	height: z.literal(1920),
	fps: z.literal(30),
	duration: seconds,
	bodyDuration: seconds,
	sourceDuration: seconds,
	speed: z.number().min(0.5).max(2).default(1),
	background: z
		.string()
		.regex(/^#[\da-fA-F]{6}$/)
		.optional(),
	clips: z
		.array(
			z.object({
				sourceStart: seconds,
				sourceEnd: seconds,
				start: seconds,
				duration: seconds,
				scale: z.number().min(1).max(1.5),
				offsetX: z.number().finite(),
				offsetY: z.number().finite().default(0),
				rate: z.number().min(0.5).max(2).default(1),
				creep: z.boolean().default(false),
				shake: z.number().min(0).max(40).default(0),
			}),
		)
		.min(1)
		.max(240),
	layers: z.array(modelLayerSchema).max(5000),
	sounds: z
		.array(
			z.object({
				kind: z.enum(["hit", "pop", "whoosh", "riser"]),
				palette: z
					.string()
					.regex(/^[a-z][a-z0-9-]{1,30}$/)
					.optional(),
				start: seconds,
				duration: seconds,
				volumeDb: z.number().finite(),
			}),
		)
		.max(64),
	transitions: z
		.array(
			z.object({
				type: z.string().regex(/^transition-[a-z-]+$/),
				start: seconds,
				duration: seconds,
				intensity: z.number().min(0).max(1),
			}),
		)
		.max(20)
		.default([]),
	music: z
		.object({
			src: z.string().regex(/^\/editing-templates\/music\/[a-z0-9-]+\.mp3$/),
			bedDb: z.number().min(-40).max(0),
			endDb: z.number().min(-40).max(0),
		})
		.nullable()
		.default(null),
	fonts: z.array(z.string().max(60)).max(12).default([]),
	voiceEnhance: z.boolean(),
	colorGrade: z.record(z.string(), z.number().finite()).nullable(),
	captionCount: z.number().int(),
	retainedWords: z.number().int(),
	warnings: z.array(z.string()),
	options: editingOptionsSchema,
});
export type EditingPlan = z.infer<typeof editingPlanSchema>;
export type EditingOptions = z.infer<typeof editingOptionsSchema>;
export type EditingTemplateReport = {
	templateId: string;
	version: number;
	presetId?: string;
	presetName?: string;
	sceneId: string;
	sourceMediaId: string;
	appliedAt: string;
	options: EditingOptions;
	duration: number;
	sourceDuration: number;
	cutCount: number;
	captionCount: number;
	soundCount: number;
	warnings: string[];
};
