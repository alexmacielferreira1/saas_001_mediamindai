import { mediaTimeToSeconds, roundMediaTime, TICKS_PER_SECOND } from "@/wasm";
import { ensurePresetFont } from "@/fonts/preset-fonts";
import { getElementLocalTime } from "@/animation";
import { resolveEffectParamsAtTime } from "@/animation/effect-param-channel";
import {
	buildGaussianBlurPasses,
	intensityToSigma,
} from "@/effects/definitions/blur";
import { effectsRegistry, resolveEffectPasses } from "@/effects";
import type { Effect, EffectPass } from "@/effects/types";
import { getSourceTimeAtClipTime } from "@/retime";
import {
	DEFAULT_GRAPHIC_SOURCE_SIZE,
	resolveGraphicElementParamsAtTime,
} from "@/graphics";
import {
	buildTextBackgroundFromElement,
	getTextMeasurementContext,
	measureTextElement,
} from "@/text/measure-element";
import { resolveColorAtTime, resolveOpacityAtTime } from "@/animation/values";
import { resolveTransformAtTime } from "@/rendering/animation-values";
import type { CanvasRenderer } from "./canvas-renderer";
import type { AnyBaseNode } from "./nodes/base-node";
import {
	BlurBackgroundNode,
	type BackdropSource,
	type ResolvedBlurBackgroundNodeState,
} from "./nodes/blur-background-node";
import {
	EffectLayerNode,
	type ResolvedEffectLayerNodeState,
	type TransitionVisualSource,
} from "./nodes/effect-layer-node";
import {
	GraphicNode,
	type ResolvedGraphicNodeState,
} from "./nodes/graphic-node";
import { ImageNode, loadImageSource } from "./nodes/image-node";
import { StickerNode, loadStickerSource } from "./nodes/sticker-node";
import { TextNode, type ResolvedTextNodeState } from "./nodes/text-node";
import { VideoNode } from "./nodes/video-node";
import type {
	ResolvedVisualNodeState,
	ResolvedVisualSourceNodeState,
	VisualNodeParams,
} from "./nodes/visual-node";

type ResolveContext = {
	renderer: CanvasRenderer;
	time: number;
};

export async function resolveRenderTree({
	node,
	renderer,
	time,
}: {
	node: AnyBaseNode;
	renderer: CanvasRenderer;
	time: number;
}): Promise<void> {
	await resolveNode({
		node,
		context: {
			renderer,
			time,
		},
	});
}

async function resolveNode({
	node,
	context,
}: {
	node: AnyBaseNode;
	context: ResolveContext;
}): Promise<void> {
	if (node instanceof VideoNode) {
		node.resolved = await resolveVideoNode({ node, context });
	} else if (node instanceof ImageNode) {
		node.resolved = await resolveImageNode({ node, context });
	} else if (node instanceof StickerNode) {
		node.resolved = await resolveStickerNode({ node, context });
	} else if (node instanceof GraphicNode) {
		node.resolved = resolveGraphicNode({ node, context });
	} else if (node instanceof TextNode) {
		await ensurePresetFont({
			family: String(node.params.params.fontFamily ?? "Arial"),
		});
		node.resolved = resolveTextNode({ node, context });
	} else if (node instanceof BlurBackgroundNode) {
		node.resolved = await resolveBlurBackgroundNode({ node, context });
	} else if (node instanceof EffectLayerNode) {
		node.resolved = await resolveEffectLayerNode({ node, context });
	}

	await Promise.all(
		node.children.map((child) => resolveNode({ node: child, context })),
	);
}

function resolveEffectPassGroups({
	effects,
	animations,
	localTime,
	duration,
	width,
	height,
}: {
	effects: Effect[] | undefined;
	animations: VisualNodeParams["animations"];
	localTime: number;
	duration: number;
	width: number;
	height: number;
}): EffectPass[][] {
	return (effects ?? [])
		.filter((effect) => effect.enabled)
		.map((effect) => {
			const resolvedParams = resolveEffectParamsAtTime({
				effectId: effect.id,
				params: effect.params,
				animations,
				localTime,
			});
			const definition = effectsRegistry.get(effect.type);
			return resolveEffectPasses({
				definition,
				effectParams: resolvedParams,
				width,
				height,
				time: localTime,
				duration: Math.max(1, duration),
				progress: Math.max(0, Math.min(1, localTime / Math.max(1, duration))),
			});
		});
}

function resolveVisualState({
	params,
	context,
	sourceWidth,
	sourceHeight,
}: {
	params: VisualNodeParams;
	context: ResolveContext;
	sourceWidth: number;
	sourceHeight: number;
}): ResolvedVisualNodeState | null {
	const clipTime = context.time - params.timeOffset;
	if (clipTime < 0 || clipTime >= params.duration) {
		return null;
	}

	const localTime = getElementLocalTime({
		timelineTime: context.time,
		elementStartTime: params.timeOffset,
		elementDuration: params.duration,
	});
	const transform = resolveTransformAtTime({
		baseTransform: params.transform,
		animations: params.animations,
		localTime,
	});
	const opacity = resolveOpacityAtTime({
		baseOpacity: params.opacity,
		animations: params.animations,
		localTime,
	});
	const containScale = Math.min(
		context.renderer.width / sourceWidth,
		context.renderer.height / sourceHeight,
	);
	const effectWidth = Math.round(
		Math.abs(sourceWidth * containScale * transform.scaleX),
	);
	const effectHeight = Math.round(
		Math.abs(sourceHeight * containScale * transform.scaleY),
	);

	return {
		localTime,
		transform,
		opacity,
		effectPasses: resolveEffectPassGroups({
			effects: params.effects,
			animations: params.animations,
			localTime,
			duration: params.duration,
			width: effectWidth,
			height: effectHeight,
		}),
	};
}

async function resolveVideoNode({
	node,
	context,
}: {
	node: VideoNode;
	context: ResolveContext;
}): Promise<ResolvedVisualSourceNodeState | null> {
	const clipTime = context.time - node.params.timeOffset;
	if (clipTime < 0 || clipTime >= node.params.duration) {
		return null;
	}

	const sourceTimeTicks =
		node.params.trimStart +
		getSourceTimeAtClipTime({
			clipTime,
			retime: node.params.retime,
		});
	const frame = await context.renderer.videoFrames.getFrameAt({
		mediaId: node.params.mediaId,
		file: node.params.file,
		time: mediaTimeToSeconds({
			time: roundMediaTime({ time: sourceTimeTicks }),
		}),
	});
	if (!frame) {
		return null;
	}

	const visualState = resolveVisualState({
		params: node.params,
		context,
		sourceWidth: frame.canvas.width,
		sourceHeight: frame.canvas.height,
	});
	if (!visualState) {
		return null;
	}

	return {
		...visualState,
		source: frame.canvas,
		sourceWidth: frame.canvas.width,
		sourceHeight: frame.canvas.height,
		// CanvasSink reuses a small canvas pool. The timestamp must travel with the
		// source so the compositor uploads new pixels instead of freezing on the
		// previously cached canvas object.
		sourceVersion: `${frame.timestamp}:${frame.duration}`,
	};
}

async function resolveImageNode({
	node,
	context,
}: {
	node: ImageNode;
	context: ResolveContext;
}): Promise<ResolvedVisualSourceNodeState | null> {
	const source = await loadImageSource({
		url: node.params.url,
		maxSourceSize: node.params.maxSourceSize,
	});
	const visualState = resolveVisualState({
		params: node.params,
		context,
		sourceWidth: source.width,
		sourceHeight: source.height,
	});
	if (!visualState) {
		return null;
	}

	return {
		...visualState,
		source: source.source,
		sourceWidth: source.width,
		sourceHeight: source.height,
	};
}

async function resolveStickerNode({
	node,
	context,
}: {
	node: StickerNode;
	context: ResolveContext;
}): Promise<ResolvedVisualSourceNodeState | null> {
	const source = await loadStickerSource({ stickerId: node.params.stickerId });
	const sourceWidth = node.params.intrinsicWidth ?? source.width;
	const sourceHeight = node.params.intrinsicHeight ?? source.height;
	const visualState = resolveVisualState({
		params: node.params,
		context,
		sourceWidth,
		sourceHeight,
	});
	if (!visualState) {
		return null;
	}

	return {
		...visualState,
		source: source.source,
		sourceWidth,
		sourceHeight,
	};
}

function resolveGraphicNode({
	node,
	context,
}: {
	node: GraphicNode;
	context: ResolveContext;
}): ResolvedGraphicNodeState | null {
	const visualState = resolveVisualState({
		params: node.params,
		context,
		sourceWidth: DEFAULT_GRAPHIC_SOURCE_SIZE,
		sourceHeight: DEFAULT_GRAPHIC_SOURCE_SIZE,
	});
	if (!visualState) {
		return null;
	}

	return {
		...visualState,
		resolvedParams: resolveGraphicElementParamsAtTime({
			element: node.params,
			localTime: visualState.localTime,
		}),
	};
}

function resolveTextNode({
	node,
	context,
}: {
	node: TextNode;
	context: ResolveContext;
}): ResolvedTextNodeState | null {
	if (
		context.time < node.params.startTime ||
		context.time >= node.params.startTime + node.params.duration
	) {
		return null;
	}

	const localTime = getElementLocalTime({
		timelineTime: context.time,
		elementStartTime: node.params.startTime,
		elementDuration: node.params.duration,
	});
	const background = buildTextBackgroundFromElement({ element: node.params });
	const transform = resolveTransformAtTime({
		baseTransform: node.params.transform,
		animations: node.params.animations,
		localTime,
	});

	return {
		transform,
		opacity: resolveOpacityAtTime({
			baseOpacity: node.params.opacity,
			animations: node.params.animations,
			localTime,
		}),
		textColor: resolveColorAtTime({
			baseColor:
				typeof node.params.params.color === "string"
					? node.params.params.color
					: "#ffffff",
			animations: node.params.animations,
			propertyPath: "color",
			localTime,
		}),
		backgroundColor: resolveColorAtTime({
			baseColor: background.color,
			animations: node.params.animations,
			propertyPath: "background.color",
			localTime,
		}),
		effectPasses: resolveEffectPassGroups({
			effects: node.params.effects,
			animations: node.params.animations,
			localTime,
			duration: node.params.duration,
			width: context.renderer.width,
			height: context.renderer.height,
		}),
		measuredText: measureTextElement({
			element: node.params,
			canvasHeight: node.params.canvasHeight,
			canvasWidth: context.renderer.width,
			transform,
			localTime,
			ctx: getTextMeasurementContext(),
		}),
	};
}

async function resolveBlurBackgroundNode({
	node,
	context,
}: {
	node: BlurBackgroundNode;
	context: ResolveContext;
}): Promise<ResolvedBlurBackgroundNodeState | null> {
	const clipTime = context.time - node.params.timeOffset;
	if (clipTime < 0 || clipTime >= node.params.duration) {
		return null;
	}

	const backdropSource = await resolveBackdropSource({
		node,
		clipTime,
		context,
	});
	if (!backdropSource) {
		return null;
	}

	return {
		backdropSource,
		passes: buildGaussianBlurPasses({
			sigmaX: intensityToSigma({
				intensity: node.params.blurIntensity,
				resolution: context.renderer.width,
				reference: 1920,
			}),
			sigmaY: intensityToSigma({
				intensity: node.params.blurIntensity,
				resolution: context.renderer.height,
				reference: 1080,
			}),
		}),
	};
}

async function resolveBackdropSource({
	node,
	clipTime,
	context,
}: {
	node: BlurBackgroundNode;
	clipTime: number;
	context: ResolveContext;
}): Promise<BackdropSource | null> {
	if (node.params.mediaType === "video") {
		const sourceTimeTicks =
			node.params.trimStart +
			getSourceTimeAtClipTime({
				clipTime,
				retime: node.params.retime,
			});
		const frame = await context.renderer.videoFrames.getFrameAt({
			mediaId: node.params.mediaId,
			file: node.params.file,
			time: mediaTimeToSeconds({
				time: roundMediaTime({ time: sourceTimeTicks }),
			}),
		});
		if (!frame) {
			return null;
		}

		return {
			source: frame.canvas,
			width: frame.canvas.width,
			height: frame.canvas.height,
		};
	}

	const source = await loadImageSource({ url: node.params.url });
	return {
		source: source.source,
		width: source.width,
		height: source.height,
	};
}

async function resolveEffectLayerNode({
	node,
	context,
}: {
	node: EffectLayerNode;
	context: ResolveContext;
}): Promise<ResolvedEffectLayerNodeState | null> {
	const time = context.time;
	if (
		time < node.params.timeOffset - 1e-6 ||
		time >= node.params.timeOffset + node.params.duration + 1e-6
	) {
		return null;
	}

	const definition = effectsRegistry.get(node.params.effectType);
	const localTime = time - node.params.timeOffset;
	const progress = Math.max(
		0,
		Math.min(1, localTime / Math.max(1, node.params.duration)),
	);
	if (node.params.transition) {
		const transitionCanvas = await resolveTransitionCanvas({
			node,
			context,
			progress,
		});
		if (transitionCanvas) {
			return { passes: [], transitionCanvas };
		}
	}
	const passes = resolveEffectPasses({
		definition,
		effectParams: node.params.effectParams,
		width: context.renderer.width,
		height: context.renderer.height,
		time: localTime,
		duration: Math.max(1, node.params.duration),
		progress,
	});
	if (passes.length === 0) {
		return null;
	}

	return {
		passes,
	};
}

type ResolvedTransitionSource = {
	source: CanvasImageSource;
	sourceWidth: number;
	sourceHeight: number;
	transform: ReturnType<typeof resolveTransformAtTime>;
	opacity: number;
};

async function resolveTransitionSource({
	source,
	context,
}: {
	source: TransitionVisualSource;
	context: ResolveContext;
}): Promise<ResolvedTransitionSource | null> {
	const frameMargin = Math.max(1, Math.round(TICKS_PER_SECOND / 60));
	const timelineTime = Math.max(
		source.timeOffset,
		Math.min(
			source.timeOffset + Math.max(0, source.duration - frameMargin),
			context.time,
		),
	);
	const clipTime = timelineTime - source.timeOffset;
	let frameSource: CanvasImageSource;
	let sourceWidth: number;
	let sourceHeight: number;
	if (source.kind === "video") {
		const sourceTimeTicks =
			source.trimStart +
			getSourceTimeAtClipTime({
				clipTime,
				retime: source.retime,
			});
		const frame = await context.renderer.videoFrames.getFrameAt({
			mediaId: source.mediaId,
			file: source.file,
			time: mediaTimeToSeconds({
				time: roundMediaTime({ time: sourceTimeTicks }),
			}),
		});
		if (!frame) return null;
		frameSource = frame.canvas;
		sourceWidth = frame.canvas.width;
		sourceHeight = frame.canvas.height;
	} else {
		const image = await loadImageSource({ url: source.url });
		frameSource = image.source;
		sourceWidth = image.width;
		sourceHeight = image.height;
	}
	const localTime = getElementLocalTime({
		timelineTime,
		elementStartTime: source.timeOffset,
		elementDuration: source.duration,
	});
	return {
		source: frameSource,
		sourceWidth,
		sourceHeight,
		transform: resolveTransformAtTime({
			baseTransform: source.transform,
			animations: source.animations,
			localTime,
		}),
		opacity: resolveOpacityAtTime({
			baseOpacity: source.opacity,
			animations: source.animations,
			localTime,
		}),
	};
}

async function resolveTransitionCanvas({
	node,
	context,
	progress,
}: {
	node: EffectLayerNode;
	context: ResolveContext;
	progress: number;
}): Promise<OffscreenCanvas | null> {
	const binding = node.params.transition;
	if (!binding) return null;
	// Split clips commonly reference the same media. Resolve them in sequence so
	// VideoCache does not cancel the first seek when the second one starts.
	const outgoing = await resolveTransitionSource({
		source: binding.outgoing,
		context,
	});
	const incoming = await resolveTransitionSource({
		source: binding.incoming,
		context,
	});
	if (!outgoing || !incoming) return null;
	const { width, height } = context.renderer;
	const canvas = new OffscreenCanvas(width, height);
	const ctx = canvas.getContext("2d");
	if (!ctx) return null;
	const intensityValue = node.params.effectParams.intensity;
	const intensity =
		typeof intensityValue === "number" && Number.isFinite(intensityValue)
			? Math.max(0, Math.min(1, intensityValue))
			: 0.75;
	const type = node.params.effectType;
	const peak = Math.sin(progress * Math.PI) * intensity;

	if (type === "transition-dip-black" || type === "transition-dip-white") {
		ctx.fillStyle = type === "transition-dip-white" ? "#ffffff" : "#000000";
		ctx.fillRect(0, 0, width, height);
		if (progress < 0.5) {
			drawTransitionSource({
				ctx,
				renderer: context.renderer,
				resolved: outgoing,
				alpha: 1 - progress * 2,
			});
		} else {
			drawTransitionSource({
				ctx,
				renderer: context.renderer,
				resolved: incoming,
				alpha: (progress - 0.5) * 2,
			});
		}
		return canvas;
	}

	if (type === "transition-whip") {
		drawTransitionSource({
			ctx,
			renderer: context.renderer,
			resolved: outgoing,
			alpha: 1,
			offsetX: -progress * width,
		});
		drawTransitionSource({
			ctx,
			renderer: context.renderer,
			resolved: incoming,
			alpha: 1,
			offsetX: (1 - progress) * width,
		});
	} else {
		drawTransitionSource({
			ctx,
			renderer: context.renderer,
			resolved: outgoing,
			alpha: 1,
			scale: type === "transition-zoom" ? 1 + progress * 0.16 * intensity : 1,
			blur: type === "transition-blur" ? peak * 16 : 0,
		});
		drawTransitionSource({
			ctx,
			renderer: context.renderer,
			resolved: incoming,
			alpha: progress,
			scale: type === "transition-zoom" ? 0.86 + progress * 0.14 : 1,
			blur: type === "transition-blur" ? peak * 10 : 0,
		});
	}

	if (type === "transition-flash") {
		ctx.fillStyle = `rgba(255,255,255,${peak ** 4})`;
		ctx.fillRect(0, 0, width, height);
	} else if (type === "transition-light-leak") {
		const gradient = ctx.createRadialGradient(
			width * 0.12,
			height * 0.25,
			0,
			width * 0.12,
			height * 0.25,
			Math.max(width, height),
		);
		gradient.addColorStop(0, `rgba(255,248,190,${peak})`);
		gradient.addColorStop(0.35, `rgba(255,82,45,${peak * 0.5})`);
		gradient.addColorStop(1, "rgba(100,30,255,0)");
		ctx.globalCompositeOperation = "screen";
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, width, height);
	} else if (type === "transition-glitch" && peak > 0.02) {
		const snapshot = new OffscreenCanvas(width, height);
		snapshot.getContext("2d")?.drawImage(canvas, 0, 0);
		const slices = Math.max(3, Math.round(4 + peak * 10));
		for (let index = 0; index < slices; index++) {
			const y = Math.round(((index * 0.173 + progress) % 1) * height);
			const sliceHeight = Math.max(2, Math.round(height * 0.02));
			const offset = (index % 2 === 0 ? 1 : -1) * peak * width * 0.05;
			ctx.drawImage(
				snapshot,
				0,
				y,
				width,
				sliceHeight,
				offset,
				y,
				width,
				sliceHeight,
			);
		}
	}
	ctx.globalAlpha = 1;
	ctx.globalCompositeOperation = "source-over";
	ctx.filter = "none";
	return canvas;
}

function drawTransitionSource({
	ctx,
	renderer,
	resolved,
	alpha,
	scale = 1,
	offsetX = 0,
	blur = 0,
}: {
	ctx: OffscreenCanvasRenderingContext2D;
	renderer: CanvasRenderer;
	resolved: ResolvedTransitionSource;
	alpha: number;
	scale?: number;
	offsetX?: number;
	blur?: number;
}): void {
	const containScale = Math.min(
		renderer.width / resolved.sourceWidth,
		renderer.height / resolved.sourceHeight,
	);
	const width =
		resolved.sourceWidth *
		containScale *
		Math.abs(resolved.transform.scaleX) *
		scale;
	const height =
		resolved.sourceHeight *
		containScale *
		Math.abs(resolved.transform.scaleY) *
		scale;
	const centerX = renderer.width / 2 + resolved.transform.position.x + offsetX;
	const centerY = renderer.height / 2 + resolved.transform.position.y;
	ctx.save();
	ctx.globalAlpha = Math.max(0, Math.min(1, alpha * resolved.opacity));
	ctx.filter = blur > 0.01 ? `blur(${blur}px)` : "none";
	ctx.translate(centerX, centerY);
	ctx.rotate((resolved.transform.rotate * Math.PI) / 180);
	ctx.scale(
		resolved.transform.scaleX < 0 ? -1 : 1,
		resolved.transform.scaleY < 0 ? -1 : 1,
	);
	ctx.drawImage(resolved.source, -width / 2, -height / 2, width, height);
	ctx.restore();
}
