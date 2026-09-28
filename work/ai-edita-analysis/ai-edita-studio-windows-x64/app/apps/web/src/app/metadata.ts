import type { Metadata } from "next";
import { SITE_INFO, DEFAULT_LOGO_URL } from "@/site/brand";

export const baseMetaData: Metadata = {
	title: { default: SITE_INFO.title, template: "%s · AI Edita" },
	description: SITE_INFO.description,
	applicationName: "AI Edita",
	robots: { index: false, follow: false },
	icons: {
		icon: [{ url: DEFAULT_LOGO_URL, type: "image/png" }],
		shortcut: [DEFAULT_LOGO_URL],
	},
	appleWebApp: { capable: true, title: "AI Edita" },
	manifest: "/manifest.json",
};
