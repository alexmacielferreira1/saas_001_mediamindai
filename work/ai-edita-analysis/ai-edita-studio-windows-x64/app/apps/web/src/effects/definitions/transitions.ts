import type { EffectDefinition } from "@/effects/types";

export const CANVAS_TRANSITION_SHADER = "canvas-transition";

export const TRANSITION_MODE = {
	crossfade: 0,
	dipBlack: 1,
	dipWhite: 2,
	flash: 3,
	zoom: 4,
	blur: 5,
	whip: 6,
	glitch: 7,
	lightLeak: 8,
} as const;

function transitionDefinition({
	type,
	name,
	keywords,
	mode,
}: {
	type: string;
	name: string;
	keywords: string[];
	mode: number;
}): EffectDefinition {
	return {
		type,
		name,
		keywords: ["transition", "transição", ...keywords],
		params: [
			{
				key: "intensity",
				label: "Intensidade",
				type: "number",
				default: 0.75,
				min: 0.1,
				max: 1,
				step: 0.01,
			},
		],
		renderer: {
			passes: [
				{
					shader: CANVAS_TRANSITION_SHADER,
					uniforms: ({ effectParams, progress }) => ({
						u_mode: mode,
						u_intensity:
							typeof effectParams.intensity === "number"
								? effectParams.intensity
								: 0.75,
						u_progress: progress,
					}),
				},
			],
		},
	};
}

export const transitionEffectDefinitions: EffectDefinition[] = [
	transitionDefinition({
		type: "transition-crossfade",
		name: "Dissolver",
		keywords: ["crossfade", "dissolve", "mistura"],
		mode: TRANSITION_MODE.crossfade,
	}),
	transitionDefinition({
		type: "transition-dip-black",
		name: "Escurecer",
		keywords: ["dip", "black", "preto", "fade"],
		mode: TRANSITION_MODE.dipBlack,
	}),
	transitionDefinition({
		type: "transition-dip-white",
		name: "Luz branca",
		keywords: ["dip", "white", "branco", "light"],
		mode: TRANSITION_MODE.dipWhite,
	}),
	transitionDefinition({
		type: "transition-flash",
		name: "Flash",
		keywords: ["flash", "impact", "viral"],
		mode: TRANSITION_MODE.flash,
	}),
	transitionDefinition({
		type: "transition-zoom",
		name: "Zoom de impacto",
		keywords: ["zoom", "punch", "impact"],
		mode: TRANSITION_MODE.zoom,
	}),
	transitionDefinition({
		type: "transition-blur",
		name: "Desfoque",
		keywords: ["blur", "soft", "desfoque"],
		mode: TRANSITION_MODE.blur,
	}),
	transitionDefinition({
		type: "transition-whip",
		name: "Whip pan",
		keywords: ["whip", "pan", "slide", "movimento"],
		mode: TRANSITION_MODE.whip,
	}),
	transitionDefinition({
		type: "transition-glitch",
		name: "Glitch",
		keywords: ["glitch", "digital", "signal"],
		mode: TRANSITION_MODE.glitch,
	}),
	transitionDefinition({
		type: "transition-light-leak",
		name: "Light leak",
		keywords: ["light", "leak", "flare", "luz"],
		mode: TRANSITION_MODE.lightLeak,
	}),
];
