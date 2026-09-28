export const CAPTION_SAFE_MARGIN_RATIO = 0.1;
export const CAPTION_MAX_LINES = 2;

export function isGeneratedCaptionName({ name }: { name: string }): boolean {
	return /^(?:Caption \d+|AI Edita · (?:clean|boxed|pulse|spotlight) · \d+)(?: \((?:left|right)\))*$/i.test(
		name,
	);
}

export function fitCaptionText({
	content,
	maxWidth,
	measureLine,
}: {
	content: string;
	maxWidth: number;
	measureLine: ({ text }: { text: string }) => number;
}): { content: string; fontScale: number; lineCount: number } {
	const normalized = content.trim().replace(/\s+/g, " ");
	if (!normalized) {
		return { content: "", fontScale: 1, lineCount: 1 };
	}

	const words = normalized.split(" ");
	const singleLineWidth = measureLine({ text: normalized });
	if (singleLineWidth <= maxWidth) {
		return { content: normalized, fontScale: 1, lineCount: 1 };
	}

	if (words.length === 1) {
		return {
			content: normalized,
			fontScale: Math.min(1, maxWidth / Math.max(1, singleLineWidth)),
			lineCount: 1,
		};
	}

	let best:
		| {
				first: string;
				second: string;
				widest: number;
				balance: number;
		  }
		| undefined;
	for (let index = 1; index < words.length; index++) {
		const first = words.slice(0, index).join(" ");
		const second = words.slice(index).join(" ");
		const firstWidth = measureLine({ text: first });
		const secondWidth = measureLine({ text: second });
		const candidate = {
			first,
			second,
			widest: Math.max(firstWidth, secondWidth),
			balance: Math.abs(firstWidth - secondWidth),
		};
		if (
			!best ||
			candidate.widest < best.widest ||
			(candidate.widest === best.widest && candidate.balance < best.balance)
		) {
			best = candidate;
		}
	}

	if (!best) {
		return { content: normalized, fontScale: 1, lineCount: 1 };
	}

	return {
		content: `${best.first}\n${best.second}`,
		fontScale: Math.min(1, maxWidth / Math.max(1, best.widest)),
		lineCount: CAPTION_MAX_LINES,
	};
}
