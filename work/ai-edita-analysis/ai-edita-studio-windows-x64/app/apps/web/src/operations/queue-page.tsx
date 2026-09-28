"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
	CalendarClock,
	Check,
	CircleAlert,
	Download,
	FolderOpen,
	LoaderCircle,
	MonitorSmartphone,
	RotateCcw,
	Sparkles,
	X,
} from "lucide-react";
import { ContentIntakeButton } from "./content-intake";
import { assetUrl, useWorkspace, workspaceRequest } from "./client";
import {
	HannaWorkerFrame,
	useHannaQueueRunner,
	useWakeLock,
} from "./queue-runner";
import { EmptyPanel, OperationsShell } from "./shell";
import type { EditTask } from "./types";

const STAGES: Array<{ id: NonNullable<EditTask["stage"]>; label: string }> = [
	{ id: "queued", label: "Na fila" },
	{ id: "importing", label: "Preparando" },
	{ id: "transcribing", label: "Transcrevendo" },
	{ id: "editing", label: "Editando" },
	{ id: "rendering", label: "Renderizando" },
	{ id: "done", label: "Pronto" },
];

function stageOf(task: EditTask): NonNullable<EditTask["stage"]> {
	if (task.status === "review") return "done";
	if (task.stage) return task.stage;
	return task.status === "editing" ? "editing" : "queued";
}

function StageTrack({ task, compact = false }: { task: EditTask; compact?: boolean }) {
	const stages = STAGES.filter(
		(stage) => stage.id !== "rendering" || task.autoRender !== false,
	);
	const current = stages.findIndex((stage) => stage.id === stageOf(task));
	const failed = task.status === "failed" || task.status === "cancelled";
	return (
		<ol className={"ops-queue-track" + (compact ? " compact" : "")}>
			{stages.map((stage, index) => (
				<li
					key={stage.id}
					className={
						index < current || (stage.id === "done" && task.status === "review")
							? "done"
							: index === current
								? failed
									? "failed"
									: "active"
								: ""
					}
				>
					<span>
						{index < current || task.status === "review" ? (
							<Check size={10} />
						) : index === current && !failed && stage.id !== "queued" ? (
							<LoaderCircle size={10} className="animate-spin" />
						) : null}
					</span>
					{!compact && <em>{stage.label}</em>}
				</li>
			))}
		</ol>
	);
}

function statusText(task: EditTask) {
	if (task.status === "failed") return "Falhou";
	if (task.status === "cancelled") return "Cancelado";
	if (task.status === "review")
		return task.exportAssetId ? "MP4 pronto" : "Pronto para revisar";
	return STAGES.find((stage) => stage.id === stageOf(task))?.label ?? "Na fila";
}

function friendlyError(message: string) {
	if (/HTTP 401|API key|invalid_api_key/i.test(message))
		return "A OpenAI recusou a chave. Confira a chave e o faturamento em Configurações e tente de novo.";
	if (/HTTP 429|rate limit|quota/i.test(message))
		return "A OpenAI limitou as requisições ou o crédito acabou. Aguarde alguns minutos ou confira o faturamento.";
	return message.slice(0, 280);
}

function TaskRow({
	task,
	position,
	onError,
}: {
	task: EditTask;
	position?: number;
	onError: (message: string) => void;
}) {
	const { data, refresh } = useWorkspace();
	const [busy, setBusy] = useState(false);
	const source = data?.assets.find((asset) => asset.id === task.assetId);
	const exported = data?.assets.find((asset) => asset.id === task.exportAssetId);
	const act = (action: "cancel_edit" | "retry_edit") => {
		setBusy(true);
		void workspaceRequest({ action, taskId: task.id })
			.then(refresh)
			.catch((reason: unknown) =>
				onError(reason instanceof Error ? reason.message : "Não foi possível concluir."),
			)
			.finally(() => setBusy(false));
	};
	return (
		<article className={"ops-queue-row " + task.status}>
			<div className="thumb">
				{exported ? (
					// eslint-disable-next-line jsx-a11y/media-has-caption -- exported user video; captions are burned in when present
					<video src={assetUrl(exported.id)} preload="metadata" muted controls />
				) : source ? (
					// eslint-disable-next-line jsx-a11y/media-has-caption -- raw user upload preview
					<video src={assetUrl(source.id) + "#t=0.5"} preload="metadata" muted />
				) : null}
				{position !== undefined && task.status === "queued" && (
					<span className="position">{position}º</span>
				)}
			</div>
			<div className="copy">
				<div className="head">
					<strong title={task.title}>{task.title}</strong>
					<span className={"ops-badge " + task.status}>{statusText(task)}</span>
				</div>
				<small className="meta">
					{task.templateName
						? `Template ${task.templateName}`
						: task.mode === "presets"
							? "Pré-definições"
							: "Direção por prompt"}
					{task.autoRender === false ? " · sem render automático" : " · render automático"}
				</small>
				<StageTrack task={task} compact />
				{(task.status === "failed" || task.status === "cancelled") && task.message && (
					<p className="error">
						<CircleAlert size={13} /> {friendlyError(task.message)}
					</p>
				)}
				<div className="actions">
					{["queued", "editing"].includes(task.status) && (
						<button className="ops-button small" disabled={busy} onClick={() => act("cancel_edit")}>
							<X size={13} /> Cancelar
						</button>
					)}
					{["failed", "cancelled"].includes(task.status) && (
						<button className="ops-button small primary" disabled={busy} onClick={() => act("retry_edit")}>
							<RotateCcw size={13} /> Tentar de novo
						</button>
					)}
					{task.projectId && task.status !== "queued" && (
						<Link className="ops-button small" href={"/editor/" + task.projectId}>
							<FolderOpen size={13} /> Abrir timeline
						</Link>
					)}
					{exported && (
						<a className="ops-button small" href={assetUrl(exported.id)} download={exported.name}>
							<Download size={13} /> Baixar MP4
						</a>
					)}
					{task.status === "review" && exported && (
						<Link
							className="ops-button small primary"
							href={"/agenda?asset=" + encodeURIComponent(exported.id)}
						>
							<CalendarClock size={13} /> Publicar ou agendar
						</Link>
					)}
				</div>
			</div>
		</article>
	);
}

export function QueuePage() {
	const { data } = useWorkspace();
	const searchParams = useSearchParams();
	const batchId = searchParams.get("lote") || "";
	const requestedTaskId = searchParams.get("task") || "";
	const [error, setError] = useState("");
	const { workerId } = useHannaQueueRunner({ requestedTaskId, onError: setError });

	const tasks = useMemo(() => {
		const all = data?.tasks ?? [];
		const current = all.filter((task) => !task.retriedBy);
		const scoped = batchId ? current.filter((task) => task.batchId === batchId) : current;
		// Without a batch, show what is active plus the last day of finished work.
		const recent = batchId
			? scoped
			: scoped.filter(
					(task) =>
						["queued", "editing"].includes(task.status) ||
						Date.now() - Date.parse(task.updatedAt) < 24 * 3600 * 1000,
				);
		return [...recent].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
	}, [data?.tasks, batchId]);
	const current = tasks.find((task) => task.id === workerId) ??
		tasks.find((task) => task.status === "editing");
	const queued = tasks.filter((task) => task.status === "queued");
	const done = tasks.filter((task) => task.status === "review").length;
	const failed = tasks.filter((task) => ["failed", "cancelled"].includes(task.status)).length;
	const active = queued.length > 0 || Boolean(current);
	const finished = tasks.length > 0 && !active;
	const percent = tasks.length ? Math.round(((done + failed) / tasks.length) * 100) : 0;
	const blocked =
		data &&
		(!data.settings.allowEdits || !data.settings.shareWithOpenAI || !data.settings.hasOpenAIKey);
	useWakeLock(active);
	useEffect(() => {
		const base = "Fila · AI Edita";
		document.title = active ? `(${done + failed}/${tasks.length}) ${base}` : base;
		return () => {
			document.title = "AI Edita";
		};
	}, [active, done, failed, tasks.length]);
	useEffect(() => {
		if (!active) return;
		const warn = (event: BeforeUnloadEvent) => event.preventDefault();
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [active]);
	const batchTitle = tasks.find((task) => task.batchTitle)?.batchTitle;

	return (
		<OperationsShell>
			<section className="ops-content-heading">
				<div>
					<div className="ops-overline">FILA DE EDIÇÃO</div>
					<h2>{batchTitle || (batchId ? "Seu lote" : "Tudo o que a Hanna está editando")}</h2>
					<p>
						{tasks.length
							? `${done} pronto${done === 1 ? "" : "s"} · ${queued.length} na fila${failed ? ` · ${failed} com falha` : ""} · ${tasks.length} no total`
							: "Nenhum vídeo na fila agora."}
					</p>
				</div>
				<div className="ops-row">
					{batchId && (
						<Link className="ops-button" href="/fila">
							Ver toda a fila
						</Link>
					)}
					<ContentIntakeButton label="Adicionar vídeos" />
				</div>
			</section>

			{tasks.length > 0 && (
				<div className="ops-queue-progress" aria-label={`Progresso do lote: ${percent}%`}>
					<span style={{ width: `${percent}%` }} />
				</div>
			)}
			{blocked && (
				<div className="ops-alert" role="alert">
					A fila está pausada: configure a chave da OpenAI e as permissões de edição em{" "}
					<Link href="/configuracoes">Configurações</Link>.
				</div>
			)}
			{error && (
				<div className="ops-alert" role="alert">
					{error}
				</div>
			)}
			{active && (
				<div className="ops-intake-started" role="status">
					<MonitorSmartphone size={17} />
					<div>
						<strong>Mantenha esta aba aberta.</strong>
						<span>
							A edição e a renderização acontecem aqui no navegador, um vídeo por vez. Pode usar
							outras abas; não feche esta nem deixe o computador dormir.
						</span>
					</div>
				</div>
			)}
			{finished && (
				<div className="ops-queue-finished" role="status">
					<Sparkles size={20} />
					<div>
						<strong>{failed ? "Lote concluído com pendências" : "Lote concluído!"}</strong>
						<span>
							{done} vídeo{done === 1 ? "" : "s"} pronto{done === 1 ? "" : "s"}
							{failed ? `, ${failed} para tentar de novo` : ""}. Revise e publique quando quiser.
						</span>
					</div>
					<Link className="ops-button primary small" href="/conteudos">
						Ir para Conteúdos
					</Link>
				</div>
			)}

			{tasks.length ? (
				<div className="ops-queue-layout">
					<section className="ops-queue-now" aria-label="Editando agora">
						<div className="ops-overline">AGORA</div>
						{current && workerId === current.id ? (
							<>
								<HannaWorkerFrame taskId={current.id} className="ops-queue-frame" />
								<strong className="title" title={current.title}>
									{current.title}
								</strong>
								<small>{current.templateName ? `Template ${current.templateName}` : "Edição da Hanna"}</small>
								<StageTrack task={current} />
								{current.message && <p className="message">{current.message.slice(0, 180)}</p>}
							</>
						) : current ? (
							<div className="ops-queue-idle">
								<LoaderCircle className="animate-spin" size={22} />
								<p>
									{current.title} está sendo editado em outra aba do AI Edita.
								</p>
								<StageTrack task={current} />
							</div>
						) : (
							<div className="ops-queue-idle">
								<Check size={22} />
								<p>{queued.length ? "Iniciando o próximo vídeo…" : "Nada sendo editado agora."}</p>
							</div>
						)}
					</section>
					<section className="ops-queue-list" aria-label="Vídeos do lote">
						{tasks.map((task) => (
							<TaskRow
								key={task.id}
								task={task}
								position={task.status === "queued" ? queued.indexOf(task) + 1 : undefined}
								onError={setError}
							/>
						))}
					</section>
				</div>
			) : (
				<EmptyPanel
					title="A fila está vazia"
					text="Envie vídeos, escolha um template ou uma direção e a Hanna edita um por um."
				>
					<ContentIntakeButton label="Adicionar vídeos" />
				</EmptyPanel>
			)}
		</OperationsShell>
	);
}
