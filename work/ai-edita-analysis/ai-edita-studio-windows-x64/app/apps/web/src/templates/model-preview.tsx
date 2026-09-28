"use client";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n";
import { resolveAnimationPathValueAtTime } from "@/animation/resolve";
import { measureTextElement } from "@/text/measure-element";
import { drawMeasuredTextLayout } from "@/text/primitives";
import {
	getGraphicDefinition,
	resolveGraphicElementParamsAtTime,
} from "@/graphics";
import { ensurePresetFont } from "@/fonts/preset-fonts";
import { mediaTimeFromSeconds } from "@/wasm";
import { buildModelLayer } from "./commands";
import { templateEngine } from "./engine";
import { layoutSchema, type EditModel } from "./contract";

// Render adapter using native text/shape primitives and the animation resolver.
// Never borrows the shared compositor or disturbs the user's video playback.
export function ModelPreview({
	model,
	texts,
	accent,
	compact = false,
}: {
	model: EditModel;
	texts?: string[];
	accent?: string;
	compact?: boolean;
}) {
	const canvas = useRef<HTMLCanvasElement>(null);
	const [playing, setPlaying] = useState(!compact);
	const [error, setError] = useState("");
	const pt = useI18n().locale === "pt-BR";
	useEffect(() => {
		let stopped = false,
			raf = 0;
		void (async () => {
			const layout = layoutSchema.parse(
				await templateEngine({
					op: "layout",
					template: model,
					width: model.canvas.width,
					height: model.canvas.height,
					start: 0,
					duration: model.duration,
					texts,
					accent: accent || undefined,
				}),
			);
			const elements = layout.layers.map((layer, i) => ({
				...buildModelLayer(layer),
				id: String(i),
			}));
			const families = new Set(
				elements
					.filter((element) => element.type === "text")
					.map((element) => String(element.params.fontFamily ?? "Arial")),
			);
			await Promise.all(
				[...families].map(async (family) => {
					try {
						await ensurePresetFont({ family });
						await document.fonts.load('24px "' + family + '"');
					} catch {
						// Font loading is best-effort in the thumbnail. Canvas will use
						// the browser fallback instead of failing the whole preview.
					}
				}),
			);
			if (stopped || !canvas.current) return;
			setError("");
			const target = canvas.current,
				ctx = target.getContext("2d");
			if (!ctx) return;
			const { width, height } = model.canvas;
			const ratio = Math.min(
				1,
				(compact ? 280 : 640) / Math.max(width, height),
			);
			target.width = Math.round(width * ratio);
			target.height = Math.round(height * ratio);
			const shape = new OffscreenCanvas(512, 512),
				shapeContext = shape.getContext("2d");
			const begin = performance.now();
			let previous = -100;
			function paint(now: number) {
				if (stopped || !ctx) return;
				if (now - previous >= 50) {
					previous = now;
					const seconds = playing
						? ((now - begin) / 1000) % model.duration
						: Math.min(model.duration / 2, 1);
					const time = mediaTimeFromSeconds({ seconds });
					ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
					ctx.fillStyle = "#101510";
					ctx.fillRect(0, 0, width, height);
					for (const element of elements) {
						if (
							time < element.startTime ||
							time >= element.startTime + element.duration
						)
							continue;
						const localTime = time - element.startTime;
						// eslint-disable-next-line opencut/prefer-object-params -- Compact local render-property accessor.
						const value = (key: string, fallback: number) =>
							resolveAnimationPathValueAtTime({
								animations: element.animations,
								propertyPath: key,
								localTime,
								fallbackValue: Number(element.params[key] ?? fallback),
							});
						ctx.save();
						const transform = {
							position: {
								x: value("transform.positionX", 0),
								y: value("transform.positionY", 0),
							},
							scaleX: value("transform.scaleX", 1),
							scaleY: value("transform.scaleY", 1),
							rotate: value("transform.rotate", 0),
						};
						ctx.translate(
							width / 2 + transform.position.x,
							height / 2 + transform.position.y,
						);
						ctx.rotate((transform.rotate * Math.PI) / 180);
						ctx.scale(transform.scaleX, transform.scaleY);
						ctx.globalAlpha = Math.max(0, Math.min(1, value("opacity", 1)));
						if (element.type === "text") {
							const measured = measureTextElement({
								element,
								canvasHeight: height,
								canvasWidth: width,
								transform,
								localTime,
								ctx,
							});
							drawMeasuredTextLayout({
								ctx,
								layout: measured,
								textColor: String(element.params.color ?? "#ffffff"),
								background: measured.resolvedBackground,
								backgroundColor: measured.resolvedBackground.color,
							});
						} else if (element.type === "graphic" && shapeContext) {
							getGraphicDefinition({
								definitionId: element.definitionId,
							}).render({
								ctx: shapeContext,
								width: 512,
								height: 512,
								params: resolveGraphicElementParamsAtTime({
									element,
									localTime,
								}),
							});
							const size = Math.min(width, height);
							ctx.drawImage(shape, -size / 2, -size / 2, size, size);
						}
						ctx.restore();
					}
					target.dataset.previewTime = seconds.toFixed(3);
				}
				if (playing) raf = requestAnimationFrame(paint);
			}
			paint(performance.now());
		})().catch(() => {
			if (!stopped)
				setError(
					pt
						? "Não foi possível renderizar a prévia."
						: "Could not render preview.",
				);
		});
		return () => {
			stopped = true;
			cancelAnimationFrame(raf);
		};
	}, [model, texts, accent, compact, playing, pt]);
	return (
		<div
			className="w-full"
			onMouseEnter={() => {
				if (compact) setPlaying(true);
			}}
			onMouseLeave={() => {
				if (compact) setPlaying(false);
			}}
		>
			<canvas
				ref={canvas}
				role="img"
				aria-label={model.name}
				style={{
					aspectRatio: model.canvas.width + " / " + model.canvas.height,
					objectFit: "contain",
				}}
				className="block h-auto w-full rounded-lg bg-[#101510]"
			/>
			{error && (
				<span role="status" className="text-xs text-destructive">
					{error}
				</span>
			)}
			{!compact && (
				<button
					type="button"
					className="mt-1 text-xs text-primary underline"
					onClick={() => setPlaying(!playing)}
				>
					{playing
						? pt
							? "Pausar prévia"
							: "Pause preview"
						: pt
							? "Reproduzir prévia"
							: "Play preview"}
				</button>
			)}
		</div>
	);
}
