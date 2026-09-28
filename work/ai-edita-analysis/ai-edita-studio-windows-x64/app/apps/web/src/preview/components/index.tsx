"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useDeepCompareEffect from "use-deep-compare-effect";
import { useEditor } from "@/editor/use-editor";
import { useRafLoop } from "@/hooks/use-raf-loop";
import { useContainerSize } from "@/hooks/use-container-size";
import { useFullscreen } from "@/hooks/use-fullscreen";
import { CanvasRenderer } from "@/services/renderer/canvas-renderer";
import { VideoCache } from "@/services/video-cache/service";
import { TICKS_PER_SECOND } from "@/wasm";
import type { RootNode } from "@/services/renderer/nodes/root-node";
import { buildScene } from "@/services/renderer/scene-builder";
import { PreviewOverlayLayer } from "./overlay-layer";
import { PreviewInteractionOverlay } from "./preview-interaction-overlay";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import type {
	PreviewOverlayControl,
	PreviewOverlayInstance,
} from "@/preview/overlays";
import { PreviewContextMenu } from "./context-menu";
import { PreviewToolbar } from "./toolbar";
import {
	PreviewViewportProvider,
	usePreviewViewportState,
} from "./preview-viewport";

function usePreviewSize() {
	const canvasSize = useEditor(
		(e) => e.project.getActive()?.settings.canvasSize,
	);

	return {
		width: canvasSize?.width,
		height: canvasSize?.height,
	};
}

function normalizeWheelDelta({
	delta,
	deltaMode,
	pageSize,
}: {
	delta: number;
	deltaMode: number;
	pageSize: number;
}): number {
	if (deltaMode === WheelEvent.DOM_DELTA_LINE) {
		return delta * 16;
	}

	if (deltaMode === WheelEvent.DOM_DELTA_PAGE) {
		return delta * pageSize;
	}

	return delta;
}

export function PreviewPanel({
	overlayControls,
	overlayInstances,
	onOverlayVisibilityChange,
}: {
	overlayControls: PreviewOverlayControl[];
	overlayInstances: PreviewOverlayInstance[];
	onOverlayVisibilityChange: (params: {
		overlayId: string;
		isVisible: boolean;
	}) => void;
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [container, setContainer] = useState<HTMLDivElement | null>(null);
	const { toggleFullscreen } = useFullscreen({ containerRef });
	const handleContainerRef = useCallback((node: HTMLDivElement | null) => {
		containerRef.current = node;
		setContainer(node);
	}, []);

	return (
		<div
			ref={handleContainerRef}
			className="panel bg-background relative flex size-full min-h-0 min-w-0 flex-col rounded-sm border"
		>
			<PreviewCanvas
				container={container}
				onToggleFullscreen={toggleFullscreen}
				overlayControls={overlayControls}
				overlayInstances={overlayInstances}
				onOverlayVisibilityChange={onOverlayVisibilityChange}
			/>
			<RenderTreeController />
		</div>
	);
}

function RenderTreeController() {
	const editor = useEditor();
	const tracks = useEditor(
		(e) => e.timeline.getPreviewTracks() ?? e.scenes.getActiveScene().tracks,
	);
	const mediaAssets = useEditor((e) => e.media.getAssets());
	const activeProject = useEditor((e) => e.project.getActive());

	const { width, height } = usePreviewSize();

	useDeepCompareEffect(() => {
		if (!activeProject) return;

		const duration = editor.timeline.getTotalDuration();
		const renderTree = buildScene({
			tracks,
			mediaAssets,
			duration,
			canvasSize: { width, height },
			background: activeProject.settings.background,
			isPreview: true,
		});

		editor.renderer.setRenderTree({ renderTree });
	}, [tracks, mediaAssets, activeProject?.settings.background, width, height]);

	return null;
}

function PreviewCanvas({
	container,
	onToggleFullscreen,
	overlayControls,
	overlayInstances,
	onOverlayVisibilityChange,
}: {
	container: HTMLElement | null;
	onToggleFullscreen: () => void;
	overlayControls: PreviewOverlayControl[];
	overlayInstances: PreviewOverlayInstance[];
	onOverlayVisibilityChange: (params: {
		overlayId: string;
		isVisible: boolean;
	}) => void;
}) {
	const canvasMountRef = useRef<HTMLDivElement>(null);
	const viewportRef = useRef<HTMLDivElement>(null);
	// Last frame copied out of the compositor while it was still ours to read.
	const posterRef = useRef<HTMLCanvasElement | null>(null);
	const posterTimeRef = useRef(0);
	const lastFrameRef = useRef(-1);
	const lastSceneRef = useRef<RootNode | null>(null);
	const renderingRef = useRef(false);
	const { width: nativeWidth, height: nativeHeight } = usePreviewSize();
	const viewportSize = useContainerSize({ containerRef: viewportRef });
	const editor = useEditor();
	const activeProject = useEditor((e) => e.project.getActive());
	// Preview always uses the same Canvas path as export, including legacy projects.
	const renderTree = useEditor((e) => e.renderer.getRenderTree());
	const isExporting = useEditor((e) => e.project.getExportState().isExporting);
	const isCapturing = useEditor((e) => e.renderer.isCapturing);
	const isDetached = isExporting || isCapturing;
	const viewport = usePreviewViewportState({
		canvasHeight: nativeHeight,
		canvasWidth: nativeWidth,
		viewportHeight: viewportSize.height,
		viewportRef,
		viewportWidth: viewportSize.width,
	});
	const { canPan, panByScreenDelta, scaleZoom } = viewport;

	// Frame inspection, thumbnail generation and export may seek the same source
	// aggressively. Keep playback on its own cache so those detached renderers
	// cannot leave the visible preview waiting on a stale or cancelled seek.
	const videoFrames = useMemo(() => {
		void activeProject.metadata.id;
		return new VideoCache();
	}, [activeProject.metadata.id]);
	useEffect(() => () => videoFrames.clearAll(), [videoFrames]);
	const renderer = useMemo(() => {
		return new CanvasRenderer({
			width: nativeWidth,
			height: nativeHeight,
			fps: activeProject.settings.fps,
			videoFrames,
		});
	}, [nativeWidth, nativeHeight, activeProject.settings.fps, videoFrames]);

	// Mount the compositor's output canvas directly into the preview. wgpu
	// renders straight into this element, so there is no intermediate copy —
	// the container div owns positioning/styling, the canvas itself fills it.
	useEffect(() => {
		const mount = canvasMountRef.current;
		if (!mount) return;
		const outputCanvas = renderer.getOutputCanvas();
		// The Rust compositor owns one canvas. Show a still while the detached
		// compositor renders export frames; never display the export as playback.
		//
		// Only export earns the swap. Agent frame captures last a few hundred
		// milliseconds, and the still is copied out of an already-presented wgpu
		// canvas, so it reads back blank — swapping for one would turn every
		// `inspect_frames` call into a black preview. A brief flicker of the real
		// compositor output is the better trade.
		if (isExporting) {
			// Reading back the wgpu canvas here returns a blank frame — it has already been
			// presented — which is why the preview went black during an export. Show the
			// poster captured while the compositor was still rendering for us.
			const poster = posterRef.current;
			const still = document.createElement("canvas");
			still.width = outputCanvas.width || poster?.width || 2;
			still.height = outputCanvas.height || poster?.height || 2;
			still.dataset.exportPreview = "frozen";
			still.style.cssText = "display:block;width:100%;height:100%";
			const context = still.getContext("2d");
			if (context && poster) {
				context.drawImage(poster, 0, 0, still.width, still.height);
			} else if (context) {
				context.fillStyle = "#0b0f0c";
				context.fillRect(0, 0, still.width, still.height);
			}
			mount.appendChild(still);
			return () => {
				still.remove();
			};
		}
		outputCanvas.style.display = "block";
		outputCanvas.style.width = "100%";
		outputCanvas.style.height = "100%";
		mount.appendChild(outputCanvas);
		return () => {
			if (outputCanvas.parentElement === mount) {
				mount.removeChild(outputCanvas);
			}
		};
	}, [renderer, isExporting]);

	useEffect(() => {
		if (!isDetached) {
			lastFrameRef.current = -1;
			lastSceneRef.current = null;
		}
	}, [isDetached]);

	const render = useCallback(() => {
		if (
			!renderTree ||
			renderingRef.current ||
			editor.project.getExportState().isExporting ||
			editor.renderer.isCapturing
		)
			return;

		const renderTime = Math.min(
			editor.playback.getCurrentTime(),
			editor.timeline.getLastFrameTime(),
		);
		const ticksPerFrame = Math.round(
			(TICKS_PER_SECOND * renderer.fps.denominator) / renderer.fps.numerator,
		);
		const frame = Math.floor(renderTime / ticksPerFrame);

		if (frame === lastFrameRef.current && renderTree === lastSceneRef.current) {
			return;
		}

		renderingRef.current = true;
		renderer
			.render({
				node: renderTree,
				time: renderTime,
				// Runs right after the compositor draws, the only moment its canvas reads
				// back with pixels in it. Twice a second is enough for a freeze frame.
				capture: () => {
					const now = Date.now();
					if (now - posterTimeRef.current < 500) return;
					posterTimeRef.current = now;
					const source = renderer.getOutputCanvas();
					if (!source.width || !source.height) return;
					const poster = (posterRef.current ??= document.createElement("canvas"));
					poster.width = source.width;
					poster.height = source.height;
					poster.getContext("2d")?.drawImage(source, 0, 0);
				},
			})
			.then(() => {
				lastSceneRef.current = renderTree;
				lastFrameRef.current = frame;
			})
			.catch((error: unknown) => {
				console.error("Preview render failed:", error);
			})
			.finally(() => {
				renderingRef.current = false;
			});
	}, [
		renderer,
		renderTree,
		editor.playback,
		editor.timeline,
		editor.project,
		editor.renderer,
	]);

	useRafLoop(render);

	useEffect(() => {
		const container = viewportRef.current;
		if (!container) return;

		let pendingZoomDelta = 0;
		let pendingPanDeltaX = 0;
		let pendingPanDeltaY = 0;
		let zoomRafId: ReturnType<typeof requestAnimationFrame> | null = null;
		let panRafId: ReturnType<typeof requestAnimationFrame> | null = null;

		const onWheel = (event: WheelEvent) => {
			const normalizedDeltaX = normalizeWheelDelta({
				delta: event.deltaX,
				deltaMode: event.deltaMode,
				pageSize: container.clientWidth,
			});
			const normalizedDeltaY = normalizeWheelDelta({
				delta: event.deltaY,
				deltaMode: event.deltaMode,
				pageSize: container.clientHeight,
			});
			const isZoomGesture = event.ctrlKey || event.metaKey;
			if (isZoomGesture) {
				event.preventDefault();
				pendingZoomDelta += normalizedDeltaY;

				if (zoomRafId === null) {
					zoomRafId = requestAnimationFrame(() => {
						const cappedDelta =
							Math.sign(pendingZoomDelta) *
							Math.min(Math.abs(pendingZoomDelta), 30);
						const zoomFactor = Math.exp(-cappedDelta / 300);

						scaleZoom({ factor: zoomFactor });
						pendingZoomDelta = 0;
						zoomRafId = null;
					});
				}

				return;
			}

			if (!canPan) {
				return;
			}

			if (normalizedDeltaX === 0 && normalizedDeltaY === 0) {
				return;
			}

			event.preventDefault();
			pendingPanDeltaX += normalizedDeltaX;
			pendingPanDeltaY += normalizedDeltaY;

			if (panRafId === null) {
				panRafId = requestAnimationFrame(() => {
					panByScreenDelta({
						deltaX: pendingPanDeltaX,
						deltaY: pendingPanDeltaY,
					});
					pendingPanDeltaX = 0;
					pendingPanDeltaY = 0;
					panRafId = null;
				});
			}
		};

		container.addEventListener("wheel", onWheel, {
			capture: true,
			passive: false,
		});

		return () => {
			container.removeEventListener("wheel", onWheel, {
				capture: true,
			});
			if (zoomRafId !== null) {
				cancelAnimationFrame(zoomRafId);
			}
			if (panRafId !== null) {
				cancelAnimationFrame(panRafId);
			}
		};
	}, [canPan, panByScreenDelta, scaleZoom]);

	return (
		<PreviewViewportProvider value={viewport}>
			<div className="flex size-full min-h-0 min-w-0 flex-col">
				<div className="flex min-h-0 min-w-0 flex-1 p-2 pb-0">
					<ContextMenu>
						<ContextMenuTrigger asChild>
							<div
								ref={viewportRef}
								className="relative flex size-full min-h-0 min-w-0 items-center justify-center overflow-hidden"
							>
								<div
									ref={canvasMountRef}
									className="absolute block overflow-hidden border"
									data-video-engine="canvas"
									style={{
										left: viewport.sceneLeft,
										top: viewport.sceneTop,
										width: viewport.sceneWidth,
										height: viewport.sceneHeight,
										background:
											activeProject.settings.background.type === "blur"
												? "transparent"
												: activeProject.settings.background.color,
									}}
								/>
								<PreviewOverlayLayer
									instances={overlayInstances}
									plane="under-interaction"
								/>
								<PreviewInteractionOverlay />
								<PreviewOverlayLayer
									instances={overlayInstances}
									plane="over-interaction"
								/>
							</div>
						</ContextMenuTrigger>
						<PreviewContextMenu
							onToggleFullscreen={onToggleFullscreen}
							container={container}
							overlayControls={overlayControls}
							onOverlayVisibilityChange={onOverlayVisibilityChange}
						/>
					</ContextMenu>
				</div>
				<PreviewToolbar onToggleFullscreen={onToggleFullscreen} />
			</div>
		</PreviewViewportProvider>
	);
}
