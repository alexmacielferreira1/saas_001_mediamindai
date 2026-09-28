import {
	ensurePackagedFont,
	isPackagedFont,
	packagedFontLabel,
	usePackagedFontFamilies,
} from "./font-packs";

// Commercial fonts live in separately installed .aiedita files. Their binary
// data never ships in the application bundle or source repository.
export function usePresetFontFamilies(): string[] {
	return usePackagedFontFamilies();
}
export function isPresetFont(family: string): boolean {
	return isPackagedFont({ family });
}
export async function ensurePresetFont(input: {
	family: string;
}): Promise<boolean> {
	return ensurePackagedFont(input);
}
export function presetFontLabel({ family }: { family: string }) {
	return packagedFontLabel({ family });
}
