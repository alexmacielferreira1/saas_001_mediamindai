"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import { useTheme } from "next-themes";
import { useWorkspace } from "./client";
import type { AppearanceSettings } from "./types";

export const DEFAULT_APP_ICON_URL = "/ai-edita-app-icon.png";

export const DEFAULT_APPEARANCE: AppearanceSettings = {
	productName: "AI Edita",
	logoLight: "",
	logoDark: "",
	appIcon: "",
	primaryColor: "#b9f443",
	accentColor: "#86b733",
	gradientStyle: "rich",
	customGradientColors: ["#557d1e", "#b9f443", "#dcff9c"],
	borderRadius: 12,
	defaultTheme: "dark",
	fontFamily: "DM Sans",
	customFontUrl: "",
	baseFontSize: 16,
};

const AppearanceContext = createContext<AppearanceSettings>(DEFAULT_APPEARANCE);

function readableForeground(hex: string) {
	const value = hex.slice(1);
	const red = Number.parseInt(value.slice(0, 2), 16);
	const green = Number.parseInt(value.slice(2, 4), 16);
	const blue = Number.parseInt(value.slice(4, 6), 16);
	return red * 0.299 + green * 0.587 + blue * 0.114 > 155
		? "#11170f"
		: "#ffffff";
}

function brandGradient(value: AppearanceSettings) {
	if (value.gradientStyle === "solid") return value.primaryColor;
	if (value.gradientStyle === "soft")
		return `linear-gradient(120deg, ${value.primaryColor}, color-mix(in srgb, ${value.primaryColor} 45%, white))`;
	const colors =
		value.gradientStyle === "custom"
			? value.customGradientColors
			: [value.accentColor, value.primaryColor, "#dcff9c"];
	return `linear-gradient(120deg, ${colors.join(", ")})`;
}

export function AppearanceProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const refresh = useWorkspace((state) => state.refresh);
	const appearance = useWorkspace((state) => state.data?.settings.appearance);
	const value = useMemo(
		() => ({ ...DEFAULT_APPEARANCE, ...(appearance || {}) }),
		[appearance],
	);
	const { setTheme } = useTheme();

	useEffect(() => {
		void refresh();
	}, [refresh]);

	useEffect(() => {
		const root = document.documentElement;
		root.style.setProperty("--brand-primary", value.primaryColor);
		root.style.setProperty(
			"--brand-primary-foreground",
			readableForeground(value.primaryColor),
		);
		root.style.setProperty("--brand-accent", value.accentColor);
		root.style.setProperty("--brand-gradient", brandGradient(value));
		root.style.setProperty("--brand-radius", `${value.borderRadius}px`);
		root.style.setProperty(
			"--brand-font-family",
			JSON.stringify(value.fontFamily),
		);
		root.style.setProperty("--brand-base-size", `${value.baseFontSize}px`);
		document.title = value.productName;

		const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
		if (favicon) favicon.href = value.appIcon || DEFAULT_APP_ICON_URL;

		const fontLinkId = "ai-edita-custom-font";
		const currentFontLink = document.getElementById(fontLinkId);
		if (value.customFontUrl) {
			const fontLink =
				currentFontLink instanceof HTMLLinkElement
					? currentFontLink
					: document.createElement("link");
			fontLink.id = fontLinkId;
			fontLink.rel = "stylesheet";
			fontLink.href = value.customFontUrl;
			if (!fontLink.isConnected) document.head.append(fontLink);
		} else {
			currentFontLink?.remove();
		}
	}, [value]);

	useEffect(() => {
		if (localStorage.getItem("ai-edita-theme") === null) {
			setTheme(value.defaultTheme);
		}
	}, [setTheme, value.defaultTheme]);

	return (
		<AppearanceContext.Provider value={value}>
			{children}
		</AppearanceContext.Provider>
	);
}

export function useAppearance() {
	return useContext(AppearanceContext);
}
