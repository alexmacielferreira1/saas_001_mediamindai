"use client";
import Link from "next/link";
import { useI18n } from "@/i18n";
export function Footer() {
	const { t } = useI18n();
	return (
		<footer className="flex flex-wrap items-center justify-between gap-4 border-t px-8 py-6 text-xs text-muted-foreground">
			<span>AI Edita</span>
			<nav className="flex gap-5">
				<Link href="/privacy">{t("Privacy")}</Link>
				<Link href="/terms">{t("Terms of use")}</Link>
			</nav>
		</footer>
	);
}
