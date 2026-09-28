import type { EffectDefinition } from "@/effects/types";

export const VIDEO_QUALITY_SHADER = "canvas-video-quality";

function numberParam({
	effectParams,
	key,
	fallback,
}: {
	effectParams: Record<string, unknown>;
	key: string;
	fallback: number;
}): number {
	const value = effectParams[key];
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export const videoQualityEffectDefinition: EffectDefinition = {
	type: "video-quality",
	name: "Qualidade do vídeo",
	keywords: [
		"quality",
		"denoise",
		"sharpen",
		"clarity",
		"qualidade",
		"ruído",
		"nitidez",
	],
	params: [
		{
			key: "denoise",
			label: "Redução de ruído",
			type: "number",
			default: 0.2,
			min: 0,
			max: 1,
			step: 0.01,
		},
		{
			key: "sharpness",
			label: "Nitidez",
			type: "number",
			default: 0.25,
			min: 0,
			max: 1,
			step: 0.01,
		},
		{
			key: "clarity",
			label: "Clareza",
			type: "number",
			default: 0.12,
			min: -1,
			max: 1,
			step: 0.01,
		},
	],
	renderer: {
		passes: [
			{
				shader: VIDEO_QUALITY_SHADER,
				uniforms: ({ effectParams }) => ({
					u_denoise: numberParam({
						effectParams,
						key: "denoise",
						fallback: 0.2,
					}),
					u_sharpness: numberParam({
						effectParams,
						key: "sharpness",
						fallback: 0.25,
					}),
					u_clarity: numberParam({
						effectParams,
						key: "clarity",
						fallback: 0.12,
					}),
				}),
			},
		],
	},
};
