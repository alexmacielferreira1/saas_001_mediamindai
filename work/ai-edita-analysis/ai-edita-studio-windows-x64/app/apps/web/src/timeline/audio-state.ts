import { hasKeyframesForPath } from "@/animation/keyframe-query";
import { resolveNumberAtTime } from "@/animation/values";
import { VOLUME_DB_MAX, VOLUME_DB_MIN } from "./audio-constants";
import type { TimelineElement } from "./types";
const DEFAULT_STEP_SECONDS = 1 / 60;

export type AudioCapableElement = Extract<
	TimelineElement,
	{ type: "audio" | "video" }
>;

export function clampDb(value: number): number {
	if (!Number.isFinite(value)) {
		return 0;
	}

	return Math.min(VOLUME_DB_MAX, Math.max(VOLUME_DB_MIN, value));
}

export function dBToLinear(db: number): number {
	return 10 ** (clampDb(db) / 20);
}

export function getElementVolume({
	element,
}: {
	element: AudioCapableElement;
}): number {
	const value = element.params.volume;
	return typeof value === "number" ? value : 0;
}

export function isElementMuted({
	element,
}: {
	element: AudioCapableElement;
}): boolean {
	return element.params.muted === true;
}

export function hasAnimatedVolume({
	element,
}: {
	element: AudioCapableElement;
}): boolean {
	return (
		hasKeyframesForPath({
			animations: element.animations,
			propertyPath: "volume",
		}) ||
		getAudioParam({ element, key: "fadeIn" }) > 0 ||
		getAudioParam({ element, key: "fadeOut" }) > 0
	);
}

function getAudioParam({
	element,
	key,
}: {
	element: AudioCapableElement;
	key: "fadeIn" | "fadeOut" | "pan";
}): number {
	const value = element.params[key];
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function getElementPan({
	element,
}: {
	element: AudioCapableElement;
}): number {
	return Math.max(-1, Math.min(1, getAudioParam({ element, key: "pan" })));
}

export function isVoiceEnhancementEnabled({
	element,
}: {
	element: AudioCapableElement;
}): boolean {
	return element.params.voiceEnhance === true;
}

import { TICKS_PER_SECOND } from "@/wasm";

export function resolveEffectiveAudioGain({
	element,
	trackMuted = false,
	localTime,
}: {
	element: AudioCapableElement;
	trackMuted?: boolean;
	localTime: number;
}): number {
	if (trackMuted || isElementMuted({ element })) {
		return 0;
	}

	const resolvedDb = resolveNumberAtTime({
		baseValue: getElementVolume({ element }),
		animations: element.animations,
		propertyPath: "volume",
		localTime: Math.round(localTime * TICKS_PER_SECOND),
	});

	const durationSeconds = element.duration / TICKS_PER_SECOND;
	const clampedLocalTime = Math.max(0, Math.min(durationSeconds, localTime));
	const fadeIn = Math.max(0, getAudioParam({ element, key: "fadeIn" }));
	const fadeOut = Math.max(0, getAudioParam({ element, key: "fadeOut" }));
	const fadeInGain = fadeIn > 0 ? Math.min(1, clampedLocalTime / fadeIn) : 1;
	const remaining = Math.max(0, durationSeconds - clampedLocalTime);
	const fadeOutGain = fadeOut > 0 ? Math.min(1, remaining / fadeOut) : 1;
	return dBToLinear(resolvedDb) * Math.min(fadeInGain, fadeOutGain);
}

export function buildWaveformGainSamples({
	element,
	count,
}: {
	element: AudioCapableElement;
	count: number;
}): number[] {
	const durationSeconds = element.duration / TICKS_PER_SECOND;
	return Array.from({ length: count }, (_, i) => {
		const localTime = ((i + 0.5) / count) * durationSeconds;
		return resolveEffectiveAudioGain({ element, localTime });
	});
}

export function buildAudioGainAutomation({
	element,
	trackMuted = false,
	fromLocalTime,
	toLocalTime,
	stepSeconds = DEFAULT_STEP_SECONDS,
}: {
	element: AudioCapableElement;
	trackMuted?: boolean;
	fromLocalTime: number;
	toLocalTime: number;
	stepSeconds?: number;
}): Array<{ localTime: number; gain: number }> {
	const startTime = Math.max(0, fromLocalTime);
	const endTime = Math.max(startTime, toLocalTime);
	const safeStep =
		Number.isFinite(stepSeconds) && stepSeconds > 0
			? stepSeconds
			: DEFAULT_STEP_SECONDS;
	const points: Array<{ localTime: number; gain: number }> = [];

	for (let localTime = startTime; localTime < endTime; localTime += safeStep) {
		points.push({
			localTime,
			gain: resolveEffectiveAudioGain({
				element,
				trackMuted,
				localTime,
			}),
		});
	}

	points.push({
		localTime: endTime,
		gain: resolveEffectiveAudioGain({
			element,
			trackMuted,
			localTime: endTime,
		}),
	});

	return points;
}
