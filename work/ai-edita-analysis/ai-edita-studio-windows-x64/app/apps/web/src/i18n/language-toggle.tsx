"use client";

import { Globe02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/utils/ui";
import type { AppLocale } from "./messages";
import { useI18n } from "./i18n-provider";

const LANGUAGE_OPTIONS: Array<{
	locale: AppLocale;
	label: string;
	shortLabel: string;
}> = [
	{ locale: "pt-BR", label: "Português (Brasil)", shortLabel: "PT-BR" },
	{ locale: "en", label: "English", shortLabel: "EN" },
];

export function LanguageToggle({ className }: { className?: string }) {
	const { locale, setLocale, t } = useI18n();
	const activeLanguage = LANGUAGE_OPTIONS.find(
		(option) => option.locale === locale,
	);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					className={cn("h-8 gap-1.5 px-2", className)}
					aria-label={t("Choose language")}
				>
					<HugeiconsIcon icon={Globe02Icon} className="size-4" />
					<span className="text-xs font-medium">
						{activeLanguage?.shortLabel ?? "PT-BR"}
					</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-48">
				<DropdownMenuLabel>{t("Language")}</DropdownMenuLabel>
				{LANGUAGE_OPTIONS.map((option) => (
					<DropdownMenuCheckboxItem
						key={option.locale}
						checked={locale === option.locale}
						onCheckedChange={() => setLocale(option.locale)}
					>
						{option.label}
					</DropdownMenuCheckboxItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
