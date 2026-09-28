import {
	assertAudioPermission,
	errorResponse,
	getSession,
	IntegrationError,
	requireLocalRequest,
	transcribeWithOpenAI,
} from "@/integrations/server";
import {
	MAX_TRANSCRIPTION_BYTES,
	transcriptionOptionsSchema,
} from "@/integrations/transcription-contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function POST(request: Request) {
	try {
		requireLocalRequest({ request, browser: true });
		const session = getSession({
			sessionId: request.headers.get("x-opencut-session"),
			controlToken: request.headers.get("x-opencut-control"),
		});
		assertAudioPermission(session);
		if (request.headers.get("content-type") !== "audio/wav")
			throw new IntegrationError("Expected WAV audio.", 415);
		const wordHeader = request.headers.get("x-opencut-word-timestamps");
		if (wordHeader !== "true" && wordHeader !== "false")
			throw new IntegrationError("Invalid timestamp setting.");
		const options = transcriptionOptionsSchema.parse({
			language: request.headers.get("x-opencut-language") ?? "auto",
			wordTimestamps: wordHeader === "true",
		});
		const reader = request.body?.getReader();
		if (!reader) throw new IntegrationError("Audio is required.");
		const chunks: Uint8Array<ArrayBuffer>[] = [];
		let length = 0;
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				length += value.byteLength;
				if (length > MAX_TRANSCRIPTION_BYTES) {
					await reader.cancel();
					throw new IntegrationError(
						"Audio exceeds the 24 MB upload limit.",
						413,
					);
				}
				chunks.push(new Uint8Array(value));
			}
		} finally {
			reader.releaseLock();
		}
		const audio = new Blob(chunks, { type: "audio/wav" });
		const result = await transcribeWithOpenAI({
			session,
			audio,
			...options,
			signal: request.signal,
		});
		return Response.json(result, { headers: { "Cache-Control": "no-store" } });
	} catch (error) {
		return errorResponse(error);
	}
}
