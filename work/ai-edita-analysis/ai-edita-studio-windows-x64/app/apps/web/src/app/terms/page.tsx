"use client";
import { BasePage } from "@/app/base-page";
import { useI18n } from "@/i18n";
export default function TermsPage() {
	const { locale } = useI18n();
	const pt = locale === "pt-BR";
	return (
		<BasePage>
			<article className="space-y-6" data-i18n-skip="true">
				<h1 className="text-3xl font-semibold">
					{pt ? "Uso desta instalação" : "Using this installation"}
				</h1>
				<p>
					{pt
						? "AI Edita é um estúdio de edição local. Revise cortes, legendas, efeitos e exportações antes de entregar seu conteúdo. A IA pode errar e a identificação de possíveis respiros não é uma garantia de classificação."
						: "AI Edita is a local editing studio. Review cuts, captions, effects and exports before delivering content. AI can make mistakes; possible-breath detection is not guaranteed classification."}
				</p>
				<p>
					{pt
						? "Use mídias, fontes e trilhas para as quais você tenha autorização. Preserve os arquivos originais e faça backups. O desfazer do editor não substitui um backup permanente."
						: "Use media, fonts and music you are authorized to use. Preserve originals and keep backups. Editor undo is not a permanent backup."}
				</p>
				<p>
					{pt
						? "As integrações são opcionais. Você controla permissões de edição e envio de dados; custos da API pertencem à conta configurada. Cancelar uma tarefa não garante o cancelamento de uma cobrança já iniciada."
						: "Integrations are optional. You control editing and data-sharing permissions; API costs belong to the configured account. Cancelling a job does not guarantee cancellation of charges already incurred."}
				</p>
				<p>
					{pt
						? "Os avisos de licença dos componentes de código aberto são preservados no código distribuído, incluindo o arquivo LICENSE. Esta página descreve o uso da instalação local; uma distribuição pública ou serviço comercial precisa de políticas próprias revisadas para seu contexto."
						: "Open-source component license notices are preserved in distributed source, including LICENSE. This page describes the local installation; public distribution or a commercial service requires policies reviewed for that context."}
				</p>
			</article>
		</BasePage>
	);
}
