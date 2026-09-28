"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
	CircleAlert,
	CircleCheck,
	LoaderCircle,
	Sparkles,
	X,
} from "lucide-react";
import { useEditor } from "@/editor/use-editor";
import type { EditorCore } from "@/core";
import type { TextElement } from "@/timeline";
import {
	connectionSchema,
	integrationRequest,
	IntegrationApiError,
	useIntegrationStore,
} from "@/integrations/client";
import { agentRunSchema } from "@/integrations/agent-run-contract";
import { workspaceRequest } from "./client";
import type { EditTask } from "./types";

type LiveState = {
	kind: "working" | "review" | "error";
	/** Latest Hanna action, shown under the status while she edits. */
	detail?: string;
	message: string;
};

function requestedCaptionStyle(prompt: string) {
	const match = prompt.match(
		/\[AI_EDITA_CAPTION_STYLE:(clean|boxed|pulse|spotlight)\]/,
	);
	return match?.[1] || "";
}

function verifyRequestedCaptions({
	editor,
	prompt,
}: {
	editor: EditorCore;
	prompt: string;
}) {
	const style = requestedCaptionStyle(prompt);
	if (!style) return;
	const tracks = editor.scenes.getActiveScene().tracks;
	const captions: TextElement[] = [];
	for (const track of [tracks.main, ...tracks.overlay]) {
		for (const element of track.elements) {
			if (
				element.type === "text" &&
				element.name.startsWith("AI Edita · " + style + " · ")
			)
				captions.push(element);
		}
	}
	if (!captions.length)
		throw new Error(
			"A Hanna terminou sem criar as legendas no estilo escolhido. A tarefa foi mantida para revisão, sem marcar uma edição incompleta como pronta.",
		);
	if (
		["pulse", "spotlight"].includes(style) &&
		!captions.some(
			(element) => Object.keys(element.animations ?? {}).length > 0,
		)
	)
		throw new Error(
			"A Hanna criou as legendas, mas sem a animação obrigatória do estilo escolhido. Revise a tarefa antes de exportar.",
		);
	if (
		style === "spotlight" &&
		!captions.every(
			(element) => element.params["caption.style"] === "spotlight",
		)
	)
		throw new Error(
			"A Hanna criou o visual spotlight sem registrar o destaque progressivo por palavra. Revise a tarefa antes de exportar.",
		);
}

/** Keeps the guided task alive while its actual edits are visible in the Editor. */
export const LIVE_RUN_KEY_PREFIX = "ai-edita-hanna-live-run:";
// One start per task even if React mounts the banner twice.
const liveRunStarts = new Map<string, Promise<void>>();

/**
 * Starts the Hanna run handed over by the guided screen, but only after this Editor tab has
 * loaded the project and completed a bridge poll, so every tool call has an editor to run on.
 */
function startHandedOverRun(taskId: string) {
	const existing = liveRunStarts.get(taskId);
	if (existing) return existing;
	const key = LIVE_RUN_KEY_PREFIX + taskId;
	const raw = sessionStorage.getItem(key);
	if (!raw) return Promise.resolve();
	const started = (async () => {
		const pending = JSON.parse(raw) as { prompt: string; maxCalls?: number };
		const waitForEditor = async (since: number) => {
			const deadline = Date.now() + 90_000;
			while (Date.now() < deadline) {
				const state = useIntegrationStore.getState();
				if (state.connection && state.lastPollAt > since) return state.connection;
				await new Promise((resolve) => setTimeout(resolve, 250));
			}
			throw new Error(
				"O Editor não conectou à Hanna a tempo. O vídeo e o projeto foram preservados; tente de novo.",
			);
		};
		let connection = connectionSchema.parse(await waitForEditor(Date.now()));
		const start = () =>
			integrationRequest({
				action: "start_agent_run",
				...connection,
				prompt: pending.prompt,
				maxCalls: pending.maxCalls ?? 48,
			});
		let run;
		try {
			run = agentRunSchema.parse(await start());
		} catch (error) {
			if (!(error instanceof IntegrationApiError) || ![401, 409].includes(error.status))
				throw error;
			// The handed-over session expired while the video loaded: the runtime reconnects
			// on its own, then the run starts on that session.
			useIntegrationStore.setState({ connection: null });
			connection = connectionSchema.parse(await waitForEditor(Date.now()));
			run = agentRunSchema.parse(await start());
		}
		sessionStorage.removeItem(key);
		useIntegrationStore.setState({
			agentRun: run,
			chatBusy: run.status === "running",
			health: "",
		});
	})();
	liveRunStarts.set(taskId, started);
	return started;
}

export function HannaLiveEdit() {
	const searchParams = useSearchParams();
	const taskId = searchParams.get("hannaTask") || "";
	const editor = useEditor();
	const [state, setState] = useState<LiveState>({
		kind: "working",
		message: "Conectando a Hanna à sua edição…",
	});
	// The task id lives in the URL, so once the run settles this banner has
	// nothing left to clear it and stays on screen over the editor forever.
	const [dismissed, setDismissed] = useState(false);

	useEffect(() => {
		if (!taskId) return;
		let stopped = false;
		let lease = "";
		let heartbeat: ReturnType<typeof setInterval> | undefined;
		const projectId = editor.project.getActiveOrNull()?.metadata.id;
		if (!projectId) return;

		async function update(input: Record<string, unknown>) {
			await workspaceRequest({
				action: "update_edit",
				input: { taskId, lease, projectId, ...input },
			});
		}

		async function monitor() {
			try {
				const task = await workspaceRequest<EditTask & { lease: string }>({
					action: "adopt_edit",
					input: { taskId, projectId },
				});
				lease = task.lease;
				if (stopped) return;
				setState({
					kind: "working",
					message: "Hanna está editando ao vivo nesta linha do tempo.",
				});
				heartbeat = setInterval(() => {
					void update({
						message: "Hanna está editando ao vivo no Editor.",
					}).catch(() => {});
				}, 10_000);

				let stage = "";
				const reportStage = async (next: string, message: string) => {
					if (next === stage) return;
					stage = next;
					await update({ stage: next, message }).catch(() => {});
				};
				setState({
					kind: "working",
					message: "Preparando a Hanna nesta linha do tempo…",
				});
				await startHandedOverRun(taskId);
				if (stopped) return;
				const startedWaitingAt = Date.now();
				const runConnectionDeadline = startedWaitingAt + 45_000;
				const deadline = startedWaitingAt + 16 * 60_000;
				while (!stopped && Date.now() < deadline) {
					await new Promise((resolve) => setTimeout(resolve, 750));
					const integration = useIntegrationStore.getState();
					const run = integration.agentRun;
					if (!run || run.id === "") {
						if (Date.now() < runConnectionDeadline) continue;
						throw new Error(
							integration.health ||
								"A sessão da Hanna se perdeu ao abrir o Editor. O vídeo e o projeto foram preservados; volte à Hanna e inicie a edição novamente.",
						);
					}
					if (run.status === "running") {
						const transcribed = run.steps.some((step) =>
							step.startsWith("Áudio transcrito"),
						);
						await reportStage(
							transcribed ? "editing" : "transcribing",
							transcribed
								? "Montando a edição ao vivo no Editor."
								: "Transcrevendo a fala para editar.",
						);
						setState({
							kind: "working",
							message: `${transcribed ? "Editando" : "Transcrevendo a fala"} · ${run.steps.length} ações`,
							detail: run.steps.at(-1),
						});
						continue;
					}
					if (run.status !== "complete")
						throw new Error(run.text || "A edição foi interrompida.");
					await editor.save.flush();
					verifyRequestedCaptions({ editor, prompt: task.prompt });
					await update({
						status: "review",
						stage: "done",
						message:
							"Edição concluída no Editor. Revise a prévia e a linha do tempo antes de exportar. " +
							run.text.slice(0, 1200),
					});
					if (!stopped)
						setState({
							kind: "review",
							message:
								"Edição concluída. Revise a timeline e exporte somente quando aprovar.",
						});
					return;
				}
				throw new Error(
					"A edição excedeu o tempo limite. O projeto foi preservado para revisão.",
				);
			} catch (reason) {
				const message =
					reason instanceof Error
						? reason.message
						: "A edição foi interrompida.";
				if (lease && !stopped)
					await update({
						status: "failed",
						message: message.slice(0, 3900),
					}).catch(() => {});
				if (!stopped) setState({ kind: "error", message });
			}
		}

		void monitor();
		return () => {
			stopped = true;
			clearInterval(heartbeat);
		};
	}, [editor, taskId]);

	if (!taskId || dismissed) return null;
	const Icon =
		state.kind === "review"
			? CircleCheck
			: state.kind === "error"
				? CircleAlert
				: LoaderCircle;
	return (
		<div
			aria-live="polite"
			className="fixed top-16 right-4 z-50 flex max-w-sm items-start gap-3 rounded-xl border border-primary/40 bg-background/95 px-4 py-3 shadow-2xl backdrop-blur"
		>
			{state.kind === "working" ? (
				<Icon className="mt-0.5 size-5 animate-spin text-primary" />
			) : (
				<Icon
					className={
						"mt-0.5 size-5 " +
						(state.kind === "error" ? "text-destructive" : "text-primary")
					}
				/>
			)}
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-1.5 text-sm font-semibold">
					<Sparkles className="size-3.5 text-primary" /> Hanna no Editor
				</div>
				<p className="mt-1 text-xs text-muted-foreground">{state.message}</p>
				{state.detail && (
					<p className="mt-1 truncate text-[11px] text-foreground/80" title={state.detail}>
						Última ação: {state.detail}
					</p>
				)}
			</div>
			<button
				type="button"
				aria-label="Fechar aviso"
				title="Fechar aviso"
				onClick={() => setDismissed(true)}
				className="text-muted-foreground hover:text-foreground -mr-1 mt-0.5 rounded p-1"
			>
				<X className="size-4" />
			</button>
		</div>
	);
}
