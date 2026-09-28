import { buildLibraryAudioElement } from "@/timeline/element-utils";
import type { CreateLibraryAudioElement } from "@/timeline";
import { mediaTimeFromSeconds, type MediaTime } from "@/wasm";

/**
 * Turns a sound served by the app (the built-in library, or an online preview) into a
 * timeline element, decoding it first so the clip draws its waveform right away.
 *
 * Shared by the Sons panel's "add" button and by dropping a sound on the timeline, so both
 * produce exactly the same element.
 */
export async function buildLibraryAudioFromUrl({
	sourceUrl,
	name,
	duration,
	startTime,
}: {
	sourceUrl: string;
	name: string;
	duration: number;
	startTime: MediaTime;
}): Promise<CreateLibraryAudioElement> {
	const response = await fetch(sourceUrl);
	if (!response.ok) {
		throw new Error(`Não foi possível abrir o som (${response.status}).`);
	}
	const arrayBuffer = await response.arrayBuffer();
	const audioContext = new AudioContext();
	try {
		const buffer = await audioContext.decodeAudioData(arrayBuffer);
		return buildLibraryAudioElement({
			sourceUrl,
			name,
			duration: mediaTimeFromSeconds({
				seconds: duration > 0 ? duration : buffer.duration,
			}),
			startTime,
			buffer,
		});
	} finally {
		void audioContext.close().catch(() => {});
	}
}
