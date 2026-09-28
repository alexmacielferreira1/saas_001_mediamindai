"use client";

import { Button } from "./ui/button";
import { useTheme } from "next-themes";
import { cn } from "@/utils/ui";
import { Moon, Sun } from "lucide-react";
import { useI18n } from "@/i18n";

interface ThemeToggleProps {
	className?: string;
	iconClassName?: string;
	onToggle?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

export function ThemeToggle({
	className,
	iconClassName,
	onToggle,
}: ThemeToggleProps) {
	const { resolvedTheme, setTheme } = useTheme();
	const { t } = useI18n();

	return (
		<Button
			size="icon"
			variant="ghost"
			className={cn("size-8", className)}
			onClick={(e) => {
				setTheme(resolvedTheme === "dark" ? "light" : "dark");
				onToggle?.(e);
			}}
		>
			<Moon className={cn("size-[1.1rem] dark:hidden", iconClassName)} />
			<Sun className={cn("hidden size-[1.1rem] dark:block", iconClassName)} />
			<span className="sr-only">{t("Toggle theme")}</span>
		</Button>
	);
}
