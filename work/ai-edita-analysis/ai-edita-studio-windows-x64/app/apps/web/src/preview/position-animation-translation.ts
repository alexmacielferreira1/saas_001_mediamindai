import { isLeafChannelData } from "@/animation/channel-data";
import type {
	ElementAnimations,
	ScalarAnimationChannel,
} from "@/animation/types";

function isScalarPositionChannel(
	channel: unknown,
): channel is ScalarAnimationChannel {
	return (
		typeof channel === "object" &&
		channel !== null &&
		"keys" in channel &&
		Array.isArray(channel.keys) &&
		channel.keys.every(
			(keyframe: unknown) =>
				typeof keyframe === "object" &&
				keyframe !== null &&
				"value" in keyframe &&
				typeof keyframe.value === "number",
		)
	);
}

export function translatePositionAnimations({
	animations,
	deltaX,
	deltaY,
}: {
	animations: ElementAnimations | undefined;
	deltaX: number;
	deltaY: number;
}): ElementAnimations | undefined {
	if (!animations) return undefined;
	let next = animations;
	for (const [propertyPath, delta] of [
		["transform.positionX", deltaX],
		["transform.positionY", deltaY],
	] as const) {
		const channel = animations[propertyPath];
		if (!isLeafChannelData(channel) || !isScalarPositionChannel(channel)) continue;
		next = {
			...next,
			[propertyPath]: {
				...channel,
				keys: channel.keys.map((keyframe) => ({
					...keyframe,
					value: keyframe.value + delta,
				})),
			},
		};
	}
	return next;
}
