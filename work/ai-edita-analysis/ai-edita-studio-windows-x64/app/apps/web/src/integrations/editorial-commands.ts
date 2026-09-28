import type { EditorCore } from "@/core";
import type { TimelineElement, ElementRef } from "@/timeline";
import type {
	ElementAnimations,
	ScalarAnimationChannel,
} from "@/animation/types";
import {
	mediaTimeFromSeconds,
	mediaTimeToSeconds,
	roundMediaTime,
} from "@/wasm";
import { useIntegrationStore } from "./client";
import { editorialPlan } from "./editorial-engine";
import { schemas } from "./catalog";
import { getBuiltInElementParams } from "@/params/registry";
import { coerceParamValue } from "@/params";
import { applyElementUpdate } from "@/timeline/update-pipeline";
import { buildDefaultEffectInstance } from "@/effects";

export function editGuard({
	editor,
	source = "local",
}: {
	editor: EditorCore;
	source?: string;
}) {
	const original = {
		project: editor.project.getActive().metadata.id,
		scene: editor.scenes.getActiveScene().id,
		tracks: editor.scenes.getActiveScene().tracks,
		settings: editor.project.getActive().settings,
		session: useIntegrationStore.getState().connection?.sessionId,
	};
	return () => {
		const state = useIntegrationStore.getState();
		if (
			source !== "local" &&
			(!original.session ||
				state.connection?.sessionId !== original.session ||
				!state.settings.allowEdits ||
				(source === "OpenAI" && !state.settings.shareWithOpenAI))
		)
			throw new Error(
				"Autorize a edição em Integrações / Authorize editing in Integrations.",
			);
		if (
			editor.project.getActiveOrNull()?.metadata.id !== original.project ||
			editor.scenes.getActiveSceneOrNull()?.id !== original.scene ||
			editor.scenes.getActiveScene().tracks !== original.tracks ||
			editor.project.getActive().settings !== original.settings
		)
			throw new Error(
				"A timeline mudou durante o planejamento. Tente novamente / Timeline changed while planning. Try again.",
			);
	};
}

export function scalarChannel({
	points,
}: {
	points: number[];
}): ScalarAnimationChannel {
	return {
		keys: Array.from({ length: points.length / 2 }, (_, i) => ({
			id: crypto.randomUUID(),
			time: mediaTimeFromSeconds({ seconds: points[i * 2] }),
			value: points[i * 2 + 1],
			segmentToNext: "linear" as const,
			tangentMode: "auto" as const,
		})),
	};
}

// Convert Rust's abstract channels into the editor's animation storage.
export function motionChannels({
	plan,
	params,
}: {
	plan: number[];
	params: TimelineElement["params"];
}): ElementAnimations {
	const scale: number[] = [],
		opacity: number[] = [];
	for (let i = 0; i < plan.length; i += 3)
		(plan[i] === 0 ? scale : opacity).push(plan[i + 1], plan[i + 2]);
	const result: ElementAnimations = {};
	for (const [property, points] of [
		["transform.scaleX", scale],
		["transform.scaleY", scale],
		["opacity", opacity],
	] as const) {
		if (points.length)
			result[property] = scalarChannel({
				points: points.map((value, i) =>
					i % 2 ? value * Number(params[property] ?? 1) : value,
				),
			});
	}
	return result;
}
export function findElement({
	editor,
	ref,
}: {
	editor: EditorCore;
	ref: ElementRef;
}) {
	const result = editor.timeline.getElementsWithTracks({ elements: [ref] })[0];
	if (!result) throw new Error("Clipe não encontrado / Clip not found.");
	return result;
}
export async function applyMotion({
	editor,
	input,
	source,
}: {
	editor: EditorCore;
	input: unknown;
	source?: string;
}) {
	const args = schemas.apply_motion.parse(input);
	const assert = editGuard({ editor, source });
	assert();
	if (
		new Set(args.elements.map((r) => r.elementId)).size !== args.elements.length
	)
		throw new Error("Duplicate clip reference.");
	const updates = [];
	for (const ref of args.elements) {
		const { element } = findElement({ editor, ref });
		if (element.type === "audio" || element.type === "effect")
			throw new Error("Escolha clipes visuais / Choose visual clips.");
		const plan = await editorialPlan({
			kind: "motion",
			args: [
				mediaTimeToSeconds({ time: element.duration }),
				["push_in", "pull_out", "punch", "fade", "pop"].indexOf(args.preset),
				args.strength ?? 0.12,
			],
		});
		if (!plan.length)
			throw new Error(
				"Clipe muito curto para este movimento / Clip too short for this motion.",
			);
		const channels = motionChannels({ plan, params: element.params });
		if (
			!args.replaceExisting &&
			Object.keys(channels).some((key) => element.animations?.[key])
		)
			throw new Error(
				"Já existe animação neste clipe. Autorize a substituição / Existing animation requires replacement approval.",
			);
		updates.push({
			...ref,
			patch: { animations: { ...element.animations, ...channels } },
		});
	}
	assert();
	editor.timeline.updateElements({ updates });
	return { modifiedElements: args.elements, preset: args.preset, undoSteps: 1 };
}
export function animateElement({
	editor,
	input,
	source,
}: {
	editor: EditorCore;
	input: unknown;
	source?: string;
}) {
	const args = schemas.animate_element.parse(input);
	editGuard({ editor, source })();
	const { element } = findElement({ editor, ref: args });
	const param = getBuiltInElementParams({ type: element.type }).find(
		(p) => p.key === args.property && p.type === "number",
	);
	if (!param || param.type !== "number")
		throw new Error(
			"Esta propriedade não pertence ao clipe / Property unavailable on this clip.",
		);
	if (element.animations?.[args.property] && !args.replaceExisting)
		throw new Error("Existing animation requires replacement approval.");
	const duration = mediaTimeToSeconds({ time: element.duration });
	for (const [i, key] of args.keyframes.entries()) {
		if (
			key.seconds > duration ||
			(i > 0 &&
				mediaTimeFromSeconds({ seconds: key.seconds }) <=
					mediaTimeFromSeconds({ seconds: args.keyframes[i - 1].seconds }))
		)
			throw new Error(
				"Keyframes must be ordered, distinct and inside the clip.",
			);
		const value = coerceParamValue({ param, value: key.value });
		if (
			value === null ||
			key.value < param.min ||
			(param.max !== undefined && key.value > param.max)
		)
			throw new Error("Animation value outside the parameter range.");
	}
	editor.timeline.updateElements({
		updates: [
			{
				trackId: args.trackId,
				elementId: args.elementId,
				patch: {
					animations: {
						...element.animations,
						[args.property]: scalarChannel({
							points: args.keyframes.flatMap((k) => [k.seconds, k.value]),
						}),
					},
				},
			},
		],
	});
	return {
		property: args.property,
		keyframeCount: args.keyframes.length,
		undoSteps: 1,
	};
}
export function setClipSpeed({
	editor,
	input,
	source,
}: {
	editor: EditorCore;
	input: unknown;
	source?: string;
}) {
	const args = schemas.set_clip_speed.parse(input);
	editGuard({ editor, source })();
	const { element, track } = findElement({ editor, ref: args });
	if (element.type !== "audio" && element.type !== "video")
		throw new Error("Choose an audio or video clip.");
	const patch = {
		retime: { rate: args.rate, maintainPitch: args.maintainPitch ?? true },
	};
	const next = applyElementUpdate({
		element,
		patch,
		context: {
			tracks: editor.scenes.getActiveScene().tracks,
			trackId: track.id,
		},
	});
	if (
		track.elements.some(
			(other) =>
				other.id !== element.id &&
				next.startTime < other.startTime + other.duration &&
				next.startTime + next.duration > other.startTime,
		)
	)
		throw new Error(
			"Esta velocidade sobreporia outro clipe / This speed would overlap another clip.",
		);
	editor.timeline.updateElements({
		updates: [{ trackId: track.id, elementId: element.id, patch }],
	});
	return {
		rate: args.rate,
		durationSeconds: mediaTimeToSeconds({ time: next.duration }),
		undoSteps: 1,
	};
}

export function setClipsSpeed({
	editor,
	input,
	source,
}: {
	editor: EditorCore;
	input: unknown;
	source?: string;
}) {
	const args = schemas.set_clips_speed.parse(input);
	editGuard({ editor, source })();
	const seen = new Set<string>();
	const matches = args.elements.map((ref) => {
		const key = ref.trackId + ":" + ref.elementId;
		if (seen.has(key)) throw new Error("Do not repeat a clip in the batch.");
		seen.add(key);
		const match = findElement({ editor, ref });
		if (match.element.type !== "audio" && match.element.type !== "video")
			throw new Error("Choose only audio or video clips.");
		return { ...match, ref };
	});
	const scalePositions =
		args.scaleTimelinePositions ?? args.elements.length > 1;
	const firstStart = Math.min(
		...matches.map(({ element }) =>
			mediaTimeToSeconds({ time: element.startTime }),
		),
	);
	const proposed = matches.map(({ element, track, ref }) => {
		const startSeconds = mediaTimeToSeconds({ time: element.startTime });
		const patch: Partial<TimelineElement> = {
			...(scalePositions
				? {
						startTime: mediaTimeFromSeconds({
							seconds: firstStart + (startSeconds - firstStart) / args.rate,
						}),
					}
				: {}),
			retime: {
				rate: args.rate,
				maintainPitch: args.maintainPitch ?? true,
			},
		};
		const next = applyElementUpdate({
			element,
			patch,
			context: {
				tracks: editor.scenes.getActiveScene().tracks,
				trackId: track.id,
			},
		});
		return { ref, patch, next, element, track };
	});
	const proposedById = new Map(
		proposed.map((proposal) => [
			proposal.ref.trackId + ":" + proposal.ref.elementId,
			proposal,
		]),
	);
	const scene = editor.scenes.getActiveScene();
	for (const track of [
		scene.tracks.main,
		...scene.tracks.overlay,
		...scene.tracks.audio,
	]) {
		const future = track.elements
			.map((element) => {
				const proposal = proposedById.get(track.id + ":" + element.id);
				return { proposal, next: proposal?.next ?? element };
			})
			.sort((a, b) => a.next.startTime - b.next.startTime);
		for (let i = 1; i < future.length; i++) {
			const previousEnd =
				future[i - 1].next.startTime + future[i - 1].next.duration;
			const overlapTicks = previousEnd - future[i].next.startTime;
			if (overlapTicks <= 0) continue;

			// Each retimed boundary is projected independently onto integer media
			// ticks. Two adjacent clips can therefore overlap by exactly one tick
			// even though their continuous-time layout is valid. Snap that boundary
			// forward instead of rejecting the whole batch.
			const proposal = future[i].proposal;
			if (
				overlapTicks === 1 &&
				proposal &&
				proposal.patch.startTime !== undefined
			) {
				proposal.patch = {
					...proposal.patch,
					startTime: roundMediaTime({ time: previousEnd }),
				};
				proposal.next = applyElementUpdate({
					element: proposal.element,
					patch: proposal.patch,
					context: {
						tracks: scene.tracks,
						trackId: proposal.track.id,
					},
				});
				future[i].next = proposal.next;
				continue;
			}

			if (overlapTicks > 0)
				throw new Error(
					"The batch speed would overlap another clip. Apply timing changes before B-roll/captions, or select the complete sequence.",
				);
		}
	}
	const previousEnd = Math.max(
		...matches.map(
			({ element }) =>
				mediaTimeToSeconds({ time: element.startTime }) +
				mediaTimeToSeconds({ time: element.duration }),
		),
	);
	const nextEnd = Math.max(
		...proposed.map(
			({ next }) =>
				mediaTimeToSeconds({ time: next.startTime }) +
				mediaTimeToSeconds({ time: next.duration }),
		),
	);
	editor.timeline.updateElements({
		updates: proposed.map(({ ref, patch }) => ({
			trackId: ref.trackId,
			elementId: ref.elementId,
			patch,
		})),
	});
	return {
		rate: args.rate,
		modifiedCount: proposed.length,
		previousSpanSeconds: previousEnd - firstStart,
		newSpanSeconds: nextEnd - firstStart,
		scaledTimelinePositions: scalePositions,
		undoSteps: 1,
	};
}

const COLOR_PRESETS = {
	natural: {
		brightness: 0.015,
		contrast: 1.08,
		saturation: 1.08,
		warmth: 0.025,
	},
	warm: { brightness: 0.02, contrast: 1.1, saturation: 1.12, warmth: 0.12 },
	cool: { brightness: 0, contrast: 1.08, saturation: 1.05, warmth: -0.1 },
	vivid: { brightness: 0.025, contrast: 1.15, saturation: 1.25, warmth: 0.04 },
	cinematic: {
		brightness: -0.015,
		contrast: 1.18,
		saturation: 0.88,
		warmth: -0.035,
	},
} as const;

export function applyColorGrade({
	editor,
	input,
	source,
}: {
	editor: EditorCore;
	input: unknown;
	source?: string;
}) {
	const args = schemas.apply_color_grade.parse(input);
	editGuard({ editor, source })();
	const intensity = args.intensity ?? 0.7;
	const preset = COLOR_PRESETS[args.preset];
	const seen = new Set<string>();
	const updates = args.elements.map((ref) => {
		const key = ref.trackId + ":" + ref.elementId;
		if (seen.has(key)) throw new Error("Do not repeat a clip in the batch.");
		seen.add(key);
		const { element } = findElement({ editor, ref });
		if (element.type !== "video" && element.type !== "image")
			throw new Error("Color grading supports video and image clips.");
		const existing = element.effects?.find(
			(effect) => effect.type === "color-grade",
		);
		if (existing && !args.replaceExisting)
			throw new Error(
				"A selected clip already has color grading. Explicitly authorize replaceExisting:true to replace it.",
			);
		const effect = buildDefaultEffectInstance({ effectType: "color-grade" });
		effect.params = {
			brightness: preset.brightness * intensity,
			contrast: 1 + (preset.contrast - 1) * intensity,
			saturation: 1 + (preset.saturation - 1) * intensity,
			warmth: preset.warmth * intensity,
		};
		return {
			trackId: ref.trackId,
			elementId: ref.elementId,
			patch: {
				effects: existing
					? element.effects?.map((item) =>
							item.id === existing.id ? { ...effect, id: item.id } : item,
						)
					: [...(element.effects ?? []), effect],
			},
			effectId: existing?.id ?? effect.id,
		};
	});
	editor.timeline.updateElements({
		updates: updates.map(({ trackId, elementId, patch }) => ({
			trackId,
			elementId,
			patch,
		})),
	});
	return {
		preset: args.preset,
		intensity,
		modifiedCount: updates.length,
		effectIds: updates.map(({ effectId }) => effectId),
		undoSteps: 1,
	};
}
