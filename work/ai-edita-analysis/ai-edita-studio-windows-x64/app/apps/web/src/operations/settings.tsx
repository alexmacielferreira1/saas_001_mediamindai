"use client";
import { useState } from "react";
import { create } from "zustand";
import {
	Copy,
	ExternalLink,
	HelpCircle,
	KeyRound,
	Plug,
	ShieldCheck,
} from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { LanguageToggle } from "@/i18n";
import { useWorkspace, workspaceRequest, statusLabel } from "./client";
import { buildMcpConfig } from "@/integrations/mcp-config";
import type { SharedSettings } from "./types";
import { AppearanceSettingsPanel } from "./appearance-settings";
import "./workspace.css";

export const useSettingsDialog = create<{
	open: boolean;
	show: () => void;
	close: () => void;
}>((set) => ({
	open: false,
	show: () => set({ open: true }),
	close: () => set({ open: false }),
}));
export function SettingsDialog() {
	const { open, close } = useSettingsDialog();
	return (
		<Dialog
			open={open}
			onOpenChange={(value) => {
				if (!value) close();
			}}
		>
			<DialogContent className="operations ops-settings-modal">
				<DialogTitle>Configurações do AI Edita</DialogTitle>
				<DialogDescription>
					Compartilhadas por todos os projetos neste servidor.
				</DialogDescription>
				{open && <SettingsPanel />}
			</DialogContent>
		</Dialog>
	);
}
export function SettingsEntry() {
	return (
		<div className="p-5 space-y-3">
			<h2>Configurações → Integrações</h2>
			<p className="text-sm text-muted-foreground">
				OpenAI e MCP agora são configurados uma vez para todo o AI Edita.
			</p>
			<button
				type="button"
				className="ops-button primary"
				onClick={() => useSettingsDialog.getState().show()}
			>
				Abrir configurações
			</button>
		</div>
	);
}

function InstagramSetupGuide() {
	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					className="ops-help-trigger"
					aria-label="Como preparar a conta do Instagram"
					title="Como preparar a conta do Instagram"
				>
					<HelpCircle size={17} aria-hidden="true" />
				</button>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				sideOffset={10}
				className="operations ops-instagram-guide"
			>
				<div className="ops-guide-header">
					<h3>Conectar com Instagram Login</h3>
					<p>O caminho simples: sem Página do Facebook vinculada.</p>
				</div>
				<ol className="ops-guide-steps">
					<li>
						<h4>Mudar para uma conta profissional</h4>
						<p>No aplicativo do Instagram:</p>
						<ol>
							<li>Abra seu perfil e toque no menu ☰.</li>
							<li>
								Entre em Configurações e atividade → Tipo e ferramentas da
								conta.
							</li>
							<li>Toque em Mudar para conta profissional.</li>
							<li>Escolha Empresa ou Criador e conclua.</li>
						</ol>
						<p className="ops-guide-note">
							As duas opções funcionam com a API. Os nomes dos menus podem
							variar conforme a versão do Instagram.
						</p>
						<div className="ops-guide-links">
							<a
								href="https://www.instagram.com/accounts/edit/"
								target="_blank"
								rel="noreferrer"
							>
								Abrir Instagram
								<ExternalLink size={13} aria-hidden="true" />
							</a>
							<a
								href="https://help.instagram.com/502981923235522/"
								target="_blank"
								rel="noreferrer"
							>
								Ver guia oficial
								<ExternalLink size={13} aria-hidden="true" />
							</a>
						</div>
					</li>
					<li>
						<h4>Criar o App na Meta</h4>
						<ol>
							<li>Abra Meta for Developers → Meus apps.</li>
							<li>Clique em Criar aplicativo.</li>
							<li>
								Escolha o caso de uso da API do Instagram e, se a Meta pedir o
								tipo, selecione Business/Empresa.
							</li>
							<li>
								No painel, abra Instagram e escolha API setup with Instagram
								login.
							</li>
						</ol>
						<div className="ops-guide-links">
							<a
								href="https://developers.facebook.com/apps/"
								target="_blank"
								rel="noreferrer"
							>
								Criar ou abrir App da Meta
								<ExternalLink size={13} aria-hidden="true" />
							</a>
							<a
								href="https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login"
								target="_blank"
								rel="noreferrer"
							>
								Documentação da API
								<ExternalLink size={13} aria-hidden="true" />
							</a>
						</div>
					</li>
					<li>
						<h4>Adicionar a conta de teste e gerar o token</h4>
						<ol>
							<li>
								Na configuração da Instagram API, localize Generate access
								tokens.
							</li>
							<li>Clique em Add account.</li>
							<li>
								Entre na conta profissional do Instagram e autorize o App.
							</li>
							<li>Clique em Generate token e copie o token.</li>
							<li>
								Copie também o Instagram Account ID exibido junto da conta.
							</li>
						</ol>
						<p className="ops-guide-note">
							Permissões necessárias: instagram_business_basic,
							instagram_business_content_publish e
							instagram_business_manage_insights. Guarde o token como senha.
						</p>
					</li>
					<li>
						<h4>Conectar no AI Edita</h4>
						<ol>
							<li>Em Tipo de autorização, mantenha Instagram Login.</li>
							<li>Cole o Instagram Account ID no campo de ID profissional.</li>
							<li>Cole o token e clique em Conectar e validar.</li>
						</ol>
						<p className="ops-guide-note">
							Não use Facebook Login com esse token. Uma Página do Facebook não
							é necessária neste fluxo.
						</p>
					</li>
				</ol>
			</PopoverContent>
		</Popover>
	);
}

const permissions: Array<{
	key: keyof SharedSettings;
	title: string;
	note: string;
}> = [
	{
		key: "autoConnect",
		title: "Conectar o editor automaticamente",
		note: "Usa a configuração global ao abrir qualquer projeto.",
	},
	{
		key: "allowEdits",
		title: "Permitir edições por agentes",
		note: "Autoriza alterações na timeline. Os arquivos originais são preservados.",
	},
	{
		key: "shareWithOpenAI",
		title: "Enviar comandos e contexto para a OpenAI",
		note: "Inclui textos, nomes, transcrições e estrutura do projeto. A API tem cobrança separada do ChatGPT.",
	},
	{
		key: "shareAudioWithOpenAI",
		title: "Transcrição pela API da OpenAI",
		note: "Envia áudio à OpenAI (whisper-1). Não usa transcrição local. Pode gerar cobrança.",
	},
	{
		key: "shareFramesWithAgents",
		title: "Permitir análise visual",
		note: "Envia quadros do vídeo à OpenAI ou ao agente MCP. Podem conter pessoas e informações privadas.",
	},
];

const suggestedOpenAIModels = [
	"gpt-5.4",
	"gpt-5.4-mini",
	"gpt-5.4-nano",
	"gpt-4.1-mini",
	"gpt-4o-mini",
];
type OpenAITestResult = {
	ok: true;
	keyValid: true;
	model: string;
	models: string[];
	modelAvailable: boolean;
	modelError?: string;
};
export function SettingsPanel() {
	const { data, refresh } = useWorkspace();
	const [tab, setTab] = useState("appearance");
	const [draftOverride, setDraft] = useState<SharedSettings | null>(null);
	const draft = draftOverride ?? data?.settings ?? null;
	const [apiKey, setApiKey] = useState("");
	const [availableModels, setAvailableModels] = useState<string[]>([]);
	const [igId, setIgId] = useState("");
	const [igToken, setIgToken] = useState("");
	const [loginType, setLoginType] = useState("instagram");
	const [busy, setBusy] = useState(false);
	const [notice, setNotice] = useState("");
	const [error, setError] = useState("");
	const [config, setConfig] = useState("");
	const [cloudflaredPath, setCloudflaredPath] = useState("");
	async function run(action: () => Promise<void>) {
		if (busy) return;
		setBusy(true);
		setNotice("");
		setError("");
		try {
			await action();
			await refresh();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Falha na configuração.");
		} finally {
			setBusy(false);
		}
	}
	async function save() {
		if (!draft) return;
		const keys: Array<keyof SharedSettings> = [
			"model",
			"allowEdits",
			"shareWithOpenAI",
			"shareAudioWithOpenAI",
			"shareFramesWithAgents",
			"autoConnect",
			"schedulerEnabled",
			"timeZone",
			"dailyLimit",
			"postingSlots",
			"exportFolder",
			"apiVersion",
		];
		const settings = Object.fromEntries(keys.map((key) => [key, draft[key]]));
		const saved = await workspaceRequest<SharedSettings>({
			action: "settings",
			settings: {
				...settings,
				...(apiKey ? { apiKey } : {}),
				...(cloudflaredPath ? { cloudflaredPath } : {}),
			},
		});
		setApiKey("");
		setCloudflaredPath("");
		setDraft(saved);
		setNotice("Configuração salva para todos os projetos.");
	}
	async function copyMcp(client: "claude" | "codex") {
		const value = await workspaceRequest<{
			token: string;
			nodePath: string;
			scriptPath: string;
		}>({ action: "mcp_config" });
		const text = buildMcpConfig({
			client,
			value,
			url: window.location.origin,
		});
		try {
			await navigator.clipboard.writeText(text);
			setNotice("Configuração copiada. Contém um token privado: não publique.");
		} catch {
			setConfig(text);
			setNotice("Copie a configuração abaixo. Ela contém um token privado.");
		}
	}
	async function saveAppearance() {
		if (!draft) return;
		const saved = await workspaceRequest<SharedSettings>({
			action: "settings",
			settings: { appearance: draft.appearance },
		});
		setDraft(saved);
		setNotice("A aparência foi salva para todos os projetos.");
	}
	async function updateBrandAsset({
		kind,
		file,
	}: {
		kind: "logoLight" | "logoDark" | "appIcon";
		file: File | null;
	}) {
		if (file && file.size > 2 * 1024 * 1024)
			throw new Error("A imagem deve ter no máximo 2 MB.");
		const response = await fetch(
			`/api/workspace/branding?kind=${encodeURIComponent(kind)}`,
			{
				method: file ? "POST" : "DELETE",
				headers: {
					"x-opencut-client": "integrations",
					...(file ? { "Content-Type": file.type } : {}),
				},
				...(file ? { body: file } : {}),
			},
		);
		if (!response.ok) throw new Error("Falha ao atualizar a marca.");
		await response.json();
		await refresh();
		const current = useWorkspace.getState().data?.settings;
		if (current) setDraft(current);
		setNotice(
			file ? "Imagem atualizada para todos os projetos." : "Imagem removida.",
		);
	}
	const modelOptions = [
		...new Set([draft?.model, ...availableModels, ...suggestedOpenAIModels]),
	]
		.filter((model): model is string => Boolean(model))
		.sort((left, right) => left.localeCompare(right));
	if (!data || !draft)
		return (
			<div className="ops-card" role="status">
				Carregando configurações…
			</div>
		);
	return (
		<div className="operations">
			<div
				className="ops-tabs"
				role="tablist"
				aria-label="Seções de configurações"
			>
				{[
					["appearance", "Aparência"],
					["integrations", "Integrações"],
					["instagram", "Instagram"],
					["publishing", "Publicação"],
					["general", "Geral"],
				].map(([id, label]) => (
					<button
						type="button"
						role="tab"
						aria-selected={tab === id}
						key={id}
						onClick={() => {
							setTab(id);
							setError("");
							setNotice("");
						}}
						className={tab === id ? "active" : ""}
					>
						{label}
					</button>
				))}
			</div>
			{error && (
				<div className="ops-alert" role="alert">
					{error}
				</div>
			)}
			{notice && (
				<div className="ops-success" role="status">
					{notice}
				</div>
			)}
			{tab === "appearance" && (
				<AppearanceSettingsPanel
					value={draft.appearance}
					busy={busy}
					onChange={(appearance) => setDraft({ ...draft, appearance })}
					onSave={() => void run(saveAppearance)}
					onAsset={(change) => void run(() => updateBrandAsset(change))}
				/>
			)}
			{tab === "integrations" && (
				<div className="ops-grid two">
					<section className="ops-card">
						<h2 className="ops-row">
							<KeyRound size={20} /> OpenAI
						</h2>
						<p>Uma chave para a Hanna, o editor e a transcrição.</p>
						<div className="ops-badge">
							{data.settings.hasOpenAIKey
								? "Chave configurada no servidor"
								: "Nenhuma chave configurada"}
						</div>
						<form
							onSubmit={(e) => {
								e.preventDefault();
								void run(save);
							}}
						>
							<label className="ops-field" style={{ marginTop: 20 }}>
								Chave da API
								<input
									type="password"
									autoComplete="new-password"
									aria-label="Chave da API OpenAI"
									placeholder={
										data.settings.hasOpenAIKey
											? "Deixe vazio para manter a chave atual"
											: "sk-…"
									}
									value={apiKey}
									onChange={(e) => setApiKey(e.target.value)}
								/>
								<small>
									A chave não fica no navegador e não é incluída na configuração
									MCP.
								</small>
							</label>
							<label className="ops-field">
								Modelo
								<select
									aria-label="Modelo OpenAI"
									value={draft.model}
									onChange={(e) =>
										setDraft({ ...draft, model: e.target.value })
									}
								>
									{modelOptions.map((model) => (
										<option key={model} value={model}>
											{model}
										</option>
									))}
								</select>
								<small>
									Teste a chave para carregar os modelos liberados para esta
									conta.
								</small>
							</label>
							<div className="ops-row wrap">
								<button className="ops-button primary" disabled={busy}>
									Salvar configuração
								</button>
								<button
									className="ops-button"
									type="button"
									disabled={busy || !data.settings.hasOpenAIKey}
									onClick={() =>
										void run(async () => {
											const result = await workspaceRequest<OpenAITestResult>({
												action: "test_openai",
												model: draft.model,
											});
											setAvailableModels(result.models);
											if (result.modelAvailable) {
												setNotice(
													"Chave validada e modelo disponível. Nenhum vídeo foi enviado.",
												);
											} else {
												setNotice(
													"Chave validada. Selecione um modelo liberado e salve a configuração.",
												);
												setError(
													result.modelError ??
														"O modelo selecionado não está disponível para esta chave.",
												);
											}
										})
									}
								>
									Testar chave e modelo
								</button>
							</div>
							{data.settings.keySource === "shared" && (
								<button
									className="ops-button small danger"
									style={{ marginTop: 14 }}
									disabled={busy}
									type="button"
									onClick={() =>
										void run(async () => {
											const saved = await workspaceRequest<SharedSettings>({
												action: "settings",
												settings: {
													clearKey: true,
													shareWithOpenAI: false,
													shareAudioWithOpenAI: false,
												},
											});
											setDraft(saved);
											setNotice("Chave removida do cofre local.");
										})
									}
								>
									Remover chave salva
								</button>
							)}
						</form>
					</section>
					<section className="ops-card">
						<h2 className="ops-row">
							<Plug size={20} /> Claude e Codex · MCP
						</h2>
						<p>
							Conexão permanente com os editores abertos. O token não muda ao
							recarregar o navegador.
						</p>
						<div className="ops-row wrap">
							<button
								className="ops-button"
								disabled={busy}
								onClick={() => void run(() => copyMcp("claude"))}
							>
								<Copy size={14} /> Claude
							</button>
							<button
								className="ops-button"
								disabled={busy}
								onClick={() => void run(() => copyMcp("codex"))}
							>
								<Copy size={14} /> Codex
							</button>
						</div>
						<p style={{ marginTop: 20 }}>
							Adicione a entrada à configuração MCP do agente, sem substituir
							outras conexões. Abra o projeto e ative a conexão automática nas
							permissões abaixo.
						</p>
						<p>
							Com vários editores abertos, defina OPENCUT_PROJECT_ID na
							configuração MCP. A Hanna não escolhe um projeto aleatório.
						</p>
						{config && (
							<>
								<pre className="ops-pre" data-i18n-skip="true">
									{config}
								</pre>
								<button
									className="ops-button small"
									onClick={() => setConfig("")}
								>
									Ocultar token
								</button>
							</>
						)}
					</section>
					<section className="ops-card" style={{ gridColumn: "1 / -1" }}>
						<h2 className="ops-row">
							<ShieldCheck size={20} /> Permissões compartilhadas
						</h2>
						<p>
							Valem para todo este servidor. Você pode revogar o acesso a
							qualquer momento.
						</p>
						{permissions.map((permission) => (
							<label className="ops-check" key={permission.key}>
								<input
									type="checkbox"
									checked={Boolean(draft[permission.key])}
									onChange={(e) =>
										setDraft({ ...draft, [permission.key]: e.target.checked })
									}
								/>
								<span>
									{permission.title}
									<small>{permission.note}</small>
								</span>
							</label>
						))}
						<button
							className="ops-button primary"
							disabled={busy}
							onClick={() => void run(save)}
						>
							Salvar permissões
						</button>
					</section>
				</div>
			)}
			{tab === "instagram" && (
				<div className="ops-grid two">
					<section className="ops-card">
						<h2>Seus Instagrams</h2>
						<p>
							Conexões independentes. Cada publicação tem uma conta de destino
							explícita.
						</p>
						<div className="ops-list">
							{!data.accounts.length && (
								<p className="ops-muted">Nenhuma conta conectada.</p>
							)}
							{data.accounts.map((account) => (
								<div className="ops-item" key={account.id}>
									<div className="ops-row between">
										<strong>@{account.username}</strong>
										<span className={"ops-badge " + account.status}>
											{statusLabel[account.status]}
										</span>
									</div>
									<p>
										ID {account.igUserId} ·{" "}
										{account.loginType === "instagram"
											? "Instagram Login"
											: "Facebook Login"}
									</p>
									{account.error && <p role="alert">{account.error}</p>}
									<button
										className="ops-button small"
										disabled={busy}
										onClick={() =>
											void run(async () => {
												await workspaceRequest({
													action: "verify_account",
													accountId: account.id,
												});
												setNotice("Conta validada pela API oficial.");
											})
										}
									>
										Validar conexão
									</button>
								</div>
							))}
						</div>
					</section>
					<section className="ops-card">
						<h2 className="ops-row">
							Adicionar ou atualizar conta
							<InstagramSetupGuide />
						</h2>
						<p>
							Use uma conta profissional e um token com permissões de publicação
							e insights. A conexão atual é por credenciais da API oficial, não
							por senha do Instagram.
						</p>
						<form
							onSubmit={(e) => {
								e.preventDefault();
								void run(async () => {
									try {
										await workspaceRequest({
											action: "account",
											account: {
												igUserId: igId,
												accessToken: igToken,
												loginType,
											},
										});
										setIgId("");
										setNotice("Instagram conectado e validado.");
									} finally {
										setIgToken("");
										await refresh();
									}
								});
							}}
						>
							<label className="ops-field">
								Tipo de autorização
								<select
									value={loginType}
									onChange={(e) => setLoginType(e.target.value)}
								>
									<option value="instagram">Instagram Login</option>
									<option value="facebook">Facebook Login</option>
								</select>
							</label>
							<label className="ops-field">
								ID profissional do Instagram
								<input
									required
									inputMode="numeric"
									pattern="[0-9]+"
									value={igId}
									onChange={(e) => setIgId(e.target.value)}
								/>
							</label>
							<label className="ops-field">
								Token de acesso
								<input
									required
									type="password"
									autoComplete="new-password"
									value={igToken}
									onChange={(e) => setIgToken(e.target.value)}
								/>
							</label>
							<button className="ops-button primary" disabled={busy}>
								Conectar e validar
							</button>
						</form>
					</section>
				</div>
			)}
			{tab === "publishing" && (
				<section className="ops-card">
					<h2>Agenda e publicação automática</h2>
					<p>
						Os horários são gravados no servidor. Depois da sua confirmação, o
						agendador envia o vídeo na hora marcada.
					</p>
					<label className="ops-check">
						<input
							type="checkbox"
							checked={draft.schedulerEnabled}
							onChange={(e) =>
								setDraft({ ...draft, schedulerEnabled: e.target.checked })
							}
						/>
						<span>Ativar agendador</span>
					</label>
					<div className="ops-grid two">
						<label className="ops-field">
							Fuso horário
							<input
								value={draft.timeZone}
								onChange={(e) =>
									setDraft({ ...draft, timeZone: e.target.value })
								}
							/>
						</label>
						<label className="ops-field">
							Limite diário por conta
							<input
								type="number"
								min="1"
								max="25"
								value={draft.dailyLimit}
								onChange={(e) =>
									setDraft({ ...draft, dailyLimit: Number(e.target.value) })
								}
							/>
						</label>
						<label className="ops-field">
							Horários preferidos (separados por vírgula)
							<input
								value={draft.postingSlots.join(", ")}
								onChange={(e) =>
									setDraft({
										...draft,
										postingSlots: e.target.value
											.split(",")
											.map((s) => s.trim()),
									})
								}
							/>
						</label>
						<label className="ops-field">
							Versão da API Meta
							<input
								value={draft.apiVersion}
								onChange={(e) =>
									setDraft({ ...draft, apiVersion: e.target.value })
								}
							/>
						</label>
					</div>
					<div className="ops-alert">
						Contas conectadas por Instagram Login usam um link HTTPS temporário
						para a Meta buscar somente o vídeo confirmado. O pacote portátil
						abre e valida novas rotas automaticamente quando a conexão oscila; o
						cliente não precisa configurar nada. Contas compatíveis com envio
						resumível enviam o MP4 diretamente à Meta.{" "}
						{data.settings.hasMediaHost
							? "Componente de publicação encontrado."
							: "Componente não encontrado; a publicação por Instagram Login ficará indisponível."}
					</div>
					<label className="ops-field">
						Substituir o Cloudflared incluído (opcional)
						<input
							placeholder="C:\caminho\cloudflared.exe"
							value={cloudflaredPath}
							onChange={(e) => setCloudflaredPath(e.target.value)}
						/>
						<small>
							Deixe vazio para usar o componente oficial incluído no pacote.
						</small>
					</label>
					<button
						className="ops-button primary"
						disabled={busy}
						onClick={() => void run(save)}
					>
						Salvar publicação
					</button>
				</section>
			)}
			{tab === "general" && (
				<div className="ops-grid two">
					<section className="ops-card">
						<h2>Preferências</h2>
						<p>O editor atual continua sendo o motor de vídeo do AI Edita.</p>
						<div className="ops-row between">
							<span>Idioma</span>
							<LanguageToggle />
						</div>
						<p style={{ marginTop: 20 }}>
							Projetos, tarefas, contas, mídias e agenda ficam no armazenamento
							local compartilhado deste computador. Faça backup da pasta de
							dados antes de trocar de máquina ou reinstalar o sistema.
						</p>
					</section>
					<section className="ops-card">
						<h2>Aproveitar o AI Edita anterior</h2>
						<p>
							Importa as credenciais e preferências compatíveis sem alterar o
							outro sistema. Não copia a fila antiga, para evitar publicações
							duplicadas.
						</p>
						<button
							className="ops-button"
							disabled={busy}
							onClick={() =>
								void run(async () => {
									const saved = await workspaceRequest<SharedSettings>({
										action: "import_legacy",
									});
									setDraft(saved);
									setNotice(
										"Configuração anterior importada. Valide o Instagram antes de agendar.",
									);
								})
							}
						>
							{data.settings.legacyImported
								? "Atualizar importação"
								: "Importar configuração anterior"}
						</button>
					</section>
				</div>
			)}
		</div>
	);
}
