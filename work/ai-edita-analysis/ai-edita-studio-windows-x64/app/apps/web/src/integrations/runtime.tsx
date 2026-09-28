"use client";

import { useEffect } from "react";
import { useEditor } from "@/editor/use-editor";
import { isEditingTool, isToolName } from "./catalog";
import { executeEditorTool } from "./editor-adapter";
import {
	IntegrationApiError,
	integrationRequest,
	pollResponseSchema,
	useIntegrationStore,
	connectionSchema,
	settingsSchema,
} from "./client";
import type { ToolReply } from "./server";
import { clearOperations } from "./operations";
import { useStudioStore } from "./studio-store";

const HANNA_HANDOFF_SESSION_KEY = "ai-edita-hanna-handoff";

// Unmounting the runtime used to disconnect its session at once. React remounts effects
// right away in development and when the Editor takes over a Hanna run from the guided
// screen, so that disconnect killed the run that had just started ("A sessão da Hanna se
// perdeu"). Disconnects now wait a moment and are cancelled when the same session is
// picked up again.
const DISCONNECT_GRACE_MS = 1500;
const pendingDisconnects = new Map<
	string,
	{ timer: ReturnType<typeof setTimeout>; send: () => void }
>();
// A closing page (tab, or a Queue worker frame being removed) cannot wait for the timer.
if (typeof window !== "undefined")
	window.addEventListener("pagehide", () => {
		for (const [sessionId, pending] of pendingDisconnects) {
			clearTimeout(pending.timer);
			pendingDisconnects.delete(sessionId);
			pending.send();
		}
	});

// The bridge runs one command at a time, so a tool that never settles wedges
// every later command until the tab is reloaded. The server gives up at 25s;
// stop waiting before that and report the failure so the loop keeps polling.
const TOOL_EXECUTION_TIMEOUT_MS = 20_000;

async function executeWithTimeout<T>({
	run,
	name,
}: {
	run: () => Promise<T>;
	name: string;
}): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			run(),
			new Promise<never>((_, reject) => {
				timer = setTimeout(
					() =>
						reject(
							new Error(
								`A ferramenta ${name} não respondeu a tempo. Mantenha a aba do editor visível e tente de novo. / Tool ${name} did not respond in time. Keep the editor tab visible and retry.`,
							),
						),
					TOOL_EXECUTION_TIMEOUT_MS,
				);
			}),
		]);
	} finally {
		if (timer) clearTimeout(timer);
	}
}

function restoreHannaHandoff({ projectId }: { projectId: string }) {
	try {
		const raw = sessionStorage.getItem(HANNA_HANDOFF_SESSION_KEY);
		if (!raw) return false;
		const value = JSON.parse(raw) as {
			projectId?: unknown;
			connection?: unknown;
		};
		if (value.projectId !== projectId) return false;
		sessionStorage.removeItem(HANNA_HANDOFF_SESSION_KEY);
		const connection = connectionSchema.safeParse(value.connection);
		if (!connection.success) return false;
		useIntegrationStore.setState({
			connection: connection.data,
			settings: connection.data,
			health: "",
		});
		return true;
	} catch {
		sessionStorage.removeItem(HANNA_HANDOFF_SESSION_KEY);
		return false;
	}
}

export function IntegrationRuntime({
	preserveSessionOnUnmount = false,
}: {
	preserveSessionOnUnmount?: boolean;
}) {
	const editor = useEditor();
	const connection = useIntegrationStore((state) => state.connection);
	useEffect(() => {
		if (connection) return;
		let stopped = false;
		async function autoConnect() {
			try {
				const activeProjectId = editor.project.getActiveOrNull()?.metadata.id;
				if (
					activeProjectId &&
					restoreHannaHandoff({ projectId: activeProjectId })
				)
					return;
				const response = await fetch("/api/workspace", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"x-opencut-client": "integrations",
					},
					body: JSON.stringify({ action: "snapshot" }),
				});
				if (!response.ok) return;
				const { settings } = await response.json();
				const projectId = editor.project.getActiveOrNull()?.metadata.id;
				const sceneId = editor.scenes.getActiveSceneOrNull()?.id;
				if (
					stopped ||
					!settings.autoConnect ||
					!projectId ||
					!sceneId ||
					useIntegrationStore.getState().connection
				)
					return;
				const result = connectionSchema.parse(
					await integrationRequest({ action: "connect", projectId, sceneId }),
				);
				if (stopped) {
					void integrationRequest({ action: "disconnect", ...result });
					return;
				}
				useIntegrationStore.setState({
					connection: result,
					settings: result,
					health: "",
				});
			} catch {
				/* Retry when configuration or connectivity changes. */
			}
		}
		void autoConnect();
		const timer = setInterval(() => void autoConnect(), 5000);
		return () => {
			stopped = true;
			clearInterval(timer);
		};
	}, [connection, editor, preserveSessionOnUnmount]);
	useEffect(() => {
		if (!connection) return;
		const pendingDisconnect = pendingDisconnects.get(connection.sessionId);
		if (pendingDisconnect) {
			clearTimeout(pendingDisconnect.timer);
			pendingDisconnects.delete(connection.sessionId);
		}
		let stopped = false;
		let timer: ReturnType<typeof setTimeout>;
		let completed: { id: string; reply: ToolReply } | null = null;
		let lastSuccess = Date.now();
		let lastSceneId = editor.scenes.getActiveSceneOrNull()?.id;
		const controller = new AbortController();
		const heartbeat = setInterval(() => {
			void integrationRequest({
				action: "heartbeat",
				...connection,
			}).catch((error) => {
				if (
					error instanceof IntegrationApiError &&
					[401, 409].includes(error.status) &&
					useIntegrationStore.getState().connection?.sessionId ===
						connection.sessionId
				)
					useIntegrationStore.setState({
						connection: null,
						chatBusy: false,
						health: "",
					});
			});
		}, 10_000);
		const unsubscribe = useIntegrationStore.subscribe((current, previous) => {
			if (
				(previous.settings.allowEdits && !current.settings.allowEdits) ||
				(previous.settings.shareAudioWithOpenAI &&
					!current.settings.shareAudioWithOpenAI) ||
				(previous.settings.shareWithOpenAI && !current.settings.shareWithOpenAI)
			)
				clearOperations();
		});
		async function tick() {
			try {
				if (completed) {
					await integrationRequest({
						action: "result",
						...connection,
						...completed,
						signal: controller.signal,
					});
					completed = null;
				}
				const projectId = editor.project.getActiveOrNull()?.metadata.id;
				const sceneId = editor.scenes.getActiveSceneOrNull()?.id;
				if (!projectId || !sceneId) return;
				if (sceneId !== lastSceneId) {
					clearOperations();
					lastSceneId = sceneId;
				}
				const result = pollResponseSchema.parse(
					await integrationRequest({
						action: "poll",
						...connection,
						projectId,
						sceneId,
						focused: document.hasFocus(),
						signal: controller.signal,
					}),
				);
				if (stopped) return;
				const { job, agentRun } = result;
				useIntegrationStore.setState({
					settings: settingsSchema.parse(result),
				});
				if (agentRun) {
					useIntegrationStore.setState({
						agentRun:
							agentRun.projectId === projectId && agentRun.sceneId === sceneId
								? agentRun
								: null,
						chatBusy: agentRun.status === "running",
					});
					if (
						agentRun.status !== "running" &&
						useIntegrationStore.getState().reportedRunId !== agentRun.id
					) {
						useIntegrationStore.setState({ reportedRunId: agentRun.id });
						useStudioStore.getState().append({
							key: agentRun.projectId + ":" + agentRun.sceneId,
							role: "assistant",
							content:
								agentRun.text ||
								"Execução encerrada; confira a atividade. / Run ended; inspect activity.",
						});
					}
				} else useIntegrationStore.setState({ agentRun: null });
				lastSuccess = Date.now();
				useIntegrationStore.setState({ health: "", lastPollAt: lastSuccess });
				if (job) {
					let reply: ToolReply;
					try {
						const current = useIntegrationStore.getState();
						if (job.expiresAt <= Date.now())
							throw new Error("Command expired before execution.");
						if (
							job.projectId !== editor.project.getActiveOrNull()?.metadata.id ||
							job.sceneId !== editor.scenes.getActiveSceneOrNull()?.id
						)
							throw new Error(
								"Project or scene changed. Read the editor state again.",
							);
						if (!isToolName(job.name)) throw new Error("Unknown editor tool.");
						if (
							current.connection?.sessionId !== connection?.sessionId ||
							(isEditingTool(job.name) && !current.settings.allowEdits) ||
							(job.name === "inspect_frames" &&
								!current.settings.shareFramesWithAgents) ||
							(job.name === "transcribe_timeline" &&
								!current.settings.shareAudioWithOpenAI) ||
							(job.source === "OpenAI" && !current.settings.shareWithOpenAI)
						)
							throw new Error("Permission revoked in Integrations.");
						reply = {
							ok: true,
							data: await executeWithTimeout({
								name: job.name,
								run: () =>
									executeEditorTool({
										editor,
										name: job.name,
										input: job.args,
										source: job.source,
									}),
							}),
						};
					} catch (error) {
						reply = {
							ok: false,
							error:
								error instanceof Error
									? error.message.slice(0, 2000)
									: "Editor command failed.",
						};
					}
					if (
						new TextEncoder().encode(JSON.stringify(reply)).byteLength > 200000
					)
						reply = {
							ok: false,
							error:
								"Result too large for the bridge. For get_operation, request a smaller limit. Completed work has not been undone; do not repeat edits.",
						};
					useIntegrationStore.getState().addActivity({ job, reply });
					completed = { id: job.id, reply };
					await integrationRequest({
						action: "result",
						...connection,
						...completed,
						signal: controller.signal,
					});
					completed = null;
				}
			} catch (error) {
				if (stopped) return;
				useIntegrationStore.setState({
					health: error instanceof Error ? error.message : "Connection failed.",
				});
				if (
					(error instanceof IntegrationApiError &&
						[401, 409].includes(error.status)) ||
					Date.now() - lastSuccess > 25_000
				)
					useIntegrationStore.setState({ connection: null, chatBusy: false });
			} finally {
				if (!stopped) timer = setTimeout(() => void tick(), 750);
			}
		}
		void tick();
		return () => {
			stopped = true;
			unsubscribe();
			if (preserveSessionOnUnmount) {
				clearInterval(heartbeat);
				clearTimeout(timer);
				controller.abort();
				return;
			}
			clearInterval(heartbeat);
			clearTimeout(timer);
			controller.abort();
			const { sessionId } = connection;
			const previous = pendingDisconnects.get(sessionId);
			if (previous) clearTimeout(previous.timer);
			const send = () => {
				clearOperations();
				void fetch("/api/integrations", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"x-opencut-client": "integrations",
					},
					body: JSON.stringify({ action: "disconnect", ...connection }),
					keepalive: true,
				}).catch(() => {});
				if (useIntegrationStore.getState().connection?.sessionId === sessionId)
					useIntegrationStore.setState({ connection: null, chatBusy: false });
			};
			pendingDisconnects.set(sessionId, {
				send,
				timer: setTimeout(() => {
					pendingDisconnects.delete(sessionId);
					send();
				}, DISCONNECT_GRACE_MS),
			});
		};
	}, [connection, editor]);
	return null;
}
