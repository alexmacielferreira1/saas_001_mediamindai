import type { SubtitleStyleOverrides } from "./types";

export type CaptionStyleId = "clean" | "boxed" | "pulse" | "spotlight";

export const BUILTIN_CAPTION_STYLES: Array<{
	id: CaptionStyleId;
	name: readonly [string, string];
	preview: string;
}> = [
	{ id: "clean", name: ["Limpa", "Clean"], preview: "FALA NATURAL" },
	{ id: "boxed", name: ["Caixa", "Boxed"], preview: "TEXTO NA CAIXA" },
	{ id: "pulse", name: ["Pulso", "Pulse"], preview: "RITMO E ÊNFASE" },
	{
		id: "spotlight",
		name: ["Palavra em destaque", "Word spotlight"],
		preview: "PALAVRA FORTE",
	},
];

export function getBuiltinCaptionStyle({
	style,
	placement = "bottom",
}: {
	style: CaptionStyleId;
	placement?: NonNullable<SubtitleStyleOverrides["placement"]>["verticalAlign"];
}): SubtitleStyleOverrides {
	return {
		fontSizeRatioOfPlayHeight: style === "spotlight" ? 0.055 : 0.04,
		color: style === "spotlight" ? "#b9f443" : "#ffffff",
		fontWeight: "bold",
		lineHeight: 1.15,
		background: {
			enabled: style === "boxed" || style === "spotlight",
			color: "#101712",
			paddingX: 10,
			paddingY: 6,
			cornerRadius: 6,
		},
		placement: {
			verticalAlign: placement,
			marginLeftRatio: 0.1,
			marginRightRatio: 0.1,
			marginVerticalRatio: 0.13,
		},
	};
}

export function builtinCaptionStyleUsesMotion({
	style,
}: {
	style: CaptionStyleId;
}): boolean {
	return style === "pulse" || style === "spotlight";
}
