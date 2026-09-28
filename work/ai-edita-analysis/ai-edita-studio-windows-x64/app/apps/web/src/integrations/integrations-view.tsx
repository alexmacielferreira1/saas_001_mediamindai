"use client";

import { useEffect, useState } from "react";
import { Plug, Copy, ShieldCheck, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEditor } from "@/editor/use-editor";
import { useI18n } from "@/i18n";
import { AudioPanel } from "./audio-panel";
import { toolDefinitions } from "./catalog";
import { useAssetsPanelStore } from "@/components/editor/panels/assets/assets-panel-store";
import {
	integrationRequest,
	updateIntegrationSettings,
	useIntegrationStore,
	connectionSchema,
} from "./client";
import { workspaceRequest } from "@/operations/client";
import { buildMcpConfig, type McpConfigValue } from "./mcp-config";

export function IntegrationsView() {
	const editor = useEditor();
	const { locale } = useI18n();
	const { connection, settings, health, activity } = useIntegrationStore();
	const [apiKey, setApiKey] = useState("");
	const [model, setModel] = useState(settings.model);
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState("");
	const [client, setClient] = useState<"claude" | "codex">("claude");
	const [showConfig, setShowConfig] = useState(false);
	// The installation token survives tab and server restarts; the session token does not.
	const [shared, setShared] = useState<McpConfigValue | null>(null);
	useEffect(() => {
		if (!connection || shared) return;
		let active = true;
		void workspaceRequest<McpConfigValue>({ action: "mcp_config" })
			.then((value) => {
				if (active) setShared(value);
			})
			.catch(() => {});
		return () => {
			active = false;
		};
	}, [connection, shared]);
	// eslint-disable-next-line opencut/prefer-object-params -- Keep each PT-BR/EN message pair adjacent for translation review.
	const l = (pt: string, en: string) => (locale === "pt-BR" ? pt : en);
	async function run(action: () => Promise<void>) {
		setBusy(true);
		setMessage("");
		try {
			await action();
		} catch (error) {
			setMessage(
				error instanceof Error
					? error.message
					: l("Falha na integração.", "Integration failed."),
			);
		} finally {
			setBusy(false);
		}
	}
	async function connect() {
		const result = connectionSchema.parse(
			await integrationRequest({
				action: "connect",
				projectId: editor.project.getActive().metadata.id,
				sceneId: editor.scenes.getActiveScene().id,
			}),
		);
		const {
			sessionId,
			controlToken,
			mcpToken,
			nodePath,
			scriptPath,
			...newSettings
		} = result;
		useIntegrationStore.setState({
			connection: { sessionId, controlToken, mcpToken, nodePath, scriptPath },
			settings: newSettings,
			health: "",
			answer: "",
		});
		setModel(newSettings.model);
		setShowConfig(false);
	}
	const config = connection
		? buildMcpConfig({
				client,
				value: shared ?? {
					token: connection.mcpToken,
					nodePath: connection.nodePath,
					scriptPath: connection.scriptPath,
				},
				url: typeof window !== "undefined" ? window.location.origin : "",
			})
		: "";

	return (
		<div
			className="h-full overflow-y-auto p-4 space-y-5 text-sm"
			data-i18n-skip="true"
		>
			<div className="flex items-start justify-between gap-2">
				<div>
					<h2 className="flex items-center gap-2 text-lg font-semibold">
						<Plug className="size-5" />
						{l("Integrações", "Integrations")}
					</h2>
					<p className="text-muted-foreground mt-1">
						{l(
							"Edição por IA no projeto aberto",
							"AI editing in the open project",
						)}
					</p>
				</div>
				<span
					className={`rounded-full px-2 py-1 text-xs ${connection && !health ? "bg-green-500/15 text-green-600" : "bg-muted text-muted-foreground"}`}
				>
					{connection && !health
						? l("Conectado", "Connected")
						: l("Desconectado", "Disconnected")}
				</span>
			</div>
			<p className="text-muted-foreground text-xs">
				{l(
					"Funciona em localhost, com esta aba do navegador aberta. Ao recarregar ou reiniciar o servidor, reconecte e atualize o token MCP. Nenhuma integração fica ativa automaticamente.",
					"Works on localhost while this browser tab remains open. After reloading or restarting the server, reconnect and update the MCP token. Integrations never activate automatically.",
				)}
			</p>
			<Button
				className="w-full"
				variant={connection ? "outline" : "default"}
				disabled={busy && !connection}
				onClick={() =>
					void run(async () => {
						if (connection) {
							useIntegrationStore.setState((state) => ({
								settings: {
									...state.settings,
									allowEdits: false,
									shareWithOpenAI: false,
									shareAudioWithOpenAI: false,
									shareFramesWithAgents: false,
								},
							}));
							try {
								await integrationRequest({
									action: "disconnect",
									...connection,
								});
							} finally {
								useIntegrationStore.setState({ connection: null });
							}
						} else await connect();
					})
				}
			>
				{connection
					? l("Desconectar e revogar acesso", "Disconnect and revoke access")
					: l("Conectar este projeto", "Connect this project")}
			</Button>
			{(message || health) && (
				<p role="status" className="rounded-md border p-3 text-xs break-words">
					{message || health}
				</p>
			)}
			<fieldset
				disabled={!connection || busy}
				className="space-y-3 rounded-lg border p-3 disabled:opacity-50"
			>
				<legend className="px-1 font-medium">
					<ShieldCheck className="mr-1 inline size-4" />
					{l("Permissões", "Permissions")}
				</legend>
				<label className="flex items-start gap-2">
					<input
						type="checkbox"
						className="mt-1"
						checked={settings.allowEdits && Boolean(connection)}
						onChange={(event) =>
							void run(() =>
								updateIntegrationSettings({ allowEdits: event.target.checked }),
							)
						}
					/>
					<span>
						{l(
							"Permitir que agentes alterem a timeline",
							"Allow agents to edit the timeline",
						)}
						<small className="text-muted-foreground block">
							{l(
								"Inclui inserir, cortar, mover, excluir clipes e desfazer. Os arquivos originais não são apagados.",
								"Includes inserting, splitting, moving, deleting clips and undoing. Source files are never deleted.",
							)}
						</small>
					</span>
				</label>
				<label className="flex items-start gap-2">
					<input
						type="checkbox"
						className="mt-1"
						checked={settings.shareWithOpenAI && Boolean(connection)}
						onChange={(event) =>
							void run(() =>
								updateIntegrationSettings({
									shareWithOpenAI: event.target.checked,
								}),
							)
						}
					/>
					<span>
						{l(
							"Autorizar envio de contexto à OpenAI",
							"Allow sending context to OpenAI",
						)}
						<small className="text-muted-foreground block">
							{l(
								"Envia seu pedido, nomes, textos, estrutura, transcrições e resultados de análise. O envio do áudio para transcrição exige a permissão separada abaixo. A API tem cobrança separada do ChatGPT. Agentes MCP também podem ler esses resultados.",
								"Sends your request, names, text, structure, transcripts and analysis results. Audio transcription uploads require the separate permission below. API billing is separate from ChatGPT. MCP agents can also read these results.",
							)}
						</small>
					</span>
				</label>
				<label className="flex items-start gap-2">
					<input
						type="checkbox"
						className="mt-1"
						checked={settings.shareAudioWithOpenAI && Boolean(connection)}
						onChange={(event) =>
							void run(() =>
								updateIntegrationSettings({
									shareAudioWithOpenAI: event.target.checked,
								}),
							)
						}
					/>
					<span>
						{l(
							"Autorizar envio de áudio à OpenAI",
							"Allow audio uploads to OpenAI",
						)}
						<small className="text-muted-foreground block">
							{l(
								"A transcrição usa a API OpenAI (whisper-1 na nuvem), inclusive quando solicitada via Claude/Codex MCP. Envia o áudio da faixa selecionada, pode gerar cobrança e não usa modelo local. Cancelar não garante estorno de uma requisição já enviada.",
								"Transcription uses the OpenAI API (cloud whisper-1), including requests from Claude/Codex MCP. Uploads the selected track audio, may incur charges and never uses a local model. Cancelling does not guarantee a refund for an already submitted request.",
							)}
						</small>
					</span>
				</label>
				<label className="flex items-start gap-2">
					<input
						type="checkbox"
						className="mt-1"
						checked={settings.shareFramesWithAgents && Boolean(connection)}
						onChange={(event) =>
							void run(() =>
								updateIntegrationSettings({
									shareFramesWithAgents: event.target.checked,
								}),
							)
						}
					/>
					<span>
						{l(
							"Autorizar imagens do vídeo para os agentes",
							"Allow video frames for agents",
						)}
						<small className="text-muted-foreground block">
							{l(
								"Permite que OpenAI, Claude e Codex recebam quadros renderizados da timeline para analisar enquadramento e conferir legendas/efeitos. Até 3 imagens reduzidas por consulta. Podem conter pessoas e informações privadas. A OpenAI pode cobrar pelo processamento; não envia o vídeo completo.",
								"Allows OpenAI, Claude and Codex to receive rendered timeline frames to inspect framing, captions and effects. Up to 3 downscaled images per request; may contain people and private information. OpenAI processing may incur charges; never sends the complete video.",
							)}
						</small>
					</span>
				</label>
			</fieldset>
			<nav
				className="sticky top-0 z-10 flex flex-wrap gap-1 bg-background py-2"
				aria-label={l("Seções de integrações", "Integration sections")}
			>
				{[
					{ id: "mcp", label: "MCP" },
					{ id: "openai", label: "OpenAI" },
					{ id: "assistant", label: l("Assistente", "Assistant") },
					{ id: "audio", label: l("Áudio", "Audio") },
					{ id: "activity", label: l("Atividade", "Activity") },
				].map(({ id, label }) => (
					<Button
						key={id}
						size="sm"
						variant="secondary"
						onClick={() =>
							document
								.getElementById(`integration-${id}`)
								?.scrollIntoView({ block: "start" })
						}
					>
						{label}
					</Button>
				))}
			</nav>
			<section
				id="integration-mcp"
				className="scroll-mt-14 space-y-3 rounded-lg border p-3"
			>
				<h3 className="font-medium">MCP · Claude / Codex</h3>
				<p className="text-muted-foreground text-xs">
					{l(
						"Copie e adicione esta entrada à configuração MCP do seu agente. Não substitua outras integrações. O token permite ler este projeto e editar somente com a permissão acima.",
						"Copy and add this entry to your agent's MCP configuration. Do not replace other integrations. The token grants read access to this project and editing only with the permission above.",
					)}
				</p>
				<div className="flex gap-2">
					<Button
						size="sm"
						variant={client === "claude" ? "secondary" : "ghost"}
						onClick={() => setClient("claude")}
					>
						Claude
					</Button>
					<Button
						size="sm"
						variant={client === "codex" ? "secondary" : "ghost"}
						onClick={() => setClient("codex")}
					>
						Codex
					</Button>
				</div>
				<p className="text-xs text-muted-foreground">
					{client === "claude"
						? l(
								"Claude Desktop: claude_desktop_config.json. Claude Code: .mcp.json no projeto.",
								"Claude Desktop: claude_desktop_config.json. Claude Code: .mcp.json in the project.",
							)
						: l(
								"Codex: adicione ao arquivo ~/.codex/config.toml e reconecte o MCP.",
								"Codex: add to ~/.codex/config.toml and reconnect MCP.",
							)}
				</p>
				<div className="flex flex-wrap gap-2">
					<Button
						size="sm"
						variant="outline"
						disabled={!connection}
						onClick={() =>
							void run(async () => {
								await navigator.clipboard.writeText(config);
								setMessage(
									l(
										"Configuração copiada. Ela contém um token privado; não publique.",
										"Configuration copied. It contains a private token; do not publish it.",
									),
								);
							})
						}
					>
						<Copy />
						{l("Copiar configuração", "Copy configuration")}
					</Button>
					<Button
						size="sm"
						variant="ghost"
						disabled={!connection}
						onClick={() => setShowConfig(!showConfig)}
					>
						{showConfig
							? l("Ocultar", "Hide")
							: l("Mostrar configuração", "Show configuration")}
					</Button>
				</div>
				{showConfig && (
					<pre
						className="max-h-64 overflow-auto rounded bg-muted p-2 text-[10px]"
						translate="no"
					>
						{config}
					</pre>
				)}
			</section>
			<section
				id="integration-openai"
				className="scroll-mt-24 space-y-3 rounded-lg border p-3"
			>
				<h3 className="font-medium">
					<KeyRound className="mr-1 inline size-4" />
					OpenAI API
				</h3>
				{!connection && (
					<div className="space-y-2 rounded-md bg-muted p-3 text-xs">
						<p>
							{l(
								"Projeto desconectado. Você já pode digitar a chave abaixo: Salvar configuração conecta este projeto em modo somente leitura. Envio de áudio e edições precisam de autorização separada.",
								"Project disconnected. You can enter your key below: Save configuration connects this project in read-only mode. Audio uploads and edits require separate permission.",
							)}
						</p>
						<Button
							className="w-full whitespace-normal h-auto py-2"
							size="sm"
							disabled={busy}
							onClick={() => void run(connect)}
						>
							{l(
								"Conectar para configurar OpenAI",
								"Connect to configure OpenAI",
							)}
						</Button>
					</div>
				)}
				{(message || health) && (
					<p role="status" className="text-xs break-words">
						{message || health}
					</p>
				)}
				<fieldset disabled={busy} className="space-y-3 disabled:opacity-50">
					<label className="block space-y-1">
						<span>{l("Chave da API", "API key")}</span>
						<Input
							type="password"
							autoComplete="off"
							spellCheck={false}
							placeholder="sk-…"
							value={apiKey}
							onChange={(event) => setApiKey(event.target.value)}
						/>
					</label>
					<p className="text-xs text-muted-foreground">
						{connection && settings.hasKey
							? settings.keySource === "environment"
								? l(
										"Chave configurada no ambiente do servidor.",
										"Key configured in the server environment.",
									)
								: l(
										"Chave ativa somente na memória do servidor para esta sessão.",
										"Key active only in server memory for this session.",
									)
							: l("Nenhuma chave configurada.", "No API key configured.")}{" "}
						{l(
							"Não é salva no navegador nem incluída no MCP. Para uso persistente, configure OPENAI_API_KEY no servidor.",
							"Not saved in the browser or included in MCP. For persistent use, configure OPENAI_API_KEY on the server.",
						)}
					</p>
					<label className="block space-y-1">
						<span>{l("Modelo", "Model")}</span>
						<Input
							value={model}
							onChange={(event) => setModel(event.target.value)}
							spellCheck={false}
						/>
					</label>
					<div className="flex flex-wrap gap-2">
						<Button
							size="sm"
							onClick={() =>
								void run(async () => {
									const key = apiKey.trim();
									if (!connection) await connect();
									setApiKey("");
									await updateIntegrationSettings({
										model,
										...(key ? { apiKey: key } : {}),
									});
									setModel(model);
									setMessage(
										l(
											"Configuração salva para esta sessão.",
											"Configuration saved for this session.",
										),
									);
								})
							}
						>
							{l("Salvar configuração", "Save configuration")}
						</Button>
						<Button
							size="sm"
							variant="outline"
							disabled={!connection || !settings.hasKey}
							onClick={() =>
								void run(async () => {
									await integrationRequest({ action: "test", ...connection });
									setMessage(
										l(
											"Chave e acesso ao modelo verificados. Nenhuma geração foi solicitada neste teste.",
											"Key and model access verified. No generation was requested by this test.",
										),
									);
								})
							}
						>
							{l("Testar conexão", "Test connection")}
						</Button>
						{connection && settings.keySource === "session" && (
							<Button
								size="sm"
								variant="ghost"
								onClick={() =>
									void run(() => updateIntegrationSettings({ clearKey: true }))
								}
							>
								{l("Remover chave", "Remove key")}
							</Button>
						)}
					</div>
				</fieldset>
			</section>
			<section
				id="integration-assistant"
				className="ai-studio-card space-y-3 p-4"
			>
				<h3 className="font-semibold">{l("Estúdio IA", "AI Studio")}</h3>
				<p className="text-xs text-muted-foreground">
					{l(
						"Receitas de edição, conversa por projeto, legendas animadas e movimentos editáveis.",
						"Editing recipes, project conversation, animated captions and editable motion.",
					)}
				</p>
				<Button
					className="w-full"
					onClick={() => useAssetsPanelStore.getState().setActiveTab("agent")}
				>
					{l("Abrir Estúdio IA", "Open AI Studio")}
				</Button>
			</section>
			<AudioPanel />
			<section id="integration-activity" className="scroll-mt-14 space-y-2">
				<h3 className="font-medium">
					{l("Atividade da sessão", "Session activity")}
				</h3>
				<p className="text-xs text-muted-foreground">
					{l(
						`${toolDefinitions().length} ferramentas compartilhadas por OpenAI e MCP: visão de quadros, composições completas em legendas, modelos editáveis, cortes, transcrição na nuvem, zooms, keyframes, velocidade, música, efeitos, exportação e histórico.`,
						`${toolDefinitions().length} tools shared by OpenAI and MCP: frame vision, complete caption compositions, editable templates, cuts, cloud transcription, zooms, keyframes, speed, music, effects, export and history.`,
					)}
				</p>
				{activity.length === 0 ? (
					<p className="text-xs text-muted-foreground">
						{l("Nenhum comando executado.", "No commands executed.")}
					</p>
				) : (
					<ol className="space-y-2">
						{activity.map((item) => (
							<li key={item.id} className="rounded border p-2 text-xs">
								<span
									className={item.ok ? "text-green-600" : "text-destructive"}
								>
									{item.ok ? "✓" : "!"}
								</span>{" "}
								{item.time} · {item.source} · <code>{item.tool}</code>
								{item.error && (
									<p className="mt-1 break-words text-destructive">
										{item.error}
									</p>
								)}
							</li>
						))}
					</ol>
				)}
			</section>
		</div>
	);
}
