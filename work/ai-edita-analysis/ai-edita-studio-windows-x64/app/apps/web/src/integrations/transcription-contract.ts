import { z } from "zod";

export const MAX_TRANSCRIPTION_BYTES = 24_000_000;
export const transcriptionOptionsSchema = z.strictObject({
	language: z
		.enum(["auto", "pt", "en", "es", "fr", "de", "it", "ru", "ja", "zh"])
		.default("auto"),
	wordTimestamps: z.boolean().default(false),
});
const transcriptionSegmentSchema = z.object({
	text: z.string(),
	start: z.number().finite().min(0),
	end: z.number().finite().min(0),
	confidence: z.number().min(0).max(1).optional(),
	needsReview: z.boolean().optional(),
});
export const transcriptionResultSchema = z.object({
	text: z.string(),
	language: z.string(),
	segments: z.array(transcriptionSegmentSchema),
	words: z.array(transcriptionSegmentSchema).optional(),
	provider: z.literal("OpenAI"),
	model: z.literal("whisper-1"),
});
