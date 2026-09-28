import type { ParamValues } from "@/params";

export interface VisualAdjustmentPreset {
	id: string;
	name: string;
	description: string;
	accent: string;
	params: Partial<ParamValues>;
}

export const VISUAL_ADJUSTMENT_PRESETS: VisualAdjustmentPreset[] = [
	{
		id: "auto",
		name: "Ajuste automático",
		description: "Equilíbrio seguro para fala e conteúdo social.",
		accent: "linear-gradient(135deg,#b6ff2b,#22c55e)",
		params: { contrast: 1.06, saturation: 1.04, vibrance: 0.14, shadows: 0.08 },
	},
	{
		id: "natural",
		name: "Natural",
		description: "Pele preservada, contraste leve e cores limpas.",
		accent: "linear-gradient(135deg,#f6d365,#fda085)",
		params: { contrast: 1.04, saturation: 1.02, vibrance: 0.08, warmth: 0.025 },
	},
	{
		id: "vivid",
		name: "Vibrante",
		description: "Mais presença para vídeos curtos e anúncios.",
		accent: "linear-gradient(135deg,#22d3ee,#7c3aed,#f43f5e)",
		params: {
			contrast: 1.12,
			saturation: 1.14,
			vibrance: 0.28,
			highlights: -0.06,
		},
	},
	{
		id: "warm",
		name: "Quente",
		description: "Temperatura acolhedora e sombras suaves.",
		accent: "linear-gradient(135deg,#fb923c,#facc15)",
		params: { contrast: 1.06, saturation: 1.06, warmth: 0.14, shadows: 0.08 },
	},
	{
		id: "cool",
		name: "Frio",
		description: "Visual tecnológico com brancos controlados.",
		accent: "linear-gradient(135deg,#38bdf8,#4338ca)",
		params: { contrast: 1.08, saturation: 0.98, warmth: -0.12, whites: -0.04 },
	},
	{
		id: "cinematic",
		name: "Cinematográfico",
		description: "Contraste, fade, vinheta e granulação discretos.",
		accent: "linear-gradient(135deg,#0f172a,#ca8a04)",
		params: {
			contrast: 1.15,
			saturation: 0.9,
			warmth: 0.06,
			fade: 0.14,
			vignette: 0.24,
			grain: 0.1,
		},
	},
	{
		id: "matte",
		name: "Matte",
		description: "Pretos elevados e acabamento editorial.",
		accent: "linear-gradient(135deg,#334155,#cbd5e1)",
		params: { contrast: 0.96, saturation: 0.92, blacks: 0.2, fade: 0.22 },
	},
	{
		id: "mono",
		name: "Preto e branco",
		description: "Monocromático forte com contraste limpo.",
		accent: "linear-gradient(135deg,#030712,#f8fafc)",
		params: { saturation: 0, contrast: 1.14, highlights: -0.05, shadows: 0.04 },
	},
];
