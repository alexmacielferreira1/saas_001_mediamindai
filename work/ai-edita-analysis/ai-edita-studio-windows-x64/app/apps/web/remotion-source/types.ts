export type RemotionParamValue = number | string | boolean;

export type RemotionAnimationKey = {
	time: number;
	value: RemotionParamValue;
	segmentToNext?: "step" | "linear" | "bezier";
};

export type RemotionAnimationChannel = {
	keys: RemotionAnimationKey[];
};

export type RemotionAnimations = Record<
	string,
	RemotionAnimationChannel | Record<string, RemotionAnimationChannel | undefined> | undefined
>;

export type RemotionMediaSource = {
	id: string;
	type: "video" | "image" | "audio";
	src: string;
	width?: number;
	height?: number;
};

export type RemotionVisualElement = {
	id: string;
	name: string;
	type: "video" | "image" | "text";
	layer: number;
	timelineStartSeconds: number;
	timelineDurationSeconds: number;
	sourceStartSeconds: number;
	playbackRate: number;
	mediaId?: string;
	includeSourceAudio?: boolean;
	params: Record<string, RemotionParamValue>;
	animations?: RemotionAnimations;
};

export type RemotionAudioElement = {
	id: string;
	name: string;
	timelineStartSeconds: number;
	timelineDurationSeconds: number;
	sourceStartSeconds: number;
	playbackRate: number;
	mediaId?: string;
	src?: string;
	params: Record<string, RemotionParamValue>;
};

export type RemotionProjectSnapshot = {
	schema: "ai-edita.remotion-snapshot";
	version: 1;
	projectId: string;
	sceneId: string;
	projectVersion: number;
	name: string;
	createdAt: string;
	width: number;
	height: number;
	fps: number;
	durationInFrames: number;
	includeAudio: boolean;
	background: { type: "color"; color: string } | { type: "blur"; blurIntensity: number };
	media: RemotionMediaSource[];
	visual: RemotionVisualElement[];
	audio: RemotionAudioElement[];
	warnings: string[];
};

export type RemotionRenderJobStatus =
	| "queued"
	| "running"
	| "succeeded"
	| "failed"
	| "cancelled";

export type RemotionRenderJob = {
	id: string;
	projectId: string;
	status: RemotionRenderJobStatus;
	progress: number;
	step: string;
	error: string | null;
	warnings: string[];
	createdAt: string;
	updatedAt: string;
	startedAt: string | null;
	finishedAt: string | null;
	downloadUrl: string | null;
};
