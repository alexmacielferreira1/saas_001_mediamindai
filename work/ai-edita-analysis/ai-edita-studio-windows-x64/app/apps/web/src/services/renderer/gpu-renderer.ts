import {
	applyMaskFeather as applyMaskFeatherWasm,
	initializeGpu,
} from "opencut-wasm";
import type { EffectPass } from "@/effects/types";

let gpuAvailable = false;
let initPromise: Promise<void> | null = null;
const COLOR_GRADE_SHADER = "color-grade";
const CANVAS_STYLIZE_SHADER = "canvas-stylize";
const CANVAS_TRANSITION_SHADER = "canvas-transition";
const CANVAS_VIDEO_QUALITY_SHADER = "canvas-video-quality";

export function initializeGpuRenderer(): Promise<void> {
	if (!initPromise) {
		initPromise = initializeGpu()
			.then(() => {
				gpuAvailable = true;
			})
			.catch((error: unknown) => {
				gpuAvailable = false;
				const message = error instanceof Error ? error.message : String(error);
				console.warn(`GPU renderer unavailable: ${message}`);
			});
	}
	return initPromise;
}

export function isGpuAvailable(): boolean {
	return gpuAvailable;
}

export const gpuRenderer = {
	applyEffect({
		source,
		width,
		height,
		passes,
	}: {
		source: OffscreenCanvas;
		width: number;
		height: number;
		passes: EffectPass[];
	}): OffscreenCanvas {
		if (passes.length === 0) return source;

		// Rendering a clip effect through a WebGPU OffscreenCanvas surface can
		// resolve successfully while yielding a transparent frame on Chromium.
		// Keep the GPU runtime for masks and compositor work, but apply preview
		// effects with the deterministic Canvas2D pipeline until that browser
		// path can be proven to preserve every frame.
		return applyCanvasFallbackPipeline({ source, width, height, passes });
	},

	applyMaskFeather({
		maskCanvas,
		width,
		height,
		feather,
	}: {
		maskCanvas: OffscreenCanvas;
		width: number;
		height: number;
		feather: number;
	}): OffscreenCanvas {
		if (!gpuAvailable) {
			return maskCanvas;
		}

		return applyMaskFeatherWasm({
			mask: maskCanvas,
			width,
			height,
			feather,
		});
	},
};

function applyCanvasFallbackPipeline({
	source,
	width,
	height,
	passes,
}: {
	source: OffscreenCanvas;
	width: number;
	height: number;
	passes: EffectPass[];
}): OffscreenCanvas {
	let current = source;
	for (const pass of passes) {
		if (pass.shader === COLOR_GRADE_SHADER) {
			current = applyCanvasColorGrade({ source: current, width, height, pass });
		} else if (pass.shader === CANVAS_STYLIZE_SHADER) {
			current = applyCanvasStylize({ source: current, width, height, pass });
		} else if (pass.shader === CANVAS_TRANSITION_SHADER) {
			current = applyCanvasTransition({ source: current, width, height, pass });
		} else if (pass.shader === CANVAS_VIDEO_QUALITY_SHADER) {
			current = applyCanvasVideoQuality({
				source: current,
				width,
				height,
				pass,
			});
		}
	}
	return current;
}

function numericUniform({
	pass,
	name,
	fallback,
}: {
	pass: EffectPass;
	name: string;
	fallback: number;
}) {
	const value = pass.uniforms[name];
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function applyCanvasVideoQuality({
	source,
	width,
	height,
	pass,
}: {
	source: OffscreenCanvas;
	width: number;
	height: number;
	pass: EffectPass;
}): OffscreenCanvas {
	const output = new OffscreenCanvas(width, height);
	const context = output.getContext("2d");
	if (!context) return source;
	const denoise = Math.max(
		0,
		Math.min(1, numericUniform({ pass, name: "u_denoise", fallback: 0.2 })),
	);
	const sharpness = Math.max(
		0,
		Math.min(1, numericUniform({ pass, name: "u_sharpness", fallback: 0.25 })),
	);
	const clarity = Math.max(
		-1,
		Math.min(1, numericUniform({ pass, name: "u_clarity", fallback: 0.12 })),
	);

	if (denoise > 0.001) {
		const reducedScale = Math.max(0.72, 1 - denoise * 0.22);
		const reducedWidth = Math.max(2, Math.round(width * reducedScale));
		const reducedHeight = Math.max(2, Math.round(height * reducedScale));
		const smooth = new OffscreenCanvas(reducedWidth, reducedHeight);
		const smoothContext = smooth.getContext("2d");
		if (smoothContext) {
			smoothContext.imageSmoothingEnabled = true;
			smoothContext.imageSmoothingQuality = "high";
			smoothContext.filter = `blur(${denoise * 0.7}px)`;
			smoothContext.drawImage(source, 0, 0, reducedWidth, reducedHeight);
			context.imageSmoothingEnabled = true;
			context.imageSmoothingQuality = "high";
			context.drawImage(smooth, 0, 0, width, height);
			context.globalAlpha = 1 - denoise * 0.72;
			context.drawImage(source, 0, 0, width, height);
		} else {
			context.drawImage(source, 0, 0, width, height);
		}
	} else {
		context.drawImage(source, 0, 0, width, height);
	}

	if (sharpness > 0.001 || Math.abs(clarity) > 0.001) {
		context.globalAlpha = Math.min(0.42, sharpness * 0.34);
		context.globalCompositeOperation = "soft-light";
		context.filter = `contrast(${1 + sharpness * 0.32 + clarity * 0.16}) saturate(${1 + clarity * 0.04})`;
		context.drawImage(source, 0, 0, width, height);
	}
	context.globalAlpha = 1;
	context.globalCompositeOperation = "source-over";
	context.filter = "none";
	return output;
}

function applyCanvasColorGrade({
	source,
	width,
	height,
	pass,
}: {
	source: OffscreenCanvas;
	width: number;
	height: number;
	pass: EffectPass;
}) {
	const output = new OffscreenCanvas(width, height);
	const context = output.getContext("2d");
	if (!context) return source;
	const brightness = numericUniform({
		pass,
		name: "u_brightness",
		fallback: 0,
	});
	const contrast = numericUniform({
		pass,
		name: "u_contrast",
		fallback: 1,
	});
	const saturation = numericUniform({
		pass,
		name: "u_saturation",
		fallback: 1,
	});
	const warmth = numericUniform({ pass, name: "u_warmth", fallback: 0 });
	const exposure = numericUniform({ pass, name: "u_exposure", fallback: 0 });
	const exposureFactor = 2 ** Math.max(-2, Math.min(2, exposure));
	context.filter = `brightness(${Math.max(0, (1 + brightness) * exposureFactor)}) contrast(${Math.max(0, contrast)}) saturate(${Math.max(0, saturation)})`;
	context.drawImage(source, 0, 0, width, height);
	context.filter = "none";
	if (Math.abs(warmth) > 0.001) {
		context.globalCompositeOperation = "soft-light";
		context.fillStyle =
			warmth > 0
				? `rgba(255, 137, 54, ${Math.min(0.45, warmth * 1.4)})`
				: `rgba(70, 135, 255, ${Math.min(0.45, -warmth * 1.4)})`;
		context.fillRect(0, 0, width, height);
		context.globalCompositeOperation = "source-over";
	}
	applyAdvancedColorAdjustments({ context, width, height, pass });
	return output;
}

function applyAdvancedColorAdjustments({
	context,
	width,
	height,
	pass,
}: {
	context: OffscreenCanvasRenderingContext2D;
	width: number;
	height: number;
	pass: EffectPass;
}): void {
	const vibrance = numericUniform({ pass, name: "u_vibrance", fallback: 0 });
	const tint = numericUniform({ pass, name: "u_tint", fallback: 0 });
	const highlights = numericUniform({
		pass,
		name: "u_highlights",
		fallback: 0,
	});
	const shadows = numericUniform({ pass, name: "u_shadows", fallback: 0 });
	const whites = numericUniform({ pass, name: "u_whites", fallback: 0 });
	const blacks = numericUniform({ pass, name: "u_blacks", fallback: 0 });
	const fade = numericUniform({ pass, name: "u_fade", fallback: 0 });
	const vignette = numericUniform({ pass, name: "u_vignette", fallback: 0 });
	const grain = numericUniform({ pass, name: "u_grain", fallback: 0 });
	const needsPixels =
		Math.abs(vibrance) > 0.001 ||
		Math.abs(tint) > 0.001 ||
		Math.abs(highlights) > 0.001 ||
		Math.abs(shadows) > 0.001 ||
		Math.abs(whites) > 0.001 ||
		Math.abs(blacks) > 0.001 ||
		fade > 0.001 ||
		grain > 0.001;

	if (needsPixels) {
		const image = context.getImageData(0, 0, width, height);
		const data = image.data;
		for (let index = 0; index < data.length; index += 4) {
			let red = data[index] / 255;
			let green = data[index + 1] / 255;
			let blue = data[index + 2] / 255;
			const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
			const darkWeight = (1 - luminance) ** 2;
			const lightWeight = luminance ** 2;
			const whiteWeight = Math.max(0, (luminance - 0.72) / 0.28);
			const blackWeight = Math.max(0, (0.28 - luminance) / 0.28);
			const saturationRange =
				Math.max(red, green, blue) - Math.min(red, green, blue);
			const vibranceScale = 1 + vibrance * (1 - saturationRange);
			red = luminance + (red - luminance) * vibranceScale;
			green = luminance + (green - luminance) * vibranceScale;
			blue = luminance + (blue - luminance) * vibranceScale;
			const tonalShift =
				shadows * darkWeight * 0.35 +
				highlights * lightWeight * 0.35 +
				whites * whiteWeight * 0.25 +
				blacks * blackWeight * 0.25;
			red += tonalShift + tint * 0.08;
			green += tonalShift - tint * 0.1;
			blue += tonalShift + tint * 0.08;
			if (fade > 0) {
				red = red * (1 - fade * 0.3) + 0.11 * fade;
				green = green * (1 - fade * 0.3) + 0.11 * fade;
				blue = blue * (1 - fade * 0.3) + 0.11 * fade;
			}
			if (grain > 0) {
				const pixel = index / 4;
				const noise =
					(Math.sin(pixel * 12.9898 + width * 78.233) * 43758.5453) % 1;
				const grainValue = noise * grain * 0.12;
				red += grainValue;
				green += grainValue;
				blue += grainValue;
			}
			data[index] = Math.round(Math.max(0, Math.min(1, red)) * 255);
			data[index + 1] = Math.round(Math.max(0, Math.min(1, green)) * 255);
			data[index + 2] = Math.round(Math.max(0, Math.min(1, blue)) * 255);
		}
		context.putImageData(image, 0, 0);
	}

	if (vignette > 0.001) {
		const gradient = context.createRadialGradient(
			width / 2,
			height / 2,
			Math.min(width, height) * 0.16,
			width / 2,
			height / 2,
			Math.max(width, height) * 0.72,
		);
		gradient.addColorStop(0, "rgba(0,0,0,0)");
		gradient.addColorStop(1, `rgba(0,0,0,${Math.min(0.88, vignette * 0.82)})`);
		context.fillStyle = gradient;
		context.fillRect(0, 0, width, height);
	}
}

function copyCanvas({
	source,
	width,
	height,
}: {
	source: OffscreenCanvas;
	width: number;
	height: number;
}): {
	output: OffscreenCanvas;
	context: OffscreenCanvasRenderingContext2D;
} | null {
	const output = new OffscreenCanvas(width, height);
	const context = output.getContext("2d");
	if (!context) return null;
	context.drawImage(source, 0, 0, width, height);
	return { output, context };
}

function applyCanvasStylize({
	source,
	width,
	height,
	pass,
}: {
	source: OffscreenCanvas;
	width: number;
	height: number;
	pass: EffectPass;
}): OffscreenCanvas {
	const surface = copyCanvas({ source, width, height });
	if (!surface) return source;
	const { output, context } = surface;
	const mode = Math.round(
		numericUniform({ pass, name: "u_mode", fallback: 0 }),
	);
	const amount = Math.max(
		0,
		Math.min(1, numericUniform({ pass, name: "u_amount", fallback: 0.5 })),
	);

	if (mode === 1) {
		const gradient = context.createRadialGradient(
			width / 2,
			height / 2,
			Math.min(width, height) * 0.18,
			width / 2,
			height / 2,
			Math.max(width, height) * 0.7,
		);
		gradient.addColorStop(0, "rgba(0,0,0,0)");
		gradient.addColorStop(1, `rgba(0,0,0,${amount * 0.9})`);
		context.fillStyle = gradient;
		context.fillRect(0, 0, width, height);
	} else if (mode === 2) {
		context.globalCompositeOperation = "soft-light";
		context.globalAlpha = amount * 0.48;
		for (let y = 0; y < height; y += 3) {
			const value = Math.round(
				96 + (((Math.sin(y * 91.17) * 10000) % 1) + 1) * 70,
			);
			context.fillStyle = `rgb(${value},${value},${value})`;
			context.fillRect(0, y, width, 2);
		}
	} else if (mode === 3) {
		context.globalCompositeOperation = "screen";
		context.globalAlpha = amount * 0.62;
		context.filter = `blur(${Math.max(2, amount * 18)}px) saturate(1.15)`;
		context.drawImage(source, 0, 0, width, height);
	} else if (mode === 4) {
		const scale = Math.max(0.025, 0.35 - amount * 0.3);
		const pixelWidth = Math.max(2, Math.round(width * scale));
		const pixelHeight = Math.max(2, Math.round(height * scale));
		const pixels = new OffscreenCanvas(pixelWidth, pixelHeight);
		const pixelsContext = pixels.getContext("2d");
		if (pixelsContext) {
			pixelsContext.drawImage(source, 0, 0, pixelWidth, pixelHeight);
			context.imageSmoothingEnabled = false;
			context.clearRect(0, 0, width, height);
			context.drawImage(pixels, 0, 0, width, height);
		}
	} else if (mode === 5) {
		context.globalAlpha = amount * 0.42;
		context.fillStyle = "#07140e";
		for (let y = 0; y < height; y += 5) context.fillRect(0, y, width, 2);
		context.globalCompositeOperation = "screen";
		context.fillStyle = `rgba(54,255,170,${amount * 0.12})`;
		context.fillRect(0, 0, width, height);
	} else if (mode === 6) {
		drawGlitchSlices({ context, source, width, height, amount });
	} else if (mode === 7) {
		const offset = Math.max(1, Math.round(amount * width * 0.018));
		context.globalCompositeOperation = "screen";
		context.globalAlpha = amount * 0.35;
		context.drawImage(source, offset, 0, width, height);
		context.drawImage(source, -offset, 0, width, height);
	} else if (mode === 8) {
		drawLightLeak({ context, width, height, amount });
	}
	context.globalAlpha = 1;
	context.globalCompositeOperation = "source-over";
	context.filter = "none";
	return output;
}

function drawGlitchSlices({
	context,
	source,
	width,
	height,
	amount,
}: {
	context: OffscreenCanvasRenderingContext2D;
	source: OffscreenCanvas;
	width: number;
	height: number;
	amount: number;
}): void {
	const slices = Math.max(3, Math.round(4 + amount * 12));
	for (let index = 0; index < slices; index++) {
		const y =
			Math.floor((((index * 47.3) % 1) + index / slices) * height) % height;
		const sliceHeight = Math.max(
			2,
			Math.round(height * (0.01 + amount * 0.025)),
		);
		const direction = index % 2 === 0 ? 1 : -1;
		const offset = direction * Math.round(width * amount * 0.055);
		context.drawImage(
			source,
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

function drawLightLeak({
	context,
	width,
	height,
	amount,
}: {
	context: OffscreenCanvasRenderingContext2D;
	width: number;
	height: number;
	amount: number;
}): void {
	const gradient = context.createRadialGradient(
		width * 0.05,
		height * 0.18,
		0,
		width * 0.05,
		height * 0.18,
		Math.max(width, height) * 0.95,
	);
	gradient.addColorStop(0, `rgba(255,244,185,${amount * 0.92})`);
	gradient.addColorStop(0.38, `rgba(255,92,38,${amount * 0.38})`);
	gradient.addColorStop(1, "rgba(110,20,255,0)");
	context.globalCompositeOperation = "screen";
	context.fillStyle = gradient;
	context.fillRect(0, 0, width, height);
}

function applyCanvasTransition({
	source,
	width,
	height,
	pass,
}: {
	source: OffscreenCanvas;
	width: number;
	height: number;
	pass: EffectPass;
}): OffscreenCanvas {
	const surface = copyCanvas({ source, width, height });
	if (!surface) return source;
	const { output, context } = surface;
	const mode = Math.round(
		numericUniform({ pass, name: "u_mode", fallback: 0 }),
	);
	const intensity = Math.max(
		0,
		Math.min(1, numericUniform({ pass, name: "u_intensity", fallback: 0.75 })),
	);
	const progress = Math.max(
		0,
		Math.min(1, numericUniform({ pass, name: "u_progress", fallback: 0.5 })),
	);
	const peak = Math.sin(progress * Math.PI) * intensity;

	if (mode === 1 || mode === 2 || mode === 3) {
		const flashPeak = mode === 3 ? peak ** 4 : peak;
		context.fillStyle =
			mode === 1
				? `rgba(0,0,0,${flashPeak})`
				: `rgba(255,255,255,${flashPeak})`;
		context.fillRect(0, 0, width, height);
	} else if (mode === 4) {
		const scale = 1 + peak * 0.16;
		context.clearRect(0, 0, width, height);
		context.translate(width / 2, height / 2);
		context.scale(scale, scale);
		context.drawImage(source, -width / 2, -height / 2, width, height);
	} else if (mode === 5) {
		context.clearRect(0, 0, width, height);
		context.filter = `blur(${Math.max(0.01, peak * 24)}px)`;
		context.drawImage(source, 0, 0, width, height);
	} else if (mode === 6) {
		const direction = progress < 0.5 ? -1 : 1;
		const offset = direction * peak * width * 0.16;
		context.clearRect(0, 0, width, height);
		context.filter = `blur(${peak * 10}px)`;
		context.drawImage(source, offset, 0, width, height);
		context.drawImage(source, offset - direction * width, 0, width, height);
	} else if (mode === 7) {
		drawGlitchSlices({ context, source, width, height, amount: peak });
	} else if (mode === 8) {
		drawLightLeak({ context, width, height, amount: peak });
	}
	context.globalAlpha = 1;
	context.globalCompositeOperation = "source-over";
	context.filter = "none";
	return output;
}
