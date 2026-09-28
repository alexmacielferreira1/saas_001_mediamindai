import type { EditorCore } from "@/core";
import { CanvasRenderer } from "@/services/renderer/canvas-renderer";
import { buildScene } from "@/services/renderer/scene-builder";
import { VideoCache } from "@/services/video-cache/service";
import { mediaTimeFromSeconds, mediaTimeToSeconds } from "@/wasm";
import { schemas } from "./catalog";
import { frameResultSchema } from "./vision-contract";
import { useIntegrationStore } from "./client";

// Hidden and throttled tabs never run requestAnimationFrame. The handoff to the
// detached still is a courtesy, so it must never be the thing that blocks a
// capture: a timer releases the wait when no frame callback arrives.
const DETACH_HANDOFF_TIMEOUT_MS = 250;

// Browser adapter: renders through the same Rust compositor as preview/export.
// Never seeks the playhead, edits tracks, persists frames or reads source paths.
export async function captureTimelineFrames({
	editor,
	input,
}: {
	editor: EditorCore;
	input: unknown;
}) {
	const args = schemas.inspect_frames.parse(input);
	const sessionId = useIntegrationStore.getState().connection?.sessionId;
	const project = editor.project.getActive();
	const scene = editor.scenes.getActiveScene();
	const tracks = scene.tracks;
	const duration = editor.timeline.getTotalDuration();
	const end = mediaTimeToSeconds({ time: duration });
	function assertCurrent() {
		const current = useIntegrationStore.getState();
		if (
			!sessionId ||
			current.connection?.sessionId !== sessionId ||
			!current.settings.shareFramesWithAgents
		)
			throw new Error(
				"Autorize imagens em Integrações / Allow frames in Integrations.",
			);
		if (
			editor.project.getActive().metadata.id !== project.metadata.id ||
			editor.scenes.getActiveScene().id !== scene.id ||
			editor.scenes.getActiveScene().tracks !== tracks
		)
			throw new Error(
				"A timeline mudou durante a captura. Leia o estado novamente / Timeline changed during capture. Read state again.",
			);
		if (editor.project.getExportState().isExporting)
			throw new Error("Aguarde a exportação / Wait for export.");
	}
	assertCurrent();
	if (!duration || args.timesSeconds.some((t) => t >= end))
		throw new Error("Capture times must be inside the timeline duration.");
	const { canvasSize, fps, background } = project.settings;
	const tree = buildScene({
		tracks,
		mediaAssets: editor.media.getAssets(),
		duration,
		canvasSize,
		background,
	});
	const videoFrames = new VideoCache();
	const renderer = new CanvasRenderer({ ...canvasSize, fps, videoFrames });
	const target = document.createElement("canvas");
	const scale = Math.min(
		1,
		640 / Math.max(canvasSize.width, canvasSize.height),
	);
	target.width = Math.max(1, Math.round(canvasSize.width * scale));
	target.height = Math.max(1, Math.round(canvasSize.height * scale));
	const release = editor.renderer.beginDetachedCapture();
	try {
		// Give React a chance to detach the shared compositor and display a still.
		await new Promise<void>((resolve) => {
			let settled = false;
			const finish = () => {
				if (settled) return;
				settled = true;
				resolve();
			};
			requestAnimationFrame(() => requestAnimationFrame(finish));
			setTimeout(finish, DETACH_HANDOFF_TIMEOUT_MS);
		});
		const frames = [];
		for (const timeSeconds of args.timesSeconds) {
			assertCurrent();
			await renderer.renderToCanvas({
				node: tree,
				time: mediaTimeFromSeconds({ seconds: timeSeconds }),
				targetCanvas: target,
			});
			let imageUrl = target.toDataURL("image/jpeg", 0.65);
			for (const quality of [0.45, 0.25, 0.1]) {
				if (imageUrl.length <= 180000 / args.timesSeconds.length) break;
				imageUrl = target.toDataURL("image/jpeg", quality);
			}
			frames.push({
				timeSeconds,
				width: target.width,
				height: target.height,
				imageUrl,
			});
		}
		assertCurrent();
		return frameResultSchema.parse({
			kind: "timeline_frames",
			projectId: project.metadata.id,
			sceneId: scene.id,
			frames,
		});
	} finally {
		videoFrames.clearAll();
		release();
	}
}
