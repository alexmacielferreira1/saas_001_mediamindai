// Canvas layout adapter for validated template rich text. Never evaluates markup.
import { z } from "zod";
const richSchema = z.object({
	source: z.string().max(2000),
	runs: z
		.array(
			z.object({
				start: z.number().int().min(0),
				end: z.number().int().min(0),
				fontSize: z.number().min(1).max(300),
				color: z.string().regex(/^#[0-9a-f]{6}([0-9a-f]{2})?$/i),
			}),
		)
		.max(100),
});
export type RichPaintRun = {
	text: string;
	size: number;
	color?: string;
	width: number;
	font: string;
};
export function readRichRuns({
	raw,
	content,
}: {
	raw?: string;
	content: string;
}) {
	if (!raw || raw.length > 64000) return [];
	try {
		const parsed = richSchema.safeParse(JSON.parse(raw));
		if (!parsed.success || parsed.data.source !== content) return [];
		let end = 0;
		for (const r of parsed.data.runs) {
			if (r.start < end || r.end < r.start || r.end > content.length) return [];
			end = r.end;
		}
		return parsed.data.runs;
	} catch {
		return [];
	}
}
