import type { ParamValues } from "@/params";
import { hasKeyframesForPath, setChannel } from "@/animation";
import type { AnimationPath, ElementAnimations } from "@/animation/types";
import { isGeneratedCaptionName } from "@/subtitles/caption-layout";
import type { SceneTracks, TextElement, TimelineElement } from "@/timeline";
import { create } from "zustand";

export const useCaptionStyleLinkStore = create<{
	applyToAll: boolean;
	setApplyToAll: (applyToAll: boolean) => void;
}>()((set) => ({
	applyToAll: true,
	setApplyToAll: (applyToAll) => set({ applyToAll }),
}));

export function isCaptionElement(
	element: TimelineElement,
): element is TextElement;
export function isCaptionElement(element: {
	type: string;
	name: string;
}): boolean;
export function isCaptionElement(element: { type: string; name: string }) {
	if (element.type !== "text") return false;

	return isGeneratedCaptionName({ name: element.name });
}

export function getCaptionElements({
	tracks,
}: {
	tracks: SceneTracks;
}): Array<{ trackId: string; element: TextElement }> {
	return [tracks.main, ...tracks.overlay].flatMap((track) =>
		track.elements.flatMap((element) =>
			isCaptionElement(element) ? [{ trackId: track.id, element }] : [],
		),
	);
}

export function copyCaptionVisualParams({
	source,
	target,
	paramKeys,
}: {
	source: { params: ParamValues };
	target: { params: ParamValues };
	paramKeys: readonly string[];
}): ParamValues {
	const params = { ...target.params };

	for (const key of paramKeys) {
		if (key !== "content" && key in source.params) {
			params[key] = source.params[key];
		}
	}

	return params;
}

export interface CaptionVisualPreviewUpdate {
	trackId: string;
	elementId: string;
	updates: Partial<TimelineElement>;
}

const TRANSFORM_ANIMATION_PATHS: readonly AnimationPath[] = [
	"transform.positionX",
	"transform.positionY",
	"transform.scaleX",
	"transform.scaleY",
	"transform.rotate",
];

function copyClearedTransformAnimations({
	sourceBefore,
	sourceAfter,
	target,
}: {
	sourceBefore: ElementAnimations | undefined;
	sourceAfter: ElementAnimations | undefined;
	target: ElementAnimations | undefined;
}): ElementAnimations | undefined {
	let next = target;
	for (const propertyPath of TRANSFORM_ANIMATION_PATHS) {
		if (
			hasKeyframesForPath({
				animations: sourceBefore,
				propertyPath,
			}) &&
			!hasKeyframesForPath({
				animations: sourceAfter,
				propertyPath,
			})
		) {
			next = setChannel({
				animations: next,
				propertyPath,
				channel: undefined,
			});
		}
	}
	return next;
}

/**
 * Mirrors direct Canvas transformations from one caption to every caption.
 * Timing and content remain individual; all visual params follow the source.
 */
export function linkCaptionVisualPreviewUpdates({
	tracks,
	updates,
}: {
	tracks: SceneTracks;
	updates: readonly CaptionVisualPreviewUpdate[];
}): CaptionVisualPreviewUpdate[] {
	const captions = getCaptionElements({ tracks });
	const captionById = new Map(
		captions.map(({ trackId, element }) => [
			`${trackId}:${element.id}`,
			element,
		]),
	);
	const sourceUpdate = updates.find(
		(update) =>
			update.updates.params &&
			captionById.has(`${update.trackId}:${update.elementId}`),
	);
	if (!sourceUpdate?.updates.params) return [...updates];

	const sourceElement = captionById.get(
		`${sourceUpdate.trackId}:${sourceUpdate.elementId}`,
	);
	if (!sourceElement) return [...updates];

	const sourceWithPreview = {
		params: {
			...sourceElement.params,
			...sourceUpdate.updates.params,
		},
	};
	const paramKeys = Object.keys(sourceWithPreview.params);
	const clearsTransformAnimations = Object.prototype.hasOwnProperty.call(
		sourceUpdate.updates,
		"animations",
	);

	return [
		...updates,
		...captions
			.filter(
				({ trackId, element }) =>
					trackId !== sourceUpdate.trackId ||
					element.id !== sourceUpdate.elementId,
			)
			.map(({ trackId, element }) => {
				const linkedUpdates: Partial<TimelineElement> = {
					params: copyCaptionVisualParams({
						source: sourceWithPreview,
						target: element,
						paramKeys,
					}),
				};

				if (clearsTransformAnimations) {
					linkedUpdates.animations = copyClearedTransformAnimations({
						sourceBefore: sourceElement.animations,
						sourceAfter: sourceUpdate.updates.animations,
						target: element.animations,
					});
				}

				return {
					trackId,
					elementId: element.id,
					updates: linkedUpdates,
				};
			}),
	];
}
