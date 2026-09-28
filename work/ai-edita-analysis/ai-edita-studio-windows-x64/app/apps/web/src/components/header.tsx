"use client";
import Link from "next/link";
import { DEFAULT_APP_ICON_URL, useAppearance } from "@/operations/appearance";
import { LanguageToggle, useI18n } from "@/i18n";
import { ThemeToggle } from "./theme-toggle";

export function Header() {
	const { t } = useI18n();
	const appearance = useAppearance();
	return (
		<header className="flex items-center justify-between border-b px-6 py-4">
			<Link
				href="/projects"
				className="flex items-center gap-3 font-bold tracking-tight"
			>
				<img
					src={appearance.appIcon || DEFAULT_APP_ICON_URL}
					alt=""
					className="size-8 rounded-md object-contain"
				/>
				{appearance.productName}
			</Link>
			<nav className="flex items-center gap-4">
				<Link href="/projects">{t("Projects")}</Link>
				<LanguageToggle />
				<ThemeToggle />
			</nav>
		</header>
	);
}
