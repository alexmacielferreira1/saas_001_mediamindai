import { generateUUID } from "@/utils/id";
import { buildDefaultParamValues } from "@/params/registry";
import { effectsRegistry } from "./registry";
import type { ParamValues } from "@/params";
import type { Effect, EffectDefinition, EffectPass } from "@/effects/types";
import { VISUAL_ELEMENT_TYPES } from "@/timeline";

export { effectsRegistry } from "./registry";
export { registerDefaultEffects } from "./definitions";

export function resolveEffectPasses({
	definition,
	effectParams,
	width,
	height,
	time = 0,
	duration = 1,
	progress = 0.5,
}: {
	definition: EffectDefinition;
	effectParams: ParamValues;
	width: number;
	height: number;
	time?: number;
	duration?: number;
	progress?: number;
}): EffectPass[] {
	if (definition.renderer.buildPasses) {
		return definition.renderer.buildPasses({
			effectParams,
			width,
			height,
			time,
			duration,
			progress,
		});
	}
	return definition.renderer.passes.map((pass) => ({
		shader: pass.shader,
		uniforms: pass.uniforms({
			effectParams,
			width,
			height,
			time,
			duration,
			progress,
		}),
	}));
}

export const EFFECT_TARGET_ELEMENT_TYPES = VISUAL_ELEMENT_TYPES;

export function buildDefaultEffectInstance({
	effectType,
}: {
	effectType: string;
}): Effect {
	const definition = effectsRegistry.get(effectType);
	const params: ParamValues = buildDefaultParamValues(definition.params);

	return {
		id: generateUUID(),
		type: effectType,
		params,
		enabled: true,
	};
}
