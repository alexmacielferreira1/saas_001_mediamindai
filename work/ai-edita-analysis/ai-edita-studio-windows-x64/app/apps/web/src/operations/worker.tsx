"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useEditor } from "@/editor/use-editor";
import { processMediaAssets } from "@/media/processing";
import {
	initializeGpuRenderer,
	isGpuAvailable,
} from "@/services/renderer/gpu-renderer";
import { loadFontAtlas } from "@/fonts/google-fonts";
import { executeEditorTool } from "@/integrations/editor-adapter";
import { IntegrationRuntime } from "@/integrations/runtime";
import {
	connectionSchema,
	integrationRequest,
	IntegrationApiError,
	useIntegrationStore,
} from "@/integrations/client";
import { agentRunSchema } from "@/integrations/agent-run-contract";
import { clearOperations, useOperationStore } from "@/integrations/operations";
import { PreviewPanel } from "@/preview/components";
import { storageService } from "@/services/storage/service";
import { assetUrl, uploadAsset, workspaceRequest } from "./client";
import type { EditTask, WorkspaceSnapshot } from "./types";
import { LIVE_RUN_KEY_PREFIX } from "./live-edit";

async function withTimeout<T>({
	promise,
	label,
	timeoutMs = 90_000,
}: {
	promise: Promise<T>;
	label: string;
	timeoutMs?: number;
}): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			promise,
			new Promise<T>((_, reject) => {
				timer = setTimeout(() => reject(new Error(label)), timeoutMs);
			}),
		]);
	} finally {
		if (timer) clearTimeout(timer);
	}
}

// Separate browser frame = separate EditorCore. Never swaps the user's open project.
export function HannaWorker({
	taskId,
	surface = "worker",
}: {
	taskId: string;
	surface?: "worker" | "editor";
}) {
	const editor = useEditor();
	const router = useRouter();
	const [ready, setReady] = useState(false),
		[message, setMessage] = useState("Preparando o editor…");
	useEffect(() => {
		let disposed = false,
			lease = "",
			projectId = "",
			finished = false,
			handedOff = false;
		let heartbeat: ReturnType<typeof setInterval> | undefined;
		const abort = new AbortController();
		const check = () => {
			if (disposed || abort.signal.aborted)
				throw new Error(
					"Edição interrompida. Confira o projeto antes de continuar.",
				);
		};
		async function update(input: Record<string, unknown>) {
			await workspaceRequest({
				action: "update_edit",
				input: { taskId, lease, ...(projectId ? { projectId } : {}), ...input },
			});
		}
		async function execute() {
			try {
				check();
				let claimed: EditTask & { lease: string };
				try {
					claimed = await workspaceRequest<EditTask & { lease: string }>({
						action: "claim_edit",
						taskId,
					});
				} catch (error) {
					// Another video is still being edited: the live Editor cannot start now,
					// so this one waits its turn in the queue instead of a stuck screen.
					if (
						surface === "editor" &&
						error instanceof Error &&
						error.message.includes("Outra edição")
					) {
						setMessage(
							"Outra edição está em andamento. Seu vídeo entrou na fila e começa em seguida…",
						);
						router.replace("/fila?task=" + encodeURIComponent(taskId));
						return;
					}
					throw error;
				}
				lease = claimed.lease;
				check();
				heartbeat = setInterval(() => {
					void update({}).catch(() => {
						if (disposed || handedOff) return;
						abort.abort();
						clearOperations();
						editor.project.cancelExport();
					});
				}, 10000);
				const state = await workspaceRequest<WorkspaceSnapshot>({
					action: "snapshot",
				});
				const source = state.assets.find((a) => a.id === claimed.assetId);
				if (
					!source ||
					!state.settings.allowEdits ||
					!state.settings.shareWithOpenAI ||
					!state.settings.hasOpenAIKey
				)
					throw new Error(
						"Configure OpenAI e as permissões de edição primeiro.",
					);
				const autoRender = claimed.autoRender !== false;
				setMessage("Importando vídeo em um novo projeto…");
				await update({
					stage: "importing",
					message: "Importando vídeo em projeto separado.",
				});
				await initializeGpuRenderer();
				check();
				editor.renderer.setDegraded(!isGpuAvailable());
				await loadFontAtlas();
				check();
				const response = await fetch(assetUrl(source.id), {
					signal: abort.signal,
				});
				if (!response.ok) throw new Error("Vídeo de origem indisponível.");
				const file = new File([await response.blob()], source.name, {
					type: source.mimeType,
				});
				const [processed] = await withTimeout({
					promise: processMediaAssets({ files: [file] }),
					label:
						"O navegador demorou demais para preparar este vídeo. O projeto não foi bloqueado; tente novamente com o arquivo original.",
				});
				check();
				if (!processed?.duration)
					throw new Error("O navegador não conseguiu decodificar o vídeo.");
				projectId = await editor.project.createNewProject({
					name: "Hanna · " + source.name,
				});
				// Complete the normal editor bootstrap before importing. A fresh
				// ProjectManager stays in "loading" until loadProject runs, which
				// otherwise prevents autosave even though rendering still works.
				await editor.project.loadProject({ id: projectId });
				await update({ projectId });
				check();
				const media = await editor.media.addMediaAsset({
					projectId,
					asset: processed,
				});
				if (!media)
					throw new Error("Não foi possível salvar o vídeo no navegador.");
				await executeEditorTool({
					editor,
					name: "insert_media",
					input: { mediaId: media.id, startSeconds: 0 },
					source: "MCP",
				});
				await editor.save.flush();
				check();
				const before = JSON.stringify(editor.scenes.getActiveScene().tracks);
				let connected = connectionSchema.parse(
					await integrationRequest({
						action: "connect",
						projectId,
						sceneId: editor.scenes.getActiveScene().id,
						automated: surface === "worker",
					}),
				);
				useIntegrationStore.setState({
					connection: connected,
					settings: connected,
					health: "",
				});
				setReady(true);
				await new Promise((resolve) => setTimeout(resolve, 300));
				check();
				const prompt =
					claimed.prompt.slice(0, 10000) +
					"\n\nExecução da Hanna em projeto NOVO, com o vídeo já importado. Edite apenas conforme a direção solicitada. Entenda a fala antes de criar títulos; use transcrição pela API OpenAI e inspect_frames quando autorizado. Preserve contexto e inteligibilidade, não faça cortes periódicos nem adicione frases genéricas. Verifique o resultado. Não execute export_video nem render_remotion: " +
					(autoRender
						? "o controlador exportará o MP4 ao terminar."
						: "a pessoa vai revisar a timeline e exportar depois.") +
					" Não publique nada.";
				if (surface === "editor") {
					// Hanna must not start before the Editor has loaded the video and is
					// answering tool calls, or her first command times out ("Editor timed
					// out"). The Editor starts the run from this handoff once it is ready.
					sessionStorage.setItem(
						"ai-edita-hanna-handoff",
						JSON.stringify({ projectId, connection: connected }),
					);
					sessionStorage.setItem(
						LIVE_RUN_KEY_PREFIX + taskId,
						JSON.stringify({ projectId, prompt, maxCalls: 48 }),
					);
					handedOff = true;
					setMessage("Abrindo sua edição ao vivo no Editor…");
					await update({
						message: "Projeto importado. Abrindo a edição ao vivo no Editor.",
					});
					router.replace(
						"/editor/" +
							encodeURIComponent(projectId) +
							"?hannaTask=" +
							encodeURIComponent(taskId),
					);
					return;
				}
				const startRun = () =>
					integrationRequest({
						action: "start_agent_run",
						...connected,
						prompt,
						maxCalls: 48,
					});
				let run;
				try {
					run = agentRunSchema.parse(await startRun());
				} catch (error) {
					if (
						!(error instanceof IntegrationApiError) ||
						![401, 409].includes(error.status)
					)
						throw error;
					setMessage("Reconectando a Hanna…");
					await update({
						message:
							"A sessão local reiniciou antes da primeira ação. Reconectando sem repetir edições.",
					});
					connected = connectionSchema.parse(
						await integrationRequest({
							action: "connect",
							projectId,
							sceneId: editor.scenes.getActiveScene().id,
							automated: surface === "worker",
						}),
					);
					useIntegrationStore.setState({
						connection: connected,
						settings: connected,
						health: "",
					});
					run = agentRunSchema.parse(await startRun());
				}
				// Publish the run immediately. Waiting for the polling runtime creates a
				// race during the guided route handoff: the Editor can mount before the
				// first poll and otherwise displays an endless "editing" banner.
				useIntegrationStore.setState({
					agentRun: run,
					chatBusy: run.status === "running",
					health: "",
				});
				setMessage("Hanna está editando…");
				let stage = "transcribing";
				await update({
					stage,
					message: "Transcrevendo a fala e entendendo o conteúdo.",
				});
				const deadline = Date.now() + 16 * 60000;
				let result = run;
				while (Date.now() < deadline) {
					await new Promise((resolve) => setTimeout(resolve, 1000));
					check();
					const current = useIntegrationStore.getState();
					if (current.health || !current.connection)
						throw new Error(current.health || "Editor desconectado.");
					if (current.agentRun?.id === run.id) {
						result = current.agentRun;
						setMessage("Hanna · " + result.steps.length + " ações");
						if (result.status !== "running") break;
						const next = result.steps.some((step) =>
							step.startsWith("Áudio transcrito"),
						)
							? "editing"
							: "transcribing";
						if (next !== stage) {
							stage = next;
							await update({
								stage,
								message:
									"Montando a edição: cortes, legendas e estilo escolhido.",
							});
						}
					}
				}
				if (result.status !== "complete")
					throw new Error(
						result.text ||
							"A edição não terminou dentro do limite. Revise o projeto.",
					);
				if (
					useOperationStore
						.getState()
						.operations.some((o) => o.status === "running")
				)
					throw new Error(
						"Há uma operação ainda em andamento. Confira o projeto antes de exportar.",
					);
				if (before === JSON.stringify(editor.scenes.getActiveScene().tracks))
					throw new Error(
						"Nenhuma alteração foi aplicada. " + result.text.slice(0, 1200),
					);
				check();
				await editor.save.flush();
				// flush can return while an earlier autosave is still in flight.
				// Wait for that queue, then verify the actual persisted timeline.
				const saveDeadline = Date.now() + 30000;
				while (editor.save.getIsDirty() && Date.now() < saveDeadline) {
					await new Promise((resolve) => setTimeout(resolve, 100));
					check();
				}
				if (editor.save.getIsDirty())
					throw new Error(
						"O salvamento não terminou. Confira o projeto antes de exportar.",
					);
				const saved = await storageService.loadProject({ id: projectId });
				const timeline = (scenes: ReturnType<typeof editor.scenes.getScenes>) =>
					JSON.stringify(
						scenes.map((scene) => ({ id: scene.id, tracks: scene.tracks })),
						(key, value) => (key === "buffer" ? undefined : value),
					);
				if (
					!saved ||
					timeline(saved.project.scenes) !== timeline(editor.scenes.getScenes())
				)
					throw new Error(
						"Não foi possível confirmar o salvamento da edição. O projeto não será marcado como pronto.",
					);
				if (!autoRender) {
					await update({
						status: "review",
						stage: "done",
						message:
							"Edição pronta na timeline. Abra o projeto para revisar e exportar. " +
							result.text.slice(0, 2000),
					});
					setMessage("Pronto para revisão.");
					return;
				}
				setMessage("Renderizando MP4…");
				await update({ stage: "rendering", message: "Renderizando o MP4 final." });
				const exported = await editor.project.export({
					options: { format: "mp4", quality: "high", includeAudio: true },
				});
				check();
				if (!exported.success || !exported.buffer)
					throw new Error(exported.error || "Exportação interrompida.");
				const asset = await uploadAsset({
					file: new File(
						[exported.buffer],
						source.name.replace(/\.[^.]+$/, "") + "-Hanna.mp4",
						{ type: "video/mp4" },
					),
					kind: "export",
					projectId,
				});
				await update({
					status: "review",
					stage: "done",
					exportAssetId: asset.id,
					message:
						"Prévia pronta. Revise a edição antes de publicar. " +
						result.text.slice(0, 2000),
				});
				setMessage("Pronto para revisão.");
			} catch (error) {
				clearOperations();
				editor.project.cancelExport();
				const connection = useIntegrationStore.getState().connection,
					run = useIntegrationStore.getState().agentRun;
				if (connection && run?.status === "running")
					void integrationRequest({
						action: "cancel_agent_run",
						...connection,
						runId: run.id,
					}).catch(() => {});
				const text =
					error instanceof Error ? error.message : "A edição falhou.";
				setMessage(text);
				if (lease) {
					await editor.save.flush().catch(() => {});
					await update({
						status: "failed",
						message: text.slice(0, 3900),
					}).catch(() => {});
				}
			} finally {
				finished = true;
				clearInterval(heartbeat);
				window.parent.postMessage(
					{ type: "hanna-worker-finished", taskId },
					window.location.origin,
				);
			}
		}
		// Delay startup by one task so React Strict Mode's probe never claims a job.
		const start = setTimeout(() => void execute(), 0);
		const unload = (event: BeforeUnloadEvent) => {
			if (finished || !lease) return;
			event.preventDefault();
		};
		// The guided Editor handoff is a route change, not a request to leave the
		// editor. Keeping a beforeunload listener here caused browsers to block that
		// handoff and left the lease stuck as “editing”.
		if (surface === "worker") window.addEventListener("beforeunload", unload);
		return () => {
			disposed = true;
			clearTimeout(start);
			clearInterval(heartbeat);
			abort.abort();
			if (surface === "worker")
				window.removeEventListener("beforeunload", unload);
			if (!finished) {
				clearOperations();
				editor.project.cancelExport();
			}
		};
	}, [editor, router, surface, taskId]);
	return (
		<div
			style={{
				background: "#0b100c",
				color: "#d9e5d5",
				height: "100dvh",
				display: "flex",
				flexDirection: "column",
			}}
		>
			<p role="status" style={{ fontSize: 11, padding: 9 }}>
				{message}
			</p>
			{ready && (
				<IntegrationRuntime preserveSessionOnUnmount={surface === "editor"} />
			)}
			{ready && surface === "worker" && (
				<div style={{ flex: 1, minHeight: 0 }}>
					<PreviewPanel
						overlayControls={[]}
						overlayInstances={[]}
						onOverlayVisibilityChange={() => {}}
					/>
				</div>
			)}
			{surface === "editor" && (
				<div
					style={{
						display: "grid",
						flex: 1,
						placeItems: "center",
						padding: 24,
					}}
				>
					<div style={{ maxWidth: 420, textAlign: "center" }}>
						<strong style={{ fontSize: 18 }}>
							Preparando sua edição ao vivo
						</strong>
						<p style={{ color: "#9eb29f", fontSize: 13, marginTop: 8 }}>
							O vídeo será aberto diretamente na timeline do Editor.
						</p>
					</div>
				</div>
			)}
		</div>
	);
}
