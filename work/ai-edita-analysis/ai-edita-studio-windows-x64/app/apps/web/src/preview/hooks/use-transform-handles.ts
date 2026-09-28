import { useEffect, useMemo, useReducer, useState } from "react";
import { usePreviewViewport } from "@/preview/components/preview-viewport";
import type { OnSnapLinesChange } from "@/preview/hooks/use-preview-interaction";
import { useEditor } from "@/editor/use-editor";
import { useCommittedRef } from "@/hooks/use-committed-ref";
import { useShiftKey } from "@/hooks/use-shift-key";
import { registerCanceller } from "@/editor/cancel-interaction";
import {
	TransformHandleController,
	type TransformHandleDeps,
} from "@/preview/controllers/transform-handle-controller";
import {
	linkCaptionVisualPreviewUpdates,
	useCaptionStyleLinkStore,
} from "@/components/editor/panels/properties/components/caption-style-link";
import { getVisibleElementsWithBounds } from "@/preview/element-bounds";
import { resolveSelectedElementWithBounds } from "@/preview/selection-bounds";

export function useTransformHandles({
	onSnapLinesChange,
}: {
	onSnapLinesChange?: OnSnapLinesChange;
}) {
	const viewport = usePreviewViewport();
	const editor = useEditor();
	const isShiftHeldRef = useShiftKey();
	const selectedElements = useEditor((e) => e.selection.getSelectedElements());
	const tracks = useEditor(
		(e) => e.timeline.getPreviewTracks() ?? e.scenes.getActiveScene().tracks,
	);
	const currentTime = useEditor((e) => e.playback.getCurrentTime());
	const mediaAssets = useEditor((e) => e.media.getAssets());
	const applyToAllCaptions = useCaptionStyleLinkStore(
		(state) => state.applyToAll,
	);
	const canvasSize = useEditor(
		(e) => e.project.getActive().settings.canvasSize,
	);
	const deps: TransformHandleDeps = {
		viewport,
		input: {
			isShiftHeld: () => isShiftHeldRef.current,
		},
		scene: {
			getSelectedElements: () => selectedElements,
			getTracks: () => tracks,
			getCurrentTime: () => currentTime,
			getMediaAssets: () => mediaAssets,
			getCanvasSize: () => canvasSize,
		},
		timeline: {
			previewElements: (updates) =>
				editor.timeline.previewElements({
					updates: applyToAllCaptions
						? linkCaptionVisualPreviewUpdates({ tracks, updates })
						: updates,
				}),
			commitPreview: () => editor.timeline.commitPreview(),
			discardPreview: () => editor.timeline.discardPreview(),
		},
		preview: {
			onSnapLinesChange,
		},
	};
	const depsRef = useCommittedRef(deps);
	const [controller] = useState(
		() => new TransformHandleController({ depsRef }),
	);

	const [, rerender] = useReducer((n: number) => n + 1, 0);
	useEffect(() => controller.subscribe(rerender), [controller]);

	useEffect(() => {
		if (!controller.isActive) return;
		return registerCanceller({ fn: () => controller.cancel() });
	}, [controller, controller.isActive]);

	useEffect(() => () => controller.destroy(), [controller]);

	// The controller reads committed dependencies for pointer events. Resolve the
	// rendered outline from this render's state so switching layers cannot show
	// the previously selected element for one render.
	const selectedWithBounds = useMemo(
		() =>
			resolveSelectedElementWithBounds({
				selectedElements,
				elementsWithBounds: getVisibleElementsWithBounds({
					tracks,
					currentTime,
					canvasSize,
					mediaAssets,
				}),
			}),
		[selectedElements, tracks, currentTime, canvasSize, mediaAssets],
	);
	const hasVisualSelection = selectedWithBounds !== null;

	return {
		selectedWithBounds,
		hasVisualSelection,
		activeHandle: controller.activeHandle,
		handleCornerPointerDown: controller.onCornerPointerDown,
		handleEdgePointerDown: controller.onEdgePointerDown,
		handleRotationPointerDown: controller.onRotationPointerDown,
		handlePointerMove: controller.onPointerMove,
		handlePointerUp: controller.onPointerUp,
	};
}
