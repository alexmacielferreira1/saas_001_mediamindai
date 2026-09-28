import type { EffectDefinition } from "@/effects/types";

export const CANVAS_STYLIZE_SHADER = "canvas-stylize";

const MODE = {
	vignette: 1,
	grain: 2,
	glow: 3,
	pixelate: 4,
	vhs: 5,
	glitch: 6,
	chromatic: 7,
	lightLeak: 8,
} as const;

function amount({
	effectParams,
	fallback,
}: {
	effectParams: Record<string, unknown>;
	fallback: number;
}): number {
	const value = effectParams.amount;
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function definition({
	type,
	name,
	keywords,
	mode,
	defaultAmount = 0.45,
}: {
	type: string;
	name: string;
	keywords: string[];
	mode: number;
	defaultAmount?: number;
}): EffectDefinition {
	return {
		type,
		name,
		keywords,
		params: [
			{
				key: "amount",
				label: "Intensidade",
				type: "number",
				default: defaultAmount,
				min: 0,
				max: 1,
				step: 0.01,
			},
		],
		renderer: {
			passes: [
				{
					shader: CANVAS_STYLIZE_SHADER,
					uniforms: ({ effectParams, progress }) => ({
						u_mode: mode,
						u_amount: amount({ effectParams, fallback: defaultAmount }),
						u_progress: progress,
					}),
				},
			],
		},
	};
}

export const stylizedEffectDefinitions: EffectDefinition[] = [
	definition({
		type: "vignette",
		name: "Vinheta cinematográfica",
		keywords: ["vignette", "cinematic", "vinheta", "cinema"],
		mode: MODE.vignette,
	}),
	definition({
		type: "film-grain",
		name: "Granulação de filme",
		keywords: ["grain", "film", "noise", "granulação"],
		mode: MODE.grain,
		defaultAmount: 0.28,
	}),
	definition({
		type: "soft-glow",
		name: "Brilho suave",
		keywords: ["glow", "bloom", "dream", "brilho"],
		mode: MODE.glow,
	}),
	definition({
		type: "pixelate",
		name: "Pixelado",
		keywords: ["pixel", "mosaic", "pixelate", "pixelado"],
		mode: MODE.pixelate,
		defaultAmount: 0.35,
	}),
	definition({
		type: "vhs",
		name: "VHS",
		keywords: ["vhs", "retro", "scanline", "fita"],
		mode: MODE.vhs,
		defaultAmount: 0.38,
	}),
	definition({
		type: "glitch",
		name: "Glitch digital",
		keywords: ["glitch", "digital", "signal", "falha"],
		mode: MODE.glitch,
		defaultAmount: 0.4,
	}),
	definition({
		type: "chromatic-aberration",
		name: "Aberração cromática",
		keywords: ["chromatic", "rgb", "aberration", "cromática"],
		mode: MODE.chromatic,
		defaultAmount: 0.32,
	}),
	definition({
		type: "light-leak",
		name: "Vazamento de luz",
		keywords: ["light", "leak", "flare", "luz"],
		mode: MODE.lightLeak,
		defaultAmount: 0.5,
	}),
];
