"use client";

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from "react";
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, type AppLocale } from "./messages";
import {
	getStoredLocale,
	translateMessage,
	translatePreservingWhitespace,
} from "./translate";

interface I18nContextValue {
	locale: AppLocale;
	setLocale: (locale: AppLocale) => void;
	t: (message: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const TRANSLATABLE_ATTRIBUTES = ["aria-label", "alt", "placeholder", "title"];
const SKIPPED_TAGS = new Set(["CODE", "PRE", "SCRIPT", "STYLE", "TEXTAREA"]);

function shouldSkipNode(node: Node): boolean {
	const parent =
		node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
	if (!(parent instanceof Element)) return true;
	if (SKIPPED_TAGS.has(parent.tagName)) return true;
	if (parent.closest("[data-i18n-skip='true']")) return true;
	if (parent.closest("[contenteditable='true']")) return true;
	return false;
}

function localizeTextNode({ node, locale }: { node: Text; locale: AppLocale }) {
	if (shouldSkipNode(node)) return;

	const translated = translatePreservingWhitespace({
		value: node.data,
		locale,
	});
	if (translated !== node.data) {
		node.data = translated;
	}
}

function localizeElement({
	element,
	locale,
}: {
	element: Element;
	locale: AppLocale;
}) {
	if (element.closest("[data-i18n-skip='true']")) return;
	if (element.closest("[contenteditable='true']")) return;
	if (["CODE", "PRE", "SCRIPT", "STYLE"].includes(element.tagName)) return;

	for (const attribute of TRANSLATABLE_ATTRIBUTES) {
		const currentValue = element.getAttribute(attribute);
		if (!currentValue) continue;

		const translated = translateMessage({ message: currentValue, locale });
		if (translated !== currentValue) {
			element.setAttribute(attribute, translated);
		}
	}
}

function localizeTree({ root, locale }: { root: Node; locale: AppLocale }) {
	if (root instanceof Text) {
		localizeTextNode({ node: root, locale });
		return;
	}

	if (!(root instanceof Element)) return;
	localizeElement({ element: root, locale });

	const walker = document.createTreeWalker(
		root,
		NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
	);
	let currentNode = walker.nextNode();
	while (currentNode) {
		if (currentNode instanceof Text) {
			localizeTextNode({ node: currentNode, locale });
		} else if (currentNode instanceof Element) {
			localizeElement({ element: currentNode, locale });
		}
		currentNode = walker.nextNode();
	}
}

function DomLocalizer({ locale }: { locale: AppLocale }) {
	useEffect(() => {
		localizeTree({ root: document.body, locale });

		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (mutation.type === "characterData") {
					localizeTree({ root: mutation.target, locale });
					continue;
				}

				if (mutation.type === "attributes") {
					localizeTree({ root: mutation.target, locale });
					continue;
				}

				for (const addedNode of mutation.addedNodes) {
					localizeTree({ root: addedNode, locale });
				}
			}
		});

		observer.observe(document.body, {
			attributeFilter: TRANSLATABLE_ATTRIBUTES,
			attributes: true,
			characterData: true,
			childList: true,
			subtree: true,
		});

		return () => observer.disconnect();
	}, [locale]);

	return null;
}

export function I18nProvider({ children }: { children: ReactNode }) {
	const [locale, setLocaleState] = useState<AppLocale>(DEFAULT_LOCALE);

	useEffect(() => {
		const storedLocale = getStoredLocale();
		if (storedLocale === DEFAULT_LOCALE) return;

		let isCancelled = false;
		queueMicrotask(() => {
			if (!isCancelled) setLocaleState(storedLocale);
		});

		return () => {
			isCancelled = true;
		};
	}, []);

	const setLocale = useCallback((nextLocale: AppLocale) => {
		setLocaleState(nextLocale);
		window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
		window.dispatchEvent(
			new CustomEvent("opencut:locale-change", {
				detail: { locale: nextLocale },
			}),
		);
	}, []);

	useEffect(() => {
		document.documentElement.lang = locale;
	}, [locale]);

	const t = useCallback(
		(message: string) => translateMessage({ message, locale }),
		[locale],
	);

	const value = useMemo(
		() => ({ locale, setLocale, t }),
		[locale, setLocale, t],
	);

	return (
		<I18nContext.Provider value={value}>
			<DomLocalizer locale={locale} />
			{children}
		</I18nContext.Provider>
	);
}

export function useI18n(): I18nContextValue {
	const context = useContext(I18nContext);
	if (!context) {
		throw new Error("useI18n must be used inside I18nProvider");
	}
	return context;
}
