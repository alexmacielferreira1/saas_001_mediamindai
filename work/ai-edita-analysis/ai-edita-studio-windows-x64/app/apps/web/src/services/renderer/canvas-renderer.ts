import type { FrameRate } from "opencut-wasm";
import type { AnyBaseNode } from "./nodes/base-node";
import { createCanvasSurface } from "./canvas-utils";
import { buildFrameDescriptor } from "./compositor/frame-descriptor";
import { wasmCompositor } from "./compositor/wasm-compositor";
import { resolveRenderTree } from "./resolve";
import { videoCache, type VideoCache } from "@/services/video-cache/service";
import {
	measureSpanAsync,
	measureSpanSync,
	onRenderPerfFrameComplete,
} from "@/diagnostics/render-perf";

export type CanvasRendererParams = {
	width: number;
	height: number;
	fps: FrameRate;
	videoFrames?: VideoCache;
};

export class CanvasRenderer {
	// Serialize access to the singleton Rust compositor, including capture.
	private static pendingFrame: Promise<unknown> = Promise.resolve();
	readonly videoFrames: VideoCache;
	canvas: OffscreenCanvas;
	context: OffscreenCanvasRenderingContext2D;
	width: number;
	height: number;
	fps: FrameRate;

	constructor({
		width,
		height,
		fps,
		videoFrames = videoCache,
	}: CanvasRendererParams) {
		this.videoFrames = videoFrames;
		this.width = width;
		this.height = height;
		this.fps = fps;

		const surface = createCanvasSurface({ width, height });
		this.canvas = surface.canvas;
		this.context = surface.context;
	}

	getOutputCanvas(): HTMLCanvasElement {
		wasmCompositor.ensureInitialized({
			width: this.width,
			height: this.height,
		});
		return wasmCompositor.getCanvas();
	}

	setSize({ width, height }: { width: number; height: number }) {
		this.width = width;
		this.height = height;

		const surface = createCanvasSurface({ width, height });
		this.canvas = surface.canvas;
		this.context = surface.context;
	}

	async render({
		node,
		time,
		capture,
	}: {
		node: AnyBaseNode;
		time: number;
		capture?: () => Promise<void> | void;
	}) {
		const frame = CanvasRenderer.pendingFrame.then(async () => {
			await measureSpanAsync({
				name: "resolve",
				fn: () => resolveRenderTree({ node, renderer: this, time }),
			});
			const { frame, textures } = await measureSpanAsync({
				name: "buildFrame",
				fn: () => buildFrameDescriptor({ node, renderer: this }),
			});
			wasmCompositor.ensureInitialized({
				width: this.width,
				height: this.height,
			});
			measureSpanSync({
				name: "syncTextures",
				fn: () => wasmCompositor.syncTextures(textures),
			});
			measureSpanSync({
				name: "renderFrame",
				fn: () => wasmCompositor.render(frame),
			});
			await capture?.();
		});
		CanvasRenderer.pendingFrame = frame.catch(() => {});
		await frame;
	}

	async renderToCanvas({
		node,
		time,
		targetCanvas,
	}: {
		node: AnyBaseNode;
		time: number;
		targetCanvas: HTMLCanvasElement;
	}) {
		const ctx = targetCanvas.getContext("2d");
		if (!ctx) {
			throw new Error("Failed to get target canvas context");
		}

		await this.render({
			node,
			time,
			capture: () => {
				measureSpanSync({
					name: "drawImage",
					fn: () =>
						ctx.drawImage(
							wasmCompositor.getCanvas(),
							0,
							0,
							targetCanvas.width,
							targetCanvas.height,
						),
				});
				onRenderPerfFrameComplete();
			},
		});
	}
}
