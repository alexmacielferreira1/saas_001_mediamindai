import { detectAudio, type AudioAnalysisInput } from "./audio-engine";
self.onmessage = async (event: MessageEvent<AudioAnalysisInput>) => {
	try {
		self.postMessage({ values: await detectAudio(event.data) });
	} catch (error) {
		self.postMessage({
			error: error instanceof Error ? error.message : "Audio analysis failed.",
		});
	}
};
