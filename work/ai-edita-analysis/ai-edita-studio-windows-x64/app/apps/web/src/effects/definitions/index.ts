import { effectsRegistry } from "../registry";
import { blurEffectDefinition } from "./blur";
import { colorGradeEffectDefinition } from "./color-grade";
import { stylizedEffectDefinitions } from "./stylized";
import { transitionEffectDefinitions } from "./transitions";
import { videoQualityEffectDefinition } from "./video-quality";

const defaultEffects = [
	blurEffectDefinition,
	colorGradeEffectDefinition,
	videoQualityEffectDefinition,
	...stylizedEffectDefinitions,
	...transitionEffectDefinitions,
];

export function registerDefaultEffects(): void {
	for (const definition of defaultEffects) {
		if (effectsRegistry.has(definition.type)) {
			continue;
		}
		effectsRegistry.register({
			key: definition.type,
			definition,
		});
	}
}
