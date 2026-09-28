"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
	CalendarClock,
	CircleCheckBig,
	Clock3,
	Download,
	Film,
	FolderOpen,
	Play,
	Sparkles,
} from "lucide-react";
import { ContentIntakeButton } from "./content-intake";
import { assetUrl, statusLabel, useWorkspace } from "./client";
import { OperationsShell, EmptyPanel } from "./shell";
import type { EditTask } from "./types";

type ContentFilter =
	| "all"
	| "incoming"
	| "editing"
	| "review"
	| "scheduled"
	| "published";

const filters: Array<{ id: ContentFilter; label: string }> = [
	{ id: "all", label: "Todos" },
	{ id: "incoming", label: "Entrada" },
	{ id: "editing", label: "Em edição" },
	{ id: "review", label: "Prontos para revisar" },
	{ id: "scheduled", label: "Agendados" },
	{ id: "published", label: "Publicados" },
];

function date(value?: string) {
	if (!value) return "Agora";
	return new Intl.DateTimeFormat("pt-BR", {
		dateStyle: "short",
		timeStyle: "short",
	}).format(new Date(value));
}

function taskMatches({
	task,
	filter,
}: {
	task: EditTask;
	filter: ContentFilter;
}) {
	if (filter === "all") return true;
	if (filter === "incoming") return task.status === "queued";
	if (filter === "editing") return task.status === "editing";
	return filter === "review" && task.status === "review";
}

function ContentTaskCard({ task }: { task: EditTask }) {
	const { data } = useWorkspace();
	const source = data?.assets.find((asset) => asset.id === task.assetId);
	const exportAsset = data?.assets.find(
		(asset) => asset.id === task.exportAssetId,
	);
	const publication = data?.publications.find(
		(item) => item.assetId === task.exportAssetId,
	);
	return (
		<article className="ops-content-card">
			<div className="ops-content-video">
				{source ? (
					<video preload="metadata" muted src={assetUrl(source.id)} />
				) : (
					<Film size={28} />
				)}
				<span className={"ops-badge " + task.status}>
					{statusLabel[task.status]}
				</span>
			</div>
			<div className="ops-content-card-copy">
				<div className="ops-row between">
					<h3>{task.title}</h3>
					<time>{date(task.updatedAt)}</time>
				</div>
				<p>
					{task.status === "queued"
						? "Na fila para a Hanna iniciar a edição."
						: task.status === "editing"
							? "A Hanna está analisando e montando a edição neste momento."
							: task.message || "Confira a prévia antes de continuar."}
				</p>
				<div className="ops-content-checkpoints">
					<span className={task.status === "queued" ? "active" : "done"}>
						<Clock3 size={13} /> Envio
					</span>
					<span
						className={
							task.status === "editing"
								? "active"
								: task.status === "queued"
									? ""
									: "done"
						}
					>
						<Sparkles size={13} /> Hanna edita
					</span>
					<span className={task.status === "review" ? "active" : ""}>
						<CircleCheckBig size={13} /> Sua revisão
					</span>
				</div>
				<div className="ops-content-actions">
					{task.projectId && (
						<Link
							className="ops-button small"
							href={"/editor/" + task.projectId}
						>
							<FolderOpen size={14} /> Abrir timeline
						</Link>
					)}
					{task.status === "queued" && (
						<Link
							className="ops-button primary small"
							href={"/fila?task=" + task.id}
						>
							<Sparkles size={14} /> Iniciar agora
						</Link>
					)}
					{task.status === "editing" && (
						<Link className="ops-button small" href={"/fila?task=" + task.id}>
							<Sparkles size={14} /> Acompanhar na fila
						</Link>
					)}
					{exportAsset && (
						<a
							className="ops-button small"
							href={assetUrl(exportAsset.id)}
							download={exportAsset.name}
						>
							<Download size={14} /> Baixar prévia
						</a>
					)}
					{task.status === "review" && exportAsset && !publication && (
						<Link
							className="ops-button primary small"
							href={"/agenda?asset=" + encodeURIComponent(exportAsset.id)}
						>
							<CalendarClock size={14} /> Publicar ou agendar
						</Link>
					)}
					{publication && (
						<Link className="ops-button small" href="/agenda">
							<Play size={14} /> {statusLabel[publication.status]}
						</Link>
					)}
				</div>
			</div>
		</article>
	);
}

export function ContentPage() {
	const { data } = useWorkspace();
	const [filter, setFilter] = useState<ContentFilter>("all");
	const tasks = useMemo(
		() =>
			(data?.tasks || [])
				.filter((task) => taskMatches({ task, filter }))
				.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
		[data?.tasks, filter],
	);
	const publicationCount = data?.publications.filter((publication) => {
		return filter === "scheduled"
			? publication.status === "scheduled"
			: filter === "published" && publication.status === "published";
	}).length;
	const showTasks = !["scheduled", "published"].includes(filter);
	return (
		<OperationsShell>
			<section className="ops-content-heading">
				<div>
					<div className="ops-overline">CONTEÚDOS</div>
					<h2>AI Edita entra, Instagram sai.</h2>
					<p>
						Envie o bruto, escolha como a Hanna deve editar e acompanhe até a
						revisão e publicação.
					</p>
				</div>
				<ContentIntakeButton label="Novo conteúdo" />
			</section>
			<section className="ops-content-steps" aria-label="Fluxo do conteúdo">
				<div>
					<span>01</span>
					<strong>Upload direto</strong>
					<small>Bruto ou editado</small>
				</div>
				<div>
					<span>02</span>
					<strong>Hanna edita</strong>
					<small>Transcrição, cortes e estilo</small>
				</div>
				<div>
					<span>03</span>
					<strong>Sua aprovação</strong>
					<small>Você revisa a prévia</small>
				</div>
				<div>
					<span>04</span>
					<strong>Publicação</strong>
					<small>Exportar, publicar ou agendar</small>
				</div>
			</section>
			<div
				className="ops-tabs ops-content-tabs"
				role="tablist"
				aria-label="Filtrar conteúdos"
			>
				{filters.map((item) => (
					<button
						key={item.id}
						className={filter === item.id ? "active" : ""}
						onClick={() => setFilter(item.id)}
						role="tab"
						aria-selected={filter === item.id}
					>
						{item.label}
					</button>
				))}
			</div>
			{showTasks ? (
				tasks.length ? (
					<div className="ops-content-grid">
						{tasks.map((task) => (
							<ContentTaskCard key={task.id} task={task} />
						))}
					</div>
				) : (
					<EmptyPanel
						title="Nenhum conteúdo nesta etapa"
						text="Envie um vídeo e a Hanna cria uma edição revisável, sem publicar nada automaticamente."
					>
						<ContentIntakeButton label="Adicionar vídeos" />
					</EmptyPanel>
				)
			) : publicationCount ? (
				<section className="ops-card">
					<h3>
						{filter === "scheduled" ? "Vídeos agendados" : "Vídeos publicados"}
					</h3>
					<div className="ops-list" style={{ marginTop: 16 }}>
						{data?.publications
							.filter((publication) => publication.status === filter)
							.map((publication) => (
								<div className="ops-item" key={publication.id}>
									<strong>
										{
											data.assets.find(
												(asset) => asset.id === publication.assetId,
											)?.name
										}
									</strong>
									<p>
										{date(publication.publishAt)} ·{" "}
										{publication.caption || "Sem legenda"}
									</p>
									<Link className="ops-button small" href="/agenda">
										Ver publicação
									</Link>
								</div>
							))}
					</div>
				</section>
			) : (
				<EmptyPanel
					title={filter === "scheduled" ? "Nada agendado" : "Nada publicado"}
					text="Depois de revisar um vídeo, você escolhe se quer exportar, publicar agora ou agendar."
				/>
			)}
		</OperationsShell>
	);
}
