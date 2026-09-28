import type { AppLocale } from "@/i18n";
import { getStoredLocale } from "@/i18n/translate";

export function formatDate({
	date,
	locale = getStoredLocale(),
}: {
	date: Date;
	locale?: AppLocale;
}): string {
	return date.toLocaleDateString(locale, {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}
