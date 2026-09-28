import { webEnv } from "@/env/web";

const PLACEHOLDERS = new Set([
	"local",
	"none",
	"disabled",
	"your_api_key_here",
]);

/**
 * Whether this installation can search sounds online.
 *
 * The portable build ships without a Freesound key, and the built-in library covers the
 * panel on its own — so the answer here decides between "show the online tab" and "explain
 * that this install works offline", never between a result and an endless spinner.
 */
export function hasOnlineSoundSearch(): boolean {
	const key = webEnv.FREESOUND_API_KEY?.trim() ?? "";
	return key.length >= 12 && !PLACEHOLDERS.has(key.toLowerCase());
}
