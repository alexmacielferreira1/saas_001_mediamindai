// Browser ABI adapter only. Detection, cut normalization and ripple-time mapping live in Rust.
type AudioExports = {
	memory: WebAssembly.Memory;
	allocate_f32: (n: number) => number;
	allocate_f64: (n: number) => number;
	release_f32: (p: number, n: number) => void;
	release_f64: (p: number, n: number) => void;
	audio_detect: (...args: number[]) => number;
	normalize_cuts: (...args: number[]) => number;
	map_time: (...args: number[]) => number;
	is_removed: (...args: number[]) => number;
	plan_transcription: (...args: number[]) => number;
	map_transcription_range: (...args: number[]) => number;
};
let engine: Promise<AudioExports> | undefined;
function hasAudioExports(
	e: WebAssembly.Exports,
): e is WebAssembly.Exports & AudioExports {
	return (
		e.memory instanceof WebAssembly.Memory &&
		[
			"allocate_f32",
			"allocate_f64",
			"release_f32",
			"release_f64",
			"audio_detect",
			"normalize_cuts",
			"map_time",
			"is_removed",
			"plan_transcription",
			"map_transcription_range",
		].every((key) => typeof e[key] === "function")
	);
}
export function loadAudioEngine({
	url = "/wasm/audio-analysis.wasm",
}: { url?: string } = {}) {
	engine ??= (async () => {
		const response = await fetch(url);
		if (!response.ok)
			throw new Error(
				"Audio engine unavailable. Run scripts/build-audio-analysis.ps1.",
			);
		const { instance } = await WebAssembly.instantiate(
			await response.arrayBuffer(),
		);
		const e = instance.exports;
		if (!hasAudioExports(e)) throw new Error("Invalid audio engine ABI.");
		// The names are checked above; this module is compiled from our Rust ABI.
		return e;
	})();
	return engine;
}
export type AudioAnalysisInput = {
	engineUrl?: string;
	samples: Float32Array;
	sampleRate: number;
	thresholdDb?: number;
	minPauseMs: number;
	paddingMs: number;
	breaths: boolean;
	speech: number[];
	coverage: number[];
};
export async function detectAudio(input: AudioAnalysisInput) {
	const e = await loadAudioEngine({ url: input.engineUrl });
	const n = input.samples.length;
	const p = e.allocate_f32(n);
	const s = e.allocate_f64(input.speech.length);
	const c = e.allocate_f64(input.coverage.length);
	const capacity = 15000;
	const o = e.allocate_f64(capacity);
	try {
		new Float32Array(e.memory.buffer, p, n).set(input.samples);
		new Float64Array(e.memory.buffer, s, input.speech.length).set(input.speech);
		new Float64Array(e.memory.buffer, c, input.coverage.length).set(
			input.coverage,
		);
		const count = e.audio_detect(
			p,
			n,
			input.sampleRate,
			input.thresholdDb ?? NaN,
			input.minPauseMs,
			input.paddingMs,
			Number(input.breaths),
			s,
			input.speech.length,
			o,
			capacity,
			c,
			input.coverage.length,
		);
		if (count < 0)
			throw new Error("Too many candidates. Analyze a shorter scene.");
		return Array.from(new Float64Array(e.memory.buffer, o, count));
	} finally {
		e.release_f32(p, n);
		e.release_f64(s, input.speech.length);
		e.release_f64(c, input.coverage.length);
		e.release_f64(o, capacity);
	}
}
export async function createCutMapper({
	cuts,
	duration,
	fps,
}: {
	cuts: number[];
	duration: number;
	fps: number;
}) {
	const e = await loadAudioEngine();
	const p = e.allocate_f64(cuts.length);
	const o = e.allocate_f64(cuts.length);
	try {
		new Float64Array(e.memory.buffer, p, cuts.length).set(cuts);
		const count = e.normalize_cuts(p, cuts.length, duration, fps, o);
		const normalized = Array.from(new Float64Array(e.memory.buffer, o, count));
		function invoke({
			time,
			removed = false,
		}: {
			time: number;
			removed?: boolean;
		}) {
			const ptr = e.allocate_f64(normalized.length);
			try {
				new Float64Array(e.memory.buffer, ptr, normalized.length).set(
					normalized,
				);
				return removed
					? e.is_removed(ptr, normalized.length, time)
					: e.map_time(ptr, normalized.length, time);
			} finally {
				e.release_f64(ptr, normalized.length);
			}
		}
		return {
			cuts: normalized,
			map: (time: number) => invoke({ time }),
			removed: (time: number) => Boolean(invoke({ time, removed: true })),
		};
	} finally {
		e.release_f64(p, cuts.length);
		e.release_f64(o, cuts.length);
	}
}

export async function createTranscriptionWindows({
	samples,
	sampleRate,
}: {
	samples: Float32Array;
	sampleRate: number;
}) {
	const e = await loadAudioEngine();
	const p = e.allocate_f32(samples.length),
		out = e.allocate_f64(64);
	const duration = samples.length / sampleRate;
	try {
		new Float32Array(e.memory.buffer, p, samples.length).set(samples);
		const n = e.plan_transcription(p, samples.length, sampleRate, out, 64);
		if (n <= 0) throw new Error("Could not prepare audio upload windows.");
		const flat = Array.from(new Float64Array(e.memory.buffer, out, n));
		const windows: Array<{
			start: number;
			end: number;
			keepStart: number;
			keepEnd: number;
		}> = [];
		for (let i = 0; i < flat.length; i += 4)
			windows.push({
				start: flat[i],
				end: flat[i + 1],
				keepStart: flat[i + 2],
				keepEnd: flat[i + 3],
			});
		function mapSegment({
			segment,
			window,
		}: {
			segment: { text: string; start: number; end: number };
			window: (typeof windows)[number];
		}) {
			const ptr = e.allocate_f64(2);
			try {
				if (
					!e.map_transcription_range(
						segment.start,
						segment.end,
						window.start,
						window.keepStart,
						window.keepEnd,
						duration,
						ptr,
					)
				)
					return null;
				const times = new Float64Array(e.memory.buffer, ptr, 2);
				return { text: segment.text, start: times[0], end: times[1] };
			} finally {
				e.release_f64(ptr, 2);
			}
		}
		return { windows, mapSegment };
	} finally {
		e.release_f32(p, samples.length);
		e.release_f64(out, 64);
	}
}
