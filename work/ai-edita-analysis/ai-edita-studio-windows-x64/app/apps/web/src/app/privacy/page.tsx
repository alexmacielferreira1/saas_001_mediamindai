"use client";
import { BasePage } from "@/app/base-page";
import { useI18n } from "@/i18n";
export default function PrivacyPage() {
	const { locale } = useI18n();
	const pt = locale === "pt-BR";
	return (
		<BasePage>
			<article className="space-y-6" data-i18n-skip="true">
				<h1 className="text-3xl font-semibold">
					{pt ? "Privacidade e dados" : "Privacy and data"}
				</h1>
				<p>
					{pt
						? "Esta instalação do AI Edita é local. Projetos e mídias importadas ficam no armazenamento deste navegador. Limpar dados do site ou mudar de navegador/endereço pode impedir o acesso a eles. Mantenha cópias dos originais."
						: "This AI Edita installation is local. Projects and imported media stay in this browser's storage. Clearing site data or changing browser/address may make them inaccessible. Keep original-file backups."}
				</p>
				<p>
					{pt
						? "O chat com OpenAI envia o pedido, o contexto autorizado do projeto e as últimas mensagens da conversa. A transcrição envia áudio à API da OpenAI somente com a permissão específica em Integrações. Não há transcrição local automática. O processamento externo segue as condições do provedor e pode gerar cobrança."
						: "OpenAI chat sends your request, authorized project context and recent conversation. Transcription uploads audio to OpenAI only with its separate permission in Integrations. There is no automatic local transcription. External processing follows the provider's terms and may incur charges."}
				</p>
				<p>
					{pt
						? "Chaves inseridas na interface ficam na memória do servidor durante a sessão; não são gravadas no histórico nem na configuração MCP. O servidor também pode usar uma chave de ambiente configurada pelo responsável pela instalação."
						: "Keys entered in the interface stay in server memory for the session, not in conversation history or MCP configuration. The server can also use an environment key configured by the installation owner."}
				</p>
				<p>
					{pt
						? "O histórico do Estúdio IA é salvo localmente por projeto e cena. Use Limpar para removê-lo. Agentes MCP podem ler o projeto conectado e seus resultados; autorize apenas clientes de confiança. Desconectar revoga o token da sessão."
						: "AI Studio history is saved locally per project and scene. Use Clear to remove it. MCP agents can read the connected project and results; authorize only trusted clients. Disconnecting revokes the session token."}
				</p>
				<p>
					{pt
						? "Esta interface não carrega analytics promocional. Recursos externos opcionais, como bibliotecas de sons ou imagens, podem consultar seus respectivos serviços."
						: "This interface does not load promotional analytics. Optional external resources, such as sound or image libraries, may contact their respective services."}
				</p>
			</article>
		</BasePage>
	);
}
