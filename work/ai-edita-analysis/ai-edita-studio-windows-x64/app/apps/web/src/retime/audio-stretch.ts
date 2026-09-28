import { SimpleFilter, SoundTouch, WebAudioBufferSource } from "soundtouchjs";
import { clampRetimeRate, shouldMaintainPitch } from "@/retime/rate";
import type { RetimeConfig } from "@/timeline";
import { getSourceTimeAtClipTime } from "./resolve";

const RATE_EPSILON = 1e-6;
const SOUNDTOUCH_PROCESS_CHUNK_FRAMES = 4096;
const SOUNDTOUCH_INPUT_PADDING_FRAMES = 16384;

function sampleLinear({
	channelData,
	position,
}: {
	channelData: Float32Array;
	position: number;
}): number {
	if (position <= 0) {
		return channelData[0] ?? 0;
	}
	const lower = Math.floor(position);
	const upper = Math.min(channelData.length - 1, lower + 1);
	if (lower >= channelData.length) {
		return 0;
	}
	const fraction = position - lower;
	return channelData[lower] * (1 - fraction) + channelData[upper] * fraction;
}

function buildResampledBuffer({
	audioContext,
	sourceBuffer,
	trimStart,
	clipDuration,
	targetSampleRate,
	retime,
}: {
	audioContext: BaseAudioContext;
	sourceBuffer: AudioBuffer;
	trimStart: number;
	clipDuration: number;
	targetSampleRate: number;
	retime?: RetimeConfig;
}): AudioBuffer {
	const outputLength = Math.max(1, Math.ceil(clipDuration * targetSampleRate));
	const numChannels = Math.max(1, Math.min(2, sourceBuffer.numberOfChannels));
	const outputBuffer = audioContext.createBuffer(
		numChannels,
		outputLength,
		targetSampleRate,
	);

	for (let channel = 0; channel < numChannels; channel++) {
		const sourceData = sourceBuffer.getChannelData(
			Math.min(channel, sourceBuffer.numberOfChannels - 1),
		);
		const outputData = outputBuffer.getChannelData(channel);

		for (let i = 0; i < outputLength; i++) {
			const clipTime = i / targetSampleRate;
			const sourceTime =
				trimStart + getSourceTimeAtClipTime({ clipTime, retime });
			outputData[i] = sampleLinear({
				channelData: sourceData,
				position: sourceTime * sourceBuffer.sampleRate,
			});
		}
	}

	return outputBuffer;
}

async function buildPitchPreservedBuffer({
	audioContext,
	sourceBuffer,
	trimStart,
	clipDuration,
	rate,
	targetSampleRate,
}: {
	audioContext: BaseAudioContext;
	sourceBuffer: AudioBuffer;
	trimStart: number;
	clipDuration: number;
	rate: number;
	targetSampleRate: number;
}): Promise<AudioBuffer> {
	const nativeSampleRate = sourceBuffer.sampleRate;
	const sourceDuration = clipDuration * rate;
	const startSample = Math.max(0, Math.floor(trimStart * nativeSampleRate));
	const numSourceSamples = Math.max(
		1,
		Math.ceil(sourceDuration * nativeSampleRate),
	);
	const available = Math.max(0, sourceBuffer.length - startSample);
	const actualSamples = Math.max(1, Math.min(numSourceSamples, available));
	const numChannels = Math.max(1, Math.min(2, sourceBuffer.numberOfChannels));

	// Resample to targetSampleRate first — soundtouchjs reads raw channel data
	// and does not respect the source buffer's native sample rate.
	const resampledSourceLength = Math.max(
		1,
		Math.ceil(sourceDuration * targetSampleRate),
	);
	const resampleCtx = new OfflineAudioContext(
		numChannels,
		resampledSourceLength + SOUNDTOUCH_INPUT_PADDING_FRAMES,
		targetSampleRate,
	);
	const nativeBuffer = resampleCtx.createBuffer(
		numChannels,
		actualSamples,
		nativeSampleRate,
	);

	for (let ch = 0; ch < numChannels; ch++) {
		const src = sourceBuffer.getChannelData(
			Math.min(ch, sourceBuffer.numberOfChannels - 1),
		);
		nativeBuffer.copyToChannel(
			src.subarray(startSample, startSample + actualSamples),
			ch,
		);
	}

	const resampleSourceNode = resampleCtx.createBufferSource();
	resampleSourceNode.buffer = nativeBuffer;
	resampleSourceNode.connect(resampleCtx.destination);
	resampleSourceNode.start(0);
	const resampledBuffer = await resampleCtx.startRendering();

	const outputSamples = Math.max(
		1,
		Math.ceil(clipDuration * targetSampleRate),
	);
	const outputBuffer = audioContext.createBuffer(
		numChannels,
		outputSamples,
		targetSampleRate,
	);

	// PitchShifter connects SoundTouch through a ScriptProcessorNode. In an
	// OfflineAudioContext that node emits two silent render quanta before the
	// first processed samples (about 180–190 ms at 48 kHz), which is plainly
	// visible as lip-sync drift. Extracting from the same SoundTouch pipeline
	// directly removes that scheduling latency while preserving the algorithm.
	const soundtouch = new SoundTouch();
	soundtouch.tempo = rate;
	soundtouch.pitch = 1;
	const filter = new SimpleFilter(
		new WebAudioBufferSource(resampledBuffer),
		soundtouch,
	);
	const interleaved = new Float32Array(
		SOUNDTOUCH_PROCESS_CHUNK_FRAMES * 2,
	);
	let writtenFrames = 0;
	while (writtenFrames < outputSamples) {
		const requestedFrames = Math.min(
			SOUNDTOUCH_PROCESS_CHUNK_FRAMES,
			outputSamples - writtenFrames,
		);
		const extractedFrames = filter.extract(interleaved, requestedFrames);
		if (extractedFrames <= 0) break;
		for (let channel = 0; channel < numChannels; channel++) {
			const output = outputBuffer.getChannelData(channel);
			for (let frame = 0; frame < extractedFrames; frame++) {
				output[writtenFrames + frame] = interleaved[frame * 2 + channel];
			}
		}
		writtenFrames += extractedFrames;
	}

	return outputBuffer;
}

export async function renderRetimedBuffer({
	audioContext,
	sourceBuffer,
	trimStart,
	clipDuration,
	retime,
	maintainPitch = false,
}: {
	audioContext: BaseAudioContext;
	sourceBuffer: AudioBuffer;
	trimStart: number;
	clipDuration: number;
	retime?: RetimeConfig;
	maintainPitch?: boolean;
}): Promise<AudioBuffer> {
	const targetSampleRate = audioContext.sampleRate;
	const rate = clampRetimeRate({ rate: retime?.rate ?? 1 });
	const usePitchPreservation =
		shouldMaintainPitch({ rate, maintainPitch }) &&
		Math.abs(rate - 1) > RATE_EPSILON;

	if (usePitchPreservation) {
		return buildPitchPreservedBuffer({
			audioContext,
			sourceBuffer,
			trimStart,
			clipDuration,
			rate,
			targetSampleRate,
		});
	}

	return buildResampledBuffer({
		audioContext,
		sourceBuffer,
		trimStart,
		clipDuration,
		targetSampleRate,
		retime,
	});
}
