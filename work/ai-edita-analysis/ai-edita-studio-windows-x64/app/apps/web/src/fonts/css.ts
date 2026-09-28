/**
 * Turns a font family into a value CSS actually accepts.
 *
 * Installed font packs register families like `AI Edita Pack - Gotham Medium`. Written
 * unquoted in an inline style, the lone hyphen makes the whole declaration invalid and the
 * browser silently falls back to the default font — every preview then looks the same.
 * Quoting keeps those names intact.
 */
export function cssFontFamily({
	family,
	fallback = "sans-serif",
}: {
	family: string | undefined;
	fallback?: string;
}): string | undefined {
	const name = family?.trim();
	if (!name) return undefined;
	return `${quoteFamily(name)}, ${fallback}`;
}

export function quoteFamily(family: string): string {
	return `"${family.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
