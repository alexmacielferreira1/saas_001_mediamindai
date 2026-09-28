import EventEmitter from "eventemitter3";

import {
	Output,
	Mp4OutputFormat,
	WebMOutputFormat,
	BufferTarget,
	CanvasSource,
	AudioBufferSource,
	QUALITY_LOW,
	QUALITY_MEDIUM,
	QUALITY_HIGH,
	QUALITY_VERY_HIGH,
} from "mediabunny";
import type { FrameRate } from "opencut-wasm";
import { mediaTimeToSeconds } from "opencut-wasm";
import { TICKS_PER_SECOND } from "@/wasm";
import { frameRateToFloat } from "@/fps/utils";
import type { RootNode } from "./nodes/root-node";
import type { ExportFormat, ExportQuality } from "@/export";
import { CanvasRenderer } from "./canvas-renderer";
import { VideoCache } from "@/services/video-cache/service";

type ExportParams = {
	width: number;
	height: number;
	fps: FrameRate;
	format: ExportFormat;
	quality: ExportQuality;
	shouldIncludeAudio?: boolean;
	audioBuffer?: AudioBuffer;
};

const qualityMap = {
	low: QUALITY_LOW,
	medium: QUALITY_MEDIUM,
	high: QUALITY_HIGH,
	very_high: QUALITY_VERY_HIGH,
};

const REELS_AAC_BITRATE = 128_000;

async function assertVideoEncoderSupport({
	format,
	width,
	height,
	fps,
}: {
	format: ExportFormat;
	width: number;
	height: number;
	fps: number;
}): Promise<void> {
	if (typeof VideoEncoder === "undefined") {
		throw new Error(
			"Este navegador não disponibiliza o codificador de vídeo (WebCodecs). Abra o AI Edita no Chrome ou Edge atualizado.",
		);
	}
	// The encoder is configured with the bare family ("avc" / "vp9") further down
	// and MediaBunny negotiates a level that fits the frame. This probe therefore
	// has to ask the same question, not a narrower one: a single low-level codec
	// string rejects resolutions that would in fact encode. avc1.42001f caps at
	// 1280x720 and vp09.00.10.08 at 512x384, so every 1080p export — vertical
	// 1080x1920 included — failed here before it ever started.
	const candidates =
		format === "webm"
			? [
					"vp09.00.50.08", // level 5.0
					"vp09.00.41.08", // level 4.1
					"vp09.00.31.08", // level 3.1
					"vp09.00.10.08", // level 1.0
				]
			: [
					"avc1.640034", // High 5.2
					"avc1.64002a", // High 4.2
					"avc1.640028", // High 4.0
					"avc1.4d0028", // Main 4.0
					"avc1.42002a", // Baseline 4.2
					"avc1.42001f", // Baseline 3.1
				];
	const bitrate = Math.max(500_000, Math.round(width * height * fps * 0.1));
	let supported = false;
	for (const codec of candidates) {
		try {
			const support = await VideoEncoder.isConfigSupported({
				codec,
				width,
				height,
				// This only probes browser support; MediaBunny still chooses the requested quality.
				bitrate,
				framerate: fps,
			});
			if (support.supported) {
				supported = true;
				break;
			}
		} catch {
			// A codec string this browser cannot even parse is not a verdict on the
			// others; keep probing.
		}
	}
	if (!supported) {
		throw new Error(
			format === "webm"
				? "Este navegador não suporta codificação VP9 para WEBM neste tamanho. Tente MP4 ou atualize o navegador."
				: "Este navegador não suporta codificação H.264 para MP4 neste tamanho. Abra o AI Edita no Chrome ou Edge atualizado.",
		);
	}
}

export type SceneExporterEvents = {
	progress: [progress: number];
	complete: [buffer: ArrayBuffer];
	error: [error: Error];
	cancelled: [];
};

export class SceneExporter extends EventEmitter<SceneExporterEvents> {
	private renderer: CanvasRenderer;
	private format: ExportFormat;
	private quality: ExportQuality;
	private shouldIncludeAudio: boolean;
	private audioBuffer?: AudioBuffer;

	private isCancelled = false;
	private videoFrames = new VideoCache();

	constructor({
		width,
		height,
		fps,
		format,
		quality,
		shouldIncludeAudio,
		audioBuffer,
	}: ExportParams) {
		super();
		this.renderer = new CanvasRenderer({
			width,
			height,
			fps,
			videoFrames: this.videoFrames,
		});

		this.format = format;
		this.quality = quality;
		this.shouldIncludeAudio = shouldIncludeAudio ?? false;
		this.audioBuffer = audioBuffer;
	}

	cancel(): void {
		this.isCancelled = true;
	}

	async export({
		rootNode,
	}: {
		rootNode: RootNode;
	}): Promise<ArrayBuffer | null> {
		const fps = this.renderer.fps;
		const fpsFloat = frameRateToFloat(fps);
		const ticksPerFrame = Math.round(
			(TICKS_PER_SECOND * fps.denominator) / fps.numerator,
		);
		const frameCount = Math.floor(rootNode.duration / ticksPerFrame);

		const outputFormat =
			this.format === "webm" ? new WebMOutputFormat() : new Mp4OutputFormat();

		const output = new Output({
			format: outputFormat,
			target: new BufferTarget(),
		});
		let finalized = false;
		try {
			await assertVideoEncoderSupport({
				format: this.format,
				width: this.renderer.width,
				height: this.renderer.height,
				fps: fpsFloat,
			});
			const videoSource = new CanvasSource(this.renderer.getOutputCanvas(), {
				codec: this.format === "webm" ? "vp9" : "avc",
				bitrate: qualityMap[this.quality],
			});

			output.addVideoTrack(videoSource, { frameRate: fpsFloat });

			let audioSource: AudioBufferSource | null = null;
			if (this.shouldIncludeAudio && this.audioBuffer) {
				const audioCodec: "aac" | "opus" =
					this.format === "webm" ? "opus" : "aac";

				if (audioCodec === "aac" && typeof AudioEncoder !== "undefined") {
					const { supported } = await AudioEncoder.isConfigSupported({
						codec: "mp4a.40.2",
						sampleRate: this.audioBuffer.sampleRate,
						numberOfChannels: this.audioBuffer.numberOfChannels,
						bitrate: REELS_AAC_BITRATE,
					});
					if (!supported) {
						throw new Error(
							"Este navegador não oferece o codificador AAC necessário para publicar no Instagram. Use Edge ou Chrome atualizado.",
						);
					}
				}

				audioSource = new AudioBufferSource({
					codec: audioCodec,
					bitrate:
						audioCodec === "aac" ? REELS_AAC_BITRATE : qualityMap[this.quality],
				});
				output.addAudioTrack(audioSource);
			}

			await output.start();

			if (audioSource && this.audioBuffer) {
				await audioSource.add(this.audioBuffer);
				audioSource.close();
			}

			let lastProgressAt = 0;
			for (let i = 0; i < frameCount; i++) {
				if (this.isCancelled) {
					await output.cancel();
					this.emit("cancelled");
					return null;
				}

				const timeTicks = i * ticksPerFrame;
				const timeSeconds = mediaTimeToSeconds({ time: timeTicks });
				await this.renderer.render({
					node: rootNode,
					time: timeTicks,
					capture: () => videoSource.add(timeSeconds, 1 / fpsFloat),
				});

				const now = performance.now();
				if (now - lastProgressAt >= 100 || i === frameCount - 1) {
					this.emit("progress", ((i + 1) / frameCount) * 0.99);
					lastProgressAt = now;
				}
			}

			if (this.isCancelled) {
				await output.cancel();
				this.emit("cancelled");
				return null;
			}

			videoSource.close();
			await output.finalize();
			finalized = true;
			this.emit("progress", 1);

			const buffer = output.target.buffer;
			if (!buffer) {
				this.emit("error", new Error("Failed to export video"));
				return null;
			}

			this.emit("complete", buffer);
			return buffer;
		} finally {
			if (!finalized) await output.cancel().catch(() => {});
			this.videoFrames.clearAll();
		}
	}
}
