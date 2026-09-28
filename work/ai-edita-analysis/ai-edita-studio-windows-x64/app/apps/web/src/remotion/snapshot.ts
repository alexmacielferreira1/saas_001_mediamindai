import type { MediaAsset } from "@/media/types";
import type { TProject } from "@/project/types";
import type {
	AudioElement,
	SceneTracks,
	TimelineElement,
	TimelineTrack,
} from "@/timeline/types";
import {
	isCompositeChannelData,
	isLeafChannelData,
} from "@/animation/channel-data";
import type { AnimationChannel } from "@/animation/types";
import { frameRateToFloat } from "@/fps/utils";
import { mediaTimeToSeconds, type MediaTime } from "@/wasm";
import type {
	RemotionAnimations,
	RemotionAnimationChannel,
	RemotionAudioElement,
	RemotionMediaSource,
	RemotionParamValue,
	RemotionProjectSnapshot,
	RemotionVisualElement,
} from "./types";

const asSeconds = (time: MediaTime) => mediaTimeToSeconds({ time });

function serializableParams(
	params: TimelineElement["params"],
): Record<string, RemotionParamValue> {
	return Object.fromEntries(
		Object.entries(params).filter(
			(entry): entry is [string, RemotionParamValue] =>
				typeof entry[1] === "number" ||
				typeof entry[1] === "string" ||
				typeof entry[1] === "boolean",
		),
	);
}

function serializableAnimations(
	element: TimelineElement,
): RemotionAnimations | undefined {
	if (!element.animations) return undefined;

	const animations: RemotionAnimations = {};
	for (const [propertyPath, data] of Object.entries(element.animations)) {
		if (isLeafChannelData(data)) {
			animations[propertyPath] = serializeChannel(data);
			continue;
		}
		if (isCompositeChannelData(data)) {
			const components: Record<string, RemotionAnimationChannel | undefined> =
				{};
			for (const [component, channel] of Object.entries(data)) {
				if (isLeafChannelData(channel)) {
					components[component] = serializeChannel(channel);
				}
			}
			animations[propertyPath] = components;
		}
	}
	return animations;
}

function serializeChannel(channel: AnimationChannel): RemotionAnimationChannel {
	return {
		keys: channel.keys.map((key) => ({
			time: asSeconds(key.time),
			value: key.value,
			...("segmentToNext" in key && {
				segmentToNext: key.segmentToNext,
			}),
		})),
	};
}

function sourceForAsset(asset: MediaAsset): RemotionMediaSource | null {
	if (!asset.url) return null;
	return {
		id: asset.id,
		type: asset.type,
		src: asset.url,
		width: asset.width,
		height: asset.height,
	};
}

function collectAnimationWarnings({
	element,
	warnings,
}: {
	element: TimelineElement;
	warnings: Set<string>;
}) {
	const hasBezier = (value: unknown): boolean => {
		if (Array.isArray(value)) return value.some(hasBezier);
		if (!value || typeof value !== "object") return false;
		if (
			"segmentToNext" in value &&
			(value as { segmentToNext?: unknown }).segmentToNext === "bezier"
		) {
			return true;
		}
		return Object.values(value).some(hasBezier);
	};
	if (hasBezier(element.animations)) {
		warnings.add(
			"Curvas Bézier permanecem salvas, mas nesta etapa do Remotion são interpoladas linearmente.",
		);
	}
}

function visibleTracks(tracks: SceneTracks): TimelineTrack[] {
	return [
		...tracks.overlay.filter((track) => !("hidden" in track && track.hidden)),
		...(!tracks.main.hidden ? [tracks.main] : []),
	].reverse();
}

function buildAudioElement({
	element,
	trackMuted,
}: {
	element: AudioElement;
	trackMuted: boolean;
}): RemotionAudioElement | null {
	if (trackMuted || element.params.muted === true) return null;
	return {
		id: element.id,
		name: element.name,
		timelineStartSeconds: asSeconds(element.startTime),
		timelineDurationSeconds: asSeconds(element.duration),
		sourceStartSeconds: asSeconds(element.trimStart),
		playbackRate: Math.max(0.05, element.retime?.rate ?? 1),
		mediaId: element.sourceType === "upload" ? element.mediaId : undefined,
		src: element.sourceType === "library" ? element.sourceUrl : undefined,
		params: serializableParams(element.params),
	};
}

export function buildRemotionSnapshot({
	project,
	tracks,
	mediaAssets,
	duration,
	includeAudio,
}: {
	project: TProject;
	tracks: SceneTracks;
	mediaAssets: MediaAsset[];
	duration: MediaTime;
	includeAudio: boolean;
}): RemotionProjectSnapshot {
	const fps = frameRateToFloat(project.settings.fps);
	const warnings = new Set<string>();
	const media = mediaAssets.flatMap((asset) => {
		const source = sourceForAsset(asset);
		if (!source) warnings.add(`Mídia “${asset.name}” está sem URL carregada.`);
		return source ? [source] : [];
	});
	const availableMedia = new Set(media.map((asset) => asset.id));
	const visual: RemotionVisualElement[] = [];

	visibleTracks(tracks).forEach((track, layer) => {
		for (const element of track.elements) {
			if ("hidden" in element && element.hidden) continue;
			collectAnimationWarnings({ element, warnings });
			if (element.type === "effect") {
				warnings.add(
					`O efeito de camada “${element.name}” foi preservado, mas ainda não possui equivalente Remotion.`,
				);
				continue;
			}
			if (element.type === "graphic" || element.type === "sticker") {
				warnings.add(
					`O item “${element.name}” (${element.type}) foi preservado, mas ainda não possui equivalente Remotion.`,
				);
				continue;
			}
			if (
				element.type !== "video" &&
				element.type !== "image" &&
				element.type !== "text"
			)
				continue;
			if (
				(element.type === "video" || element.type === "image") &&
				!availableMedia.has(element.mediaId)
			) {
				warnings.add(
					`A mídia usada por “${element.name}” não está disponível.`,
				);
			}
			if (element.effects?.some((effect) => effect.enabled)) {
				warnings.add(
					`Os efeitos de “${element.name}” permanecem editáveis no projeto, mas ainda não são renderizados pelo Remotion.`,
				);
			}
			if ("masks" in element && element.masks?.length) {
				warnings.add(
					`As máscaras de “${element.name}” permanecem salvas, mas ainda não são renderizadas pelo Remotion.`,
				);
			}
			visual.push({
				id: element.id,
				name: element.name,
				type: element.type,
				layer,
				timelineStartSeconds: asSeconds(element.startTime),
				timelineDurationSeconds: asSeconds(element.duration),
				sourceStartSeconds: asSeconds(element.trimStart),
				playbackRate:
					element.type === "video"
						? Math.max(0.05, element.retime?.rate ?? 1)
						: 1,
				mediaId: element.type === "text" ? undefined : element.mediaId,
				includeSourceAudio:
					element.type === "video" &&
					includeAudio &&
					track.type === "video" &&
					!track.muted &&
					element.isSourceAudioEnabled !== false &&
					element.params.muted !== true,
				params: serializableParams(element.params),
				animations: serializableAnimations(element),
			});
		}
	});

	const audio = includeAudio
		? tracks.audio.flatMap((track) =>
				track.elements.flatMap((element) => {
					const item = buildAudioElement({ element, trackMuted: track.muted });
					if (item?.src) {
						warnings.add(
							`O áudio de biblioteca “${element.name}” depende de uma URL externa; a exportação Remotion local exige mídia importada.`,
						);
					}
					return item ? [item] : [];
				}),
			)
		: [];

	if (project.settings.background.type === "blur") {
		warnings.add(
			"O fundo desfocado foi preservado, mas o Remotion usa fundo preto até o equivalente ser concluído.",
		);
	}

	return {
		schema: "ai-edita.remotion-snapshot",
		version: 1,
		projectId: project.metadata.id,
		sceneId: project.currentSceneId,
		projectVersion: project.version,
		name: project.metadata.name,
		createdAt: new Date().toISOString(),
		width: project.settings.canvasSize.width,
		height: project.settings.canvasSize.height,
		fps,
		durationInFrames: Math.max(1, Math.ceil(asSeconds(duration) * fps)),
		includeAudio,
		background: project.settings.background,
		media,
		visual,
		audio,
		warnings: [...warnings],
	};
}
