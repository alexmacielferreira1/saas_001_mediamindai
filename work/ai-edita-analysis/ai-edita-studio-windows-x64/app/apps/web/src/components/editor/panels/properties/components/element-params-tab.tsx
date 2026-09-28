"use client";

import {
	hasKeyframesForPath,
	resolveAnimationPathValueAtTime,
	upsertPathKeyframe,
} from "@/animation";
import { Section, SectionContent, SectionFields } from "@/components/section";
import { useElementPlayhead } from "@/components/editor/panels/properties/hooks/use-element-playhead";
import { useKeyframedParamProperty } from "@/components/editor/panels/properties/hooks/use-keyframed-param-property";
import { PropertyParamField } from "@/components/editor/panels/properties/components/property-param-field";
import {
	coerceParamValue,
	getParamChannelLayout,
	type ParamValue,
	type ParamValues,
} from "@/params";
import {
	getElementParams,
	readElementParamValue,
	writeElementParamValue,
	type ElementParamDefinition,
} from "@/params/registry";
import type { TimelineElement } from "@/timeline";
import { roundMediaTime, type MediaTime } from "@/wasm";
import { useEditor } from "@/editor/use-editor";
import {
	getCaptionElements,
	isCaptionElement,
	useCaptionStyleLinkStore,
} from "./caption-style-link";

export function ElementParamsTab({
	element,
	trackId,
	paramKeys,
	sectionKey,
	linkedElements,
}: {
	element: TimelineElement;
	trackId: string;
	paramKeys?: readonly string[];
	sectionKey: string;
	linkedElements?: readonly {
		trackId: string;
		element: TimelineElement;
	}[];
}) {
	const applyToAllCaptions = useCaptionStyleLinkStore(
		(state) => state.applyToAll,
	);
	const tracks = useEditor(
		(instance) => instance.scenes.getActiveScene().tracks,
	);
	const automaticCaptionPeers =
		applyToAllCaptions && isCaptionElement(element)
			? getCaptionElements({ tracks }).filter(
					({ element: candidate }) => candidate.id !== element.id,
				)
			: [];
	const resolvedLinkedElements = linkedElements ?? automaticCaptionPeers;
	const { localTime, isPlayheadWithinElementRange } = useElementPlayhead({
		startTime: element.startTime,
		duration: element.duration,
	});
	const params = getElementParams({ element }).filter(
		(param) => !paramKeys || paramKeys.includes(param.key),
	);
	const baseValues = buildValues({ element, params });

	return (
		<Section sectionKey={`${element.id}:${sectionKey}`}>
			<SectionContent className="pt-4">
				<SectionFields>
					{params
						.filter((param) => isVisible({ param, values: baseValues }))
						.map((param) => (
							<ElementParamField
								key={param.key}
								element={element}
								trackId={trackId}
								param={param}
								baseValue={baseValues[param.key] ?? param.default}
								localTime={localTime}
								isPlayheadWithinElementRange={isPlayheadWithinElementRange}
								linkedElements={
									param.key === "content" ? [] : resolvedLinkedElements
								}
							/>
						))}
				</SectionFields>
			</SectionContent>
		</Section>
	);
}

function ElementParamField({
	element,
	trackId,
	param,
	baseValue,
	localTime,
	isPlayheadWithinElementRange,
	linkedElements,
}: {
	element: TimelineElement;
	trackId: string;
	param: ElementParamDefinition;
	baseValue: ParamValue;
	localTime: MediaTime;
	isPlayheadWithinElementRange: boolean;
	linkedElements: readonly {
		trackId: string;
		element: TimelineElement;
	}[];
}) {
	const resolvedValue = resolveAnimationPathValueAtTime({
		animations: element.animations,
		propertyPath: param.key,
		localTime,
		fallbackValue: baseValue,
	});
	const animatedParam = useKeyframedParamProperty({
		param,
		trackId,
		elementId: element.id,
		animations: element.animations,
		propertyPath: param.key,
		localTime,
		isPlayheadWithinElementRange,
		resolvedValue,
		buildBaseUpdates: ({ value }) =>
			writeElementParamValue({ element, param, value }),
		buildAdditionalBaseUpdates: ({ value }) =>
			linkedElements.map(
				({ trackId: linkedTrackId, element: linkedElement }) => ({
					trackId: linkedTrackId,
					elementId: linkedElement.id,
					updates: writeElementParamValue({
						element: linkedElement,
						param,
						value,
					}),
				}),
			),
		buildAdditionalAnimatedUpdates: ({ value }) => {
			const progress =
				element.duration > 0
					? Math.max(0, Math.min(1, localTime / element.duration))
					: 0;

			return linkedElements.map(
				({ trackId: linkedTrackId, element: linkedElement }) => {
					if (
						!hasKeyframesForPath({
							animations: linkedElement.animations,
							propertyPath: param.key,
						})
					) {
						return {
							trackId: linkedTrackId,
							elementId: linkedElement.id,
							updates: writeElementParamValue({
								element: linkedElement,
								param,
								value,
							}),
						};
					}

					return {
						trackId: linkedTrackId,
						elementId: linkedElement.id,
						updates: {
							animations: upsertPathKeyframe({
								animations: linkedElement.animations,
								propertyPath: param.key,
								time: roundMediaTime({
									time: linkedElement.duration * progress,
								}),
								value,
								channelLayout: getParamChannelLayout({ param }),
								coerceValue: ({ value: nextValue }) =>
									coerceParamValue({ param, value: nextValue }),
							}),
						},
					};
				},
			);
		},
	});

	return (
		<PropertyParamField
			param={param}
			value={resolvedValue}
			onPreview={animatedParam.onPreview}
			onCommit={animatedParam.onCommit}
			keyframe={
				param.keyframable === false
					? undefined
					: {
							isActive: animatedParam.isKeyframedAtTime,
							isDisabled: !isPlayheadWithinElementRange,
							onToggle: animatedParam.toggleKeyframe,
						}
			}
		/>
	);
}

function buildValues({
	element,
	params,
}: {
	element: TimelineElement;
	params: readonly ElementParamDefinition[];
}): ParamValues {
	const values: ParamValues = {};
	for (const param of params) {
		const value = readElementParamValue({ element, param });
		if (value !== null) {
			values[param.key] = value;
		}
	}
	return values;
}

function isVisible({
	param,
	values,
}: {
	param: ElementParamDefinition;
	values: ParamValues;
}): boolean {
	return (param.dependencies ?? []).every((dependency) =>
		areParamValuesEqual({
			left: values[dependency.param],
			right: dependency.equals,
		}),
	);
}

function areParamValuesEqual({
	left,
	right,
}: {
	left: ParamValue | undefined;
	right: ParamValue;
}): boolean {
	return left === right;
}
