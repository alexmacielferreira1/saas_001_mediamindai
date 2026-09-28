import type { EditorCore } from "@/core";
import { Command, createElementSelectionResult } from "@/commands/base-command";
import { UpdateProjectSettingsCommand } from "@/commands/project/update-project-settings";
import { buildDefaultEffectInstance } from "@/effects";
import { registerDefaultGraphics } from "@/graphics";
import { ensurePresetFont } from "@/fonts/preset-fonts";
import { editGuard, scalarChannel } from "@/integrations/editorial-commands";
import { buildEffectElement } from "@/timeline/element-utils";
import { readEditingTranscript } from "@/integrations/operations";
import { useIntegrationStore } from "@/integrations/client";
import {
	mediaTimeFromSeconds,
	mediaTimeToSeconds,
	ZERO_MEDIA_TIME,
} from "@/wasm";
import type {
	AudioElement,
	EffectTrack,
	OverlayTrack,
	SceneTracks,
	TimelineElement,
	VideoElement,
} from "@/timeline";
import type { TProjectSettings } from "@/project/types";
import { buildModelLayer } from "./commands";
import { templateEngine } from "./engine";
import {
	findInstalledEditingTemplate,
	loadInstalledEditingTemplatePacks,
} from "./editing-template-packs";
import {
	applyEditingTemplateSchema,
	editingCatalogSchema,
	editingPlanSchema,
	type EditingPlan,
	type EditingTemplateReport,
} from "./editing-contract";

export async function listBuiltinEditingTemplates() {
	return editingCatalogSchema.parse(
		await templateEngine({ op: "editing_catalog" }),
	);
}

export async function listEditingTemplates() {
	const catalog = await listBuiltinEditingTemplates();
	const installed = loadInstalledEditingTemplatePacks().flatMap(
		(pack) => pack.templates,
	);
	return { ...catalog, templates: [...catalog.templates, ...installed] };
}

export function editingSource(editor: EditorCore) {
	const scene = editor.scenes.getActiveScene();
	const { main, overlay, audio } = scene.tracks;
	if (editor.project.getActive().settings.editingTemplates?.[scene.id]) {
		throw new Error(
			"Este template já foi aplicado nesta cena. Use Desfazer para voltar ao bruto ou crie outro projeto.",
		);
	}
	if (
		main.elements.length !== 1 ||
		main.elements[0].type !== "video" ||
		overlay.some((t) => t.elements.length) ||
		audio.some((t) => t.elements.length)
	) {
		throw new Error(
			"Para esta primeira versão, adicione um único vídeo de fala a uma timeline sem outras edições. As edições atuais foram preservadas.",
		);
	}
	const clip = main.elements[0];
	if (
		main.hidden ||
		main.muted ||
		clip.hidden ||
		clip.params.muted ||
		clip.isSourceAudioEnabled === false ||
		(clip.retime?.rate ?? 1) !== 1 ||
		Object.keys(clip.animations ?? {}).length ||
		clip.effects?.length ||
		clip.masks?.length
	) {
		throw new Error(
			"Use um vídeo com voz ativa e sem velocidade, animações, efeitos ou máscaras já aplicados.",
		);
	}
	if (editor.scenes.getScenes().length > 1) {
		throw new Error(
			"A edição completa define o formato do projeto. Use um projeto com uma única cena para preservar as outras cenas.",
		);
	}
	const asset = editor.media.getAssets().find((a) => a.id === clip.mediaId);
	if (!asset?.file || !asset.width || !asset.height || !asset.duration) {
		throw new Error(
			"O vídeo de origem precisa estar carregado antes de aplicar o template.",
		);
	}
	const duration = mediaTimeToSeconds({ time: clip.duration });
	if (duration < 1 || duration > 900)
		throw new Error("Use uma gravação entre 1 segundo e 15 minutos.");
	return { scene, clip, asset, duration };
}

export function getEditingTemplateContext({
	editor,
	transcriptId,
}: {
	editor: EditorCore;
	transcriptId?: string;
}) {
	const { scene, clip, asset, duration } = editingSource(editor);
	let words;
	if (transcriptId) {
		const transcript = readEditingTranscript({ editor, transcriptId });
		if (transcript.trackId !== scene.tracks.main.id)
			throw new Error("Transcreva a trilha do vídeo principal.");
		const start = mediaTimeToSeconds({ time: clip.startTime });
		words = transcript.words.map((word, wordIndex) => ({
			...word,
			start: word.start - start,
			end: word.end - start,
			wordIndex,
		}));
	}
	return {
		projectId: editor.project.getActive().metadata.id,
		sceneId: scene.id,
		trackId: scene.tracks.main.id,
		elementId: clip.id,
		sourceMediaId: asset.id,
		duration,
		sourceWidth: asset.width,
		sourceHeight: asset.height,
		words,
		instructions:
			"Use zero-based wordIndex from these words. keepRanges endpoints are inclusive and ordered. Preserve complete sentences, caveats and the recorded CTA; never fabricate speech, numbers or credentials. Apply once; if the call is rejected nothing changed, so fix the arguments from the error and retry (max 3 attempts). Panel price wordIndex must be inside the panel range and after the last panel item; motion stat wordIndex inside the motion range. No speed or preliminary timeline edits. No need to re-transcribe after the template: it remaps words itself. Explicativo Clean: 1–3 emphasisWords and a 1.5–9 second motion with headline and 1–3 items. Theme templates (energia-maxima and installed theme packs listed by list_editing_templates): corrections fix misheard words shown in captions (fromWord/toWord replaced by text, e.g. brand names); hook = 1–3 short phrases anchored on the opening words (fromWord/toWord span the spoken hook); commands = optional second stack of 1–3 short phrases for a spoken process or result; emphasisRanges = 2–4 categorical sentences for zoom; motion = one 3–9 s conceptual stretch in the middle with headline, up to 4 items anchored on spoken words and, when a number is spoken, stat {wordIndex of the final number, before, after, delta only if computable}; panel = optional lower-half list (1–4 short items anchored on words, optional price with its wordIndex) for an enumerated offer or list; highlightWords = up to 6 caption words to color. Hook, commands, motion and panel must not overlap. Follow the selected template brief.",
	};
}

// This is a host adapter, not an editorial planner. All ranges, layout, timing,
// and styles come from the portable Rust recipe. Existing editor rendering and
// audio processing handle the resulting ordinary timeline elements.
export function buildEditingTracks({
	editor,
	plan,
}: {
	editor: EditorCore;
	plan: EditingPlan;
}): SceneTracks {
	const { scene, clip, asset } = editingSource(editor);
	const time = (seconds: number) => mediaTimeFromSeconds({ seconds });
	const sourceTrim = mediaTimeToSeconds({ time: clip.trimStart });
	const sourceDuration = clip.sourceDuration ?? time(asset.duration!);
	const contain = Math.min(
		plan.width / asset.width!,
		plan.height / asset.height!,
	);
	const cover = Math.max(
		plan.width / asset.width!,
		plan.height / asset.height!,
	);
	const oldCanvas = editor.project.getActive().settings.canvasSize;
	const sx = Math.max(
		cover / contain,
		Number(clip.params["transform.scaleX"] ?? 1),
	);
	const sy = Math.max(
		cover / contain,
		Number(clip.params["transform.scaleY"] ?? 1),
	);
	const label = plan.templateName ?? "Explicativo Clean";
	const baseX =
		(Number(clip.params["transform.positionX"] ?? 0) * plan.width) /
		oldCanvas.width;
	const baseY =
		(Number(clip.params["transform.positionY"] ?? 0) * plan.height) /
		oldCanvas.height;
	const main: VideoElement[] = plan.clips.map((part, i) => {
		const effect = plan.colorGrade
			? buildDefaultEffectInstance({ effectType: "color-grade" })
			: undefined;
		if (effect) effect.params = { ...plan.colorGrade };
		const scaleX = sx * part.scale;
		const scaleY = sy * part.scale;
		const x = baseX + part.offsetX;
		const y = baseY + part.offsetY;
		const animations: NonNullable<VideoElement["animations"]> = {};
		// Slow "breathing" zoom and a short impact shake are native keyframes.
		if (part.creep) {
			animations["transform.scaleX"] = scalarChannel({
				points: [0, scaleX, part.duration, scaleX * 1.03],
			});
			animations["transform.scaleY"] = scalarChannel({
				points: [0, scaleY, part.duration, scaleY * 1.03],
			});
		}
		if (part.shake > 0) {
			const f = 1 / plan.fps;
			const k = part.shake;
			const shake = [
				[0, x + k],
				[f, x - k * 0.8],
				[2 * f, x + k * 0.6],
				[3 * f, x - k * 0.4],
				[5 * f, x + k * 0.2],
				[8 * f, x],
			].filter(([t]) => t <= part.duration);
			animations["transform.positionX"] = scalarChannel({
				points: shake.flat(),
			});
		}
		return {
			...clip,
			id: crypto.randomUUID(),
			name: `${label} · ${i + 1}`,
			startTime: time(part.start),
			duration: time(part.duration),
			trimStart: time(sourceTrim + part.sourceStart),
			trimEnd: time(
				Math.max(
					0,
					mediaTimeToSeconds({ time: sourceDuration }) -
						sourceTrim -
						part.sourceEnd,
				),
			),
			sourceDuration,
			...(part.rate !== 1 && {
				retime: { rate: part.rate, maintainPitch: true },
			}),
			params: {
				...clip.params,
				"transform.scaleX": scaleX,
				"transform.scaleY": scaleY,
				"transform.positionX": x,
				"transform.positionY": y,
				voiceEnhance: plan.voiceEnhance,
				fadeIn: 0.005,
				fadeOut: i === plan.clips.length - 1 ? 0.08 : 0.005,
			},
			animations: Object.keys(animations).length
				? animations
				: clip.animations,
			effects: effect ? [effect] : [],
		};
	});
	registerDefaultGraphics();
	const lanes = new Map<number, OverlayTrack>();
	for (const layer of plan.layers) {
		const lane = layer.lane ?? 0;
		let track = lanes.get(lane);
		if (!track) {
			track = {
				id: crypto.randomUUID(),
				name: layer.name,
				type: layer.type,
				hidden: false,
				elements: [],
			} as OverlayTrack;
			lanes.set(lane, track);
		}
		if (track.type !== layer.type)
			throw new Error("Tipos de camada incompatíveis no plano.");
		const element = {
			...buildModelLayer(layer),
			id: crypto.randomUUID(),
		} as TimelineElement;
		(track.elements as TimelineElement[]).push(element);
	}
	const audio: SceneTracks["audio"] = [];
	const music = plan.music;
	if (music) {
		// One continuous source: the end-card part resumes where the bed stops.
		const parts = [
			{
				from: 0,
				to: plan.bodyDuration,
				volume: music.bedDb,
				fadeIn: 1,
				fadeOut: 0.25,
			},
			{
				from: plan.bodyDuration,
				to: plan.duration,
				volume: music.endDb,
				fadeIn: 0.25,
				fadeOut: 0.5,
			},
		].filter((part) => part.to - part.from > 0.05);
		audio.push({
			id: crypto.randomUUID(),
			name: `${label} · trilha`,
			type: "audio",
			muted: false,
			elements: parts.map(
				(part, n): AudioElement => ({
					id: crypto.randomUUID(),
					type: "audio",
					sourceType: "library",
					sourceUrl: music.src,
					name: `${label} · trilha ${n + 1}`,
					startTime: time(part.from),
					duration: time(part.to - part.from),
					trimStart: time(part.from),
					trimEnd: ZERO_MEDIA_TIME,
					params: {
						volume: part.volume,
						muted: false,
						fadeIn: part.fadeIn,
						fadeOut: part.fadeOut,
					},
				}),
			),
		});
	}
	// Separate lanes avoid overlap rejection when hits and motion sounds coincide.
	for (const sound of plan.sounds) {
		const element: AudioElement = {
			id: crypto.randomUUID(),
			type: "audio",
			sourceType: "library",
			sourceUrl: sound.palette
				? `/editing-templates/sfx/${sound.palette}/${sound.kind}.wav`
				: `/editing-templates/sfx/${sound.kind}.wav`,
			name: `${label} · ${sound.kind}`,
			startTime: time(sound.start),
			duration: time(sound.duration),
			trimStart: ZERO_MEDIA_TIME,
			trimEnd: ZERO_MEDIA_TIME,
			params: {
				volume: sound.volumeDb,
				muted: false,
				fadeIn: 0.005,
				fadeOut: 0.02,
			},
		};
		audio.push({
			id: crypto.randomUUID(),
			name: element.name,
			type: "audio",
			muted: false,
			elements: [element],
		});
	}
	const overlay: OverlayTrack[] = [...lanes.entries()]
		.sort(([a], [b]) => b - a)
		.map(([, track]) => track);
	if (plan.transitions.length) {
		// Transitions bind to main-track cuts; keep them right above the video.
		const effects: EffectTrack = {
			id: crypto.randomUUID(),
			name: `${label} · transições`,
			type: "effect",
			hidden: false,
			elements: plan.transitions.map((transition) => {
				const element = buildEffectElement({
					effectType: transition.type,
					startTime: time(transition.start),
					duration: time(transition.duration),
				});
				return {
					...element,
					id: crypto.randomUUID(),
					params: { ...element.params, intensity: transition.intensity },
				};
			}),
		};
		overlay.push(effects);
	}
	return {
		main: { ...scene.tracks.main, elements: main },
		overlay,
		audio,
	};
}

export class ApplyEditingTemplateCommand extends Command {
	readonly handlesRipple = true;
	private before: SceneTracks;
	private settingsCommand: UpdateProjectSettingsCommand;
	private editor: EditorCore;
	private after: SceneTracks;
	constructor({
		editor,
		after,
		settings,
	}: {
		editor: EditorCore;
		after: SceneTracks;
		settings: Partial<TProjectSettings>;
	}) {
		super();
		this.editor = editor;
		this.after = after;
		this.before = editor.scenes.getActiveScene().tracks;
		this.settingsCommand = new UpdateProjectSettingsCommand(settings);
	}
	execute() {
		try {
			this.settingsCommand.execute();
			this.editor.timeline.updateTracks(this.after);
			return createElementSelectionResult([]);
		} catch (error) {
			this.editor.timeline.updateTracks(this.before);
			this.settingsCommand.undo();
			throw error;
		}
	}
	undo() {
		this.editor.timeline.updateTracks(this.before);
		this.settingsCommand.undo();
	}
}

export async function applyEditingTemplate({
	editor,
	input,
	source = "local",
}: {
	editor: EditorCore;
	input: unknown;
	source?: string;
}) {
	const deadline = Date.now() + 15_000;
	const args = applyEditingTemplateSchema.parse(input);
	const assert = editGuard({ editor, source });
	assert();
	if (editor.project.getExportState().isExporting)
		throw new Error("Aguarde a exportação terminar.");
	const context = getEditingTemplateContext({
		editor,
		transcriptId: args.transcriptId,
	});
	const plan = editingPlanSchema.parse(
		await templateEngine({
			op: "editing_plan",
			...args,
			installed: findInstalledEditingTemplate(args.templateId),
			words: context.words,
			duration: context.duration,
		}),
	);
	await ensurePresetFont({ family: "Montserrat" });
	const families = [...new Set(["Montserrat", ...plan.fonts])];
	await Promise.all(
		families.flatMap((family) =>
			["normal 44px", "bold 64px", "italic 44px"].map((style) =>
				document.fonts.load(`${style} "${family}"`).catch(() => []),
			),
		),
	);
	const missingFonts = families.filter(
		(family) => !document.fonts.check(`normal 44px "${family}"`),
	);
	const assets = [
		...new Set([
			...plan.sounds.map((sound) =>
				sound.palette
					? `/editing-templates/sfx/${sound.palette}/${sound.kind}.wav`
					: `/editing-templates/sfx/${sound.kind}.wav`,
			),
			...(plan.music ? [plan.music.src] : []),
		]),
	];
	await Promise.all(
		assets.map(async (url) => {
			const response = await fetch(url, {
				signal: AbortSignal.timeout(8000),
			});
			if (!response.ok || (await response.arrayBuffer()).byteLength < 100)
				throw new Error(
					"Arquivo de som do template indisponível. Nenhuma edição foi aplicada.",
				);
		}),
	);
	if (Date.now() > deadline)
		throw new Error("O preparo excedeu o tempo. Nenhuma edição foi aplicada.");
	const run = useIntegrationStore.getState().agentRun;
	if (source === "OpenAI" && run && run.status !== "running")
		throw new Error("Edição cancelada antes da aplicação.");
	assert();
	// Source-bound transcript and export status are rechecked after all async work.
	getEditingTemplateContext({ editor, transcriptId: args.transcriptId });
	if (editor.project.getExportState().isExporting)
		throw new Error("Aguarde a exportação terminar.");
	const tracks = buildEditingTracks({ editor, plan });
	const report: EditingTemplateReport = {
		templateId: plan.templateId,
		version: plan.version,
		presetId: args.presetId,
		presetName: args.presetName,
		sceneId: context.sceneId,
		sourceMediaId: context.sourceMediaId,
		appliedAt: new Date().toISOString(),
		options: args.options,
		duration: plan.duration,
		sourceDuration: context.duration,
		cutCount: plan.clips.length - 1,
		captionCount: plan.captionCount,
		soundCount: plan.sounds.length,
		warnings: [
			...plan.warnings,
			...missingFonts.map(
				(family) =>
					`Fonte ${family} indisponível neste computador; o editor usa uma fonte substituta.`,
			),
		],
	};
	editor.command.execute({
		command: new ApplyEditingTemplateCommand({
			editor,
			after: tracks,
			settings: {
				canvasSize: { width: plan.width, height: plan.height },
				canvasSizeMode: "preset",
				fps: { numerator: plan.fps, denominator: 1 },
				videoEngine: "canvas",
				background: { type: "color", color: plan.background ?? "#18191B" },
				editingTemplates: {
					...editor.project.getActive().settings.editingTemplates,
					[context.sceneId]: report,
				},
			},
		}),
	});
	return {
		...report,
		undoSteps: 1,
		retainedWords: plan.retainedWords,
		visualLayerCount: plan.layers.length,
		previewMatchesExportEngine: true,
	};
}
