"use client";

import { useEffect, useMemo, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { useEditor } from "@/editor/use-editor";
import { mediaTimeToSeconds } from "@/wasm";
import { AiEditaRemotionComposition } from "./composition";
import { buildRemotionSnapshot } from "./snapshot";

export function RemotionPreview() {
	const playerRef = useRef<PlayerRef>(null);
	const editor = useEditor();
	const project = useEditor((state) => state.project.getActive());
	const tracks = useEditor(
		(state) => state.timeline.getPreviewTracks() ?? state.scenes.getActiveScene().tracks,
	);
	const mediaAssets = useEditor((state) => state.media.getAssets());
	const duration = useEditor((state) => state.timeline.getTotalDuration());
	const snapshot = useMemo(
		() =>
			buildRemotionSnapshot({
				project,
				tracks,
				mediaAssets,
				duration,
				includeAudio: false,
			}),
		[project, tracks, mediaAssets, duration],
	);

	useEffect(() => {
		const seek = (time: Parameters<typeof mediaTimeToSeconds>[0]["time"]) => {
			const frame = Math.max(
				0,
				Math.min(
					snapshot.durationInFrames - 1,
					Math.round(mediaTimeToSeconds({ time }) * snapshot.fps),
				),
			);
			playerRef.current?.seekTo(frame);
		};
		seek(editor.playback.getCurrentTime());
		const offUpdate = editor.playback.onUpdate(seek);
		const offSeek = editor.playback.onSeek(seek);
		return () => {
			offUpdate();
			offSeek();
		};
	}, [editor.playback, snapshot.durationInFrames, snapshot.fps]);

	return (
		<div className="size-full bg-black" data-remotion-preview="true">
			<Player
				ref={playerRef}
				component={AiEditaRemotionComposition}
				inputProps={snapshot}
				durationInFrames={snapshot.durationInFrames}
				compositionWidth={snapshot.width}
				compositionHeight={snapshot.height}
				fps={snapshot.fps}
				controls={false}
				clickToPlay={false}
				loop={false}
				initialFrame={0}
				acknowledgeRemotionLicense
				style={{ width: "100%", height: "100%" }}
			/>
		</div>
	);
}
