import React from "react";
import { Composition, registerRoot } from "remotion";
import { AiEditaRemotionComposition } from "./composition";
import type { RemotionProjectSnapshot } from "./types";

const placeholder: RemotionProjectSnapshot = {
	schema: "ai-edita.remotion-snapshot",
	version: 1,
	projectId: "placeholder",
	sceneId: "placeholder",
	projectVersion: 1,
	name: "AI Edita",
	createdAt: new Date(0).toISOString(),
	width: 1080,
	height: 1920,
	fps: 30,
	durationInFrames: 30,
	includeAudio: true,
	background: { type: "color", color: "#000000" },
	media: [],
	visual: [],
	audio: [],
	warnings: [],
};

const RemotionRoot: React.FC = () => (
	<Composition
		id="AiEditaVideo"
		component={AiEditaRemotionComposition}
		width={placeholder.width}
		height={placeholder.height}
		fps={placeholder.fps}
		durationInFrames={placeholder.durationInFrames}
		defaultProps={placeholder}
		calculateMetadata={({ props }) => ({
			width: props.width,
			height: props.height,
			fps: props.fps,
			durationInFrames: props.durationInFrames,
		})}
	/>
);

registerRoot(RemotionRoot);
