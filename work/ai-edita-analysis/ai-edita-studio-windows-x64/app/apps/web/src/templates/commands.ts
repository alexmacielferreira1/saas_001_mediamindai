import type { EditorCore } from "@/core";
import { z } from "zod";
import { Command, createElementSelectionResult } from "@/commands/base-command";
import { AddTrackCommand, InsertElementCommand } from "@/commands";
import { DeleteElementsCommand } from "@/commands/timeline/element/delete-elements";
import { buildGraphicElement } from "@/timeline/element-utils";
import { DEFAULTS } from "@/timeline/defaults";
import { ensurePresetFont } from "@/fonts/preset-fonts";
import { isLeafChannelData } from "@/animation/channel-data";
import { isScalarChannel } from "@/animation/interpolation";
import type {
	ElementAnimations,
	ScalarAnimationChannel,
} from "@/animation/types";
import { mediaTimeFromSeconds, mediaTimeToSeconds } from "@/wasm";
import type {
	CreateTimelineElement,
	ElementRef,
	SceneTracks,
	TimelineElement,
} from "@/timeline";
import { scalarChannel, editGuard } from "@/integrations/editorial-commands";
import { schemas } from "@/integrations/catalog";
import { templateEngine } from "./engine";
import { getModel, saveModels } from "./store";
import {
	layoutSchema,
	modelSchema,
	modelLayerSchema,
	type ModelLayer,
} from "./contract";

async function loadModelFonts(layers: ModelLayer[]) {
	const families = new Set(
		layers
			.filter((l) => l.type === "text")
			.map((l) => String(l.params.fontFamily ?? "Arial")),
	);
	for (const family of families) {
		await ensurePresetFont({ family });
		await document.fonts.load('bold 24px "' + family + '"');
		await document.fonts.load('24px "' + family + '"');
	}
}
function scalarEntries(
	animations: ElementAnimations | undefined,
): [string, ScalarAnimationChannel][] {
	return Object.entries(animations ?? {}).map(([key, channel]) => {
		if (
			!isLeafChannelData(channel) ||
			!isScalarChannel(channel) ||
			channel.keys.some((k) => k.segmentToNext !== "linear") ||
			channel.extrapolation?.before === "linear" ||
			channel.extrapolation?.after === "linear"
		)
			throw new Error(
				"Este formato preserva apenas keyframes numéricos lineares / This format preserves numeric linear keyframes only.",
			);
		return [key, channel];
	});
}
export function buildModelLayer(layer: ModelLayer): CreateTimelineElement {
	const startTime = mediaTimeFromSeconds({ seconds: layer.start });
	const duration = mediaTimeFromSeconds({ seconds: layer.duration });
	const animations = Object.fromEntries(
		Object.entries(layer.animations).map(([property, points]) => [
			property,
			scalarChannel({ points }),
		]),
	);
	if (layer.type === "text")
		return {
			...DEFAULTS.text.element,
			startTime,
			duration,
			name: layer.name || "Texto",
			params: { ...DEFAULTS.text.element.params, ...layer.params },
			animations,
		};
	return {
		...buildGraphicElement({
			definitionId: layer.definitionId ?? "rectangle",
			name: layer.name,
			startTime,
			params: layer.params,
		}),
		duration,
		animations,
	};
}
// Atomic native insertion. No ripple of user clips; failures roll back the whole batch.
class InsertModelCommand extends Command {
	public readonly handlesRipple = true;
	private before: SceneTracks;
	private after: SceneTracks | undefined;
	public refs: ElementRef[] = [];
	private editor: EditorCore;
	private layers: ModelLayer[];
	private remove: ElementRef[];
	constructor({
		editor,
		layers,
		remove = [],
	}: {
		editor: EditorCore;
		layers: ModelLayer[];
		remove?: ElementRef[];
	}) {
		super();
		this.editor = editor;
		this.layers = layers;
		this.remove = remove;
		this.before = editor.scenes.getActiveScene().tracks;
	}
	execute() {
		if (this.after) {
			this.editor.timeline.updateTracks(this.after);
			return createElementSelectionResult(this.refs);
		}
		try {
			if (this.remove.length)
				new DeleteElementsCommand({ elements: this.remove }).execute();
			const tracks = new Map<number, string>();
			for (const [i, layer] of this.layers.entries()) {
				const lane = layer.lane ?? i;
				let trackId = tracks.get(lane);
				if (!trackId) {
					const command = new AddTrackCommand({ type: layer.type, index: 0 });
					command.execute();
					trackId = command.getTrackId();
					tracks.set(lane, trackId);
				}
				const command = new InsertElementCommand({
					element: buildModelLayer(layer),
					placement: { mode: "explicit", trackId },
				});
				command.execute();
				if (command.getTrackId() !== trackId)
					throw new Error(
						"O editor recusou uma camada / Editor rejected a layer.",
					);
				this.refs.push({ trackId, elementId: command.getElementId() });
			}
			this.after = this.editor.scenes.getActiveScene().tracks;
			return createElementSelectionResult(this.refs);
		} catch (e) {
			this.refs = [];
			this.editor.timeline.updateTracks(this.before);
			throw e;
		}
	}
	undo() {
		this.editor.timeline.updateTracks(this.before);
	}
}
export async function applyModel({
	editor,
	input,
	source = "local",
}: {
	editor: EditorCore;
	input: unknown;
	source?: string;
}) {
	const args = schemas.apply_template.parse(input);
	const assert = editGuard({ editor, source });
	assert();
	if (editor.project.getExportState().isExporting)
		throw new Error("Aguarde a exportação / Wait for export.");
	const model = await getModel(args.templateId);
	if (model.warnings.length && !args.acknowledgeAdaptations)
		throw new Error(
			"Leia as adaptações do modelo e confirme antes de aplicar / Review and acknowledge template adaptations.",
		);
	const canvas = editor.project.getActive().settings.canvasSize;
	const layout = layoutSchema.parse(
		await templateEngine({
			op: "layout",
			template: model,
			width: canvas.width,
			height: canvas.height,
			start: args.startSeconds,
			duration: args.durationSeconds ?? model.duration,
			texts: args.texts,
			accent: args.accent,
		}),
	);
	await loadModelFonts(layout.layers);
	assert();
	if (editor.project.getExportState().isExporting)
		throw new Error("Aguarde a exportação / Wait for export.");
	const command = new InsertModelCommand({ editor, layers: layout.layers });
	editor.command.execute({ command });
	return {
		templateId: model.id,
		insertedElements: command.refs,
		warnings: model.warnings,
		undoSteps: 1,
	};
}
export async function applyModelToCaptions({
	editor,
	input,
	source = "local",
}: {
	editor: EditorCore;
	input: unknown;
	source?: string;
}) {
	const args = schemas.apply_template_to_captions.parse(input);
	const assert = editGuard({ editor, source });
	assert();
	if (editor.project.getExportState().isExporting)
		throw new Error("Aguarde a exportação / Wait for export.");
	if (
		new Set(args.elements.map((e) => e.elementId)).size !== args.elements.length
	)
		throw new Error("Duplicate captions.");
	const matches = editor.timeline.getElementsWithTracks({
		elements: args.elements,
	});
	if (
		matches.length !== args.elements.length ||
		matches.some((m) => m.element.type !== "text")
	)
		throw new Error("Selecione somente legendas / Select captions only.");
	const captions = matches
		.map(({ element }) => ({
			text: String(element.params.content ?? ""),
			start: mediaTimeToSeconds({ time: element.startTime }),
			duration: mediaTimeToSeconds({ time: element.duration }),
		}))
		.sort((a, b) => a.start - b.start);
	const model = await getModel(args.templateId);
	if (model.warnings.length && !args.acknowledgeAdaptations)
		throw new Error("Confirme as adaptações / Acknowledge adaptations.");
	const canvas = editor.project.getActive().settings.canvasSize;
	const layout = layoutSchema.parse(
		await templateEngine({
			op: "compose",
			template: model,
			captions,
			width: canvas.width,
			height: canvas.height,
			textMode: args.textMode,
			textLayerIndex: args.textLayerIndex,
			maxCharsPerLine: args.maxCharsPerLine,
		}),
	);
	await loadModelFonts(layout.layers);
	assert();
	if (editor.project.getExportState().isExporting)
		throw new Error("Aguarde a exportação / Wait for export.");
	const command = new InsertModelCommand({
		editor,
		layers: layout.layers,
		remove: args.replaceCaptions ? args.elements : [],
	});
	editor.command.execute({ command });
	return {
		templateId: model.id,
		captionCount: captions.length,
		insertedElements: command.refs,
		replacedCaptions: args.replaceCaptions ? args.elements : [],
		warnings: model.warnings,
		undoSteps: 1,
	};
}

export async function saveSelectionAsModel({
	editor,
	name,
}: {
	editor: EditorCore;
	name: string;
}) {
	const assert = editGuard({ editor });
	assert();
	const selected = editor.selection.getSelectedElements();
	if (!selected.length)
		throw new Error(
			"Selecione textos ou formas na timeline / Select timeline text or shapes.",
		);
	// Preserve visible stacking from bottom to top, not selection click order.
	const selectedIds = new Set(selected.map((r) => r.elementId));
	const { main, overlay, audio } = editor.scenes.getActiveScene().tracks;
	const elements = [...audio, main, ...overlay.slice().reverse()]
		.flatMap<TimelineElement>((t) => t.elements)
		.filter((e) => selectedIds.has(e.id));
	if (elements.some((e) => !["text", "graphic"].includes(e.type)))
		throw new Error(
			"Salve apenas textos e formas; mídias não são empacotadas / Save text and shapes only; media are not packaged.",
		);
	if (
		elements.some(
			(e) =>
				("effects" in e && e.effects?.length) ||
				("masks" in e && e.masks?.length),
		)
	)
		throw new Error(
			"Remova efeitos/máscaras da seleção de modelo ou salve outros elementos / Effects and masks cannot be packaged yet.",
		);
	const layers = elements.map((e) => ({
		type: e.type,
		name: e.name,
		definitionId: "definitionId" in e ? e.definitionId : undefined,
		start: mediaTimeToSeconds({ time: e.startTime }),
		duration: mediaTimeToSeconds({ time: e.duration }),
		params: Object.fromEntries(
			Object.entries(e.params).filter(([k]) => k !== "blendMode"),
		),
		animations: Object.fromEntries(
			scalarEntries(e.animations).map(([key, channel]) => [
				key,
				channel.keys.flatMap((k) => [
					mediaTimeToSeconds({ time: k.time }),
					k.value,
				]),
			]),
		),
	}));
	if (
		elements.some((e) => e.params.blendMode && e.params.blendMode !== "normal")
	)
		throw new Error(
			"Modelos exigem modo de mesclagem normal / Models require normal blend mode.",
		);
	const model = modelSchema.parse(
		await templateEngine({
			op: "capture",
			template: {
				id: "user-" + crypto.randomUUID(),
				name,
				category: "Meus modelos · My models",
				source: "user",
				canvas: editor.project.getActive().settings.canvasSize,
				layers,
				warnings: [],
			},
		}),
	);
	assert();
	await saveModels([model]);
	return model;
}

export async function applyModelStyle({
	editor,
	input,
	source = "local",
}: {
	editor: EditorCore;
	input: unknown;
	source?: string;
}) {
	const args = schemas.apply_template_style.parse(input);
	const assert = editGuard({ editor, source });
	assert();
	if (
		new Set(args.elements.map((e) => e.elementId)).size !== args.elements.length
	)
		throw new Error("Duplicate clip references.");
	const model = await getModel(args.templateId);
	if (model.warnings.length && !args.acknowledgeAdaptations)
		throw new Error("Confirme as adaptações / Acknowledge adaptations.");
	const canvas = editor.project.getActive().settings.canvasSize;
	const matches = editor.timeline.getElementsWithTracks({
		elements: args.elements,
	});
	if (
		matches.length !== args.elements.length ||
		matches.some((m) => m.element.type !== "text")
	)
		throw new Error(
			"Escolha apenas textos/legendas / Choose only text/caption clips.",
		);
	const updates = [];
	const fontLayers = modelLayerSchema.array().parse(
		await templateEngine({
			op: "styles",
			template: model,
			textLayerIndex: args.textLayerIndex ?? 0,
			width: canvas.width,
			height: canvas.height,
			durations: matches.map(({ element }) =>
				mediaTimeToSeconds({ time: element.duration }),
			),
			captionTexts: matches.map(({ element }) =>
				String(element.params.content ?? ""),
			),
		}),
	);
	for (const [i, { element, track }] of matches.entries()) {
		const layer = fontLayers[i];
		const animations = args.includeMotion
			? Object.fromEntries(
					Object.entries(layer.animations).map(([key, points]) => [
						key,
						scalarChannel({
							points: points.map((v, i) =>
								i % 2 ? v * Number(element.params[key] ?? 1) : v,
							),
						}),
					]),
				)
			: {};
		if (
			!args.replaceExisting &&
			Object.keys(animations).some((k) => element.animations?.[k])
		)
			throw new Error(
				"Animação existente: autorize substituição / Existing animation requires replacement approval.",
			);
		updates.push({
			trackId: track.id,
			elementId: element.id,
			patch: {
				params: { ...layer.params },
				...(args.includeMotion
					? { animations: { ...element.animations, ...animations } }
					: {}),
			},
		});
	}
	await loadModelFonts(fontLayers);
	assert();
	if (editor.project.getExportState().isExporting)
		throw new Error("Aguarde a exportação / Wait for export.");
	editor.timeline.updateElements({ updates });
	return {
		modifiedElements: args.elements,
		warnings: model.warnings,
		undoSteps: 1,
	};
}

export async function addModelText({
	editor,
	input,
	source = "local",
}: {
	editor: EditorCore;
	input: unknown;
	source?: string;
}) {
	const { textLayerIndex, ...args } = schemas.apply_template
		.extend({ textLayerIndex: z.number().int().min(0).max(399).default(0) })
		.parse(input);
	const assert = editGuard({ editor, source });
	assert();
	if (editor.project.getExportState().isExporting)
		throw new Error("Aguarde a exportação / Wait for export.");
	const model = await getModel(args.templateId);
	if (model.warnings.length && !args.acknowledgeAdaptations)
		throw new Error("Confirme as adaptações / Acknowledge adaptations.");
	const canvas = editor.project.getActive().settings.canvasSize;
	const layout = layoutSchema.parse(
		await templateEngine({
			op: "text",
			template: model,
			width: canvas.width,
			height: canvas.height,
			start: args.startSeconds,
			duration: args.durationSeconds ?? model.duration,
			textLayerIndex,
			texts: args.texts,
			accent: args.accent,
		}),
	);
	await loadModelFonts(layout.layers);
	assert();
	const command = new InsertModelCommand({ editor, layers: layout.layers });
	editor.command.execute({ command });
	return { insertedElements: command.refs, undoSteps: 1 };
}
