import { isGeneratedCaptionName } from "./caption-layout";

export interface CaptionWordRange {
	start: number;
	end: number;
	text: string;
}

type NormalizedWordTiming = {
	start: number;
	end: number;
};

export function getCaptionWordRanges({
	content,
}: {
	content: string;
}): CaptionWordRange[] {
	return Array.from(content.matchAll(/\S+/g)).map((match) => ({
		start: match.index,
		end: match.index + match[0].length,
		text: match[0],
	}));
}

function parseWordTimings({
	raw,
	wordCount,
}: {
	raw: unknown;
	wordCount: number;
}): NormalizedWordTiming[] | null {
	if (typeof raw !== "string" || raw.length > 16_000) return null;
	try {
		const value: unknown = JSON.parse(raw);
		if (!Array.isArray(value) || value.length !== wordCount) return null;
		const result: NormalizedWordTiming[] = [];
		let previousStart = 0;
		for (const timing of value) {
			if (
				!timing ||
				typeof timing !== "object" ||
				typeof timing.start !== "number" ||
				typeof timing.end !== "number" ||
				!Number.isFinite(timing.start) ||
				!Number.isFinite(timing.end) ||
				timing.start < previousStart ||
				timing.start < 0 ||
				timing.end < timing.start ||
				timing.end > 1
			) {
				return null;
			}
			result.push({ start: timing.start, end: timing.end });
			previousStart = timing.start;
		}
		return result;
	} catch {
		return null;
	}
}

export function getActiveCaptionWordIndex({
	content,
	progress,
	wordTimings,
}: {
	content: string;
	progress: number;
	wordTimings?: unknown;
}): number {
	const words = getCaptionWordRanges({ content });
	if (words.length === 0) return -1;
	const clampedProgress = Math.max(0, Math.min(1, progress));
	const timings = parseWordTimings({
		raw: wordTimings,
		wordCount: words.length,
	});
	if (!timings) {
		return Math.min(
			words.length - 1,
			Math.floor(clampedProgress * words.length),
		);
	}

	const exact = timings.findIndex(
		(timing, index) =>
			clampedProgress >= timing.start &&
			(clampedProgress < timing.end || index === timings.length - 1),
	);
	if (exact >= 0) return exact;

	let nearest = 0;
	for (let index = 0; index < timings.length; index++) {
		if (timings[index].start <= clampedProgress) nearest = index;
		else break;
	}
	return nearest;
}

export function isSpotlightCaption({
	name,
	params,
}: {
	name: string;
	params: Record<string, unknown>;
}): boolean {
	if (params["caption.style"] === "spotlight") return true;

	// Compatibility with projects created before the style identifier existed.
	return (
		isGeneratedCaptionName({ name }) &&
		String(params.color).toLowerCase() === "#b9f443" &&
		params["background.enabled"] === true &&
		typeof params.fontSize === "number" &&
		Math.abs(params.fontSize - 4.95) < 0.001
	);
}

export function buildCaptionWordHighlightRichText({
	content,
	fontSize,
	progress,
	wordTimings,
	activeColor,
	inactiveColor,
}: {
	content: string;
	fontSize: number;
	progress: number;
	wordTimings?: unknown;
	activeColor: string;
	inactiveColor: string;
}): string {
	const words = getCaptionWordRanges({ content });
	const activeIndex = getActiveCaptionWordIndex({
		content,
		progress,
		wordTimings,
	});
	return JSON.stringify({
		source: content,
		runs: words.map((word, index) => ({
			start: word.start,
			end: word.end,
			fontSize,
			color: index === activeIndex ? activeColor : inactiveColor,
		})),
	});
}

export function buildNormalizedWordTimings({
	words,
	startTime,
	endTime,
}: {
	words: Array<{ start: number; end: number }>;
	startTime: number;
	endTime: number;
}): string {
	const duration = Math.max(0.000001, endTime - startTime);
	return JSON.stringify(
		words.map((word) => ({
			start: Math.max(0, Math.min(1, (word.start - startTime) / duration)),
			end: Math.max(0, Math.min(1, (word.end - startTime) / duration)),
		})),
	);
}
