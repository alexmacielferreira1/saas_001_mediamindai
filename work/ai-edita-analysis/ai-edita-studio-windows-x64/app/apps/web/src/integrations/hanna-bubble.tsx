"use client";

import { Settings2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverClose,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { useI18n } from "@/i18n";
import { useSettingsDialog } from "@/operations/settings";
import { AgentStudio } from "./agent-studio";

export function HannaBubble() {
	const { locale } = useI18n();
	const pt = locale === "pt-BR";
	return (
		<div className="fixed right-4 bottom-4 z-180">
			<Popover>
				<PopoverTrigger asChild>
					<Button
						size="icon"
						aria-label="Hanna"
						className="size-12 rounded-2xl border border-primary/60 shadow-[0_12px_40px_rgba(0,0,0,0.24)] transition-transform hover:scale-105"
					>
						<Sparkles className="!size-5" />
					</Button>
				</PopoverTrigger>
				<PopoverContent
					side="top"
					align="end"
					sideOffset={12}
					collisionPadding={12}
					className="flex h-[min(680px,calc(100dvh-5.5rem))] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl bg-background p-0 text-foreground shadow-2xl"
				>
					<div className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
						<span className="grid size-8 place-items-center rounded-xl bg-primary text-primary-foreground">
							<Sparkles className="size-4" />
						</span>
						<div className="min-w-0 flex-1">
							<strong className="block text-sm">Hanna</strong>
							<span className="block truncate text-[11px] text-muted-foreground">
								{pt ? "Agente deste projeto" : "Agent for this project"}
							</span>
						</div>
						<Button
							variant="ghost"
							size="icon"
							aria-label={pt ? "Configurações da Hanna" : "Hanna settings"}
							onClick={() => useSettingsDialog.getState().show()}
						>
							<Settings2 />
						</Button>
						<PopoverClose asChild>
							<Button
								variant="ghost"
								size="icon"
								aria-label={pt ? "Fechar Hanna" : "Close Hanna"}
							>
								<X />
							</Button>
						</PopoverClose>
					</div>
					<div className="min-h-0 flex-1">
						<AgentStudio compact />
					</div>
				</PopoverContent>
			</Popover>
		</div>
	);
}
