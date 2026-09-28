import {
	DEFAULT_LOCALE,
	LOCALE_STORAGE_KEY,
	PT_BR_MESSAGES,
	type AppLocale,
} from "./messages";

const PT_BR_TO_EN = new Map<string, string>();
for (const [english, portuguese] of Object.entries(PT_BR_MESSAGES)) {
	if (!PT_BR_TO_EN.has(portuguese)) {
		PT_BR_TO_EN.set(portuguese, english);
	}
}

const ENGLISH_DYNAMIC_TRANSLATIONS: Array<{
	pattern: RegExp;
	translate: (...matches: string[]) => string;
}> = [
	{
		pattern: /^Your search for "(.+)" did not return any results\.$/,
		translate: (query) =>
			`Sua pesquisa por "${query}" não retornou resultados.`,
	},
	{
		pattern: /^(\d+) projects? selected$/,
		translate: (count) =>
			`${count} ${count === "1" ? "projeto selecionado" : "projetos selecionados"}`,
	},
	{
		pattern: /^(\d+) elements? selected\.?$/,
		translate: (count) =>
			`${count} ${count === "1" ? "elemento selecionado" : "elementos selecionados"}`,
	},
	{
		pattern: /^Delete '(.+)'$/,
		translate: (name) => `Excluir '${name}'`,
	},
	{
		pattern: /^Delete \((\d+)\)$/,
		translate: (count) => `Excluir (${count})`,
	},
	{
		pattern: /^Delete (\d+) scenes?$/,
		translate: (count) =>
			`Excluir ${count} ${count === "1" ? "cena" : "cenas"}`,
	},
	{
		pattern: /^(\d+) results?$/,
		translate: (count) =>
			`${count} ${count === "1" ? "resultado" : "resultados"}`,
	},
	{
		pattern: /^(\d+) contributors?$/,
		translate: (count) =>
			`${count} ${count === "1" ? "colaborador" : "colaboradores"}`,
	},
	{
		pattern: /^(\d+) contributions?$/,
		translate: (count) =>
			`${count} ${count === "1" ? "contribuição" : "contribuições"}`,
	},
	{
		pattern: /^Sort (ascending|descending)$/,
		translate: (direction) =>
			direction === "ascending"
				? "Ordenar em ordem crescente"
				: "Ordenar em ordem decrescente",
	},
	{
		pattern: /^Select (.+) track$/,
		translate: (trackName) =>
			`Selecionar faixa ${translateMessage({ message: trackName, locale: "pt-BR" })}`,
	},
	{
		pattern: /^Failed to (.+)$/,
		translate: (action) => `Não foi possível ${action}`,
	},
	{
		pattern: /^(© \d{4} OpenCut, )All Rights Reserved$/,
		translate: (prefix) => `${prefix}Todos os direitos reservados`,
	},
	{
		pattern: /^(.+)'s avatar$/,
		translate: (name) => `Avatar de ${name}`,
	},
	{
		pattern: /^(.+) logo$/,
		translate: (name) => `Logotipo de ${name}`,
	},
];

const PORTUGUESE_DYNAMIC_TRANSLATIONS: Array<{
	pattern: RegExp;
	translate: (...matches: string[]) => string;
}> = [
	{
		pattern: /^Sua pesquisa por "(.+)" não retornou resultados\.$/,
		translate: (query) =>
			`Your search for "${query}" did not return any results.`,
	},
	{
		pattern: /^(\d+) projeto selecionado$/,
		translate: (count) => `${count} project selected`,
	},
	{
		pattern: /^(\d+) projetos selecionados$/,
		translate: (count) => `${count} projects selected`,
	},
	{
		pattern: /^(\d+) elemento selecionado$/,
		translate: (count) => `${count} element selected`,
	},
	{
		pattern: /^(\d+) elementos selecionados$/,
		translate: (count) => `${count} elements selected`,
	},
	{
		pattern: /^Excluir '(.+)'$/,
		translate: (name) => `Delete '${name}'`,
	},
	{
		pattern: /^Excluir \((\d+)\)$/,
		translate: (count) => `Delete (${count})`,
	},
	{
		pattern: /^Excluir (\d+) cena$/,
		translate: (count) => `Delete ${count} scene`,
	},
	{
		pattern: /^Excluir (\d+) cenas$/,
		translate: (count) => `Delete ${count} scenes`,
	},
	{
		pattern: /^(\d+) resultado$/,
		translate: (count) => `${count} result`,
	},
	{
		pattern: /^(\d+) resultados$/,
		translate: (count) => `${count} results`,
	},
	{
		pattern: /^Selecionar faixa (.+)$/,
		translate: (trackName) =>
			`Select ${translateMessage({ message: trackName, locale: "en" })} track`,
	},
	{
		pattern: /^(© \d{4} OpenCut, )Todos os direitos reservados$/,
		translate: (prefix) => `${prefix}All Rights Reserved`,
	},
	{
		pattern: /^Avatar de (.+)$/,
		translate: (name) => `${name}'s avatar`,
	},
	{
		pattern: /^Logotipo de (.+)$/,
		translate: (name) => `${name} logo`,
	},
];

function applyDynamicTranslation({
	message,
	translations,
}: {
	message: string;
	translations: typeof ENGLISH_DYNAMIC_TRANSLATIONS;
}): string | null {
	for (const { pattern, translate } of translations) {
		const match = message.match(pattern);
		if (match) {
			return translate(...match.slice(1));
		}
	}

	return null;
}

export function translateMessage({
	message,
	locale,
}: {
	message: string;
	locale: AppLocale;
}): string {
	if (!message) return message;

	if (locale === "pt-BR") {
		const englishSource = PT_BR_TO_EN.get(message) ?? message;
		return (
			PT_BR_MESSAGES[englishSource] ??
			applyDynamicTranslation({
				message: englishSource,
				translations: ENGLISH_DYNAMIC_TRANSLATIONS,
			}) ??
			message
		);
	}

	return (
		PT_BR_TO_EN.get(message) ??
		applyDynamicTranslation({
			message,
			translations: PORTUGUESE_DYNAMIC_TRANSLATIONS,
		}) ??
		message
	);
}

export function translatePreservingWhitespace({
	value,
	locale,
}: {
	value: string;
	locale: AppLocale;
}): string {
	const leadingWhitespace = value.match(/^\s*/)?.[0] ?? "";
	const trailingWhitespace = value.match(/\s*$/)?.[0] ?? "";
	const content = value.trim().replace(/\s+/g, " ");
	if (!content) return value;

	const translated = translateMessage({ message: content, locale });
	if (translated === content) return value;

	return `${leadingWhitespace}${translated}${trailingWhitespace}`;
}

export function getStoredLocale(): AppLocale {
	if (typeof window === "undefined") return DEFAULT_LOCALE;

	const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
	return storedLocale === "en" || storedLocale === "pt-BR"
		? storedLocale
		: DEFAULT_LOCALE;
}

export function localizeRegionName({
	regionCode,
	locale,
}: {
	regionCode: string;
	locale: AppLocale;
}): string | null {
	try {
		return (
			new Intl.DisplayNames([locale], { type: "region" }).of(regionCode) ?? null
		);
	} catch {
		return null;
	}
}

export function localizeLanguageName({
	languageCode,
	locale,
}: {
	languageCode: string;
	locale: AppLocale;
}): string | null {
	try {
		return (
			new Intl.DisplayNames([locale], { type: "language" }).of(languageCode) ??
			null
		);
	} catch {
		return null;
	}
}
