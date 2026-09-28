"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
	Sparkles,
	Plus,
	ArrowUp,
	Paperclip,
	ListChecks,
	ArrowUpRight,
	CalendarDays,
	Play,
	RefreshCw,
} from "lucide-react";
import { OperationsShell, EmptyPanel } from "./shell";
import {
	useWorkspace,
	workspaceRequest,
	uploadAsset,
	assetUrl,
	statusLabel,
} from "./client";
import { ContentIntakeButton } from "./content-intake";
import { HannaWorkerFrame, useHannaQueueRunner } from "./queue-runner";
import type {
	HannaThread,
	InstagramInsights,
	PublicationProposal,
} from "./types";

function formatDate({
	value,
	timeZone = "America/Sao_Paulo",
}: {
	value: string;
	timeZone?: string;
}) {
	return new Intl.DateTimeFormat("pt-BR", {
		timeZone,
		dateStyle: "short",
		timeStyle: "short",
	}).format(new Date(value));
}
function VideoPreview({ id }: { id: string }) {
	// eslint-disable-next-line jsx-a11y/media-has-caption -- User-generated exports may have burned-in captions; a nonexistent subtitle track must not be fabricated.
	return <video controls preload="metadata" src={assetUrl(id)} />;
}
function Metric({
	label,
	value,
	note,
}: {
	label: string;
	value: number | string | null | undefined;
	note: string;
}) {
	return (
		<div className="ops-card ops-metric">
			<span>{label}</span>
			<strong>
				{typeof value === "number"
					? value.toLocaleString("pt-BR")
					: (value ?? "—")}
			</strong>
			<small>{note}</small>
		</div>
	);
}
export function OverviewPage() {
	const { data, accountId } = useWorkspace();
	const account = data?.accounts.find((a) => a.id === accountId);
	return (
		<OperationsShell>
			<section className="ops-hero">
				<div className="ops-hero-copy">
					<span className="ops-badge">
						<span className="ops-dot" />
						{account?.status === "connected"
							? "INSTAGRAM CONECTADO À API OFICIAL"
							: "SEU CONTEÚDO, DO BRUTO À PUBLICAÇÃO"}
					</span>
					<h2>
						Você grava.
						<br />A Hanna entra em cena.
					</h2>
					<p>
						Um só espaço para conversar, editar e publicar. Seu editor de
						sempre, com uma nova operação de conteúdo ao redor.
					</p>
					<div className="ops-row wrap">
						<ContentIntakeButton label="Enviar vídeos" />
						<Link href="/projects" className="ops-button">
							Abrir editor <ArrowUpRight size={15} />
						</Link>
					</div>
				</div>
				<div className="ops-orbit" aria-hidden="true">
					<div className="ops-orbit-ring" />
					<div className="ops-orbit-core">
						<Sparkles size={32} />
					</div>
					{[
						["01", "Seus vídeos"],
						["02", "Hanna edita"],
						["03", "Sua revisão"],
						["04", "Instagram"],
					].map(([n, title]) => (
						<div key={n} className="ops-orbit-label">
							<small>{n}</small>
							{title}
						</div>
					))}
				</div>
			</section>
			<div className="ops-grid four" style={{ marginBottom: 30 }}>
				<Metric
					label="Vídeos enviados à Hanna"
					value={data?.assets.filter((a) => a.kind === "source").length}
					note="disponíveis para a Hanna"
				/>
				<Metric
					label="Projetos no editor"
					value={data?.editorProjectCount}
					note="salvos neste computador"
				/>
				<Metric
					label="Agendados"
					value={
						data?.publications.filter((p) => p.status === "scheduled").length
					}
					note="todas as contas"
				/>
				<Metric
					label="Publicados"
					value={
						data?.publications.filter((p) => p.status === "published").length
					}
					note="confirmados pelo Instagram"
				/>
			</div>
			<div className="ops-row between" style={{ marginBottom: 16 }}>
				<div>
					<div className="ops-overline">AGORA</div>
					<h2 className="ops-section-title">Esteira de produção</h2>
				</div>
				<Link href="/conteudos" className="ops-badge">
					Ver conteúdos →
				</Link>
			</div>
			<div className="ops-grid four">
				{[
					["queued", "Entrada"],
					["editing", "Edição"],
					["review", "Prontos"],
					["distribution", "Distribuição"],
				].map(([state, title]) => (
					<section key={state} className="ops-card">
						<div className="ops-row between">
							<h3>{title}</h3>
							<span className="ops-muted">
								{state === "distribution"
									? data?.publications.filter(
											(p) => !["failed", "cancelled"].includes(p.status),
										).length || 0
									: data?.tasks.filter((t) => t.status === state).length || 0}
							</span>
						</div>
						<div className="ops-list" style={{ marginTop: 18 }}>
							{state === "distribution"
								? data?.publications
										.slice(-4)
										.reverse()
										.map((p) => (
											<div className="ops-item" key={p.id}>
												<strong>
													@
													{
														data.accounts.find((a) => a.id === p.accountId)
															?.username
													}
												</strong>
												<p>
													{statusLabel[p.status]} ·{" "}
													{formatDate({
														value: p.publishAt,
														timeZone: data.settings.timeZone,
													})}
												</p>
											</div>
										))
								: data?.tasks
										.filter((t) => t.status === state)
										.slice(-4)
										.map((t) => (
											<div className="ops-item" key={t.id}>
												<strong>{t.title}</strong>
												<p>{t.message || statusLabel[t.status]}</p>
												{t.projectId && (
													<Link
														className="ops-badge"
														href={"/editor/" + t.projectId}
													>
														Abrir projeto
													</Link>
												)}
											</div>
										))}
							{(state === "distribution"
								? !data?.publications.length
								: !data?.tasks.some((t) => t.status === state)) && (
								<p className="ops-muted" style={{ padding: "24px 0" }}>
									Nenhum conteúdo aqui.
								</p>
							)}
						</div>
					</section>
				))}
			</div>
		</OperationsShell>
	);
}
export function ProposalCard({ proposal }: { proposal: PublicationProposal }) {
	const { data, refresh } = useWorkspace();
	const [approved, setApproved] = useState(false),
		[busy, setBusy] = useState(false),
		[error, setError] = useState("");
	if (!data) return null;
	const requiresTunnel = proposal.items.some(
		(item) =>
			data.accounts.find((account) => account.id === item.accountId)
				?.loginType === "instagram",
	);
	return (
		<section className="ops-card" style={{ marginBottom: 16 }}>
			<h3>Conferir plano de publicação</h3>
			<div className="ops-list" style={{ marginTop: 12 }}>
				{proposal.items.map((item, i) => (
					<div className="ops-item" key={i}>
						<strong>
							@{data.accounts.find((a) => a.id === item.accountId)?.username} ·{" "}
							{formatDate({
								value: item.publishAt,
								timeZone: data.settings.timeZone,
							})}
						</strong>
						<p>{data.assets.find((a) => a.id === item.assetId)?.name}</p>
						<p data-i18n-skip="true">
							{item.caption || "Sem legenda de publicação"}
						</p>
						<a
							className="ops-badge"
							href={assetUrl(item.assetId)}
							target="_blank"
							rel="noreferrer"
						>
							Ver vídeo final
						</a>
						{proposal.preflight?.items[i] && (
							<div className="ops-muted" style={{ marginTop: 12 }}>
								<strong>Pré-voo aprovado</strong>
								<ul>
									{proposal.preflight.items[i].checks.map((check) => (
										<li key={check}>{check}</li>
									))}
								</ul>
							</div>
						)}
					</div>
				))}
			</div>
			<label className="ops-check">
				<input
					type="checkbox"
					checked={approved}
					onChange={(e) => setApproved(e.target.checked)}
				/>
				<span>
					Conferi vídeos, contas e horários.
					<small>
						Autorizo o envio do arquivo à Meta e a publicação no horário
						indicado. Fuso: {data.settings.timeZone}.
					</small>
				</span>
			</label>
			{error && (
				<div className="ops-alert" role="alert">
					{error}
				</div>
			)}
			<button
				className="ops-button primary"
				disabled={
					!approved || busy || (requiresTunnel && !data.settings.hasMediaHost)
				}
				onClick={() => {
					setBusy(true);
					setError("");
					void workspaceRequest({
						action: "confirm_publication",
						proposalId: proposal.id,
						confirmMediaTransfer: true,
					})
						.then(refresh)
						.catch((e) => setError(e.message))
						.finally(() => setBusy(false));
				}}
			>
				{busy ? "Validando novamente…" : "Confirmar agendamento"}
			</button>
			{requiresTunnel && !data.settings.hasMediaHost && (
				<p className="ops-muted">
					Esta conta usa Instagram Login e exige uma URL HTTPS pública para o
					vídeo. Configure o componente de publicação em Configurações.
				</p>
			)}
		</section>
	);
}
export function HannaPage() {
	const { data, refresh, accountId } = useWorkspace();
	const searchParams = useSearchParams();
	const [threadId, setThreadId] = useState(""),
		[draft, setDraft] = useState(""),
		[selected, setSelected] = useState<string[]>([]);
	const [busy, setBusy] = useState(false),
		[uploading, setUploading] = useState(false),
		[error, setError] = useState("");
	const input = useRef<HTMLInputElement>(null),
		messagesEnd = useRef<HTMLDivElement>(null);
	const thread = data?.threads.find((t) => t.id === threadId);
	const requestedTaskId = searchParams.get("task") || "";
	const { workerId } = useHannaQueueRunner({ requestedTaskId, onError: setError });
	useEffect(() => {
		messagesEnd.current?.scrollIntoView({ block: "end", behavior: "smooth" });
	}, [thread?.messages.length]);
	async function newConversation() {
		const created = await workspaceRequest<HannaThread>({
			action: "new_thread",
		});
		setThreadId(created.id);
		await refresh();
		return created.id;
	}
	async function send() {
		if (!draft.trim() || busy || uploading) return;
		setBusy(true);
		setError("");
		try {
			const id = threadId || (await newConversation());
			const prompt =
				draft.trim() +
				(selected.length
					? "\n\nVídeos selecionados (IDs): " + selected.join(", ")
					: "") +
				(accountId
					? "\nConta selecionada no painel (contexto, não autorização para publicar): " +
						accountId
					: "");
			setDraft("");
			setSelected([]);
			await workspaceRequest({ action: "hanna", threadId: id, prompt });
			await refresh();
		} catch (e) {
			setError(
				e instanceof Error ? e.message : "A solicitação não foi concluída.",
			);
			await refresh();
		} finally {
			setBusy(false);
		}
	}
	return (
		<OperationsShell>
			{requestedTaskId && (
				<div className="ops-intake-started" role="status">
					<Sparkles size={17} />
					<div>
						<strong>A Hanna iniciou sua edição.</strong>
						<span>
							Mantenha esta tela aberta enquanto ela importa, edita e cria a
							prévia para revisão.
						</span>
					</div>
				</div>
			)}
			<div className="hanna-layout">
				<aside className="hanna-history">
					<button
						className="ops-button"
						disabled={busy}
						onClick={() =>
							void newConversation().catch((e) => setError(e.message))
						}
					>
						<Plus size={15} /> Nova conversa
					</button>
					<div className="ops-overline" style={{ margin: "20px 0 6px" }}>
						RECENTES
					</div>
					{data?.threads.map((t) => (
						<button
							title={t.title}
							className={"thread " + (t.id === threadId ? "active" : "")}
							key={t.id}
							onClick={() => setThreadId(t.id)}
						>
							{t.title}
						</button>
					))}
				</aside>
				<section className="hanna-center">
					<div className="hanna-mobile-history">
						<select
							aria-label="Histórico de conversas"
							value={threadId}
							onChange={(e) => setThreadId(e.target.value)}
						>
							<option value="">Nova conversa</option>
							{data?.threads.map((t) => (
								<option key={t.id} value={t.id}>
									{t.title}
								</option>
							))}
						</select>
						<button
							className="ops-button small"
							disabled={busy}
							aria-label="Nova conversa"
							onClick={() =>
								void newConversation().catch((e) => setError(e.message))
							}
						>
							<Plus size={16} />
						</button>
					</div>
					<div
						className="hanna-messages"
						role="log"
						aria-label="Conversa com a Hanna"
					>
						{!thread?.messages.length && (
							<div className="hanna-welcome">
								<div className="hanna-symbol">
									<Sparkles size={30} />
								</div>
								<h2>O que vamos criar hoje?</h2>
								<p>
									Sou a Hanna. Envie seus vídeos, me conte a direção e acompanhe
									cada etapa por aqui.
								</p>
								<div className="hanna-prompts">
									{[
										[
											"Editar meus vídeos",
											"Edite os vídeos selecionados: entenda a fala, preserve o contexto, remova pausas excessivas e crie legendas legíveis com destaques pontuais. Evite cortes e títulos genéricos.",
										],
										[
											"Planejar publicações",
											"Mostre os vídeos finais disponíveis e me ajude a planejar as próximas publicações.",
										],
										[
											"Entender meu Instagram",
											"Consulte os insights da conta selecionada e explique o que os dados realmente mostram.",
										],
										[
											"Revisar a produção",
											"Como está a produção? Mostre o que está pendente, em edição e pronto para revisão.",
										],
									].map(([label, prompt]) => (
										<button key={label} onClick={() => setDraft(prompt)}>
											{label} <span style={{ color: "#b9f43c" }}>↗</span>
										</button>
									))}
								</div>
							</div>
						)}
						{thread?.messages.map((m) => (
							<div
								key={m.id}
								data-i18n-skip="true"
								className={"hanna-message " + m.role}
							>
								{m.text}
							</div>
						))}
						{(busy || thread?.busy) && (
							<div className="hanna-message assistant" role="status">
								Trabalhando na sua solicitação… As tarefas aparecem no painel ao
								lado.
							</div>
						)}
						<div ref={messagesEnd} />
					</div>
					{error && (
						<div className="ops-alert" role="alert">
							{error}
						</div>
					)}
					{!data?.settings.hasOpenAIKey && (
						<div className="ops-alert">
							Configure a OpenAI em{" "}
							<Link href="/configuracoes">Configurações → Integrações</Link>{" "}
							para conversar com a Hanna.
						</div>
					)}
					<div className="hanna-composer">
						<div className="ops-chips">
							{selected.map((id) => (
								<button
									key={id}
									onClick={() =>
										setSelected(selected.filter((value) => value !== id))
									}
								>
									{data?.assets.find((a) => a.id === id)?.name || id} ×
								</button>
							))}
						</div>
						<textarea
							aria-label="Mensagem para a Hanna"
							placeholder="Peça à Hanna para editar, organizar ou agendar…"
							value={draft}
							onChange={(e) => setDraft(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter" && !e.shiftKey) {
									e.preventDefault();
									void send();
								}
							}}
						/>
						<div className="hanna-composer-foot">
							<button
								className="ops-button small"
								disabled={uploading}
								onClick={() => input.current?.click()}
							>
								<Paperclip size={15} />
								{uploading ? "Enviando…" : "Adicionar vídeos"}
							</button>
							<button
								className="ops-button primary"
								aria-label="Enviar mensagem"
								disabled={busy || uploading || !draft.trim()}
								onClick={() => void send()}
							>
								<ArrowUp size={18} />
							</button>
						</div>
						<input
							ref={input}
							hidden
							type="file"
							accept="video/mp4,video/webm,video/quicktime"
							multiple
							onChange={(e) => {
								const files = Array.from(e.target.files || []);
								e.target.value = "";
								setUploading(true);
								setError("");
								void (async () => {
									for (const file of files) {
										const asset = await uploadAsset({ file, kind: "source" });
										setSelected((current) => [...current, asset.id]);
									}
								})()
									.catch((e) => setError(e.message))
									.finally(() => setUploading(false));
							}}
						/>
					</div>
					<p className="hanna-disclosure">
						A Hanna pode errar. Revise os vídeos antes de publicar. Edição e
						renderização exigem esta página aberta.
					</p>
				</section>
				<aside className="hanna-tasks">
					<h2>
						<ListChecks size={17} /> Área de trabalho
					</h2>
					{workerId && (
						<HannaWorkerFrame
							taskId={workerId}
							style={{
								width: "100%",
								height: 200,
								border: "1px solid #263028",
								borderRadius: 12,
								marginBottom: 12,
							}}
						/>
					)}
					{!data?.tasks.length && (
						<p className="ops-muted">
							As edições aparecem aqui, com projeto editável e prévia.
						</p>
					)}
					{data?.tasks
						.slice(-12)
						.reverse()
						.map((task) => {
							return (
								<div className="ops-item" key={task.id}>
									<span className={"ops-badge " + task.status}>
										{statusLabel[task.status]}
									</span>
									<p>
										<strong>{task.title}</strong>
									</p>
									<p>{task.message}</p>
									{task.exportAssetId && (
										<VideoPreview id={task.exportAssetId} />
									)}
									{task.projectId && task.status !== "editing" && (
										<Link
											href={"/editor/" + task.projectId}
											className="ops-button small"
										>
											<Play size={12} /> Abrir editor
										</Link>
									)}
									{task.exportAssetId && (
										<a
											className="ops-button small"
											href={assetUrl(task.exportAssetId)}
											download={task.title + ".mp4"}
										>
											Baixar prévia
										</a>
									)}
									{["queued", "editing"].includes(task.status) && (
										<button
											className="ops-button small danger"
											onClick={() =>
												void workspaceRequest({
													action: "cancel_edit",
													taskId: task.id,
												})
													.then(refresh)
													.catch((e) => setError(e.message))
											}
										>
											Cancelar tarefa
										</button>
									)}
									{["failed", "cancelled"].includes(task.status) &&
										task.assetId && (
											<button
												className="ops-button small"
												onClick={() =>
													void workspaceRequest({
														action: "edit",
														input: {
															assetIds: [task.assetId],
															prompt: task.prompt,
														},
													})
														.then(refresh)
														.catch((e) => setError(e.message))
												}
											>
												Tentar novamente em novo projeto
											</button>
										)}
								</div>
							);
						})}
					{data?.proposals
						.filter((p) => p.status === "pending")
						.map((p) => (
							<ProposalCard key={p.id} proposal={p} />
						))}
					<h2 style={{ marginTop: 24 }}>Biblioteca de vídeos brutos</h2>
					{data?.assets
						.filter((a) => a.kind === "source")
						.slice(-15)
						.reverse()
						.map((a) => (
							<label className="ops-check" key={a.id}>
								<input
									type="checkbox"
									checked={selected.includes(a.id)}
									onChange={(e) =>
										setSelected(
											e.target.checked
												? [...selected, a.id]
												: selected.filter((id) => id !== a.id),
										)
									}
								/>
								<span style={{ overflowWrap: "anywhere", fontSize: 11 }}>
									{a.name}
									<small>{(a.bytes / 1024 / 1024).toFixed(1)} MB</small>
								</span>
							</label>
						))}
				</aside>
			</div>
		</OperationsShell>
	);
}
export function AgendaPage() {
	const { data, accountId, refresh } = useWorkspace();
	const searchParams = useSearchParams();
	const [assetId, setAssetId] = useState(() => searchParams.get("asset") || ""),
		[caption, setCaption] = useState(""),
		[when, setWhen] = useState("");
	const [busy, setBusy] = useState(false),
		[error, setError] = useState("");
	async function plan() {
		setBusy(true);
		setError("");
		try {
			const publishAt = when
				? new Date(when).toISOString()
				: new Date(Date.now() + 120000).toISOString();
			await workspaceRequest({
				action: "prepare_publication",
				items: [{ assetId, accountId, caption, publishAt }],
			});
			await refresh();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Falha no plano.");
		} finally {
			setBusy(false);
		}
	}
	const pendingProposals =
		data?.proposals.filter(
			(proposal) =>
				proposal.status === "pending" &&
				proposal.items.some((item) => item.accountId === accountId),
		) || [];
	return (
		<OperationsShell>
			<div className="ops-grid two">
				<section className="ops-card">
					<h2 className="ops-row">
						<CalendarDays size={21} /> Agendar um vídeo
					</h2>
					<p>
						Selecione uma exportação final e confira o plano antes de confirmar.
						Destino: @
						{data?.accounts.find((a) => a.id === accountId)?.username ||
							"selecione uma conta"}
						.
					</p>
					<label className="ops-field">
						Vídeo final
						<select
							aria-label="Vídeo final"
							value={assetId}
							onChange={(e) => setAssetId(e.target.value)}
						>
							<option value="">Escolha uma exportação</option>
							{data?.assets
								.filter((a) => a.kind === "export")
								.map((a) => {
									const compatible = a.media?.reelProfile?.compatible === true;
									return (
										<option key={a.id} value={a.id} disabled={!compatible}>
											{a.name}
											{compatible ? "" : " — formato antigo; reexporte"}
										</option>
									);
								})}
						</select>
						<small>
							Apenas MP4s validados para Reels (AAC 48 kHz/128 kbps) podem ser
							agendados.
						</small>
					</label>
					<label className="ops-field">
						Data e hora
						<input
							type="datetime-local"
							value={when}
							onChange={(e) => setWhen(e.target.value)}
						/>
						<small>
							Entrada no fuso deste navegador (
							{Intl.DateTimeFormat().resolvedOptions().timeZone}). O plano
							mostra o fuso configurado. Vazio: publicar em 2 minutos, após
							confirmar.
						</small>
					</label>
					<label className="ops-field">
						Legenda de publicação
						<textarea
							maxLength={2200}
							value={caption}
							onChange={(e) => setCaption(e.target.value)}
						/>
					</label>
					{error && (
						<div className="ops-alert" role="alert">
							{error}
						</div>
					)}
					<button
						className="ops-button primary"
						disabled={busy || !assetId || !accountId}
						onClick={() => void plan()}
					>
						{busy ? "Validando requisitos…" : "Revisar plano"}
					</button>
					<p style={{ marginTop: 15 }}>
						Para adicionar um MP4 final, use “Guardar na agenda” no exportador
						do editor ou envie abaixo.
					</p>
					<label className="ops-field">
						Importar vídeo final MP4
						<input
							disabled={busy}
							type="file"
							accept="video/mp4"
							onChange={(e) => {
								const file = e.target.files?.[0];
								e.target.value = "";
								if (!file) return;
								setBusy(true);
								void uploadAsset({ file, kind: "export" })
									.then((asset) => setAssetId(asset.id))
									.catch((e) => setError(e.message))
									.finally(() => setBusy(false));
							}}
						/>
					</label>
				</section>
				<div>
					{pendingProposals.map((proposal) => (
						<ProposalCard proposal={proposal} key={proposal.id} />
					))}
					{pendingProposals.length === 0 && (
						<EmptyPanel
							title="Uma revisão antes de ir ao ar"
							text="A Hanna prepara o plano. Você confere o conteúdo, a conta e os horários. Depois disso, o servidor publica automaticamente."
						/>
					)}
				</div>
			</div>
			<section className="ops-card" style={{ marginTop: 22 }}>
				<div className="ops-row between">
					<h2>
						Publicações · @
						{data?.accounts.find((a) => a.id === accountId)?.username ||
							"nenhuma conta"}
					</h2>
					<span className="ops-badge">{data?.settings.timeZone}</span>
				</div>
				<div className="ops-list" style={{ marginTop: 18 }}>
					{data?.publications
						.filter((p) => p.accountId === accountId)
						.sort((a, b) => b.publishAt.localeCompare(a.publishAt))
						.map((p) => (
							<div className="ops-item" key={p.id}>
								<div className="ops-row between wrap">
									<strong>
										{data.assets.find((a) => a.id === p.assetId)?.name}
									</strong>
									<span className={"ops-badge " + p.status}>
										{statusLabel[p.status]}
									</span>
								</div>
								<p>
									{formatDate({
										value: p.publishAt,
										timeZone: data.settings.timeZone,
									})}{" "}
									· {p.caption}
								</p>
								{p.containerId && (
									<p className="ops-muted">
										Meta: {p.providerStatus || "status ainda não registrado"}
										{typeof p.statusChecks === "number"
											? ` · ${p.statusChecks} consulta${p.statusChecks === 1 ? "" : "s"}`
											: ""}
										{p.lastCheckedAt
											? ` · ${new Date(p.lastCheckedAt).toLocaleString("pt-BR")}`
											: ""}
										<br />
										Contêiner: {p.containerId}
									</p>
								)}
								{p.error && <div className="ops-alert">{p.error}</div>}
								{p.permalink && (
									<a
										className="ops-button small"
										target="_blank"
										rel="noreferrer"
										href={p.permalink}
									>
										Abrir no Instagram
									</a>
								)}
								{p.status === "scheduled" && (
									<button
										className="ops-button small danger"
										onClick={() =>
											void workspaceRequest({
												action: "cancel_publication",
												jobId: p.id,
											})
												.then(refresh)
												.catch((e) => setError(e.message))
										}
									>
										Cancelar agendamento
									</button>
								)}
							</div>
						))}
				</div>
				{!data?.publications.some((p) => p.accountId === accountId) && (
					<p>Nenhuma publicação desta conta na nova agenda.</p>
				)}
			</section>
		</OperationsShell>
	);
}
export function InsightsPage() {
	const { accountId } = useWorkspace();
	const [insights, setInsights] = useState<InstagramInsights | null>(null),
		[error, setError] = useState(""),
		[busy, setBusy] = useState(false);
	const requestId = useRef(0);
	const load = useCallback(
		async (force = false) => {
			const ticket = ++requestId.current;
			setInsights(null);
			setError("");
			if (!accountId) return;
			setBusy(true);
			try {
				const value = await workspaceRequest<InstagramInsights>({
					action: "insights",
					accountId,
					force,
				});
				if (ticket === requestId.current) setInsights(value);
			} catch (e) {
				if (ticket === requestId.current)
					setError(
						e instanceof Error ? e.message : "Falha ao buscar métricas.",
					);
			} finally {
				if (ticket === requestId.current) setBusy(false);
			}
		},
		[accountId],
	);
	useEffect(() => {
		const counter = requestId;
		const timer = setTimeout(() => void load(), 0);
		return () => {
			clearTimeout(timer);
			counter.current++;
		};
	}, [load]);
	return (
		<OperationsShell>
			<div className="ops-row between" style={{ marginBottom: 20 }}>
				<div>
					<h2 className="ops-section-title">Dados reais. Decisões melhores.</h2>
					<p className="ops-muted">
						API oficial · últimas 30 publicações ·{" "}
						{insights
							? "atualizado " + formatDate({ value: insights.fetchedAt })
							: "selecione uma conta conectada"}
					</p>
				</div>
				<button
					className="ops-button"
					disabled={busy || !accountId}
					onClick={() => void load(true)}
				>
					<RefreshCw size={15} />
					{busy ? "Consultando…" : "Atualizar"}
				</button>
			</div>
			{error && (
				<div className="ops-alert" role="alert">
					{error}
				</div>
			)}
			{!accountId ? (
				<EmptyPanel
					title="Conecte seu Instagram"
					text="Não mostramos números simulados. Adicione uma conta profissional para consultar seus dados."
				>
					<Link className="ops-button primary" href="/configuracoes">
						Configurar Instagram
					</Link>
				</EmptyPanel>
			) : (
				<>
					<div className="ops-grid four">
						<Metric
							label="Seguidores"
							value={insights?.profile.followers_count}
							note="na conta selecionada"
						/>
						<Metric
							label="Visualizações"
							value={insights?.totals.views}
							note="soma das publicações consultadas"
						/>
						<Metric
							label="Interações"
							value={insights?.totals.total_interactions}
							note="quando a Meta disponibiliza"
						/>
						<Metric
							label="Compartilhamentos"
							value={insights?.totals.shares}
							note="últimas publicações"
						/>
					</div>
					<section className="ops-card" style={{ marginTop: 22 }}>
						<h2>Desempenho por publicação</h2>
						<p>
							“—” significa dado indisponível, não zero. Alcance por publicação
							não equivale ao alcance único da conta.
						</p>
						<div className="ops-table-wrap">
							<table className="ops-table">
								<thead>
									<tr>
										<th>Publicação</th>
										<th>Visualizações</th>
										<th>Alcance</th>
										<th>Curtidas</th>
										<th>Comentários</th>
										<th>Salvos</th>
									</tr>
								</thead>
								<tbody>
									{insights?.media.map((m) => (
										<tr key={m.id}>
											<td>
												<a target="_blank" rel="noreferrer" href={m.permalink}>
													{m.caption?.slice(0, 70) || m.id}
												</a>
												{m.insightsError && (
													<small
														className="ops-muted"
														style={{ display: "block" }}
													>
														Métricas parcialmente indisponíveis
													</small>
												)}
											</td>
											<td>{m.insights.views ?? "—"}</td>
											<td>{m.insights.reach ?? "—"}</td>
											<td>{m.like_count ?? "—"}</td>
											<td>{m.comments_count ?? "—"}</td>
											<td>{m.insights.saved ?? "—"}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						{insights?.media.length === 0 && (
							<p>Não há publicações disponíveis para esta conta.</p>
						)}
					</section>
				</>
			)}
		</OperationsShell>
	);
}
