import type { ParamValues } from "@/params";

export type TextPresetId =
	| "simple"
	| "title"
	| "highlight"
	| "label"
	| "quote"
	| "caption";

export type TextPreset = {
	id: TextPresetId;
	name: string;
	content: string;
	params: ParamValues;
};

export const TEXT_PRESETS: TextPreset[] = [
	{
		id: "simple",
		name: "Texto simples",
		content: "Seu texto",
		params: { fontSize: 15, fontWeight: "normal" },
	},
	{
		id: "title",
		name: "Título forte",
		content: "SEU TÍTULO",
		params: {
			fontSize: 23,
			fontWeight: "bold",
			letterSpacing: 1.2,
			outlineColor: "#000000",
			outlineWidth: 2,
		},
	},
	{
		id: "highlight",
		name: "Destaque",
		content: "DESTAQUE",
		params: {
			fontSize: 19,
			fontWeight: "bold",
			color: "#b9f443",
			outlineColor: "#071009",
			outlineWidth: 3,
		},
	},
	{
		id: "label",
		name: "Tarja",
		content: "INFORMAÇÃO",
		params: {
			fontSize: 14,
			fontWeight: "bold",
			"background.enabled": true,
			"background.color": "#071009",
			"background.cornerRadius": 12,
			"background.paddingX": 28,
			"background.paddingY": 20,
		},
	},
	{
		id: "quote",
		name: "Citação",
		content: "“Sua mensagem aqui”",
		params: {
			fontSize: 18,
			fontStyle: "italic",
			shadowColor: "#000000",
			shadowBlur: 6,
			shadowOpacity: 0.7,
		},
	},
	{
		id: "caption",
		name: "Legenda manual",
		content: "Digite a legenda",
		params: {
			fontSize: 16,
			fontWeight: "bold",
			outlineColor: "#000000",
			outlineWidth: 3,
		},
	},
];

export const TEXT_STYLE_PRESETS = TEXT_PRESETS.filter(
	(preset) => preset.id !== "simple" && preset.id !== "caption",
);

const CAPTION_STYLE_RESET: ParamValues = {
	color: "#ffffff",
	fontWeight: "normal",
	fontStyle: "normal",
	textDecoration: "none",
	letterSpacing: 0,
	outlineWidth: 0,
	outlineColor: "#000000",
	shadowOpacity: 0,
	shadowColor: "#000000",
	shadowBlur: 0,
	shadowOffsetX: 0,
	shadowOffsetY: 0,
	"background.enabled": false,
	"background.color": "#000000",
	"background.cornerRadius": 0,
	"background.paddingX": 0,
	"background.paddingY": 0,
	"background.offsetX": 0,
	"background.offsetY": 0,
};

const SCALED_CAPTION_STYLE_PARAMS = new Set([
	"letterSpacing",
	"outlineWidth",
	"shadowBlur",
	"shadowOffsetX",
	"shadowOffsetY",
	"background.cornerRadius",
	"background.paddingX",
	"background.paddingY",
	"background.offsetX",
	"background.offsetY",
]);

export function buildCaptionTextStyleParams({
	preset,
	fontSize,
}: {
	preset: TextPreset;
	fontSize: number;
}): ParamValues {
	const presetFontSize = Number(preset.params.fontSize ?? fontSize);
	const scale =
		Number.isFinite(fontSize) && fontSize > 0 && presetFontSize > 0
			? fontSize / presetFontSize
			: 1;
	const params: ParamValues = { ...CAPTION_STYLE_RESET };

	for (const [key, value] of Object.entries(preset.params)) {
		if (key === "fontSize") continue;
		params[key] =
			typeof value === "number" && SCALED_CAPTION_STYLE_PARAMS.has(key)
				? value * scale
				: value;
	}

	return params;
}
