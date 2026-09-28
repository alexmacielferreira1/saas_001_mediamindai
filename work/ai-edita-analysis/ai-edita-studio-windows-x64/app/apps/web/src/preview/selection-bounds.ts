import type { ElementWithBounds } from "@/preview/element-bounds";

export function resolveSelectedElementWithBounds({
	selectedElements,
	elementsWithBounds,
}: {
	selectedElements: readonly { trackId: string; elementId: string }[];
	elementsWithBounds: readonly ElementWithBounds[];
}): ElementWithBounds | null {
	if (selectedElements.length !== 1) return null;

	const selected = selectedElements[0];
	return (
		elementsWithBounds.find(
			(entry) =>
				entry.trackId === selected.trackId &&
				entry.elementId === selected.elementId,
		) ?? null
	);
}
