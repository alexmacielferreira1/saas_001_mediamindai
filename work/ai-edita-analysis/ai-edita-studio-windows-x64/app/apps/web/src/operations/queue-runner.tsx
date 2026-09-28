"use client";

import { useEffect, useState } from "react";
import { useWorkspace, workspaceRequest } from "./client";

const STALE_MS = 120000;
// A single video sent to the Editor gets this long to be claimed by that tab before any
// queue page may pick it up (e.g. if the person closed the tab right away).
const EDITOR_CLAIM_MS = 120000;

/**
 * Runs queued Hanna edits one at a time in an isolated worker frame. Any open page that
 * mounts this hook advances the line; the server lease keeps two tabs from double-claiming.
 */
export function useHannaQueueRunner({
	requestedTaskId = "",
	onError,
}: {
	requestedTaskId?: string;
	onError?: (message: string) => void;
} = {}) {
	const { data, refresh } = useWorkspace();
	const [workerId, setWorkerId] = useState("");
	useEffect(() => {
		if (!requestedTaskId || workerId || !data) return;
		const task = data.tasks.find((candidate) => candidate.id === requestedTaskId);
		if (task?.status !== "queued") return;
		const timer = setTimeout(() => setWorkerId(task.id), 0);
		return () => clearTimeout(timer);
	}, [data, requestedTaskId, workerId]);
	useEffect(() => {
		if (
			!workerId &&
			data?.settings.allowEdits &&
			data.settings.shareWithOpenAI &&
			data.settings.hasOpenAIKey
		) {
			const next = data.tasks.some(
				(t) =>
					t.status === "editing" &&
					Date.now() - Date.parse(t.updatedAt) < STALE_MS,
			)
				? undefined
				: // Oldest first, so a batch runs in the order it was added.
					data.tasks.find(
						(t) =>
							t.status === "queued" &&
							!(
								t.openInEditor &&
								t.id !== requestedTaskId &&
								Date.now() - Date.parse(t.createdAt) < EDITOR_CLAIM_MS
							),
					);
			if (next) {
				const timer = setTimeout(() => setWorkerId(next.id), 0);
				return () => clearTimeout(timer);
			}
		}
	}, [data, workerId, requestedTaskId]);
	useEffect(() => {
		if (!workerId || !data) return;
		const task = data.tasks.find((candidate) => candidate.id === workerId);
		const stale =
			task?.status === "editing" &&
			Date.now() - Date.parse(task.updatedAt) >= STALE_MS;
		if (stale) {
			const timer = setTimeout(() => setWorkerId(""), 0);
			void workspaceRequest({ action: "cancel_edit", taskId: task.id })
				.then(refresh)
				.catch((reason: unknown) =>
					onError?.(reason instanceof Error ? reason.message : "A tarefa parou."),
				);
			return () => clearTimeout(timer);
		}
		if (!task || !["queued", "editing"].includes(task.status)) {
			const timer = setTimeout(() => setWorkerId(""), 0);
			return () => clearTimeout(timer);
		}
	}, [data, workerId, refresh, onError]);
	useEffect(() => {
		const receive = (event: MessageEvent) => {
			if (
				event.origin !== window.location.origin ||
				event.data?.type !== "hanna-worker-finished" ||
				event.data.taskId !== workerId
			)
				return;
			void refresh().then(() => setWorkerId(""));
		};
		window.addEventListener("message", receive);
		return () => window.removeEventListener("message", receive);
	}, [workerId, refresh]);
	return { workerId };
}

export function HannaWorkerFrame({
	taskId,
	style,
	className,
}: {
	taskId: string;
	style?: React.CSSProperties;
	className?: string;
}) {
	return (
		<iframe
			key={taskId}
			src={"/hanna/work?task=" + encodeURIComponent(taskId)}
			title="Motor de edição da Hanna"
			className={className}
			style={style}
			allow="autoplay"
		/>
	);
}

/** Keeps the screen awake while the queue has work (best effort; not all browsers). */
export function useWakeLock(active: boolean) {
	useEffect(() => {
		if (!active || !("wakeLock" in navigator)) return;
		let lock: WakeLockSentinel | undefined;
		let cancelled = false;
		const request = () =>
			navigator.wakeLock
				.request("screen")
				.then((sentinel) => {
					if (cancelled) void sentinel.release();
					else lock = sentinel;
				})
				.catch(() => {});
		void request();
		const visible = () => {
			if (document.visibilityState === "visible" && (!lock || lock.released))
				void request();
		};
		document.addEventListener("visibilitychange", visible);
		return () => {
			cancelled = true;
			document.removeEventListener("visibilitychange", visible);
			void lock?.release().catch(() => {});
		};
	}, [active]);
}
