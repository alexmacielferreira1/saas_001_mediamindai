"use client";
import { Sparkles } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocalStorage } from "@/services/storage/use-local-storage";
import { useI18n } from "@/i18n";
import { Button } from "../ui/button";
import { Dialog, DialogBody, DialogContent, DialogTitle } from "../ui/dialog";

export function Onboarding() {
	const { locale } = useI18n();
	const pt = locale === "pt-BR";
	const [hasSeen, setSeen] = useLocalStorage({
		key: "hasSeenOnboarding",
		defaultValue: false,
	});
	const close = () => setSeen({ value: true });
	// Opening the Editor to watch Hanna edit live (after "Novo conteúdo") must not
	// cover the timeline with the welcome dialog.
	const watchingHanna = Boolean(useSearchParams().get("hannaTask"));
	return (
		<Dialog open={!hasSeen && !watchingHanna} onOpenChange={close}>
			<DialogContent className="sm:max-w-[440px]">
				<DialogTitle className="flex items-center gap-2">
					<Sparkles className="text-primary" />
					AI Edita
				</DialogTitle>
				<DialogBody>
					<div className="space-y-4">
						<h2 className="text-xl font-semibold">
							{pt ? "Seu estúdio. Sua criação." : "Your studio. Your creation."}
						</h2>
						<p className="text-sm text-muted-foreground">
							{pt
								? "Importe seus vídeos e arraste para a timeline. Peça à Hanna cortes, legendas, movimentos e ajustes de música — tudo continua editável."
								: "Import videos and drag them onto the timeline. Ask Hanna for cuts, captions, motion and music adjustments — everything stays editable."}
						</p>
						<p className="text-sm text-muted-foreground">
							{pt
								? "Configure sua chave e permissões uma vez em Configurações → Integrações. A transcrição usa a API da OpenAI; os projetos ficam neste navegador. Guarde cópias dos originais."
								: "Set up your key and permissions once in Settings → Integrations. Transcription uses the OpenAI API; projects stay in this browser. Keep copies of your originals."}
						</p>
						<Button className="w-full" onClick={close}>
							{pt ? "Começar a criar" : "Start creating"}
						</Button>
					</div>
				</DialogBody>
			</DialogContent>
		</Dialog>
	);
}
