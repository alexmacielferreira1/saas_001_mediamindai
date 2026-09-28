import type { EffectDefinition } from "@/effects/types";

export const COLOR_GRADE_SHADER = "color-grade";

function numberParam({
	effectParams,
	key,
	fallback,
}: {
	effectParams: Record<string, unknown>;
	key: string;
	fallback: number;
}) {
	const value = effectParams[key];
	const parsed =
		typeof value === "number" ? value : Number.parseFloat(String(value));
	return Number.isFinite(parsed) ? parsed : fallback;
}

export const colorGradeEffectDefinition: EffectDefinition = {
	type: "color-grade",
	name: "Ajustes de imagem",
	keywords: [
		"color",
		"grade",
		"contrast",
		"saturation",
		"warmth",
		"cor",
		"exposure",
		"hsl",
		"vignette",
	],
	params: [
		{
			key: "exposure",
			label: "Exposição",
			type: "number",
			default: 0,
			min: -2,
			max: 2,
			step: 0.01,
		},
		{
			key: "brightness",
			label: "Brilho",
			type: "number",
			default: 0,
			min: -0.5,
			max: 0.5,
			step: 0.01,
		},
		{
			key: "contrast",
			label: "Contraste",
			type: "number",
			default: 1,
			min: 0.5,
			max: 1.8,
			step: 0.01,
		},
		{
			key: "saturation",
			label: "Saturação",
			type: "number",
			default: 1,
			min: 0,
			max: 2,
			step: 0.01,
		},
		{
			key: "vibrance",
			label: "Vibrância",
			type: "number",
			default: 0,
			min: -1,
			max: 1,
			step: 0.01,
		},
		{
			key: "warmth",
			label: "Temperatura",
			type: "number",
			default: 0,
			min: -0.5,
			max: 0.5,
			step: 0.01,
		},
		{
			key: "tint",
			label: "Matiz verde/magenta",
			type: "number",
			default: 0,
			min: -0.5,
			max: 0.5,
			step: 0.01,
		},
		{
			key: "highlights",
			label: "Destaques",
			type: "number",
			default: 0,
			min: -1,
			max: 1,
			step: 0.01,
		},
		{
			key: "shadows",
			label: "Sombras",
			type: "number",
			default: 0,
			min: -1,
			max: 1,
			step: 0.01,
		},
		{
			key: "whites",
			label: "Brancos",
			type: "number",
			default: 0,
			min: -1,
			max: 1,
			step: 0.01,
		},
		{
			key: "blacks",
			label: "Pretos",
			type: "number",
			default: 0,
			min: -1,
			max: 1,
			step: 0.01,
		},
		{
			key: "fade",
			label: "Fade",
			type: "number",
			default: 0,
			min: 0,
			max: 1,
			step: 0.01,
		},
		{
			key: "vignette",
			label: "Vinheta",
			type: "number",
			default: 0,
			min: 0,
			max: 1,
			step: 0.01,
		},
		{
			key: "grain",
			label: "Granulação",
			type: "number",
			default: 0,
			min: 0,
			max: 1,
			step: 0.01,
		},
	],
	renderer: {
		passes: [
			{
				shader: COLOR_GRADE_SHADER,
				uniforms: ({ effectParams }) => ({
					u_exposure: numberParam({
						effectParams,
						key: "exposure",
						fallback: 0,
					}),
					u_brightness: numberParam({
						effectParams,
						key: "brightness",
						fallback: 0,
					}),
					u_contrast: numberParam({
						effectParams,
						key: "contrast",
						fallback: 1,
					}),
					u_saturation: numberParam({
						effectParams,
						key: "saturation",
						fallback: 1,
					}),
					u_warmth: numberParam({
						effectParams,
						key: "warmth",
						fallback: 0,
					}),
					u_vibrance: numberParam({
						effectParams,
						key: "vibrance",
						fallback: 0,
					}),
					u_tint: numberParam({
						effectParams,
						key: "tint",
						fallback: 0,
					}),
					u_highlights: numberParam({
						effectParams,
						key: "highlights",
						fallback: 0,
					}),
					u_shadows: numberParam({
						effectParams,
						key: "shadows",
						fallback: 0,
					}),
					u_whites: numberParam({
						effectParams,
						key: "whites",
						fallback: 0,
					}),
					u_blacks: numberParam({
						effectParams,
						key: "blacks",
						fallback: 0,
					}),
					u_fade: numberParam({
						effectParams,
						key: "fade",
						fallback: 0,
					}),
					u_vignette: numberParam({
						effectParams,
						key: "vignette",
						fallback: 0,
					}),
					u_grain: numberParam({
						effectParams,
						key: "grain",
						fallback: 0,
					}),
				}),
			},
		],
	},
};
